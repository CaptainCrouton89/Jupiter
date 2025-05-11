import { decrypt } from "@/lib/auth/encryption"; // Real decrypt
import { createClient } from "@/lib/auth/server"; // Corrected import path
import { Database } from "@/lib/database.types";
import { fetchAndParseEmails } from "@/lib/email/parseEmail"; // Added import
import { storeEmails } from "@/lib/email/storeEmails"; // Added import
import { SupabaseClient } from "@supabase/supabase-js"; // Correct import for SupabaseClient type
import { ImapFlow } from "imapflow"; // Import ImapFlow
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid"; // Import uuid
// Assuming ParsedEmailData might be needed for typing if not inferred
// import { ParsedEmailData } from "@/lib/email/parseEmail";

// Remove all placeholder functions and supabase_placeholder, logger_placeholder

const logger = {
  // Simple console logger for now
  info: (...args: any[]) => console.log("[SYNC_ACCOUNT_INFO]", ...args),
  warn: (...args: any[]) => console.warn("[SYNC_ACCOUNT_WARN]", ...args),
  error: (...args: any[]) => console.error("[SYNC_ACCOUNT_ERROR]", ...args),
};

export const maxDuration = 300; // 5 minutes max for single account sync, increased slightly

interface EmailAccountDetails {
  id: string;
  email: string;
  imap_host: string;
  imap_port: number;
  password_encrypted: string;
  last_synced_uid: number | null;
  last_synced_at: string | null;
  user_id: string; // Added user_id
}

async function getEmailAccountDetails(
  supabase: SupabaseClient<Database>,
  accountId: string
): Promise<EmailAccountDetails | null> {
  const { data, error } = await supabase
    .from("email_accounts")
    .select(
      "id, email, imap_host, imap_port, password_encrypted, last_synced_uid, last_synced_at, user_id"
    )
    .eq("id", accountId)
    .single<EmailAccountDetails>(); // Specify the expected return type for single()

  console.log("data", data);
  console.log("error", error);

  if (error) {
    logger.error(
      `Error fetching email account details for ${accountId}:`,
      error.message
    );
    return null;
  }
  return data;
}

// Helper function to get or create folder_id
async function getOrCreateFolderId(
  supabase: SupabaseClient<Database>,
  accountId: string,
  folderPath: string
): Promise<string> {
  // Check if folder exists
  let { data: existingFolder, error: fetchError } = await supabase
    .from("folders")
    .select("id")
    .eq("account_id", accountId)
    .eq("name", folderPath) // Assuming 'name' column stores the IMAP path
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116: "Searched for a single row, but 0 rows were found"
    logger.error(
      `Error fetching folder ${folderPath} for account ${accountId}:`,
      fetchError.message
    );
    throw new Error(
      `Failed to fetch folder ${folderPath}: ${fetchError.message}`
    );
  }

  if (existingFolder) {
    return existingFolder.id;
  }

  // Folder does not exist, create it
  const newFolderId = uuidv4();
  const { data: newFolder, error: insertError } = await supabase
    .from("folders")
    .insert({
      id: newFolderId,
      account_id: accountId,
      name: folderPath, // IMAP path
      type: "inbox", // Changed from "mailbox" to "inbox" based on user's check constraint
    })
    .select("id")
    .single();

  if (insertError) {
    logger.error(
      `Error creating folder ${folderPath} for account ${accountId}:`,
      insertError.message
    );
    throw new Error(
      `Failed to create folder ${folderPath}: ${insertError.message}`
    );
  }

  if (!newFolder) {
    logger.error(
      `Failed to create folder ${folderPath} for account ${accountId} - no data returned after insert.`
    );
    throw new Error(
      `Failed to create folder ${folderPath} - no data returned.`
    );
  }
  logger.info(
    `Created folder ${folderPath} with ID ${newFolder.id} for account ${accountId}`
  );
  return newFolder.id;
}

// Placeholder for a potential helper function to get new UIDs
// Actual implementation would involve checking last_synced_uid from DB
// and then fetching UIDs greater than that from IMAP server.
async function fetchNewEmailUids(
  client: ImapFlow,
  lastSyncedUid: number = 0
): Promise<number[]> {
  // Example: Fetch UIDs for all messages if no lastSyncedUid, or newer ones
  // This is a simplified placeholder. Real implementation needs to be robust.
  logger.info(`Fetching UIDs since: ${lastSyncedUid}`); // Changed from console.log
  await client.mailboxOpen("INBOX");
  const searchCriteria =
    lastSyncedUid > 0 ? `UID ${lastSyncedUid + 1}:*` : "1:*";
  // Fetch UIDs and sort them immediately to ensure they are processed in order
  const uids = await client.search({ uid: searchCriteria });
  uids.sort((a, b) => a - b); // Ensure UIDs are sorted ascending
  logger.info(`Found UIDs: ${uids.join(", ")}`); // Changed from console.log
  return uids;
}

