import { v4 as uuidv4 } from "uuid";
import { supabase } from "./client"; // Assumes supabase client is exported from here

const ATTACHMENT_BUCKET = "email-attachments";

/**
 * Generates a signed URL for uploading an attachment.
 * The client will use this URL to upload the file directly to Supabase Storage.
 * @param userId The ID of the user uploading the file.
 * @param emailId The ID of the email this attachment is associated with (can be a temporary ID if email is not yet saved).
 * @param fileName The original name of the file.
 * @returns An object containing the signed upload URL, the final file path, or an error.
 */
export async function getAttachmentUploadUrl(
  userId: string,
  emailId: string,
  fileName: string
): Promise<{
  uploadUrl: string | null;
  filePath: string | null;
  token: string | null; // The token is part of the signed URL, but sometimes useful separately
  error: any | null;
}> {
  try {
    const uniqueFileName = `${uuidv4()}-${fileName.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    )}`;
    const filePath = `${userId}/${emailId}/${uniqueFileName}`;

    const { data, error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Error creating signed upload URL:", error);
      return { uploadUrl: null, filePath: null, token: null, error };
    }

    return {
      uploadUrl: data?.signedUrl || null,
      filePath: data?.path || filePath, // Supabase returns the full path in data.path
      token: data?.token || null,
      error: null,
    };
  } catch (err: any) {
    console.error("Catch block: Error creating signed upload URL:", err);
    return { uploadUrl: null, filePath: null, token: null, error: err };
  }
}

/**
 * Generates a time-limited signed URL for downloading an attachment.
 * @param filePath The full path to the file in Supabase Storage.
 * @param expiresInSeconds The duration for which the URL will be valid (default: 60 seconds).
 * @returns An object containing the signed download URL or an error.
 */
export async function getAttachmentDownloadUrl(
  filePath: string,
  expiresInSeconds = 60
): Promise<{ downloadUrl: string | null; error: any | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error) {
      console.error("Error creating signed download URL:", error);
      return { downloadUrl: null, error };
    }
    return { downloadUrl: data?.signedUrl || null, error: null };
  } catch (err: any) {
    console.error("Catch block: Error creating signed download URL:", err);
    return { downloadUrl: null, error: err };
  }
}

/**
 * Deletes an attachment from Supabase Storage.
 * @param filePath The full path to the file in Supabase Storage.
 * @returns An object indicating success or an error.
 */
export async function deleteAttachment(
  filePath: string
): Promise<{ success: boolean; error: any | null }> {
  try {
    const { error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error("Error deleting attachment:", error);
      return { success: false, error };
    }
    return { success: true, error: null };
  } catch (err: any) {
    console.error("Catch block: Error deleting attachment:", err);
    return { success: false, error: err };
  }
}

/**
 * Lists all attachments for a specific email given its user ID and email ID path prefix.
 * @param userId The ID of the user.
 * @param emailId The ID of the email.
 * @returns An object containing an array of file objects or an error.
 */
export async function listEmailAttachments(
  userId: string,
  emailId: string
): Promise<{ files: any[] | null; error: any | null }> {
  try {
    const folderPath = `${userId}/${emailId}`;
    const { data, error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .list(folderPath);

    if (error) {
      console.error("Error listing attachments:", error);
      return { files: null, error };
    }
    return { files: data || [], error: null };
  } catch (err: any) {
    console.error("Catch block: Error listing attachments:", err);
    return { files: null, error: err };
  }
}

// It might also be useful to have a function to get a public URL if RLS allows public reads for certain paths,
// or if the bucket is public but paths are obscured.
// For now, focusing on signed URLs as they are generally more secure for private data.
