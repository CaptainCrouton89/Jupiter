import { createNewSupabaseAdminClient } from "@/lib/auth/admin"; // Corrected import path
import { decrypt } from "@/lib/auth/encryption"; // Real decrypt
import { Database } from "@/lib/database.types";
import {
  categorizeEmail,
  EmailCategorizationResult,
} from "@/lib/email/emailCategorizer"; // Import spam evaluator
import { fetchAndParseEmails, ParsedEmailData } from "@/lib/email/parseEmail"; // Added import, ensured ParsedEmailData is imported
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
  // Add a trace level for very verbose debugging, initially a no-op
  trace: (...args: any[]) => console.log("[SYNC_ACCOUNT_TRACE]", ...args), // Temporarily enable trace for debugging
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

  // console.log("data", data); // Removed direct console.log
  // console.log("error", error); // Removed direct console.log

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
      name: folderPath.toUpperCase(), // IMAP path
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
  logger.info(
    `IMAP search: ${query.uid ? `UIDs ${query.uid}` : "all messages"}`
  );

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

    // Limit to the latest 50 UIDs if more are found
    if (uids.length > 50) {
      uids = uids.slice(-50);
      logger.info(`Limited to the latest 50 UIDs. Count: ${uids.length}`);
    }
  } else {
    logger.info(`No new UIDs found since: ${lastSyncedUid}`);
    uids = []; // Default to an empty array if no UIDs are found or if not an array
  }
  return uids;
}

// Helper function to update sync_logs table
async function updateSyncLog(
  supabase: SupabaseClient<Database>,
  jobId: string,
  status: string,
  errorMessage?: string | null,
  isTerminal: boolean = false,
  processedCount?: number,
  totalToProcess?: number
) {
  const updatePayload: any = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (errorMessage) {
    updatePayload.error_message = errorMessage;
  }
  if (isTerminal) {
    updatePayload.completed_at = new Date().toISOString();
  }
  if (typeof processedCount === "number") {
    updatePayload.uids_processed_count = processedCount;
  }
  if (typeof totalToProcess === "number" && status === "fetching_uids") {
    // Only set total_uids_to_process once
    updatePayload.total_uids_to_process = totalToProcess;
  }

  try {
    const { error } = await supabase
      .from("sync_logs")
      .update(updatePayload)
      .eq("job_id", jobId);
    if (error) {
      logger.error(
        `Failed to update sync_log for job ${jobId} to status ${status}:`,
        error.message
      );
    }
  } catch (e) {
    logger.error(
      `Exception while updating sync_log for job ${jobId} to status ${status}:`,
      e
    );
  }
}

// Helper function to handle sync failures, log them, and return a NextResponse
async function handleSyncFailure(
  supabase: SupabaseClient<Database>,
  logger: any,
  jobId: string,
  error: any,
  httpStatus: number,
  userMessage: string,
  processedCount?: number // Optional: count of items processed before failure
): Promise<NextResponse> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(
    `Sync failure for job ${jobId}: ${userMessage} - Details: ${errorMessage}`
  );
  if (error instanceof Error && error.stack) {
    logger.error("Stack trace:", error.stack);
  }

  await updateSyncLog(
    supabase,
    jobId,
    "failed",
    `${userMessage}: ${errorMessage}`.substring(0, 255), // Ensure error message fits schema
    true, // isTerminal
    processedCount
  );

  return NextResponse.json(
    { error: userMessage, details: errorMessage },
    { status: httpStatus }
  );
}

const RATE_LIMIT_DELAY_MS = 200; // Example: 200ms delay after processing a batch

