import { encrypt } from "@/lib/auth/encryption";
import { Database } from "@/lib/database.types";
import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { ParsedEmailData } from "./parseEmail";

/**
 * Type definitions for database insertion
 */
type EmailInsert = Database["public"]["Tables"]["emails"]["Insert"];

/**
 * Store a single parsed email in the database
 */
export async function storeEmail(
  supabase: SupabaseClient<Database>,
  accountId: string,
  parsedEmail: ParsedEmailData,
  logger: any // Added logger parameter
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  try {
    // Check if email already exists by message-id to prevent duplicates
    if (parsedEmail.messageId) {
      const { data: existingEmail, error: checkError } = await supabase
        .from("emails")
        .select("id")
        .eq("account_id", accountId)
        .eq("message_id", parsedEmail.messageId)
        .maybeSingle();

      if (checkError) {
        // console.error("Error checking for existing email:", checkError); // Replaced with logger
        logger.warn(
          `[storeEmail] Error checking for existing email (MessageID: ${
            parsedEmail.messageId || "N/A"
          }) for account ${accountId}:`,
          checkError.message
        );
        // Continue, as this is not a fatal error for storing the email itself if it's new
      } else if (existingEmail) {
        // Email already exists, return existing ID
        logger.info(
          `[storeEmail] Email with MessageID ${parsedEmail.messageId} already exists for account ${accountId}. Skipping. ID: ${existingEmail.id}`
        );
        return {
          success: true,
          emailId: existingEmail.id,
          error: "Email already exists in database",
        };
      }
    }

    // Message ID is required by database schema
    const messageId = parsedEmail.messageId || `generated-${uuidv4()}`;

    // Format the email data for insertion
    const emailData: EmailInsert = {
      id: uuidv4(),
      account_id: accountId,
      message_id: messageId,
      imap_uid: parsedEmail.imapUid ? String(parsedEmail.imapUid) : null,
      from_email: parsedEmail.from?.address
        ? encrypt(parsedEmail.from.address)
        : encrypt("unknown@example.com"),
      from_name: parsedEmail.from?.name ? encrypt(parsedEmail.from.name) : null,
      subject: parsedEmail.subject
        ? encrypt(parsedEmail.subject)
        : encrypt("(No Subject)"),
      received_at: parsedEmail.date
        ? new Date(parsedEmail.date).toISOString()
        : new Date().toISOString(),
      body_html: parsedEmail.html ? encrypt(parsedEmail.html) : null,
      body_text: parsedEmail.text ? encrypt(parsedEmail.text) : null,
      category: parsedEmail.category,
    };

    // Insert the email into the database
    const { data: emailResult, error: emailError } = await supabase
      .from("emails")
      .insert(emailData)
      .select("id")
      .single();

    if (emailError) {
      // console.error("Error inserting email:", emailError); // Replaced with logger
      logger.error(
        `[storeEmail] Error inserting email (MessageID: ${messageId}) for account ${accountId}:`,
        emailError.message
      );
      return {
        success: false,
        error: `Failed to insert email: ${emailError.message}`,
      };
    }

    const emailId = emailResult.id;

    logger.info(
      `[storeEmail] Successfully stored email (ID: ${emailId}, MessageID: ${messageId}) for account ${accountId}.`
    );
    return { success: true, emailId };
  } catch (error) {
    // console.error("Error storing email:", error); // Replaced with logger
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error storing email";
    logger.error(
      `[storeEmail] Catch-all error storing email (MessageID: ${
        parsedEmail.messageId || "N/A"
      }) for account ${accountId}:`,
      errorMessage
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Store multiple parsed emails in the database
 */
export async function storeEmails(
  supabase: SupabaseClient<Database>,
  accountId: string,
  parsedEmails: ParsedEmailData[],
  logger: any, // Added logger parameter
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (let i = 0; i < parsedEmails.length; i++) {
    const email = parsedEmails[i];
    const result = await storeEmail(
      supabase,
      accountId,
      email,
      logger // Pass logger
    );

    if (result.success) {
      results.success++;
    } else {
      results.failed++;
      if (result.error) {
        results.errors.push(`Failed to store email: ${result.error}`);
      }
    }

    // Report progress if callback provided
    if (onProgress) {
      onProgress(i + 1, parsedEmails.length);
    }
  }

  return results;
}
