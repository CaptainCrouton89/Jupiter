import { decrypt } from "@/lib/auth/encryption";
import { createClient } from "@/lib/auth/server";
import { fetchAndParseEmail } from "@/lib/email/parseEmail";
import { ImapFlow } from "imapflow";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ accountId: string; uid: string }> }
) {
  const supabase = await createClient();
  const { accountId, uid } = await context.params;

  if (!accountId || !uid) {
    return NextResponse.json(
      { error: "Account ID and UID are required" },
      { status: 400 }
    );
  }

  // Check authorization
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify the account exists and belongs to the user
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("email, password_encrypted, imap_host, imap_port")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: "Email account not found or access denied" },
        { status: 404 }
      );
    }

    // Decrypt password
    const password = decrypt(account.password_encrypted);

    // Connect to IMAP server
    const client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: true, // Assume secure connection
      auth: {
        user: account.email,
        pass: password,
      },
      logger: console, // DEBUG: Pass console object for imapflow logging
    });

    try {
      // Connect and open INBOX
      await client.connect();
      await client.mailboxOpen("INBOX");

      // Fetch and parse the email with the given UID
      const emailData = await fetchAndParseEmail(client, parseInt(uid, 10));

      // Return the parsed email data
      return NextResponse.json({
        success: true,
        email: {
          // Include only essential fields to keep response size reasonable
          messageId: emailData.messageId,
          subject: emailData.subject,
          from: emailData.from,
          to: emailData.to,
          cc: emailData.cc,
          date: emailData.date,
          hasHtml: !!emailData.html,
          hasText: !!emailData.text,
          attachmentCount: emailData.attachments.length,
          attachments: emailData.attachments.map((att) => ({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
          })),
        },
      });
    } finally {
      // Ensure the client is properly closed
      try {
        await client.logout();
      } catch (e) {
        console.error("Error during IMAP logout:", e);
      }
    }
  } catch (error) {
    console.error("Error fetching and parsing email:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch and parse email",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
