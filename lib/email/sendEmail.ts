import { EmailAccountDetails } from "@/app/api/internal/sync-account/[accountId]/supabaseOps"; // Re-using this interface
import { createNewSupabaseAdminClient } from "@/lib/auth/admin";
import { decrypt, encrypt } from "@/lib/auth/encryption";
import {
  refreshGoogleAccessToken,
  updateEmailAccountTokens,
} from "@/lib/auth/googleService";
import nodemailer from "nodemailer";

// Basic logger placeholder - replace with your actual logger if you have one
const logger = {
  info: (...args: any[]) => console.log("[sendEmail INFO]", ...args),
  warn: (...args: any[]) => console.warn("[sendEmail WARN]", ...args),
  error: (...args: any[]) => console.error("[sendEmail ERROR]", ...args),
};

/**
 * Sends an email using Nodemailer.
 *
 * @param userAccount The email account details to send from (including SMTP config and encrypted password).
 * @param toEmail The recipient's email address.
 * @param subject The subject of the email.
 * @param htmlBody The HTML body of the email.
 * @returns A promise that resolves if the email is sent successfully, or rejects with an error.
 */
export async function sendDigestEmail(
  userAccount: EmailAccountDetails, // Reusing this type, ensure it has SMTP fields
  toEmail: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  let transporter;
  let currentAccessToken = userAccount.access_token_encrypted
    ? decrypt(userAccount.access_token_encrypted)
    : null;

  const createTransporter = (accessToken: string | null) => {
    if (userAccount.provider === "google" && accessToken) {
      try {
        logger.info(
          `Attempting to configure Google OAuth transporter for ${userAccount.email}`
        );
        return nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            type: "OAuth2",
            user: userAccount.email,
            accessToken: accessToken,
            // clientId, clientSecret, and refreshToken are handled by Nodemailer if accessToken expires
            // and these are provided. However, our explicit refresh is more robust.
          },
          tls: {
            rejectUnauthorized: process.env.NODE_ENV === "production",
          },
        });
      } catch (oauthError: any) {
        logger.warn(
          `Google OAuth setup failed for ${userAccount.email}: ${oauthError.message}. Falling back to password auth if configured.`
        );
        return null; // Fallback will be attempted
      }
    }
    return null; // Indicates OAuth not applicable or failed, allowing fallback
  };

  if (userAccount.provider === "google" && currentAccessToken) {
    transporter = createTransporter(currentAccessToken);
    if (transporter) {
      logger.info(
        `Nodemailer transporter configured for Google OAuth for ${userAccount.email}.`
      );
    }
  }

  // If not Google OAuth or if Google OAuth setup failed/not applicable, try password auth
  if (!transporter) {
    logger.info(
      `Attempting to send email via password SMTP for ${userAccount.email}`
    );
    let decryptedPassword = "";
    try {
      if (!userAccount.password_encrypted) {
        // If it's an OAuth account and we reached here, it means OAuth failed AND there's no password.
        if (userAccount.provider) {
          throw new Error(
            `OAuth failed and no password_encrypted found for ${userAccount.provider} account ${userAccount.email}. Cannot send email.`
          );
        }
        throw new Error(
          "Encrypted password is missing from user account details."
        );
      }
      decryptedPassword = decrypt(userAccount.password_encrypted);
    } catch (error: any) {
      logger.error(
        `Failed to decrypt password for ${userAccount.email}: ${error.message}`
      );
      throw new Error(`Failed to decrypt password: ${error.message}`);
    }

    if (!decryptedPassword) {
      logger.error(`Decrypted password is empty for ${userAccount.email}.`);
      throw new Error("Decrypted password is empty.");
    }

    const smtpHost = userAccount.smtp_host;
    const smtpPort = userAccount.smtp_port;

    if (!smtpHost || !smtpPort) {
      logger.error(
        `SMTP host or port is missing for account ${userAccount.email}.`
      );
      throw new Error(
        `SMTP configuration (host or port) is missing for account ${userAccount.email}.`
      );
    }

    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465 || smtpPort === 587, // True for 465, STARTTLS usually on 587
      auth: {
        user: userAccount.email,
        pass: decryptedPassword,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production", // More secure for production
      },
    });
    logger.info(
      `Nodemailer transporter configured for password SMTP for ${userAccount.email}.`
    );
  }

  if (!transporter) {
    logger.error(
      `Failed to configure any email transporter for ${userAccount.email}.`
    );
    throw new Error(
      `Could not initialize email transporter for ${userAccount.email}. Check account configuration and logs.`
    );
  }

  const mailOptions = {
    from: `"${userAccount.name || userAccount.email}" <${userAccount.email}>`,
    to: toEmail,
    subject: subject,
    html: htmlBody,
    headers: {
      "X-Jupiter-Generated": "Digest",
    },
  };

  let attempts = 0;
  const maxAttempts = 2; // Initial attempt + 1 retry after refresh

  while (attempts < maxAttempts) {
    attempts++;
    try {
      if (!transporter) {
        // This case would be hit if the initial transporter setup (OAuth or password) failed.
        // Or if retrying and the refreshed OAuth transporter setup failed.
        logger.error(
          `Failed to configure any email transporter for ${userAccount.email} on attempt ${attempts}.`
        );
        throw new Error(
          `Could not initialize email transporter for ${userAccount.email}. Check account configuration and logs.`
        );
      }
      logger.info(
        `Attempt ${attempts} to send digest email to ${toEmail} from ${userAccount.email}`
      );
      const info = await transporter.sendMail(mailOptions);
      logger.info(
        `Digest email sent successfully to ${toEmail}. Message ID: ${info.messageId}`
      );
      return; // Success, exit function
    } catch (error: any) {
      logger.error(
        `Attempt ${attempts} failed to send digest email to ${toEmail} from ${userAccount.email}: ${error.message}`
      );

      // Check if it's a Google OAuth error and if we can refresh (and haven't retried yet)
      if (
        attempts < maxAttempts &&
        userAccount.provider === "google" &&
        userAccount.refresh_token_encrypted &&
        (error.code === "EAUTH" || // Common Nodemailer OAuth2 error code
          error.message?.includes("invalid_grant") ||
          error.message?.includes("Token has expired") ||
          error.message?.includes("Can't create new access token for user") || // Original error
          error.message?.toLowerCase().includes("authenticationfailed"))
      ) {
        logger.info(
          `Attempting Google token refresh for ${userAccount.email} after send failure.`
        );
        try {
          const refreshed = await refreshGoogleAccessToken(
            userAccount.refresh_token_encrypted
          );

          if (refreshed && refreshed.newAccessToken) {
            currentAccessToken = refreshed.newAccessToken; // This is the raw new token
            userAccount.access_token_encrypted = encrypt(currentAccessToken); // Update in-memory account detail
            if (refreshed.newRefreshToken) {
              userAccount.refresh_token_encrypted = encrypt(
                refreshed.newRefreshToken
              );
            }
            userAccount.token_expires_at = refreshed.newExpiresAt;

            const supabaseAdmin = createNewSupabaseAdminClient();
            await updateEmailAccountTokens(
              supabaseAdmin,
              userAccount.id, // Assuming userAccount has an 'id' field for accountId
              userAccount.access_token_encrypted,
              refreshed.newExpiresAt,
              refreshed.newRefreshToken
                ? userAccount.refresh_token_encrypted
                : null
            );

            logger.info(
              `Google token refreshed successfully for ${userAccount.email}. Re-configuring transporter.`
            );
            // Re-create transporter with the new access token
            transporter = createTransporter(currentAccessToken);
            if (!transporter) {
              // If createTransporter returns null even after refresh, something is wrong.
              logger.error(
                `Failed to re-configure Google OAuth transporter for ${userAccount.email} after token refresh. Aborting retry.`
              );
              throw new Error( // Throw a new error or the original error
                `Failed to re-initialize Google OAuth transporter after token refresh for ${userAccount.email}.`
              );
            }
            logger.info(
              `Retrying email send for ${userAccount.email} with new token.`
            );
            continue; // Continue to the next iteration of the while loop to retry sending
          } else {
            logger.warn(
              `Google token refresh failed or did not return a new access token for ${userAccount.email}. Original send error will be thrown.`
            );
            throw error; // Throw original error if refresh didn't yield a token
          }
        } catch (refreshError: any) {
          logger.error(
            `Error during token refresh process for ${userAccount.email}: ${refreshError.message}`
          );
          throw error; // Throw original send error if refresh process itself fails
        }
      }
      // If not a refreshable error, or max attempts reached, or not Google OAuth with refresh token
      if (attempts >= maxAttempts) {
        logger.error(
          `Max send attempts reached for ${userAccount.email}. Last error: ${error.message}`
        );
      }
      throw new Error(
        `Failed to send email after ${attempts} attempt(s): ${error.message}`
      );
    }
  }
}
