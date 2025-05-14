import {
  closeImapClient,
  fetchNewEmailUids,
  getMailboxLock,
} from "@/app/api/internal/sync-account/[accountId]/imapOps";
import { encrypt } from "@/lib/auth/encryption";
import { createClient } from "@/lib/auth/server";
import type { Database } from "@/lib/database.types";
import { getConnectedImapClient } from "@/lib/email/imapService";
import { emailConnectionSchema } from "@/lib/validations/email";
import type { ImapFlow } from "imapflow";
import { NextRequest, NextResponse } from "next/server";
// import { supabaseAdmin } from '@/lib/supabaseAdmin'; // Only if RLS becomes an issue for user client

// This type can be removed if EmailConnectionFormValues is directly used and mapped
// interface EmailAccountInsert extends Omit<EmailConnectionFormValues, 'password'> {
//   user_id: string;
//   password_encrypted: string;
// }

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsedBody = emailConnectionSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: parsedBody.error.format() },
        { status: 400 }
      );
    }

    const {
      emailAddress,
      password, // Plain text password from form
      imapServer,
      imapPort,
      smtpServer,
      smtpPort,
      security, // This is parsed from the form but may not be saved if no column exists
      accountName,
    } = parsedBody.data;

    const password_encrypted = encrypt(password);

    // Ensure this object matches the structure of Database['public']['Tables']['email_accounts']['Insert']
    // from your newly regenerated lib/database.types.ts
    const dbInsertData: Database["public"]["Tables"]["email_accounts"]["Insert"] =
      {
        username: accountName || emailAddress,
        user_id: user.id,
        email: emailAddress,
        password_encrypted,
        imap_host: imapServer,
        imap_port: imapPort,
        smtp_host: smtpServer,
        smtp_port: smtpPort,
        provider: "custom",
      };

    const { data, error } = await supabase
      .from("email_accounts")
      .insert([dbInsertData])
      .select()
      .single();

    if (error) {
      console.error("Error saving email account:", error);
      if (error.code === "23505") {
        return NextResponse.json(
          { message: "This email account is already connected." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { message: "Failed to save email account", error: error.message },
        { status: 500 }
      );
    }

    // Successfully saved the account, now try to set initial last_synced_uid
    if (data && data.id) {
      const newAccountId = data.id;
      let imapClient: ImapFlow | null = null;
      let mailboxLock: Awaited<ReturnType<ImapFlow["getMailboxLock"]>> | null =
        null;
      let accountEmailForImap = data.email; // email from the saved data

      try {
        console.log(
          `Attempting to fetch initial UID for new account ${newAccountId} (${accountEmailForImap})`
        );
        const { client: connectedClient, accountDetails } =
          await getConnectedImapClient(newAccountId, supabase);
        imapClient = connectedClient;
        accountEmailForImap = accountDetails.email; // Use email from accountDetails for accuracy in logs

        mailboxLock = await getMailboxLock(
          imapClient,
          "INBOX",
          accountEmailForImap
        );
        const latestUids = await fetchNewEmailUids(imapClient, 0);
        const initialLastSyncedUid = latestUids.length > 0 ? latestUids[0] : 0;

        console.log(
          `Fetched initialLastSyncedUid: ${initialLastSyncedUid} for account ${newAccountId}`
        );

        const { error: updateError } = await supabase
          .from("email_accounts")
          .update({ last_synced_uid: initialLastSyncedUid })
          .eq("id", newAccountId);

        if (updateError) {
          console.error(
            `Failed to update last_synced_uid for account ${newAccountId}:`,
            updateError
          );
        } else {
          console.log(
            `Successfully updated last_synced_uid for account ${newAccountId}`
          );
        }
      } catch (uidError: any) {
        console.error(
          `Error fetching initial UID for account ${newAccountId}: ${uidError.message}`,
          uidError
        );
        // Do not throw, account is already saved. This is a best-effort enhancement.
      } finally {
        if (imapClient) {
          await closeImapClient(imapClient, accountEmailForImap, mailboxLock);
        }
      }
    }

    return NextResponse.json(
      { success: true, message: "Email account connected successfully!", data },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Save Account API Error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
