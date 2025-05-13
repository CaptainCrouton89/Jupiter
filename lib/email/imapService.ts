import { logger as defaultLogger } from "@/app/api/internal/sync-account/[accountId]/logger"; // Generic logger
import {
  EmailAccountDetails,
  getEmailAccountDetailsFromDb,
} from "@/app/api/internal/sync-account/[accountId]/supabaseOps"; // Reusing this type
import { createNewSupabaseAdminClient } from "@/lib/auth/admin"; // Assuming this can be used generally
import { decrypt, encrypt } from "@/lib/auth/encryption";
import {
  refreshGoogleAccessToken,
  updateEmailAccountTokens,
} from "@/lib/auth/googleService";
import { SupabaseClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";

interface ConnectedImapClientResult {
  client: ImapFlow;
  accountDetails: EmailAccountDetails;
}

// Define the auth payload type similar to how it evolved
type ImapServiceAuthPayload =
  | { user: string; accessToken?: string; password?: string; xoauth2?: string } // xoauth2 might still be needed if baseCreateImapClient expects it
  | undefined;

export async function getConnectedImapClient(
  accountId: string,
  supabaseClient?: SupabaseClient, // Allow passing client, or create new one
  logger: typeof defaultLogger = defaultLogger
): Promise<ConnectedImapClientResult> {
  const supabase = supabaseClient || (await createNewSupabaseAdminClient());

  let currentAccountDetails = await getEmailAccountDetailsFromDb(
    supabase,
    accountId
  );

  if (!currentAccountDetails) {
    logger.error(`[ImapService] Account not found for ID: ${accountId}`);
    throw new Error("Account not found");
  }

  let imapClient: ImapFlow | null = null;
  let connectionAttempts = 0;
  const maxConnectionAttempts = 2; // Allow one retry after token refresh
  let imapConnected = false;
  let authPayload: ImapServiceAuthPayload;

  while (connectionAttempts < maxConnectionAttempts && !imapConnected) {
    connectionAttempts++;
    logger.info(
      `[ImapService] IMAP connection attempt ${connectionAttempts} for ${currentAccountDetails.email}`
    );
    authPayload = undefined; // Reset for each attempt

    // 1. Construct AuthPayload
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
          accessToken: decryptedAccessToken, // Prioritize accessToken for Google
        };
        logger.info(
          `[ImapService] Using Google OAuth (accessToken) for ${currentAccountDetails.email}`
        );
      } else {
        logger.warn(
          `[ImapService] Decrypted Google access token is empty for ${currentAccountDetails.email}.`
        );
      }
    }

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
          `[ImapService] Using password authentication for ${currentAccountDetails.email}`
        );
      } else {
        logger.warn(
          `[ImapService] Decrypted password is empty for ${currentAccountDetails.email}.`
        );
      }
    }

    if (!authPayload) {
      logger.error(
        `[ImapService] No valid auth method for ${currentAccountDetails.email} on attempt ${connectionAttempts}.`
      );
      if (connectionAttempts >= maxConnectionAttempts) {
        throw new Error(
          "No valid authentication method available after all attempts."
        );
      }
      // If not Google or no refresh token, continuing won't help here for this attempt.
      // Let the try/catch below handle actual connection errors.
    }

    // Ensure authPayload is defined before proceeding to create client
    if (!authPayload) {
      // This state should ideally be caught above and error thrown if max attempts reached.
      // Adding defensive check.
      logger.error(
        `[ImapService] AuthPayload is unexpectedly undefined before creating client for ${currentAccountDetails.email}. This may indicate a logic flaw if not on the last attempt.`
      );
      if (connectionAttempts >= maxConnectionAttempts) {
        throw new Error("AuthPayload construction failed after all attempts.");
      }
      // Allow loop to continue if not max attempts, maybe refresh logic can save it.
      // But realistically, if it's not Google + refreshable, it shouldn't hit this if it failed above.
    }

    try {
      if (!authPayload) {
        // Final check before client creation if loop continues after prior !authPayload warning
        throw new Error("Cannot create IMAP client without valid authPayload.");
      }
      // We need to ensure baseCreateImapClient and connectImapClient are compatible
      // with the structure of currentAccountDetails and the authPayload
      // For now, assuming baseCreateImapClient is compatible.
      // The original createImapClient from imapOps.ts was expecting a specific authPayload.
      // We might need to adjust baseCreateImapClient or how we call it.
      // Let's assume for now `baseCreateImapClient` takes the EmailAccountDetails and our ImapServiceAuthPayload

      // The `baseCreateImapClient` from `imapOps` needs to be adapted or this service needs its own direct `ImapFlow` instantiation.
      // For true unification, this service should probably instantiate ImapFlow directly.

      const clientConfig: any = {
        // Directly configure ImapFlow here
        host: currentAccountDetails.imap_host,
        port: currentAccountDetails.imap_port,
        secure: currentAccountDetails.imap_port === 993, // Common default
        auth: {
          // Construct auth specifically for ImapFlow
          user: authPayload.user,
          ...(authPayload.accessToken && {
            accessToken: authPayload.accessToken,
          }),
          ...(authPayload.password && { pass: authPayload.password }),
          // Note: ImapFlow's 'accessToken' is for XOAUTH2. If 'xoauth2' key was specifically needed, adjust here.
          // Current logic in working sync route uses `accessToken` key in authPayload passed to createImapClient,
          // and `createImapClient` (in imapOps) then builds its own imapAuthConf.
          // Let's align with that structure.
        },
        logger: {
          info: () => {}, // Keep ImapFlow's own logger minimal for this service
          debug: () => {},
          warn: (obj: any) =>
            logger.warn("[ImapService_ImapFlow]", JSON.stringify(obj)),
          error: (obj: any) =>
            logger.error("[ImapService_ImapFlow]", JSON.stringify(obj)),
        },
        disableAutoIdle: true,
      };

      if (
        currentAccountDetails.provider === "google" &&
        authPayload.accessToken
      ) {
        clientConfig.host = clientConfig.host || "imap.gmail.com";
        clientConfig.port = clientConfig.port || 993;
        clientConfig.secure = true; // Ensure secure for Gmail OAuth
        // ImapFlow internally handles XOAUTH2 if 'accessToken' is provided in 'auth'
      }

      imapClient = new ImapFlow(clientConfig);

      logger.info(
        `[ImapService] Attempting IMAP connect for ${currentAccountDetails.email}`
      );
      await imapClient.connect();
      imapConnected = true;
      logger.info(
        `[ImapService] IMAP connection successful on attempt ${connectionAttempts} for ${currentAccountDetails.email}`
      );
    } catch (connectionError: any) {
      logger.error(
        `[ImapService] IMAP connection attempt ${connectionAttempts} failed for ${currentAccountDetails.email}:`,
        connectionError.message
      );

      if (imapClient) {
        try {
          await imapClient.logout();
        } catch (logoutErr) {
          // ignore
        }
        imapClient = null;
      }

      if (
        connectionAttempts < maxConnectionAttempts &&
        currentAccountDetails.provider === "google" &&
        currentAccountDetails.refresh_token_encrypted &&
        (connectionError.message?.includes("AUTHENTICATIONFAILED") ||
          connectionError.message?.includes("AuthError") ||
          connectionError.message?.includes("No password configured") || // As seen with stale tokens
          connectionError.message?.includes("Invalid credentials") ||
          connectionError.message === "Command failed")
      ) {
        logger.info(
          `[ImapService] Attempting Google token refresh for ${currentAccountDetails.email}`
        );
        const refreshed = await refreshGoogleAccessToken(
          currentAccountDetails.refresh_token_encrypted
        );

        if (refreshed) {
          const newEncryptedAccessToken = encrypt(refreshed.newAccessToken);
          let newEncryptedRefreshToken =
            currentAccountDetails.refresh_token_encrypted;
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

          // Update currentAccountDetails for the next attempt in the loop
          currentAccountDetails.access_token_encrypted =
            newEncryptedAccessToken;
          currentAccountDetails.token_expires_at = refreshed.newExpiresAt;
          if (refreshed.newRefreshToken && newEncryptedRefreshToken) {
            currentAccountDetails.refresh_token_encrypted =
              newEncryptedRefreshToken;
          }
          logger.info(
            `[ImapService] Google token refreshed. Retrying IMAP connection for ${currentAccountDetails.email}.`
          );
          continue; // Next iteration of the while loop
        } else {
          logger.warn(
            `[ImapService] Google token refresh failed for ${currentAccountDetails.email}.`
          );
          throw connectionError; // Propagate if refresh failed
        }
      } else {
        if (connectionAttempts >= maxConnectionAttempts) {
          logger.error(
            `[ImapService] Max connection attempts reached for ${currentAccountDetails.email}.`
          );
        }
        throw connectionError; // Propagate if not a refreshable Google error or max attempts reached
      }
    }
  } // End of while loop

  if (!imapConnected || !imapClient) {
    // Should have been thrown from within the loop if all attempts failed
    throw new Error(
      "IMAP client not connected after all attempts. This indicates an issue in the connection loop."
    );
  }

  return { client: imapClient, accountDetails: currentAccountDetails };
}
