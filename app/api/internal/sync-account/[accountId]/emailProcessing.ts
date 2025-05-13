import { Database } from "@/lib/database.types";
import {
  categorizeEmail,
  EmailCategorizationResult,
} from "@/lib/email/emailCategorizer";
import { fetchAndParseEmails } from "@/lib/email/parseEmail";
import { storeEmails } from "@/lib/email/storeEmails";
import type { CategoryPreferences } from "@/types/settings";
import { SupabaseClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import {
  getArchiveFolderRemoteName,
  getJunkFolderRemoteName,
  getTrashFolderRemoteName,
  markMessagesAsSeen,
  moveMessagesToServerFolder,
} from "./imapOps";
import { logger } from "./logger";
import { EmailAccountDetails, updateSyncLog } from "./supabaseOps";

const RATE_LIMIT_DELAY_MS = 200;

// Define CONFIGURABLE_CATEGORIES, mirroring categories for which users can set actions
const CONFIGURABLE_CATEGORIES = [
  "newsletter",
  "marketing",
  "receipt",
  "invoice",
  "finances",
  "code-related",
  "notification",
  "account-related",
  "personal",
] as const;
export type ConfigurableCategory = (typeof CONFIGURABLE_CATEGORIES)[number];

export interface ProcessEmailBatchResult {
  processedEmailsCount: number;
  failedEmailsCount: number;
  maxUidProcessedInBatch: number;
}

export async function processEmailBatch(
  supabase: SupabaseClient<Database>,
  imapClient: ImapFlow,
  account: EmailAccountDetails,
  newUids: number[],
  jobId: string,
  initialMaxUidProcessed: number,
  currentTotalProcessedCountForJob: number
): Promise<ProcessEmailBatchResult> {
  let processedEmailsThisBatch = 0;
  let failedEmailsThisBatch = 0;
  let maxUidProcessedThisBatch = initialMaxUidProcessed;
  const uidsToMoveToJunk: number[] = [];
  const uidsToArchive: number[] = [];
  const uidsToTrash: number[] = [];
  let uidsToMarkAsSeenOnServer: number[] = []; // Initialize

  if (newUids.length === 0) {
    logger.info(
      `No new UIDs to process in this batch for account ${account.email}.`
    );
    return {
      processedEmailsCount: 0,
      failedEmailsCount: 0,
      maxUidProcessedInBatch: initialMaxUidProcessed,
    };
  }

  // Fetch user settings for this account's user
  let userCategoryPreferences: CategoryPreferences = {};
  if (account.user_id) {
    const { data: userSettings, error: settingsError } = await supabase
      .from("user_settings")
      .select("category_preferences")
      .eq("user_id", account.user_id)
      .single();

    if (settingsError && settingsError.code !== "PGRST116") {
      logger.error(
        `Error fetching user settings for user ${account.user_id} (account ${account.id}):`,
        settingsError
      );
      // Decide if we should proceed with defaults or fail the batch for this user
    }
    if (userSettings && userSettings.category_preferences) {
      userCategoryPreferences =
        userSettings.category_preferences as CategoryPreferences;
    } else {
      logger.info(
        `No category preferences found for user ${account.user_id}. Using default actions.`
      );
      // Ensure userCategoryPreferences is an empty object with the correct type for iteration
      CONFIGURABLE_CATEGORIES.forEach((cat) => {
        if (!userCategoryPreferences[cat]) {
          userCategoryPreferences[cat] = { action: "none", digest: false };
        }
      });
    }
  } else {
    logger.warn(
      `Account ${account.id} does not have a user_id. Cannot fetch category preferences.`
    );
    // Ensure default preferences if no user
    CONFIGURABLE_CATEGORIES.forEach((cat) => {
      if (!userCategoryPreferences[cat]) {
        userCategoryPreferences[cat] = { action: "none", digest: false };
      }
    });
  }

  logger.info(
    `Fetching and parsing ${newUids.length} emails for account ${account.id}...`
  );
  const parsedEmailsData = await fetchAndParseEmails(
    imapClient,
    newUids,
    10,
    account.id,
    logger
  );

  if (parsedEmailsData.length > 0) {
    logger.info(
      `Processing ${parsedEmailsData.length} parsed emails for categorization, server actions, and DB storage for account ${account.id}...`
    );

    for (const parsedEmail of parsedEmailsData) {
      const categorizationInput = {
        from: parsedEmail.from,
        subject: parsedEmail.subject,
        textContent: parsedEmail.text,
        htmlContent: parsedEmail.html,
        headers: parsedEmail.headers,
      };
      const categorizationResult: EmailCategorizationResult =
        await categorizeEmail(categorizationInput);
      parsedEmail.category = categorizationResult.category;

      logger.info(
        `[CategorizationDebug] Email (MsgID: ${
          parsedEmail.messageId || "N/A"
        }, UID: ${parsedEmail.imapUid || "N/A"}, Subject: "${
          parsedEmail.subject || "N/A"
        }") for account ${account.id}: Category - ${parsedEmail.category}`
      );

      const emailCategory = parsedEmail.category as ConfigurableCategory;
      const preference = userCategoryPreferences[emailCategory] ?? {
        action: "none",
        digest: false,
      };

      logger.info(
        `[PreferenceDebug] Account ${account.id}, Email UID ${parsedEmail.imapUid}, Category: ${emailCategory}, User Action Preference: ${preference.action}`
      );

      const numericUid = parsedEmail.imapUid
        ? Number(parsedEmail.imapUid)
        : null;
      const initialIsRead = parsedEmail.isRead; // Store initial read status

      // Determine DB read status and collect UIDs for server actions
      let markSeenOnServer = false;

      switch (preference.action) {
        case "mark_as_spam":
          logger.info(
            `[ActionDebug] UID ${numericUid}: Marking as SPAM based on preference.`
          );
          parsedEmail.isRead = true; // Set DB status
          if (numericUid) {
            uidsToMoveToJunk.push(numericUid);
            markSeenOnServer = true; // Mark seen for spam
          }
          break;
        case "mark_as_read":
          logger.info(
            `[ActionDebug] UID ${numericUid}: Marking as READ based on preference.`
          );
          parsedEmail.isRead = true; // Set DB status
          markSeenOnServer = true; // Mark seen on server
          break;
        case "archive":
          logger.info(
            `[ActionDebug] UID ${numericUid}: ARCHIVING based on preference.`
          );
          parsedEmail.isRead = true; // Set DB status
          if (numericUid) {
            uidsToArchive.push(numericUid);
            markSeenOnServer = true; // Mark seen before archive
          }
          break;
        case "trash":
          logger.info(
            `[ActionDebug] UID ${numericUid}: TRASHING based on preference.`
          );
          parsedEmail.isRead = true; // Set DB status
          if (numericUid) {
            uidsToTrash.push(numericUid);
            markSeenOnServer = true; // Mark seen before trash
          }
          break;
        case "none":
        default:
          logger.info(
            `[ActionDebug] UID ${numericUid}: Taking NO ACTION (to store) based on preference ('${preference.action}'). Original isRead: ${initialIsRead}`
          );
          // Preserve original parsedEmail.isRead from server
          // Only mark seen on server if it was already read there
          if (initialIsRead) {
            markSeenOnServer = true;
          }
          break;
      }

      // Add to list for server action if needed and not already added
      if (
        numericUid &&
        markSeenOnServer &&
        !uidsToMarkAsSeenOnServer.includes(numericUid)
      ) {
        uidsToMarkAsSeenOnServer.push(numericUid);
      }
    }

    // --- Perform Server-Side Actions FIRST --- //

    // Move emails marked as Spam
    if (uidsToMoveToJunk.length > 0) {
      logger.info(
        `Attempting to find Junk folder and move ${uidsToMoveToJunk.length} emails for account ${account.id}`
      );
      const junkFolderName = await getJunkFolderRemoteName(imapClient, logger);
      if (junkFolderName) {
        const movedUids = await moveMessagesToServerFolder(
          imapClient,
          uidsToMoveToJunk,
          junkFolderName,
          "Junk",
          logger
        );
        if (movedUids.length > 0) {
          logger.info(
            `SPAM: Successfully moved ${movedUids.length} emails to Junk folder '${junkFolderName}'. Removing from general seen list.`
          );
          uidsToMarkAsSeenOnServer = uidsToMarkAsSeenOnServer.filter(
            (uid) => !movedUids.includes(uid)
          );
        } else {
          logger.warn(
            `SPAM: Failed to move any of the ${uidsToMoveToJunk.length} designated spam emails.`
          );
        }
      } else {
        logger.warn(
          `SPAM: Could not find Junk folder. Cannot move ${uidsToMoveToJunk.length} emails server-side.`
        );
      }
    }

    // Move emails marked for Archive
    if (uidsToArchive.length > 0) {
      logger.info(
        `ARCHIVE: Processing ${uidsToArchive.length} emails for account ${account.id}. First marking as SEEN.`
      );
      // Mark as SEEN in INBOX first
      await markMessagesAsSeen(imapClient, uidsToArchive);
      logger.info(
        `ARCHIVE: Marked ${uidsToArchive.length} UIDs as SEEN in INBOX for account ${account.id}. Now attempting move.`
      );

      const archiveFolderName = await getArchiveFolderRemoteName(
        imapClient,
        logger
      );
      if (archiveFolderName) {
        const movedUids = await moveMessagesToServerFolder(
          imapClient,
          uidsToArchive,
          archiveFolderName,
          "Archive",
          logger
        );
        if (movedUids.length > 0) {
          logger.info(
            `ARCHIVE: Successfully moved ${movedUids.length} emails to Archive folder '${archiveFolderName}'. Removing from general seen list.`
          );
          uidsToMarkAsSeenOnServer = uidsToMarkAsSeenOnServer.filter(
            (uid) => !movedUids.includes(uid)
          );
        } else {
          logger.warn(
            `ARCHIVE: Failed to move any of the ${uidsToArchive.length} designated archive emails. They were marked as SEEN in INBOX.`
          );
        }
      } else {
        logger.warn(
          `ARCHIVE: Could not find Archive folder. ${uidsToArchive.length} emails were marked as SEEN in INBOX but not moved.`
        );
      }
    }

    // Move emails marked for Trash
    if (uidsToTrash.length > 0) {
      logger.info(
        `TRASH: Processing ${uidsToTrash.length} emails for account ${account.id}. First marking as SEEN.`
      );
      // Mark as SEEN in INBOX first
      await markMessagesAsSeen(imapClient, uidsToTrash);
      logger.info(
        `TRASH: Marked ${uidsToTrash.length} UIDs as SEEN in INBOX for account ${account.id}. Now attempting move.`
      );

      const trashFolderName = await getTrashFolderRemoteName(
        imapClient,
        logger
      );
      if (trashFolderName) {
        const movedUids = await moveMessagesToServerFolder(
          imapClient,
          uidsToTrash,
          trashFolderName,
          "Trash",
          logger
        );
        if (movedUids.length > 0) {
          logger.info(
            `TRASH: Successfully moved ${movedUids.length} emails to Trash folder '${trashFolderName}'. Removing from general seen list.`
          );
          uidsToMarkAsSeenOnServer = uidsToMarkAsSeenOnServer.filter(
            (uid) => !movedUids.includes(uid)
          );
        } else {
          logger.warn(
            `TRASH: Failed to move any of the ${uidsToTrash.length} designated trash emails. They were marked as SEEN in INBOX.`
          );
        }
      } else {
        logger.warn(
          `TRASH: Could not find Trash folder. ${uidsToTrash.length} emails were marked as SEEN in INBOX but not moved.`
        );
      }
    }

    // Mark remaining necessary emails as seen on server
    if (uidsToMarkAsSeenOnServer.length > 0) {
      logger.info(
        `Attempting to mark ${uidsToMarkAsSeenOnServer.length} remaining emails as seen on server for account ${account.id}`
      );
      await markMessagesAsSeen(imapClient, uidsToMarkAsSeenOnServer);
    } else {
      logger.info(
        `No remaining emails need to be marked as seen on server for account ${account.id}.`
      );
    }

    // --- Now Proceed with DB Storage --- //

    logger.info(
      `Storing ${parsedEmailsData.length} emails in the database for account ${account.id}`
    );
    const storeResult = await storeEmails(
      supabase,
      account.id,
      parsedEmailsData,
      logger
    );
    processedEmailsThisBatch = storeResult.success;
    failedEmailsThisBatch = storeResult.failed;
    if (storeResult.errors.length > 0) {
      logger.error(`Errors storing emails for account ${account.id}:`, {
        count: storeResult.errors.length,
        firstError: storeResult.errors[0],
      });
    }

    logger.info(
      `Database storage for batch complete for account ${account.id}. Stored: ${processedEmailsThisBatch}, Failed: ${failedEmailsThisBatch}`
    );

    const newTotalProcessedForJob =
      currentTotalProcessedCountForJob + processedEmailsThisBatch;
    await updateSyncLog(
      supabase,
      jobId,
      "processing_emails",
      null,
      false,
      newTotalProcessedForJob
    );

    // Determine max UID processed in this batch
    const actionsAttempted =
      uidsToMoveToJunk.length > 0 ||
      uidsToArchive.length > 0 ||
      uidsToTrash.length > 0 ||
      uidsToMarkAsSeenOnServer.length > 0 ||
      processedEmailsThisBatch > 0 ||
      failedEmailsThisBatch > 0;
    if (actionsAttempted && newUids.length > 0) {
      const highestUidAttemptedInThisBatch = newUids[newUids.length - 1];
      if (highestUidAttemptedInThisBatch > maxUidProcessedThisBatch) {
        logger.info(
          `Actions attempted or emails stored/failed for UIDs up to ${highestUidAttemptedInThisBatch}. Advancing max UID for batch.`
        );
        maxUidProcessedThisBatch = highestUidAttemptedInThisBatch;
      }
    }
  } else {
    logger.info(
      `No emails were successfully parsed from the fetched UIDs for account ${account.id}.`
    );
    if (newUids.length > 0) {
      const highestUidAttemptedInThisBatch = newUids[newUids.length - 1];
      if (highestUidAttemptedInThisBatch > maxUidProcessedThisBatch) {
        logger.warn(
          `No emails parsed from UIDs ${newUids.join(
            ","
          )}. Advancing last_synced_uid past this batch to ${highestUidAttemptedInThisBatch}.`
        );
        maxUidProcessedThisBatch = highestUidAttemptedInThisBatch;
      }
    }
  }

  if (parsedEmailsData.length > 0 || newUids.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
  }

  return {
    processedEmailsCount: processedEmailsThisBatch,
    failedEmailsCount: failedEmailsThisBatch,
    maxUidProcessedInBatch: maxUidProcessedThisBatch,
  };
}
