import { Database } from "@/lib/database.types";
import {
  categorizeEmail,
  EmailCategorizationResult,
} from "@/lib/email/emailCategorizer";
import { fetchAndParseEmails, ParsedEmailData } from "@/lib/email/parseEmail";
import { storeEmails } from "@/lib/email/storeEmails";
import type { CategoryPreferences } from "@/types/settings";
import { SupabaseClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import { markMessagesAsSeen } from "./imapOps";
import { logger } from "./logger";
import {
  EmailAccountDetails,
  getOrCreateFolderId,
  updateSyncLog,
} from "./supabaseOps";

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
  uidsSuccessfullyStoredThisBatch: number[];
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
  const uidsSuccessfullyStoredThisBatch: number[] = [];

  if (newUids.length === 0) {
    logger.info(
      `No new UIDs to process in this batch for account ${account.email}.`
    );
    return {
      processedEmailsCount: 0,
      failedEmailsCount: 0,
      maxUidProcessedInBatch: initialMaxUidProcessed,
      uidsSuccessfullyStoredThisBatch: [],
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
      `Processing ${parsedEmailsData.length} parsed emails for categorization and storage for account ${account.id}...`
    );

    const inboxEmails: ParsedEmailData[] = [];
    const spamEmails: ParsedEmailData[] = [];
    const uidsToMarkAsSeenOnServer: number[] = [];

    for (const parsedEmail of parsedEmailsData) {
      const categorizationInput = {
        from: parsedEmail.from,
        subject: parsedEmail.subject,
        textContent: parsedEmail.text,
        htmlContent: parsedEmail.html,
        headers: parsedEmail.headers,
      };
      // Categorize the email first
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

      // Get user preference for this category
      const emailCategory = parsedEmail.category as ConfigurableCategory; // Assume category is one of these
      const preference = userCategoryPreferences[emailCategory] || {
        action: "none",
        digest: false,
      };

      logger.info(
        `[PreferenceDebug] Account ${account.id}, Email UID ${parsedEmail.imapUid}, Category: ${emailCategory}, User Action Preference: ${preference.action}`
      );

      // If email was already read on server, ensure it's marked as seen later if no other action overrides.
      if (parsedEmail.isRead && parsedEmail.imapUid) {
        const numericUid = Number(parsedEmail.imapUid);
        if (
          !isNaN(numericUid) &&
          !uidsToMarkAsSeenOnServer.includes(numericUid)
        ) {
          uidsToMarkAsSeenOnServer.push(numericUid);
        }
      }

      // Apply action based on user preference
      if (preference.action === "mark_as_spam") {
        logger.info(
          `[ActionDebug] Email UID ${parsedEmail.imapUid} for account ${account.id}: Marking as SPAM based on user preference for category '${emailCategory}'.`
        );
        parsedEmail.isRead = true; // Mark as read when moving to spam
        if (parsedEmail.imapUid) {
          const numericUid = Number(parsedEmail.imapUid);
          if (
            !isNaN(numericUid) &&
            !uidsToMarkAsSeenOnServer.includes(numericUid)
          ) {
            uidsToMarkAsSeenOnServer.push(numericUid);
          }
        }
        spamEmails.push(parsedEmail);
      } else if (preference.action === "mark_as_read") {
        logger.info(
          `[ActionDebug] Email UID ${parsedEmail.imapUid} for account ${account.id}: Marking as READ based on user preference for category '${emailCategory}'.`
        );
        parsedEmail.isRead = true;
        if (parsedEmail.imapUid) {
          const numericUid = Number(parsedEmail.imapUid);
          if (
            !isNaN(numericUid) &&
            !uidsToMarkAsSeenOnServer.includes(numericUid)
          ) {
            uidsToMarkAsSeenOnServer.push(numericUid);
          }
        }
        inboxEmails.push(parsedEmail);
      } else {
        // Default action: "none" or category not in configurable list, or no preference set.
        // It goes to inbox. isRead status is preserved from server.
        logger.info(
          `[ActionDebug] Email UID ${parsedEmail.imapUid} for account ${account.id}: Taking NO ACTION (to inbox) based on user preference ('${preference.action}') for category '${emailCategory}'. Original isRead: ${parsedEmail.isRead}`
        );
        // If original category was "spam" from categorizer, and action is "none", it goes to inbox.
        // This behavior might need review if "spam" from categorizer should always override to spam folder.
        // For now, user preference for "none" on a category (even if categorizer called it "spam") means inbox.
        inboxEmails.push(parsedEmail);
      }
    }

    if (inboxEmails.length > 0) {
      const inboxFolderId = await getOrCreateFolderId(
        supabase,
        account.id,
        "INBOX",
        "inbox"
      );
      const storeResultInbox = await storeEmails(
        supabase,
        account.id,
        inboxEmails,
        inboxFolderId,
        logger,
        false
      );
      processedEmailsThisBatch += storeResultInbox.success;
      failedEmailsThisBatch += storeResultInbox.failed;
      if (storeResultInbox.errors.length > 0) {
        logger.error(
          `Errors storing INBOX emails for account ${account.id}:`,
          storeResultInbox.errors
        );
      }
    }

    if (spamEmails.length > 0) {
      const spamFolderId = await getOrCreateFolderId(
        supabase,
        account.id,
        "Spam",
        "spam"
      );
      const storeResultSpam = await storeEmails(
        supabase,
        account.id,
        spamEmails,
        spamFolderId,
        logger,
        true
      );
      processedEmailsThisBatch += storeResultSpam.success;
      failedEmailsThisBatch += storeResultSpam.failed;
      if (storeResultSpam.errors.length > 0) {
        logger.error(
          `Errors storing SPAM emails for account ${account.id}:`,
          storeResultSpam.errors
        );
      }
    }

    logger.info(
      `Email storage for batch complete for account ${account.id}. Success: ${processedEmailsThisBatch}, Failed: ${failedEmailsThisBatch}`
    );

    if (uidsToMarkAsSeenOnServer.length > 0) {
      await markMessagesAsSeen(imapClient, uidsToMarkAsSeenOnServer);
    }

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

    if (processedEmailsThisBatch > 0 && newUids.length > 0) {
      const highestUidInAttemptedBatch = newUids[newUids.length - 1];
      if (highestUidInAttemptedBatch > maxUidProcessedThisBatch) {
        maxUidProcessedThisBatch = highestUidInAttemptedBatch;
      }
    } else if (
      newUids.length > 0 &&
      processedEmailsThisBatch === 0 &&
      failedEmailsThisBatch > 0
    ) {
      const highestUidAttemptedInThisBatch = newUids[newUids.length - 1];
      if (highestUidAttemptedInThisBatch > maxUidProcessedThisBatch) {
        logger.warn(
          `All ${newUids.length} emails in current UID batch failed. Advancing last_synced_uid past this batch to ${highestUidAttemptedInThisBatch} to avoid retries.`
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
    uidsSuccessfullyStoredThisBatch,
  };
}
