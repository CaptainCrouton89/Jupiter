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
  folderId: string = "INBOX" // Default folder
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
        console.error("Error checking for existing email:", checkError);
      } else if (existingEmail) {
        // Email already exists, return existing ID
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
      folder_id: folderId,
      message_id: messageId,
      // These are supposed to be inserted into email_recipients table, not emails table
      // But we'll store them in the email for now
      from_email: parsedEmail.from?.address || "unknown@example.com",
      from_name: parsedEmail.from?.name,
      // Optional fields as per database schema
      subject: parsedEmail.subject || "(No Subject)",
      received_at: parsedEmail.date
        ? new Date(parsedEmail.date).toISOString()
        : new Date().toISOString(),
      read: parsedEmail.isRead, // Use isRead from ParsedEmailData
      starred: false, // Default to not starred
      has_attachments: parsedEmail.attachments.length > 0,
      body_html: parsedEmail.html,
      body_text: parsedEmail.text,
      // The conversation_id will be handled separately
    };

    // Insert the email into the database
    const { data: emailResult, error: emailError } = await supabase
      .from("emails")
      .insert(emailData)
      .select("id")
      .single();

    if (emailError) {
      console.error("Error inserting email:", emailError);
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
        console.error("Error inserting attachments:", attachmentsError);
        // We don't fail the entire operation if attachments fail, just log it
      }
    }

    return { success: true, emailId };
  } catch (error) {
    console.error("Error storing email:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown error storing email",
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
  folderId: string = "INBOX",
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (let i = 0; i < parsedEmails.length; i++) {
    const email = parsedEmails[i];
    const result = await storeEmail(supabase, accountId, email, folderId);

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
  references: string[] | null
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
        throw new Error(`Failed to update conversation ID: ${error.message}`);
      }

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
        throw new Error(`Failed to update conversation ID: ${error.message}`);
      }

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
        throw new Error(`Failed to update conversation ID: ${error.message}`);
      }

      return { success: true, conversationId };
    }

    // No related emails found, create new conversation
    const conversationId = uuidv4();

    const { error } = await supabase
      .from("emails")
      .update({ conversation_id: conversationId })
      .eq("id", emailId);

    if (error) {
      throw new Error(`Failed to update conversation ID: ${error.message}`);
    }

    return { success: true, conversationId };
  } catch (error) {
    console.error("Error assigning conversation ID:", error);
    return {
      success: false,
      conversationId: null,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error assigning conversation ID",
    };
  }
}

/**
 * Update the read status of an email in the database
 */
export async function updateEmailReadStatus(
  supabase: SupabaseClient<Database>,
  emailId: string,
  read: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("emails")
      .update({ read })
      .eq("id", emailId);

    if (error) {
      throw new Error(`Failed to update read status: ${error.message}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating read status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error updating read status",
    };
  }
}
