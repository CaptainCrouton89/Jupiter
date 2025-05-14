import { createNewSupabaseAdminClient } from "@/lib/auth/admin";
import { ImapFlow } from "imapflow";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

import { Tables } from "@/lib/database.types";
import { getConnectedImapClient } from "@/lib/email/imapService";
import { processEmailBatch, ProcessEmailBatchResult } from "./emailProcessing";
import { handleSyncFailure } from "./errorHandler";
import { closeImapClient, fetchNewEmailUids, getMailboxLock } from "./imapOps";
import { logger } from "./logger";
import { updateEmailAccountSyncStatus, updateSyncLog } from "./supabaseOps";

export const maxDuration = 300; // 5 minutes

export async function POST(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;
  const supabase = await createNewSupabaseAdminClient();
  const jobId = uuidv4();
  let cumulativeProcessedEmailsCount = 0;
  let cumulativeFailedEmailsCount = 0;

  await supabase.from("sync_logs").insert({
    job_id: jobId,
    account_id: accountId,
    status: "started",
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!accountId) {
    return handleSyncFailure(
      supabase,
      logger,
      jobId,
      new Error("Account ID is required"),
      400,
      "Account ID is required"
    );
  }

  let imapClient: ImapFlow | null = null;
  let mailboxLock: Awaited<ReturnType<ImapFlow["getMailboxLock"]>> | null =
    null;
  let currentAccountDetails:
    | import("./supabaseOps").EmailAccountDetails
    | null = null;
  let userSettings: Tables<"user_settings"> | null = null;

  try {
    logger.info(
      `[SyncRoute] Attempting to connect IMAP client for account ${accountId} via ImapService.`
    );
    const { client: imapClient, accountDetails: fetchedAccountDetails } =
      await getConnectedImapClient(accountId, supabase, logger);

    currentAccountDetails = fetchedAccountDetails;
    logger.info(
      `[SyncRoute] IMAP client connected successfully for ${currentAccountDetails.email} via ImapService.`
    );

    // Fetch user settings
    const { data: settingsData, error: settingsError } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", currentAccountDetails.user_id)
      .single();

    if (settingsError || !settingsData) {
      return handleSyncFailure(
        supabase,
        logger,
        jobId,
        settingsError || new Error("User settings not found"),
        500,
        `User settings not found for user ${currentAccountDetails.user_id}`
      );
    }

    userSettings = settingsData;

    // Check subscription status and email count
    if (
      userSettings.stripe_subscription_status !== "active" &&
      userSettings.emails_since_reset >= 200 // Default to 0 if null
    ) {
      logger.warn(
        `[SyncRoute] Account ${currentAccountDetails.email} (User ID: ${userSettings.user_id}) skipped. Non-active subscription and email limit reached (${userSettings.emails_since_reset}/200).`
      );
      await updateSyncLog(
        supabase,
        jobId,
        "skipped_limit_reached",
        `Non-active subscription and email limit reached (${userSettings.emails_since_reset}/200)`,
        true,
        0,
        0
      );
      return NextResponse.json({
        message: `Sync skipped for account ${accountId}. Non-active subscription and email limit reached.`,
        email: currentAccountDetails.email,
        status: "skipped_limit_reached",
      });
    }

    mailboxLock = await getMailboxLock(
      imapClient,
      "INBOX",
      currentAccountDetails.email
    );

    await updateSyncLog(supabase, jobId, "started", null, false, undefined, 0);
    const lastSyncedUidFromDb = currentAccountDetails.last_synced_uid || 0;
    const newUids = await fetchNewEmailUids(imapClient, lastSyncedUidFromDb);
    logger.info(
      `Found ${newUids.length} new email UIDs for account ${currentAccountDetails.email}.`
    );

    await updateSyncLog(
      supabase,
      jobId,
      newUids.length > 0 ? "started" : "no_new_emails",
      null,
      newUids.length === 0,
      newUids.length > 0 ? undefined : 0,
      newUids.length
    );

    let maxUidProcessedOverall = lastSyncedUidFromDb;

    if (newUids.length > 0) {
      logger.info(
        `[SyncRoute-${currentAccountDetails.email}] Starting email processing. lastSyncedUidFromDb: ${lastSyncedUidFromDb}`
      );
      const batchResult: ProcessEmailBatchResult = await processEmailBatch(
        supabase,
        imapClient,
        currentAccountDetails,
        newUids,
        jobId,
        lastSyncedUidFromDb,
        0
      );

      cumulativeProcessedEmailsCount += batchResult.processedEmailsCount;
      cumulativeFailedEmailsCount += batchResult.failedEmailsCount;

      logger.info(
        `[SyncRoute-${currentAccountDetails.email}] Batch result: maxUidProcessedInBatch: ${batchResult.maxUidProcessedInBatch}, current maxUidProcessedOverall (before update): ${maxUidProcessedOverall}`
      );

      if (batchResult.maxUidProcessedInBatch > maxUidProcessedOverall) {
        maxUidProcessedOverall = batchResult.maxUidProcessedInBatch;
        logger.info(
          `[SyncRoute-${currentAccountDetails.email}] Updated maxUidProcessedOverall to: ${maxUidProcessedOverall} (from batch)`
        );
      }

      logger.info(
        `[SyncRoute-${currentAccountDetails.email}] About to check for DB update. maxUidProcessedOverall: ${maxUidProcessedOverall}, lastSyncedUidFromDb: ${lastSyncedUidFromDb}`
      );
      if (maxUidProcessedOverall > lastSyncedUidFromDb) {
        logger.info(
          `[SyncRoute-${currentAccountDetails.email}] Condition met. Calling updateEmailAccountSyncStatus with UID: ${maxUidProcessedOverall}`
        );
        await updateEmailAccountSyncStatus(
          supabase,
          currentAccountDetails.id,
          maxUidProcessedOverall,
          logger
        );
        logger.info(
          `[SyncRoute-${currentAccountDetails.email}] Successfully called updateEmailAccountSyncStatus.`
        );
      } else {
        logger.warn(
          `[SyncRoute-${currentAccountDetails.email}] Condition NOT met for DB update. maxUidProcessedOverall (${maxUidProcessedOverall}) is not > lastSyncedUidFromDb (${lastSyncedUidFromDb}). No UID update will occur.`
        );
      }

      await updateSyncLog(
        supabase,
        jobId,
        "completed",
        null,
        true,
        cumulativeProcessedEmailsCount,
        newUids.length
      );
    } else {
      logger.info(
        `No new email UIDs to process for account ${currentAccountDetails.email}.`
      );
      await updateSyncLog(supabase, jobId, "no_new_emails", null, true, 0, 0);
    }

    return NextResponse.json({
      message:
        `Sync process completed for account ${accountId}. ` +
        `Fetched UIDs: ${newUids.length}. ` +
        `Successfully processed and stored: ${cumulativeProcessedEmailsCount}. ` +
        `Failed to store: ${cumulativeFailedEmailsCount}.`,
      email: currentAccountDetails.email,
      newUidsFetched: newUids.length,
      emailsSuccessfullyStored: cumulativeProcessedEmailsCount,
      emailsFailedToStore: cumulativeFailedEmailsCount,
      lastUidEffectivelyProcessed: maxUidProcessedOverall,
    });
  } catch (error: any) {
    if (imapClient) {
      await closeImapClient(
        imapClient,
        currentAccountDetails?.email || accountId,
        mailboxLock
      ).catch((closeErr) =>
        logger.error("Error during emergency IMAP client close:", closeErr)
      );
    }
    const errorMessage = error.message || "Unknown error during sync";
    const errorDetails = error.stack || "No stack trace";
    logger.error(
      `[OuterCatch] Sync failure for job ${jobId}, account ${
        currentAccountDetails?.email || accountId
      }: ${errorMessage}`,
      errorDetails
    );
    return handleSyncFailure(
      supabase,
      logger,
      jobId,
      error,
      500,
      `General sync error: ${errorMessage}`,
      cumulativeProcessedEmailsCount
    );
  } finally {
    if (imapClient) {
      await closeImapClient(
        imapClient,
        currentAccountDetails?.email || accountId,
        mailboxLock
      );
    }
  }
}