export async function POST(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;
  const supabase = await createNewSupabaseAdminClient();
  const jobId = uuidv4(); // Unique ID for this sync run
  let processedEmailsCount = 0; // Initialize at a higher scope

  // Log start of sync job
  await supabase.from("sync_logs").insert({
    job_id: jobId,
    account_id: accountId,
    status: "started",
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!accountId) {
    // No need to call updateSyncLog directly, handleSyncFailure will do it.
    return handleSyncFailure(
      supabase,
      logger,
      jobId,
      new Error("Account ID is required"), // Create an error object
      400,
      "Account ID is required"
      // processedEmailsCount is 0 here, so default is fine
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
        await updateSyncLog(
          supabase,
          jobId,
          "failed",
          "Account not found",
          true
        );
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }
      return handleSyncFailure(
        supabase,
        logger,
        jobId,
        accountError,
        500,
        "Failed to fetch account details"
      );
    }

    if (!account) {
      await updateSyncLog(
        supabase,
        jobId,
        "failed",
        "Account not found after successful query (should not happen)",
        true
      );
      return NextResponse.json({ error: "Account not found" }, { status: 404 }); // Or use handleSyncFailure
    }

    // Ensure password_encrypted exists and is a string before trying to decrypt
    if (
      !account.password_encrypted ||
      typeof account.password_encrypted !== "string"
    ) {
      return handleSyncFailure(
        supabase,
        logger,
        jobId,
        new Error("Encrypted password not found or invalid for account"),
        500,
        "Encrypted password not found or invalid for account"
      );
    }

    let decryptedPassword = "";
    try {
      decryptedPassword = decrypt(account.password_encrypted);
    } catch (decryptionError: any) {
      return handleSyncFailure(
        supabase,
        logger,
        jobId,
        decryptionError,
        500,
        "Failed to decrypt password"
      );
    }

    if (!decryptedPassword) {
      return handleSyncFailure(
        supabase,
        logger,
        jobId,
        new Error("Decrypted password is empty"),
        500,
        "Decrypted password is empty"
      );
    }

    logger.info(
      `Successfully fetched and decrypted credentials for account: ${account.email}`
    );

    // Subtask 12.2: Implement IMAP Connection and UID Fetching
    let imapClient: ImapFlow | null = null;
    let mailboxLock: Awaited<ReturnType<ImapFlow["getMailboxLock"]>> | null =
      null;
    let newUids: number[] = [];
    let failedEmailsCount = 0;
    let maxUidProcessed = account.last_synced_uid || 0;

    try {
      // Update sync log: fetching UIDs
      await updateSyncLog(supabase, jobId, "fetching_uids");

      imapClient = new ImapFlow({
        host: account.imap_host,
        port: account.imap_port,
        secure: account.imap_port === 993, // Set secure based on port; true for 993 (IMAPS), false otherwise (for STARTTLS)
        auth: {
          user: account.email, // Assuming the email is the username for IMAP
          pass: decryptedPassword,
        },
        logger: {
          info: () => {}, // No-op for info
          debug: () => {}, // No-op for debug
          warn: (obj) => logger.warn("[IMAP_FLOW_WARN]", JSON.stringify(obj)), // Pass warnings to our logger
          error: (obj) =>
            logger.error("[IMAP_FLOW_ERROR]", JSON.stringify(obj)), // Pass errors to our logger
        },
        disableAutoIdle: true, // Recommended for scripts
      });

      // Log connection attempt
      logger.info(`Attempting IMAP connection for ${account.email}...`);
      await imapClient.connect();
      logger.info(`IMAP connection successful for ${account.email}.`);

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
        `Found ${newUids.length} new email UIDs for account ${account.email}.`
      );

      // Update sync_logs with total UIDs to process
      await updateSyncLog(
        supabase,
        jobId,
        "fetching_uids", // Status remains fetching_uids or could be 'processing_emails'
        null, // No error message
        false, // Not terminal
        undefined, // No processed count yet
        newUids.length // Total to process
      );

      // Subtask 12.3 - Implement Email Fetching, Parsing, and Storage Loop (using newUids)
      if (newUids.length > 0) {
        logger.info(`Fetching and parsing ${newUids.length} emails...`);
        const parsedEmailsInBatch = await fetchAndParseEmails(
          imapClient,
          newUids,
          10, // Batch size
          account.id, // Pass accountId
          logger // Pass logger
        );

        if (parsedEmailsInBatch.length > 0) {
          logger.info(
            `Processing ${parsedEmailsInBatch.length} parsed emails for spam and storage...`
          );

          const inboxEmails: ParsedEmailData[] = [];
          const spamEmails: ParsedEmailData[] = [];

          logger.trace(
            `[SpamDebug] Processing ${parsedEmailsInBatch.length} emails from IMAP batch.`
          );

          for (const parsedEmail of parsedEmailsInBatch) {
            // Evaluate for Spam
            const spamEvaluationInput = {
              from: parsedEmail.from,
              subject: parsedEmail.subject,
              textContent: parsedEmail.text,
              htmlContent: parsedEmail.html,
              headers: parsedEmail.headers,
            };

            const spamResult: EmailCategorizationResult = await categorizeEmail(
              spamEvaluationInput
            );

            logger.info(
              `[CategorizationDebug] Email (MsgID: ${
                parsedEmail.messageId || "N/A"
              }, Subject: "${
                parsedEmail.subject || "N/A"
              }") for account ${accountId}: Category - ${spamResult.category}`
            );

            // Assign the determined category to the parsedEmail object
            parsedEmail.category = spamResult.category;

            if (
              spamResult.category === "newsletter" ||
              spamResult.category === "marketing" ||
              spamResult.category === "receipt" ||
              spamResult.category === "invoice" ||
              spamResult.category === "finances" ||
              spamResult.category === "code-related" ||
              spamResult.category === "notification"
              // Any other categories that should be treated as spam for this purpose
              // For now, let's assume these are the ones that go to the 'Spam' folder conceptually,
              // even if the folder is named 'Spam'.
              // If the intent is *only* for emails categorized by your new system as potential spam going to a spam folder,
              // you might need a specific spam category like 'detected-spam' from emailCategorizer or a flag.
              // Based on current code, these categories are just examples and emails are split into inboxEmails/spamEmails.
              // Let's refine the condition if 'spam' means something very specific.
              // For now, let's assume these categories are what you consider 'spam' for auto-read purposes.
            ) {
              logger.info(
                `[SpamDebug] Classified as SPAM-like for auto-read. MsgID: ${
                  parsedEmail.messageId || "N/A"
                }`
              );
              parsedEmail.isRead = true; // Mark as read if it's going to be treated as spam
              spamEmails.push(parsedEmail);
            } else {
              logger.info(
                `[SpamDebug] Classified as INBOX. MsgID: ${
                  parsedEmail.messageId || "N/A"
                }`
              );
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
              `[SpamDebug] Storing ${
                inboxEmails.length
              } emails to INBOX. Target FolderID: ${inboxFolderId}. MsgIDs: ${inboxEmails
                .map((e) => e.messageId || "N/A")
                .join(", ")}`
            );
            const storeResultInbox = await storeEmails(
              supabase,
              account.id,
              inboxEmails,
              inboxFolderId,
              logger, // Pass logger
              false // isSpamBatch = false for inbox
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
              `[SpamDebug] Storing ${
                spamEmails.length
              } emails to SPAM. Target FolderID: ${spamFolderId}. MsgIDs: ${spamEmails
                .map((e) => e.messageId || "N/A")
                .join(", ")}`
            );
            const storeResultSpam = await storeEmails(
              supabase,
              account.id,
              spamEmails,
              spamFolderId,
              logger, // Pass logger
              true // isSpamBatch = true for spam
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
          await updateSyncLog(
            supabase,
            jobId,
            "processing_emails", // A more specific status
            null, // No error
            false, // Not terminal
            processedEmailsCount // Pass current processed count
          );

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
        await updateSyncLog(supabase, jobId, "no_new_emails", null, true);
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
        await updateSyncLog(
          supabase,
          jobId,
          "completed",
          null,
          true,
          processedEmailsCount // Final processed count
        );
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
      return handleSyncFailure(
        supabase,
        logger,
        jobId,
        imapError,
        500,
        "IMAP operation failed",
        processedEmailsCount
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
        logger.info(`Closing IMAP connection for ${account.email}...`);
        await imapClient
          .logout()
          .catch((logoutErr) => logger.error("IMAP logout error:", logoutErr));
        logger.info(`IMAP connection closed for ${account.email}.`);
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
    // logger.error already called by handleSyncFailure
    return handleSyncFailure(
      supabase,
      logger,
      jobId,
      error,
      500,
      "General sync error",
      processedEmailsCount
    );
  }
}