const RATE_LIMIT_DELAY_MS = 200; // Example: 200ms delay after processing a batch

export async function POST(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  const { accountId } = params;
  const supabase = await createClient();
  const jobId = uuidv4(); // Unique ID for this sync run

  // Log start of sync job
  await supabase.from("sync_logs").insert({
    job_id: jobId,
    account_id: accountId,
    status: "started",
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!accountId) {
    await supabase
      .from("sync_logs")
      .update({
        status: "failed",
        error_message: "Account ID is required",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", jobId);
    return NextResponse.json(
      { error: "Account ID is required" },
      { status: 400 }
    );
  }

  // Note: createClient() from @/lib/auth/server typically handles session/cookie stuff itself.
  // If this is an internal API route called by a cron job, it might not have a user session.
  // For now, assuming createClient() can be used to get a Supabase admin-like client or a service role client.

  try {
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (accountError) {
      console.error(`Error fetching account ${accountId}:`, accountError);
      if (accountError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          error: "Failed to fetch account details",
          details: accountError.message,
        },
        { status: 500 }
      );
    }

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Ensure password_encrypted exists and is a string before trying to decrypt
    if (
      !account.password_encrypted ||
      typeof account.password_encrypted !== "string"
    ) {
      return NextResponse.json(
        { error: "Encrypted password not found or invalid for account" },
        { status: 500 }
      );
    }

    let decryptedPassword = "";
    try {
      decryptedPassword = decrypt(account.password_encrypted);
    } catch (decryptionError: any) {
      console.error(
        `Error decrypting password for account ${accountId}:`,
        decryptionError
      );
      return NextResponse.json(
        {
          error: "Failed to decrypt password",
          details: decryptionError.message,
        },
        { status: 500 }
      );
    }

    if (!decryptedPassword) {
      return NextResponse.json(
        { error: "Decrypted password is empty" },
        { status: 500 }
      );
    }

    console.log(
      `Successfully fetched and decrypted credentials for account: ${account.email}`
    );
    // console.log(`Decrypted Password: ${decryptedPassword}`); // Avoid logging sensitive data

    // Subtask 12.2: Implement IMAP Connection and UID Fetching
    let imapClient: ImapFlow | null = null;
    let newUids: number[] = [];
    let processedEmailsCount = 0;
    let failedEmailsCount = 0;
    let maxUidProcessed = account.last_synced_uid || 0;

    try {
      // Update sync log: fetching UIDs
      await supabase
        .from("sync_logs")
        .update({
          status: "in_progress",
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", jobId);

      imapClient = new ImapFlow({
        host: account.imap_host,
        port: account.imap_port,
        secure: true, // Defaulting to true, common for IMAP SSL (e.g., port 993)
        // This might need to be dynamic based on port or a new DB column if STARTTLS is also supported.
        auth: {
          user: account.email, // Assuming the email is the username for IMAP
          pass: decryptedPassword,
        },
        logger: false, // Set to true for detailed IMAP logs if needed
      });

      logger.info(`Attempting IMAP connection for ${account.email}...`); // Changed from console.log
      await imapClient.connect();
      logger.info(`IMAP connection successful for ${account.email}.`); // Changed from console.log

      // Fetch new UIDs
      const lastSyncedUidFromDb = account.last_synced_uid || 0;
      newUids = await fetchNewEmailUids(imapClient, lastSyncedUidFromDb);
      logger.info(
        // Changed from console.log
        `Found ${newUids.length} new email UIDs for account ${account.email}.`
      );

      // Update sync_logs with total UIDs to process
      await supabase
        .from("sync_logs")
        .update({
          total_uids_to_process: newUids.length,
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", jobId);

      // Subtask 12.3 - Implement Email Fetching, Parsing, and Storage Loop (using newUids)
      if (newUids.length > 0) {
        logger.info(`Fetching and parsing ${newUids.length} emails...`);
        const parsedEmails = await fetchAndParseEmails(imapClient, newUids, 10); // Batch size 10

        if (parsedEmails.length > 0) {
          logger.info(`Storing ${parsedEmails.length} parsed emails...`);
          const inboxFolderId = await getOrCreateFolderId(
            supabase,
            account.id,
            "INBOX"
          );
          const storeResult = await storeEmails(
            supabase,
            account.id,
            parsedEmails,
            inboxFolderId,
            (current, total) => {
              logger.info(`Storage progress: ${current}/${total}`);
            }
          );
          processedEmailsCount = storeResult.success;
          failedEmailsCount = storeResult.failed;
          if (storeResult.errors.length > 0) {
            logger.error("Errors during email storage:", storeResult.errors);
          }
          logger.info(
            `Email storage complete. Success: ${processedEmailsCount}, Failed: ${failedEmailsCount}`
          );

          // Update sync_logs with processed count
          await supabase
            .from("sync_logs")
            .update({
              uids_processed_count: processedEmailsCount, // Assuming processedEmailsCount reflects UIDs fully processed
              updated_at: new Date().toISOString(),
            })
            .eq("job_id", jobId);

          // Update last_synced_uid with the maximum UID actually processed and stored successfully
          // This assumes UIDs are processed in order by fetchAndParseEmails and storeEmails
          // and that parsedEmails retains that order.
          // A more robust way would be to track max successful UID within storeEmails or from its results.
          // For now, if any emails were processed, update to the max UID from the fetched batch.
          if (processedEmailsCount > 0) {
            // newUids are sorted ascending, so the last one is the highest.
            maxUidProcessed = newUids[newUids.length - 1];
          }
        } else {
          logger.info(
            "No emails were successfully parsed from the fetched UIDs."
          );
        }

        // Update last_synced_uid and last_synced_at in the database
        if (maxUidProcessed > lastSyncedUidFromDb) {
          // Only update if new emails were processed
          const { error: updateError } = await supabase
            .from("email_accounts")
            .update({
              last_synced_uid: maxUidProcessed,
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", account.id);

          if (updateError) {
            logger.error(
              `Failed to update last_synced_uid for account ${account.id}:`,
              updateError.message
            );
            // Don't let this block the response, but log it.
          } else {
            logger.info(
              `Successfully updated last_synced_uid to ${maxUidProcessed} for account ${account.id}.`
            );
          }
        }
      } else {
        logger.info(
          `No new email UIDs to process for account ${account.email}.`
        );
        await supabase
          .from("sync_logs")
          .update({
            status: "no_new_emails",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("job_id", jobId);
      }

      // If new UIDs were processed, introduce a small delay for rate limiting
      if (newUids.length > 0 && processedEmailsCount > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, RATE_LIMIT_DELAY_MS)
        );
      }

      // Final successful update to sync_logs if not already set to no_new_emails
      const { data: currentLog } = await supabase
        .from("sync_logs")
        .select("status")
        .eq("job_id", jobId)
        .single();
      if (currentLog && currentLog.status !== "no_new_emails") {
        await supabase
          .from("sync_logs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("job_id", jobId);
      }
    } catch (imapError: any) {
      console.error(
        `IMAP operation failed for account ${accountId}:`,
        imapError
      );
      if (imapClient && imapClient.usable) {
        await imapClient
          .logout()
          .catch((logoutErr) =>
            console.error("IMAP logout error during error handling:", logoutErr)
          );
      }
      await supabase
        .from("sync_logs")
        .update({
          status: "failed",
          error_message: imapError.message || "IMAP operation failed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", jobId);
      return NextResponse.json(
        { error: "IMAP operation failed", details: imapError.message },
        { status: 500 }
      );
    } finally {
      if (imapClient && imapClient.usable) {
        logger.info(`Closing IMAP connection for ${account.email}...`); // Changed from console.log
        await imapClient
          .logout()
          .catch((logoutErr) => logger.error("IMAP logout error:", logoutErr)); // Changed from console.error
        logger.info(`IMAP connection closed for ${account.email}.`); // Changed from console.log
      }
    }

    return NextResponse.json({
      message:
        `Sync process completed for account ${accountId}. ` +
        `Fetched UIDs: ${newUids.length}. ` +
        `Successfully processed and stored: ${processedEmailsCount}. ` +
        `Failed to store: ${failedEmailsCount}.`,
      email: account.email,
      newUidsFetched: newUids.length,
      emailsSuccessfullyStored: processedEmailsCount,
      emailsFailedToStore: failedEmailsCount,
      lastUidProcessed: maxUidProcessed,
    });
  } catch (error: any) {
    logger.error(`General error in sync for account ${accountId}:`, error);
    await supabase
      .from("sync_logs")
      .update({
        status: "failed",
        error_message: error.message || "General sync error",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", jobId);
    return NextResponse.json(
      { error: "Failed to sync email account", details: error.message },
      { status: 500 }
    );
  }
}
