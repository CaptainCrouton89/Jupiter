import { createNewSupabaseAdminClient } from "@/lib/auth/admin";
import { decrypt } from "@/lib/auth/encryption";
import { ImapFlow } from "imapflow";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

import { encrypt } from "@/lib/auth/encryption";
import {
  refreshGoogleAccessToken,
  updateEmailAccountTokens,
} from "@/lib/auth/googleService";
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
  let authPayload:
    | {
        user: string;
        xoauth2?: string;
        accessToken?: string;
        password?: string;
      }
    | undefined;
  let currentAccountDetails:
    | import("./supabaseOps").EmailAccountDetails
    | null = null;

  try {
    const initialAccountDetails = await getEmailAccountDetailsFromDb(
      supabase,
      accountId
    );

    if (!initialAccountDetails) {
      return handleSyncFailure(
        supabase,
        logger,
        jobId,
        new Error("Account not found"),
        404,
        "Account not found"
      );
    }
    currentAccountDetails = { ...initialAccountDetails }; // Work with a mutable copy

    // --- Connection Loop Start ---
    let connectionAttempts = 0;
    const maxConnectionAttempts = 2;
    let imapConnected = false;

    while (connectionAttempts < maxConnectionAttempts && !imapConnected) {
      connectionAttempts++;
      logger.info(
        `IMAP connection attempt ${connectionAttempts} for ${currentAccountDetails.email}`
      );
      authPayload = undefined; // Reset for each attempt

      // Google OAuth Logic
      if (
        currentAccountDetails.provider === "google" &&
        currentAccountDetails.access_token_encrypted
      ) {
        const decryptedAccessToken = decrypt(
          currentAccountDetails.access_token_encrypted
        );
        if (decryptedAccessToken && decryptedAccessToken.trim() !== "") {
          authPayload = {
            user: currentAccountDetails.email,
            accessToken: decryptedAccessToken,
          };
          logger.info(
            `Using Google OAuth for account: ${currentAccountDetails.email}`
          );
        } else {
          logger.warn(
            `Decrypted Google access token is empty or invalid for ${currentAccountDetails.email}. Will try password if available or fail.`
          );
        }
      }

      // Password Auth Logic
      if (!authPayload && currentAccountDetails.password_encrypted) {
        const decryptedPassword = decrypt(
          currentAccountDetails.password_encrypted
        );
        if (decryptedPassword && decryptedPassword.trim() !== "") {
          authPayload = {
            user: currentAccountDetails.email,
            password: decryptedPassword,
          };
          logger.info(
            `Using password authentication for account: ${currentAccountDetails.email}`
          );
        } else {
          logger.warn(
            `Decrypted password is empty or invalid for ${currentAccountDetails.email}.`
          );
        }
      }

      if (!authPayload) {
        logger.error(
          `No valid auth method for ${currentAccountDetails.email} on attempt ${connectionAttempts}.`
        );
        if (connectionAttempts >= maxConnectionAttempts) {
          // Only fail out if all attempts exhausted
          return handleSyncFailure(
            supabase,
            logger,
            jobId,
            new Error(
              "No valid authentication method available after all attempts."
            ),
            401,
            "No valid authentication method"
          );
        }
        // If it wasn't Google or no refresh token, continuing the loop won't help for auth payload construction for this attempt.
        // Let the try/catch below handle connection errors.
        // Effectively, if authPayload is not set here, and it's not a Google refresh scenario, it will fail in the try block.
      }

      try {
        if (!authPayload) {
          // This should ideally not be reached if the above logic is sound and handleSyncFailure exits.
          // But as a defensive measure:
          throw new Error(
            "AuthPayload is unexpectedly undefined before creating IMAP client."
          );
        }
        logger.info(
          `Attempting IMAP connection for ${
            currentAccountDetails.email
          } with auth method: ${
            "xoauth2" in authPayload ? "XOAUTH2" : "Password"
          }`
        );
        imapClient = await createImapClient(
          currentAccountDetails,
          authPayload as Exclude<typeof authPayload, undefined>
        );
        await connectImapClient(imapClient, currentAccountDetails.email);
        imapConnected = true;
        logger.info(
          `IMAP connection successful on attempt ${connectionAttempts} for ${currentAccountDetails.email}`
        );
        // Successfully connected, loop will exit due to imapConnected = true
      } catch (connectionError: any) {
        logger.error(
          `IMAP connection attempt ${connectionAttempts} failed for ${currentAccountDetails.email}:`,
          connectionError.message
        );

        // Clean up client from previous failed attempt before potentially retrying or throwing
        if (imapClient) {
          try {
            await imapClient.logout();
          } catch (logoutErr) {
            // ignore errors during cleanup logout
          }
          imapClient = null; // Ensure it's null for next iteration or if error is rethrown
        }

        // Google OAuth Refresh Logic
        if (
          connectionAttempts < maxConnectionAttempts &&
          currentAccountDetails.provider === "google" &&
          currentAccountDetails.refresh_token_encrypted &&
          (connectionError.message?.includes("AUTHENTICATIONFAILED") ||
            connectionError.message?.includes("AuthError") || // Broader catch for auth issues
            connectionError.message?.includes("No password configured") ||
            connectionError.message?.includes("Invalid credentials"))
        ) {
          logger.info(
            `Attempting Google token refresh for ${currentAccountDetails.email}`
          );
          const refreshed = await refreshGoogleAccessToken(
            currentAccountDetails.refresh_token_encrypted
          );

          if (refreshed) {
            const newEncryptedAccessToken = encrypt(refreshed.newAccessToken);
            let newEncryptedRefreshToken =
              currentAccountDetails.refresh_token_encrypted; // Keep old one if Google doesn't return new
            if (refreshed.newRefreshToken) {
              newEncryptedRefreshToken = encrypt(refreshed.newRefreshToken);
            }

            await updateEmailAccountTokens(
              supabase,
              accountId,
              newEncryptedAccessToken,
              refreshed.newExpiresAt,
              refreshed.newRefreshToken ? newEncryptedRefreshToken : null
            );

            currentAccountDetails.access_token_encrypted =
              newEncryptedAccessToken;
            currentAccountDetails.token_expires_at = refreshed.newExpiresAt;
            if (refreshed.newRefreshToken && newEncryptedRefreshToken) {
              currentAccountDetails.refresh_token_encrypted =
                newEncryptedRefreshToken;
            }

            logger.info(
              `Google token refreshed. Retrying IMAP connection for ${currentAccountDetails.email}.`
            );
            continue; // Go to next iteration of the while loop
          } else {
            logger.warn(
              `Google token refresh failed for ${currentAccountDetails.email}. No retry for this specific error.`
            );
            // Propagate original imapError if refresh fails, as we won't retry this path.
            throw connectionError;
          }
        } else {
          // Not a retriable Google scenario, or max attempts reached.
          if (connectionAttempts >= maxConnectionAttempts) {
            logger.info(
              `Max connection attempts reached for ${currentAccountDetails.email}.`
            );
          }
          throw connectionError; // Propagate error to outer catch
        }
      }
    } // --- Connection Loop End ---

    if (!imapConnected || !imapClient) {
      // This means all attempts in the loop failed and error was propagated or conditions not met for retry
      return handleSyncFailure(
        supabase,
        logger,
        jobId,
        new Error("Failed to connect to IMAP server after all attempts."),
        500,
        "IMAP connection failed after retries"
      );
    }

    // --- Email Processing Starts Here (AFTER successful connection) ---
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
      const batchResult: ProcessEmailBatchResult = await processEmailBatch(
        supabase,
        imapClient,
        currentAccountDetails,
        newUids,
        jobId,
        lastSyncedUidFromDb, // Pass the UID from which to start considering newness
        0 // Initial processed count for this job's batch processing part
      );

      cumulativeProcessedEmailsCount += batchResult.processedEmailsCount;
      cumulativeFailedEmailsCount += batchResult.failedEmailsCount;
      if (batchResult.maxUidProcessedInBatch > maxUidProcessedOverall) {
        maxUidProcessedOverall = batchResult.maxUidProcessedInBatch;
      }

      if (maxUidProcessedOverall > lastSyncedUidFromDb) {
        await updateEmailAccountSyncStatus(
          supabase,
          currentAccountDetails.id,
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
        cumulativeProcessedEmailsCount,
        newUids.length // totalToProcess was newUids.length for this segment
      );
    } else {
      logger.info(
        `No new email UIDs to process for account ${currentAccountDetails.email}.`
      );
      // "no_new_emails" status already set, final counts are 0 for processing
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
    // Ensure IMAP client is closed if an error occurs (could be before client was set, or after)
    if (imapClient) {
      await closeImapClient(
        imapClient,
        // Use accountId for logging if currentAccountDetails might not be set (e.g. error in getEmailAccountDetailsFromDb)
        currentAccountDetails?.email || accountId,
        mailboxLock
      ).catch((closeErr) =>
        logger.error("Error during emergency IMAP client close:", closeErr)
      );
    }
    // Log to sync_logs table, using currentAccountDetails if available for better context
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
      error, // Pass the original error object
      500,
      `General sync error: ${errorMessage}`,
      cumulativeProcessedEmailsCount
    );
  } finally {
    if (imapClient) {
      await closeImapClient(
        imapClient,
        currentAccountDetails?.email || accountId, // Similarly, use available email or accountId
        mailboxLock // Pass mailboxLock, closeImapClient handles if it's null
      );
    }
  }
}
