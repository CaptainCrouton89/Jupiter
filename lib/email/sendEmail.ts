import { EmailAccountDetails } from "@/app/api/internal/sync-account/[accountId]/supabaseOps"; // Re-using this interface
import { decrypt } from "@/lib/auth/encryption";
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

  // Try OAuth for Google first
  if (userAccount.provider === "google" && userAccount.access_token_encrypted) {
    try {
      logger.info(
        `Attempting to send email via Google OAuth for ${userAccount.email}`
      );
      const decryptedAccessToken = decrypt(userAccount.access_token_encrypted);
      if (!decryptedAccessToken) {
        throw new Error("Decrypted access token is empty.");
      }

      transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true, // use SSL
        auth: {
          type: "OAuth2",
          user: userAccount.email,
          accessToken: decryptedAccessToken,
          // Optionally, if you have refresh token logic and client ID/secret:
          // clientId: process.env.GOOGLE_CLIENT_ID,
          // clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          // refreshToken: userAccount.refresh_token_encrypted ? decrypt(userAccount.refresh_token_encrypted) : undefined,
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === "production", // More secure for production
        },
      });
      logger.info(
        `Nodemailer transporter configured for Google OAuth for ${userAccount.email}.`
      );
    } catch (oauthError: any) {
      logger.warn(
        `Google OAuth setup failed for ${userAccount.email}: ${oauthError.message}. Falling back to password auth.`
      );
      // Fallback to password auth will be handled if transporter is still undefined
    }
  }

  // If not Google OAuth or if Google OAuth setup failed, try password auth
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
  };

  try {
    logger.info(
      `Attempting to send digest email to ${toEmail} from ${userAccount.email}`
    );
    const info = await transporter.sendMail(mailOptions);
    logger.info(
      `Digest email sent successfully to ${toEmail}. Message ID: ${info.messageId}`
    );
  } catch (error: any) {
    logger.error(
      `Failed to send digest email to ${toEmail} from ${userAccount.email}: ${error.message}`
    );
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
