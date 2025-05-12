import { createClient } from "@/lib/auth/server";
import { getConnectedImapClient } from "@/lib/email/imapService";
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

  // 1. Check authorization & verify account ownership by the logged-in user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the account belongs to the user before attempting to connect via service
  const { data: initialAccountCheck, error: checkError } = await supabase
    .from("email_accounts")
    .select("id, user_id") // Select minimal fields for check
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (checkError || !initialAccountCheck) {
    return NextResponse.json(
      { error: "Email account not found or access denied for this user." },
      { status: 404 }
    );
  }

  let imapClient: ImapFlow | null = null; // For the finally block

  try {
    // 2. Get connected client using the new service
    // The service handles fetching the full account details for connection (including tokens/passwords)
    const { client: connectedClient, accountDetails } =
      await getConnectedImapClient(accountId, supabase);
    imapClient = connectedClient;

    console.log(
      `[ParseEmailRoute] Successfully connected for account ${accountDetails.email} via ImapService`
    );

    // 3. Open INBOX (client is already connected by the service)
    // The service should ideally return a client that is ready or has methods to easily prepare it.
    // For now, let's assume getConnectedImapClient returns a connected client but not necessarily with INBOX open.
    // If mailboxOpen is specific to the task, it should be done here.
    await imapClient.mailboxOpen("INBOX");

    // 4. Fetch and parse the email with the given UID
    const emailData = await fetchAndParseEmail(
      imapClient,
      parseInt(uid, 10),
      console // Pass a logger if fetchAndParseEmail uses one
    );

    // 5. Return the parsed email data
    return NextResponse.json({
      success: true,
      email: {
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
  } catch (error) {
    console.error(
      `[ParseEmailRoute] Error fetching and parsing email for account ${accountId}, UID ${uid}:`,
      error
    );
    return NextResponse.json(
      {
        error: "Failed to fetch and parse email",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    if (imapClient) {
      try {
        await imapClient.logout();
        console.log(
          `[ParseEmailRoute] Disconnected from IMAP server for account ${accountId}`
        );
      } catch (e) {
        console.error("[ParseEmailRoute] Error during IMAP logout:", e);
      }
    }
  }
}
