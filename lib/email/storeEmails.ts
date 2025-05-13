import { Database } from "@/lib/database.types";
import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { ParsedEmailData } from "./parseEmail";

/**
 * Type definitions for database insertion
 */
type EmailInsert = Database["public"]["Tables"]["emails"]["Insert"];
type AttachmentInsert = Database["public"]["Tables"]["attachments"]["Insert"];

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
      imap_uid: parsedEmail.imapUid ? String(parsedEmail.imapUid) : null, // Store IMAP UID as string
      // These are supposed to be inserted into email_recipients table, not emails table
      // But we'll store them in the email for now
      from_email: parsedEmail.from?.address || "unknown@example.com",
      from_name: parsedEmail.from?.name,
      // Optional fields as per database schema
      subject: parsedEmail.subject || "(No Subject)",
      received_at: parsedEmail.date
        ? new Date(parsedEmail.date).toISOString()
        : new Date().toISOString(),
      starred: false, // Default to not starred
      has_attachments: parsedEmail.attachments.length > 0,
      body_html: parsedEmail.html,
      body_text: parsedEmail.text,
      category: parsedEmail.category, // Save the AI-determined category
      // The conversation_id will be handled separately
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

    // Store attachments if any
    if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
      const attachmentsData: AttachmentInsert[] = parsedEmail.attachments.map(
        (attachment) => ({
          id: uuidv4(),
          email_id: emailId,
          filename: attachment.filename || "unnamed_attachment",
          content_type: attachment.contentType,
          size: attachment.size,
          storage_path: `attachments/${emailId}/${uuidv4()}`, // Generate path for future storage
          // content_id is not in the database schema, so we can't store it directly
        })
      );

      const { error: attachmentsError } = await supabase
        .from("attachments")
        .insert(attachmentsData);

      if (attachmentsError) {
        // console.error("Error inserting attachments:", attachmentsError); // Replaced with logger
        logger.warn(
          `[storeEmail] Error inserting attachments for email (ID: ${emailId}, MessageID: ${messageId}) for account ${accountId}:`,
          attachmentsError.message
        );
        // We don't fail the entire operation if attachments fail, just log it
      }
    }

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

/**
 * Check if conversation exists based on Message-ID/References/In-Reply-To
 * and either assign existing conversation_id or create a new one
 */
export async function assignConversationId(
  supabase: SupabaseClient<Database>,
  accountId: string,
  emailId: string,
  messageId: string | null,
  inReplyTo: string | null,
  references: string[] | null,
  logger: any // Added logger parameter
): Promise<{
  success: boolean;
  conversationId: string | null;
  error?: string;
}> {
  try {
    // If we don't have message references, just create a new conversation
    if (!inReplyTo && (!references || references.length === 0)) {
      const conversationId = uuidv4();

      // Update the email with the new conversation ID
      const { error } = await supabase
        .from("emails")
        .update({ conversation_id: conversationId })
        .eq("id", emailId);

      if (error) {
        logger.error(
          `[assignConversationId] Failed to update conversation ID for new conversation (EmailID: ${emailId}):`,
          error.message
        );
        throw new Error(`Failed to update conversation ID: ${error.message}`);
      }

      logger.info(
        `[assignConversationId] Assigned new conversation ID ${conversationId} to email ${emailId}`
      );
      return { success: true, conversationId };
    }

    // Collect all potential related message IDs
    const relatedIds = [
      ...(references || []),
      ...(inReplyTo ? [inReplyTo] : []),
    ].filter(Boolean);

    if (relatedIds.length === 0) {
      // No related messages, create new conversation
      const conversationId = uuidv4();

      const { error } = await supabase
        .from("emails")
        .update({ conversation_id: conversationId })
        .eq("id", emailId);

      if (error) {
        logger.error(
          `[assignConversationId] Failed to update conversation ID for new conversation (no related) (EmailID: ${emailId}):`,
          error.message
        );
        throw new Error(`Failed to update conversation ID: ${error.message}`);
      }

      logger.info(
        `[assignConversationId] Assigned new conversation ID ${conversationId} to email ${emailId} (no related found)`
      );
      return { success: true, conversationId };
    }

    // Look for any related emails in the database
    const { data: relatedEmails, error: queryError } = await supabase
      .from("emails")
      .select("id, conversation_id, message_id")
      .eq("account_id", accountId)
      .in("message_id", relatedIds)
      .not("conversation_id", "is", null);

    if (queryError) {
      logger.error(
        `[assignConversationId] Failed to query related emails for email ${emailId} (MessageID: ${
          messageId || "N/A"
        }):`,
        queryError.message
      );
      throw new Error(`Failed to query related emails: ${queryError.message}`);
    }

    if (relatedEmails && relatedEmails.length > 0) {
      // Use the conversation ID of the first related email
      const conversationId = relatedEmails[0].conversation_id;

      // Update the current email with this conversation ID
      const { error } = await supabase
        .from("emails")
        .update({ conversation_id: conversationId })
        .eq("id", emailId);

      if (error) {
        logger.error(
          `[assignConversationId] Failed to update conversation ID from related email (EmailID: ${emailId}, RelatedConvID: ${conversationId}):`,
          error.message
        );
        throw new Error(`Failed to update conversation ID: ${error.message}`);
      }

      logger.info(
        `[assignConversationId] Assigned existing conversation ID ${conversationId} to email ${emailId} from related email`
      );
      return { success: true, conversationId };
    }

    // No related emails found, create new conversation
    const conversationId = uuidv4();

    const { error } = await supabase
      .from("emails")
      .update({ conversation_id: conversationId })
      .eq("id", emailId);

    if (error) {
      logger.error(
        `[assignConversationId] Failed to update conversation ID for new conversation (no related found post-query) (EmailID: ${emailId}):`,
        error.message
      );
      throw new Error(`Failed to update conversation ID: ${error.message}`);
    }
    logger.info(
      `[assignConversationId] Assigned new conversation ID ${conversationId} to email ${emailId} (no related found post-query)`
    );

    return { success: true, conversationId };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error in assignConversationId";
    logger.error(
      `[assignConversationId] Catch-all error for email ${emailId} (MessageID: ${
        messageId || "N/A"
      }):`,
      errorMessage
    );
    return {
      success: false,
      conversationId: null,
      error: errorMessage,
    };
  }
}

/**
 * Update the read status of an email in the database
 */
export async function updateEmailReadStatus(
  supabase: SupabaseClient<Database>,
  emailId: string,
  read: boolean,
  logger: any // Added logger parameter
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("emails")
      .update({ read })
      .eq("id", emailId);

    if (error) {
      logger.error(
        `[updateEmailReadStatus] Error updating read status for email ${emailId} to ${read}:`,
        error.message
      );
      return { success: false, error: error.message };
    }
    logger.info(
      `[updateEmailReadStatus] Successfully updated read status for email ${emailId} to ${read}`
    );
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error updating read status";
    logger.error(
      `[updateEmailReadStatus] Catch-all error for email ${emailId}:`,
      errorMessage
    );
    return { success: false, error: errorMessage };
  }
}
