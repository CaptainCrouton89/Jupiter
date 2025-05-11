import { NextResponse } from "next/server";
// Assume Supabase client, logger, and email utility functions are available
// import { createClient } from '@/lib/supabase/server';
// import { logger } from '@/lib/logger';
// import { getEmailCredentials } from '@/lib/email/credentials'; // Assuming this exists
// import { fetchNewEmailUids } from '@/lib/email/fetchEmails'; // To be created/updated
// import { fetchAndParseEmail } from '@/lib/email/parseEmail';
// import { storeEmail, assignConversationId } from '@/lib/email/storeEmails';

// Placeholders for now
const supabase_placeholder = {
  from: (table: string) => ({
    select: (columns: string) => ({
      eq: (column: string, value: any) =>
        Promise.resolve({
          data: {
            id: value,
            email: "test@example.com",
            last_synced_uid: 0,
            last_synced_at: null,
          },
          error: null as { message: string } | null,
        }),
    }),
    update: (data: any) => ({
      eq: (column: string, value: any) => Promise.resolve({ error: null }),
    }),
  }),
};
const logger_placeholder = {
  info: (...args: any[]) => console.log(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};
const getEmailCredentials_placeholder = (accountId: string) =>
  Promise.resolve({
    imap_host: "host",
    username: "user",
    password_encrypted: "pass",
  });
const fetchNewEmailUids_placeholder = (
  creds: any,
  lastUid: number,
  lastDate?: string | null
) => Promise.resolve([1, 2, 3]);
const fetchAndParseEmail_placeholder = (creds: any, uid: number) =>
  Promise.resolve({
    messageId: `msg-${uid}`,
    subject: "Test",
    isRead: false,
    attachments: [],
    from: { address: "f@e.com" },
    to: [],
    cc: [],
    bcc: [],
    headers: {},
  });
const storeEmail_placeholder = (
  supabase: any,
  parsedEmail: any,
  accountId: string
) =>
  Promise.resolve({
    success: true,
    emailId: `email-${parsedEmail.messageId}`,
    error: null,
  });
const assignConversationId_placeholder = (
  supabase: any,
  emailId: string,
  headers: any
) => Promise.resolve({ success: true });

export const maxDuration = 240; // 4 minutes max for single account sync

export async function POST(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  const accountId = params.accountId;
  // const supabase = createClient();
  // const logger = logger_placeholder;
  const supabase = supabase_placeholder;
  const logger = logger_placeholder;
  const getEmailCredentials = getEmailCredentials_placeholder;
  const fetchNewEmailUids = fetchNewEmailUids_placeholder;
  const fetchAndParseEmail = fetchAndParseEmail_placeholder;
  const storeEmail = storeEmail_placeholder;
  const assignConversationId = assignConversationId_placeholder;

  logger.info(`Sync request received for account: ${accountId}`);

  // Verify internal API secret (passed from the main cron job)
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  if (token !== process.env.INTERNAL_API_SECRET) {
    logger.warn(`Unauthorized sync attempt for account: ${accountId}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get account details including last sync info
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("id, email, last_synced_uid, last_synced_at") // Ensure these fields exist
      .eq("id", accountId);
    // .single(); // .single() should be chained if fetching one record

    // The placeholder needs to be adjusted if .single() is used.
    // For now, assume select().eq() returns the single object or an array with one item.
    // Let's simulate that the direct result of .eq() is the object we need for the placeholder.

    if (accountError || !account) {
      logger.error(
        `Account not found or error fetching account ${accountId}:`,
        accountError
      );
      throw new Error(
        `Account not found or error: ${
          accountError?.message || "Unknown error"
        }`
      );
    }
    logger.info(
      `Account details fetched for ${account.email}. Last synced UID: ${account.last_synced_uid}, Last synced at: ${account.last_synced_at}`
    );

    // 2. Get email credentials (decrypt password, etc.)
    const credentials = await getEmailCredentials(accountId);
    if (!credentials) {
      logger.error(`Failed to retrieve credentials for account ${accountId}`);
      throw new Error("Credentials not found.");
    }

    // 3. Fetch new email UIDs since last sync
    const lastSyncedUid = account.last_synced_uid || 0;
    const lastSyncedAt = account.last_synced_at; // This might be null

    logger.info(
      `Fetching new emails for account ${account.email} since UID ${lastSyncedUid}`
    );
    const newUids = await fetchNewEmailUids(
      credentials,
      lastSyncedUid,
      lastSyncedAt
    );

    if (newUids.length === 0) {
      logger.info(`No new emails for account ${account.email}`);
      // Optionally, update last_synced_at here if desired even if no new emails
      await supabase
        .from("email_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", accountId);
      return NextResponse.json({
        success: true,
        message: "No new emails to sync.",
        newEmails: 0,
      });
    }

    logger.info(
      `Found ${newUids.length} new emails for account ${
        account.email
      }. UIDs: ${newUids.join(", ")}`
    );

    let processedCount = 0;
    let currentHighestUid = lastSyncedUid;
    const batchSize = 10; // Process in smaller batches

    for (let i = 0; i < newUids.length; i += batchSize) {
      const batchUids = newUids.slice(i, i + batchSize);
      logger.info(
        `Processing batch for account ${accountId}: UIDs ${batchUids.join(
          ", "
        )}`
      );

      const batchResults = await Promise.allSettled(
        batchUids.map(async (uid) => {
          try {
            const parsedEmail = await fetchAndParseEmail(credentials, uid);
            // Ensure parsedEmail has all necessary fields for storeEmail and assignConversationId
            const {
              success: storeSuccess,
              emailId,
              error: storeError,
            } = await storeEmail(supabase, parsedEmail, accountId);

            if (!storeSuccess || !emailId) {
              throw new Error(
                `Failed to store email UID ${uid}: ${
                  storeError || "Unknown store error"
                }`
              );
            }

            // Pass necessary headers from parsedEmail to assignConversationId
            await assignConversationId(supabase, emailId, parsedEmail.headers);

            currentHighestUid = Math.max(currentHighestUid, uid);
            return { uid, status: "success" };
          } catch (emailError: any) {
            logger.error(
              `Error processing email UID ${uid} for account ${accountId}:`,
              emailError.message
            );
            return { uid, status: "failed", error: emailError.message };
          }
        })
      );

      processedCount += batchResults.filter(
        (r) => r.status === "fulfilled" && r.value.status === "success"
      ).length;

      // Update sync info (last_synced_uid, last_synced_at) in DB for the account
      await supabase
        .from("email_accounts")
        .update({
          last_synced_uid: currentHighestUid,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", accountId);
      logger.info(
        `Batch processed for account ${accountId}. Current highest UID: ${currentHighestUid}`
      );
    }

    logger.info(
      `Sync completed for account ${accountId}. Processed ${processedCount} new emails.`
    );
    return NextResponse.json({
      success: true,
      accountId,
      totalNewEmails: newUids.length,
      processedEmails: processedCount,
      highestUidProcessed: currentHighestUid,
    });
  } catch (error: any) {
    logger.error(`Sync failed for account ${accountId}:`, error.message);
    return NextResponse.json(
      { error: `Sync failed for account ${accountId}`, details: error.message },
      { status: 500 }
    );
  }
}
