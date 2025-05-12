import { createNewSupabaseAdminClient } from "@/lib/auth/admin";
import { decrypt } from "@/lib/auth/encryption";
import { ImapFlow } from "imapflow";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

import { processEmailBatch, ProcessEmailBatchResult } from "./emailProcessing";
import { handleSyncFailure } from "./errorHandler";
import {
  closeImapClient,
  connectImapClient,
  createImapClient,
  fetchNewEmailUids,
  getMailboxLock,
} from "./imapOps";
import { logger } from "./logger";
import {
  getEmailAccountDetailsFromDb,
  updateEmailAccountSyncStatus,
  updateSyncLog,
} from "./supabaseOps";

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

  try {
    const account = await getEmailAccountDetailsFromDb(supabase, accountId);

    if (!account) {
      return handleSyncFailure(
        supabase,
        logger,
        jobId,
        new Error("Account not found"),
        404,
        "Account not found"
      );
    }

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

    // Decrypt password here before passing to createImapClient
    // The createImapClient was modified to also handle decryption if password_encrypted is provided,
    // but doing it here allows for earlier failure handling if decryption itself fails.
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

    imapClient = await createImapClient(account, decryptedPassword);
    await connectImapClient(imapClient, account.email);
    mailboxLock = await getMailboxLock(imapClient, "INBOX", account.email);

    await updateSyncLog(supabase, jobId, "fetching_uids");
    const lastSyncedUidFromDb = account.last_synced_uid || 0;
    const newUids = await fetchNewEmailUids(imapClient, lastSyncedUidFromDb);
    logger.info(
      `Found ${newUids.length} new email UIDs for account ${account.email}.`
    );

    await updateSyncLog(
      supabase,
      jobId,
      newUids.length > 0 ? "processing_emails" : "fetching_uids", // Keep as fetching_uids if no UIDs, then update to no_new_emails
      null,
      false,
      undefined, // processedCount not applicable yet
      newUids.length
    );

    let maxUidProcessedOverall = lastSyncedUidFromDb;

    if (newUids.length > 0) {
      // In a real scenario with many UIDs, you might batch newUids itself.
      // For now, processEmailBatch handles internal batching for fetchAndParseEmails.
      const batchResult: ProcessEmailBatchResult = await processEmailBatch(
        supabase,
        imapClient,
        account,
        newUids, // Pass all new UIDs to a single call of processEmailBatch
        jobId,
        maxUidProcessedOverall,
        cumulativeProcessedEmailsCount
      );

      cumulativeProcessedEmailsCount += batchResult.processedEmailsCount;
      cumulativeFailedEmailsCount += batchResult.failedEmailsCount;
      if (batchResult.maxUidProcessedInBatch > maxUidProcessedOverall) {
        maxUidProcessedOverall = batchResult.maxUidProcessedInBatch;
      }

      // Update email_accounts table with the overall max UID processed from this sync run
      if (maxUidProcessedOverall > lastSyncedUidFromDb) {
        await updateEmailAccountSyncStatus(
          supabase,
          account.id,
          maxUidProcessedOverall,
          logger
        );
      }

      await updateSyncLog(
        supabase,
        jobId,
        "completed",
        null,
        true,
        cumulativeProcessedEmailsCount
      );
    } else {
      logger.info(`No new email UIDs to process for account ${account.email}.`);
      await updateSyncLog(supabase, jobId, "no_new_emails", null, true, 0, 0);
    }

    return NextResponse.json({
      message:
        `Sync process completed for account ${accountId}. ` +
        `Fetched UIDs: ${newUids.length}. ` +
        `Successfully processed and stored: ${cumulativeProcessedEmailsCount}. ` +
        `Failed to store: ${cumulativeFailedEmailsCount}.`,
      email: account.email,
      newUidsFetched: newUids.length,
      emailsSuccessfullyStored: cumulativeProcessedEmailsCount,
      emailsFailedToStore: cumulativeFailedEmailsCount,
      lastUidEffectivelyProcessed: maxUidProcessedOverall,
    });
  } catch (error: any) {
    // Ensure IMAP client is closed if an error occurs during IMAP operations
    if (imapClient) {
      await closeImapClient(
        imapClient,
        params ? (await params).accountId : "unknown_account_during_error",
        mailboxLock
      ).catch((closeErr) =>
        logger.error("Error during emergency IMAP client close:", closeErr)
      );
    }
    return handleSyncFailure(
      supabase,
      logger,
      jobId,
      error,
      500,
      "General sync error in POST handler",
      cumulativeProcessedEmailsCount
    );
  } finally {
    // Ensure the lock is released and client is logged out in the normal path
    if (imapClient) {
      await closeImapClient(
        imapClient,
        params ? (await params).accountId : "unknown_account_on_finally",
        mailboxLock
      );
    }
  }
}
