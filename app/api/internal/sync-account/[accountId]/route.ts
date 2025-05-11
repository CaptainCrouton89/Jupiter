import { createNewSupabaseAdminClient } from "@/lib/auth/admin"; // Corrected import path
import { decrypt } from "@/lib/auth/encryption"; // Real decrypt
import { Database } from "@/lib/database.types";
import { fetchAndParseEmails, ParsedEmailData } from "@/lib/email/parseEmail"; // Added import, ensured ParsedEmailData is imported
import {
  evaluateEmailForSpam,
  SpamEvaluationResult,
} from "@/lib/email/spamEvaluator"; // Import spam evaluator
import { storeEmails } from "@/lib/email/storeEmails"; // Added import
import { SupabaseClient } from "@supabase/supabase-js"; // Correct import for SupabaseClient type
import { ImapFlow } from "imapflow"; // Import ImapFlow
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid"; // Import uuid

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
  // await client.mailboxOpen("INBOX"); // MAILBOX IS NOW OPENED/LOCKED BY CALLER

  // Construct the search query object based on imapflow documentation
  const query: any = {}; // Using 'any' for flexibility, but should match ImapFlow.SearchObject
  if (lastSyncedUid > 0) {
    query.uid = `${lastSyncedUid + 1}:*`;
  } else {
    query.all = true; // Fetches all messages if no lastSyncedUid
  }
  logger.info(`IMAP search query object: ${JSON.stringify(query)}`);

  // Fetch UIDs and sort them immediately to ensure they are processed in order
  // The second argument { uid: true } ensures UIDs are returned.
  let uids = await client.search(query, { uid: true });
  logger.info(
    `Raw UIDs from search: ${
      Array.isArray(uids) ? uids.join(", ") : "Not an array or empty"
    }`
  );

  // Ensure uids is an array and sort if it has elements
  if (Array.isArray(uids) && uids.length > 0) {
    uids.sort((a, b) => a - b); // Ensure UIDs are sorted ascending
    logger.info(`Found and sorted UIDs: ${uids.join(", ")}`);
  } else {
    logger.info(`No new UIDs found since: ${lastSyncedUid}`);
    uids = []; // Default to an empty array if no UIDs are found or if not an array
  }
  return uids;
}

const RATE_LIMIT_DELAY_MS = 200; // Example: 200ms delay after processing a batch

