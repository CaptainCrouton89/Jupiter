import { Database } from "@/lib/database.types";
import {
  categorizeEmail,
  EmailCategorizationResult,
} from "@/lib/email/emailCategorizer";
import { fetchAndParseEmails, ParsedEmailData } from "@/lib/email/parseEmail";
import { storeEmails } from "@/lib/email/storeEmails";
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
      parsedEmail.category = spamResult.category;

      logger.info(
        `[CategorizationDebug] Email (MsgID: ${
          parsedEmail.messageId || "N/A"
        }, UID: ${parsedEmail.imapUid || "N/A"}, Subject: "${
          parsedEmail.subject || "N/A"
        }") for account ${account.id}: Category - ${spamResult.category}`
      );

      if (parsedEmail.isRead && parsedEmail.imapUid) {
        const numericUid = Number(parsedEmail.imapUid);
        if (
          !isNaN(numericUid) &&
          !uidsToMarkAsSeenOnServer.includes(numericUid)
        ) {
          uidsToMarkAsSeenOnServer.push(numericUid);
        }
      }

      if (
        [
          "newsletter",
          "marketing",
          "receipt",
          "invoice",
          "finances",
          "code-related",
          "notification",
          "spam",
        ].includes(spamResult.category.toLowerCase())
      ) {
        logger.info(
          `[SpamDebug] Email UID ${
            parsedEmail.imapUid
          } classified as SPAM-like for auto-read. MsgID: ${
            parsedEmail.messageId || "N/A"
          }`
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
        spamEmails.push(parsedEmail);
      } else {
        logger.info(
          `[SpamDebug] Email UID ${
            parsedEmail.imapUid
          } classified as INBOX. MsgID: ${parsedEmail.messageId || "N/A"}`
        );
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
