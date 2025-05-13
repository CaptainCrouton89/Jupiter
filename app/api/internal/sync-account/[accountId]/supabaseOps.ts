import { Database } from "@/lib/database.types";
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";

export interface EmailAccountDetails {
  id: string;
  email: string;
  name: string | null;
  imap_host: string | null;
  imap_port: number | null;
  smtp_host: string | null;
  smtp_port: number | null;
  password_encrypted: string | null;
  last_synced_uid: number | null;
  last_synced_at: string | null;
  user_id: string;
  is_active: boolean | null;
  provider?: string | null;
  access_token_encrypted?: string | null;
  refresh_token_encrypted?: string | null;
  token_expires_at?: string | null;
}

export async function getEmailAccountDetailsFromDb(
  supabase: SupabaseClient<Database>,
  accountId: string
): Promise<EmailAccountDetails | null> {
  const { data, error } = await supabase
    .from("email_accounts")
    .select(
      "id, email, name, imap_host, imap_port, smtp_host, smtp_port, password_encrypted, last_synced_uid, last_synced_at, user_id, is_active, provider, access_token_encrypted, refresh_token_encrypted, token_expires_at"
    )
    .eq("id", accountId)
    .single<EmailAccountDetails>();

  if (error) {
    logger.error(
      `Error fetching email account details for ${accountId}:`,
      error.message
    );
    return null;
  }
  return data;
}

export async function updateSyncLog(
  supabase: SupabaseClient<Database>,
  jobId: string,
  status: string,
  errorMessage?: string | null,
  isTerminal: boolean = false,
  processedCount?: number,
  totalToProcess?: number
) {
  const updatePayload: any = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (errorMessage) {
    updatePayload.error_message = errorMessage;
  }
  if (isTerminal) {
    updatePayload.completed_at = new Date().toISOString();
  }
  if (typeof processedCount === "number") {
    updatePayload.uids_processed_count = processedCount;
  }
  if (
    typeof totalToProcess === "number" &&
    (status === "fetching_uids" ||
      status === "started" ||
      status === "processing_emails")
  ) {
    updatePayload.total_uids_to_process = totalToProcess;
  }

  try {
    const { error } = await supabase
      .from("sync_logs")
      .update(updatePayload)
      .eq("job_id", jobId);
    if (error) {
      logger.error(
        `Failed to update sync_log for job ${jobId} to status ${status}:`,
        error.message
      );
    }
  } catch (e) {
    logger.error(
      `Exception while updating sync_log for job ${jobId} to status ${status}:`,
      e
    );
  }
}

export async function updateEmailAccountSyncStatus(
  supabase: SupabaseClient<Database>,
  accountId: string,
  lastSyncedUid: number,
  loggerToUse: typeof logger = logger
) {
  const { error: updateError } = await supabase
    .from("email_accounts")
    .update({
      last_synced_uid: lastSyncedUid,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  if (updateError) {
    loggerToUse.error(
      `Failed to update last_synced_uid for account ${accountId}:`,
      updateError.message
    );
  } else {
    loggerToUse.info(
      `Successfully updated last_synced_uid to ${lastSyncedUid} for account ${accountId}.`
    );
  }
}