export async function POST(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;
  const supabase = await createNewSupabaseAdminClient();
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
    let mailboxLock: Awaited<ReturnType<ImapFlow["getMailboxLock"]>> | null =
      null;
    let newUids: number[] = [];
    let processedEmailsCount = 0;
    let failedEmailsCount = 0;
    let maxUidProcessed = account.last_synced_uid || 0;

    try {
      // Update sync log: fetching UIDs
      await supabase
        .from("sync_logs")
        .update({
          status: "fetching_uids",
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", jobId);

      imapClient = new ImapFlow({
        host: account.imap_host,
        port: account.imap_port,
        secure: account.imap_port === 993, // Set secure based on port; true for 993 (IMAPS), false otherwise (for STARTTLS)
        auth: {
          user: account.email, // Assuming the email is the username for IMAP
          pass: decryptedPassword,
        },
        logger: console, // ENABLE VERBOSE LOGGING
      });

      logger.info(`Attempting IMAP connection for ${account.email}...`); // Changed from console.log
      await imapClient.connect();
      logger.info(`IMAP connection successful for ${account.email}.`); // Changed from console.log

      // Acquire mailbox lock
      logger.info(
        `Attempting to get mailbox lock for 'INBOX' for ${account.email}...`
      );
      mailboxLock = await imapClient.getMailboxLock("INBOX");
      logger.info(`Mailbox 'INBOX' selected and locked for ${account.email}.`);

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
        const parsedEmailsInBatch = await fetchAndParseEmails(
          imapClient,
          newUids,
          10
        ); // Batch size 10

        if (parsedEmailsInBatch.length > 0) {
          logger.info(
            `Processing ${parsedEmailsInBatch.length} parsed emails for spam and storage...`
          );

          const inboxEmails: ParsedEmailData[] = [];
          const spamEmails: ParsedEmailData[] = [];

          for (const parsedEmail of parsedEmailsInBatch) {
            // Evaluate for Spam
            const spamEvaluationInput = {
              from: parsedEmail.from,
              subject: parsedEmail.subject,
              textContent: parsedEmail.text,
              htmlContent: parsedEmail.html,
            };
            const spamResult: SpamEvaluationResult = await evaluateEmailForSpam(
              spamEvaluationInput
            );

            logger.info(
              `Email (messageId: ${
                parsedEmail.messageId || "N/A"
              }) for account ${accountId}: Spam Score - ${spamResult.spamScore}`
            );

            if (spamResult.spamScore > 0.7) {
              spamEmails.push(parsedEmail);
            } else {
              inboxEmails.push(parsedEmail);
            }
          }

          let currentBatchProcessedCount = 0;
          let currentBatchFailedCount = 0;
          let uidsSuccessfullyStoredInBatch: number[] = [];

          // Process INBOX emails
          if (inboxEmails.length > 0) {
            const inboxFolderId = await getOrCreateFolderId(
              supabase,
              account.id,
              "INBOX"
            );
            logger.info(
              `Storing ${inboxEmails.length} emails to INBOX (folderId: ${inboxFolderId}) for account ${accountId}`
            );
            const storeResultInbox = await storeEmails(
              supabase,
              account.id,
              inboxEmails, // Correct: 3rd param is the array of emails
              inboxFolderId // Correct: 4th param is the folderId
              // TODO: Add progress callback if storeEmails supports it and it's needed
            );
            currentBatchProcessedCount += storeResultInbox.success;
            currentBatchFailedCount += storeResultInbox.failed;
            if (storeResultInbox.errors.length > 0) {
              logger.error(
                `Errors storing INBOX emails for account ${accountId}:`,
                storeResultInbox.errors
              );
            }
            // Assuming newUids corresponds to parsedEmailsInBatch order and UIDs are needed for tracking.
            // This is a simplification. A robust way is if storeEmail returns the UID or if ParsedEmailData has it.
            if (storeResultInbox.success > 0) {
              // Add UIDs of successfully stored inbox emails. This needs a reliable way to map ParsedEmailData back to its original UID.
              // For simplicity, if some inbox emails are stored, consider UIDs related to inboxEmails as processed.
              // This part is tricky without UIDs on ParsedEmailData.
            }
          }

          // Process SPAM emails
          if (spamEmails.length > 0) {
            const spamFolderId = await getOrCreateFolderId(
              supabase,
              account.id,
              "Spam"
            ); // Or your designated spam folder name
            logger.info(
              `Storing ${spamEmails.length} emails to Spam (folderId: ${spamFolderId}) for account ${accountId}`
            );
            const storeResultSpam = await storeEmails(
              supabase,
              account.id,
              spamEmails, // Correct: 3rd param is the array of emails
              spamFolderId // Correct: 4th param is the folderId
            );
            currentBatchProcessedCount += storeResultSpam.success;
            currentBatchFailedCount += storeResultSpam.failed;
            if (storeResultSpam.errors.length > 0) {
              logger.error(
                `Errors storing SPAM emails for account ${accountId}:`,
                storeResultSpam.errors
              );
            }
            // Similar simplification for UIDs of spam emails.
          }

          processedEmailsCount += currentBatchProcessedCount;
          failedEmailsCount += currentBatchFailedCount;

          logger.info(
            `Email storage for batch complete. Success: ${currentBatchProcessedCount}, Failed: ${currentBatchFailedCount}`
          );

          // Update sync_logs with processed count for this batch
          // The uids_processed_count in sync_logs should be cumulative for the job.
          await supabase
            .from("sync_logs")
            .update({
              // Increment uids_processed_count by emails processed in this batch
              // This requires fetching the current value or using a Supabase function for atomic increment.
              // For simplicity, let's just set the total processed so far in the job.
              uids_processed_count: processedEmailsCount,
              updated_at: new Date().toISOString(),
            })
            .eq("job_id", jobId);

          // Update last_synced_uid with the maximum UID from the *original newUids batch*
          // if any emails in this batch were successfully processed.
          // newUids are sorted.
          if (currentBatchProcessedCount > 0 && newUids.length > 0) {
            const highestUidInThisBatch = newUids[newUids.length - 1]; //This assumes the current batch of newUids corresponds to this processing
            if (highestUidInThisBatch > maxUidProcessed) {
              maxUidProcessed = highestUidInThisBatch;
            }
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
      // Ensure the lock is released and client is logged out
      if (mailboxLock) {
        try {
          await mailboxLock.release();
          logger.info(
            `Mailbox 'INBOX' lock released in finally block for ${account.email}.`
          );
        } catch (releaseError) {
          logger.error(
            "Error releasing mailbox lock in finally block:",
            releaseError
          );
        }
      }
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
