import { decrypt } from "@/lib/auth/encryption";
import { getServerSession } from "@/lib/auth/server"; // Updated imports
import type { Database } from "@/lib/database.types"; // Ensure correct path and import type
import { ImapFlow } from "imapflow";
import { NextResponse } from "next/server";

// Corresponds to EmailDetails in app/(dashboard)/[folder]/[id]/page.tsx
// but we'll fetch based on what's in the 'emails' and 'attachments' tables.
interface FetchedEmailDetails {
  id: string;
  subject: string | null;
  fromName: string | null; // from 'emails' table
  fromEmail: string; // from 'emails' table
  // For 'to', 'cc', 'bcc' - these are not directly on the 'emails' table per storeEmail.ts
  // We'll need to derive them or add them to the schema later.
  // For now, the EmailViewPage will handle their absence or use placeholders.
  bodyHtml: string | null; // from 'emails' table
  receivedAt: string; // from 'emails' table (should be ISO string)
  attachments: {
    name: string;
    size: number | null;
    type: string | null;
    url: string;
  }[]; // from 'attachments' table
}

// Define a more specific type for what we expect from the attachments query
type AttachmentRow = Database["public"]["Tables"]["attachments"]["Row"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: emailId } = await params;

  if (!emailId) {
    return NextResponse.json(
      { error: "Email ID is required" },
      { status: 400 }
    );
  }

  try {
    const { user, supabase } = await getServerSession(); // Use getServerSession
    // const supabase = await createClient(); // Or create client separately if session isn't needed immediately for other logic

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: email, error } = await supabase // Use the supabase instance from getServerSession
      .from("emails")
      .select(
        `
        *,
        attachments (
          id,
          filename,
          content_type,
          size,
          storage_path
        )
      `
      )
      .eq("id", emailId)
      // Ensure RLS policies on 'emails' and 'email_accounts' correctly restrict access to user's own data.
      // The user_id from the session can be used by RLS.
      .single();

    if (error) {
      console.error("Error fetching email:", error);
      if (error.code === "PGRST116") {
        // Not found
        return NextResponse.json({ error: "Email not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to fetch email" },
        { status: 500 }
      );
    }

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    return NextResponse.json(email);
  } catch (err) {
    console.error("Unexpected error fetching email:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: emailId } = await params;
  const { read } = await request.json(); // Expecting { read: boolean }

  if (!emailId) {
    return NextResponse.json(
      { error: "Email ID is required" },
      { status: 400 }
    );
  }
  if (typeof read !== "boolean") {
    return NextResponse.json(
      { error: "'read' status (boolean) is required in the request body" },
      { status: 400 }
    );
  }

  let imapSyncStatus: "success" | "failed" | "skipped" = "skipped";
  let imapSyncError: string | null = null;

  try {
    const { user, supabase } = await getServerSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First, verify the user has access to this email via RLS.
    // This also confirms the email exists before attempting an update.
    // We select all fields needed for the IMAP operation and the final response.
    const { data: emailDataFromDb, error: fetchError } = await supabase
      .from("emails")
      .select("id, read, updated_at, account_id, imap_uid, folder_id")
      .eq("id", emailId)
      .single();

    if (fetchError || !emailDataFromDb) {
      if (fetchError && fetchError.code === "PGRST116") {
        return NextResponse.json({ error: "Email not found" }, { status: 404 });
      }
      console.error(
        "Error fetching email for status update (pre-check):",
        fetchError
      );
      return NextResponse.json(
        { error: "Failed to verify email before update" },
        { status: 500 }
      );
    }

    // Update the email read status in the database
    const { data: updatedEmail, error: updateError } = await supabase
      .from("emails")
      .update({ read: read, updated_at: new Date().toISOString() })
      .eq("id", emailId)
      .select("id, read, updated_at") // Select fields for the primary response
      .single();

    if (updateError) {
      console.error("Error updating email read status in DB:", updateError);
      return NextResponse.json(
        { error: "Failed to update email status in DB" },
        { status: 500 }
      );
    }

    if (!updatedEmail) {
      return NextResponse.json(
        { error: "Email not found after DB update attempt" },
        { status: 404 }
      );
    }

    // Proceed with IMAP sync if possible
    if (
      emailDataFromDb.imap_uid &&
      emailDataFromDb.account_id &&
      emailDataFromDb.folder_id
    ) {
      try {
        const { data: accountDetails, error: accountErr } = await supabase
          .from("email_accounts")
          .select("username, password_encrypted, imap_host, imap_port")
          .eq("id", emailDataFromDb.account_id)
          .eq("user_id", user.id)
          .single();

        if (accountErr || !accountDetails) {
          throw new Error(
            `Failed to fetch account details for IMAP: ${
              accountErr?.message || "not found"
            }`
          );
        }

        const { data: folderDetails, error: folderErr } = await supabase
          .from("folders")
          .select("name") // 'name' is the IMAP path
          .eq("id", emailDataFromDb.folder_id)
          .single();

        if (folderErr || !folderDetails || !folderDetails.name) {
          throw new Error(
            `Failed to fetch folder path for IMAP: ${
              folderErr?.message || "not found or name missing"
            }`
          );
        }

        const imapPassword = decrypt(accountDetails.password_encrypted);
        const imapFolderPath = folderDetails.name;

        if (
          !accountDetails.imap_host ||
          !accountDetails.imap_port ||
          !imapPassword ||
          !accountDetails.username
        ) {
          throw new Error("Incomplete IMAP account credentials or details.");
        }

        const imapClient = new ImapFlow({
          host: accountDetails.imap_host,
          port: accountDetails.imap_port,
          secure: accountDetails.imap_port === 993, // Common practice: port 993 is IMAPS
          auth: {
            user: accountDetails.username,
            pass: imapPassword,
          },
          logger: {
            // Basic console logging for IMAP operations, can be enhanced
            info: (msg) => console.log("[IMAP INFO]", msg),
            warn: (msg) => console.warn("[IMAP WARN]", msg),
            error: (err) => console.error("[IMAP ERROR]", err),
            debug: (obj) => console.debug("[IMAP DEBUG]", obj),
          },
          disableAutoIdle: true,
        });

        let mailboxLock;
        try {
          await imapClient.connect();
          console.log(
            `IMAP: Connected to ${accountDetails.imap_host} for user ${accountDetails.username}`
          );
          mailboxLock = await imapClient.getMailboxLock(imapFolderPath);
          console.log(`IMAP: Mailbox '${imapFolderPath}' locked.`);

          const targetUid = emailDataFromDb.imap_uid; // Already a string or null

          if (!targetUid) {
            // Ensure targetUid is not null before using
            throw new Error("IMAP UID is null, cannot set flags.");
          }

          if (read) {
            await imapClient.messageFlagsAdd(targetUid, ["\\Seen"], {
              uid: true,
            });
            console.log(
              `IMAP: Flagged UID ${targetUid} as \\Seen in ${imapFolderPath}`
            );
          } else {
            await imapClient.messageFlagsRemove(targetUid, ["\\Seen"], {
              uid: true,
            });
            console.log(
              `IMAP: Removed \\Seen flag for UID ${targetUid} in ${imapFolderPath}`
            );
          }
          imapSyncStatus = "success";
        } catch (imapOpErr: any) {
          console.error(
            `IMAP operation failed for email ${emailId}, UID ${emailDataFromDb.imap_uid}:`,
            imapOpErr
          );
          imapSyncStatus = "failed";
          imapSyncError = imapOpErr.message || "Unknown IMAP operation error";
        } finally {
          if (mailboxLock) {
            try {
              await mailboxLock.release();
              console.log(`IMAP: Mailbox '${imapFolderPath}' lock released.`);
            } catch (releaseErr) {
              console.error("IMAP: Error releasing mailbox lock:", releaseErr);
            }
          }
          if (imapClient.usable) {
            try {
              await imapClient.logout();
              console.log(`IMAP: Logged out from ${accountDetails.imap_host}`);
            } catch (logoutErr) {
              console.error("IMAP: Error logging out:", logoutErr);
            }
          }
        }
      } catch (syncSetupError: any) {
        console.error(
          `IMAP sync setup error for email ${emailId}:`,
          syncSetupError
        );
        imapSyncStatus = "failed";
        imapSyncError =
          syncSetupError.message || "Unknown IMAP sync setup error";
      }
    } else {
      console.warn(
        `Skipping IMAP sync for email ${emailId}: imap_uid, account_id, or folder_id missing.`
      );
      imapSyncError =
        "IMAP UID, account ID, or folder ID missing from email record.";
      // imapSyncStatus remains "skipped"
    }

    return NextResponse.json({
      id: updatedEmail.id,
      read: updatedEmail.read,
      updated_at: updatedEmail.updated_at,
      imap_sync_status: imapSyncStatus,
      imap_sync_error: imapSyncError,
    });
  } catch (err: any) {
    console.error(
      `Unexpected error in PATCH /api/email/message/${emailId}:`,
      err
    );
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        message: err.message,
        imap_sync_status: "failed",
        imap_sync_error: err.message,
      },
      { status: 500 }
    );
  }
}
