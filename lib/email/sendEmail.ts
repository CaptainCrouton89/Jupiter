import { EmailAccountDetails } from "@/app/api/internal/sync-account/[accountId]/supabaseOps"; // Re-using this interface
import { decrypt } from "@/lib/auth/encryption";
import nodemailer from "nodemailer";

// Basic logger placeholder - replace with your actual logger if you have one
const logger = {
  info: (...args: any[]) => console.log("[sendEmail INFO]", ...args),
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
  let decryptedPassword = "";
  try {
    if (!userAccount.password_encrypted) {
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

  // Ensure SMTP details are present in EmailAccountDetails or fetch them if necessary.
  // For now, assuming they are part of the userAccount object passed in.
  // The EmailAccountDetails from supabaseOps might not have SMTP host/port.
  // We will need to adjust fetching or the interface if it doesn't.
  // For the `email_accounts` table used in `getEmailAccountDetailsFromDb`, it does NOT have SMTP fields.
  // This will need to be addressed. For now, proceeding with placeholder names.

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

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465 || smtpPort === 587, // True for 465, STARTTLS usually on 587
    auth: {
      user: userAccount.email, // or userAccount.username if different
      pass: decryptedPassword,
    },
    tls: {
      // do not fail on invalid certs if using self-signed or local server
      // For production, this should ideally be true or configured carefully.
      rejectUnauthorized: false, // Adjust as per your SMTP server's requirements
    },
  });

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
