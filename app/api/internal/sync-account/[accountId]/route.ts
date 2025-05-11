import { getSupabaseAdminClient } from "@/lib/auth/admin"; // New admin client
import { decrypt } from "@/lib/auth/encryption"; // Real decrypt
import { Database } from "@/lib/database.types";
import { EmailCredentials, fetchNewEmailUids } from "@/lib/email/fetchEmails"; // Real fetchNewEmailUids and EmailCredentials
import { fetchAndParseEmail, ParsedEmailData } from "@/lib/email/parseEmail"; // Real fetchAndParseEmail, Added ParsedEmailData import
import { assignConversationId, storeEmail } from "@/lib/email/storeEmails"; // Real storeEmail
import { SupabaseClient } from "@supabase/supabase-js"; // Correct import for SupabaseClient type
import { ImapFlow } from "imapflow"; // Real ImapFlow
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid"; // Import uuid
// Assuming ParsedEmailData might be needed for typing if not inferred
// import { ParsedEmailData } from "@/lib/email/parseEmail";

// Remove all placeholder functions and supabase_placeholder, logger_placeholder

const logger = {
  // Simple console logger for now
  info: (...args: any[]) => console.log("[SYNC_ACCOUNT_INFO]", ...args),
  warn: (...args: any[]) => console.warn("[SYNC_ACCOUNT_WARN]", ...args),
  error: (...args: any[]) => console.error("[SYNC_ACCOUNT_ERROR]", ...args),
};

export const maxDuration = 300; // 5 minutes max for single account sync, increased slightly

interface EmailAccountDetails {
  id: string;
  email: string;
  imap_host: string;
  imap_port: number;
  password_encrypted: string;
  last_synced_uid: number | null;
  last_synced_at: string | null;
  user_id: string; // Added user_id
}

async function getEmailAccountDetails(
  supabase: SupabaseClient<Database>,
  accountId: string
): Promise<EmailAccountDetails | null> {
  const { data, error } = await supabase
    .from("email_accounts")
    .select(
      "id, email, imap_host, imap_port, password_encrypted, last_synced_uid, last_synced_at, user_id"
    )
    .eq("id", accountId)
    .single<EmailAccountDetails>(); // Specify the expected return type for single()

  console.log("data", data);
  console.log("error", error);

  if (error) {
    logger.error(
      `Error fetching email account details for ${accountId}:`,
      error.message
    );
    return null;
  }
  return data;
}

// Helper function to get or create folder_id
async function getOrCreateFolderId(
  supabase: SupabaseClient<Database>,
  accountId: string,
  folderPath: string
): Promise<string> {
  // Check if folder exists
  let { data: existingFolder, error: fetchError } = await supabase
    .from("folders")
    .select("id")
    .eq("account_id", accountId)
    .eq("name", folderPath) // Assuming 'name' column stores the IMAP path
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116: "Searched for a single row, but 0 rows were found"
    logger.error(
      `Error fetching folder ${folderPath} for account ${accountId}:`,
      fetchError.message
    );
    throw new Error(
      `Failed to fetch folder ${folderPath}: ${fetchError.message}`
    );
  }

  if (existingFolder) {
    return existingFolder.id;
  }

  // Folder does not exist, create it
  const newFolderId = uuidv4();
  const { data: newFolder, error: insertError } = await supabase
    .from("folders")
    .insert({
      id: newFolderId,
      account_id: accountId,
      name: folderPath, // IMAP path
      type: "inbox", // Changed from "mailbox" to "inbox" based on user's check constraint
    })
    .select("id")
    .single();

  if (insertError) {
    logger.error(
      `Error creating folder ${folderPath} for account ${accountId}:`,
      insertError.message
    );
    throw new Error(
      `Failed to create folder ${folderPath}: ${insertError.message}`
    );
  }

  if (!newFolder) {
    logger.error(
      `Failed to create folder ${folderPath} for account ${accountId} - no data returned after insert.`
    );
    throw new Error(
      `Failed to create folder ${folderPath} - no data returned.`
    );
  }
  logger.info(
    `Created folder ${folderPath} with ID ${newFolder.id} for account ${accountId}`
  );
  return newFolder.id;
}

export async function POST(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  const accountId = params.accountId;
  const supabase = getSupabaseAdminClient(); // Use the admin client

  logger.info(`Sync request received for account: ${accountId}`);

  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  if (token !== process.env.INTERNAL_API_SECRET) {
    logger.warn(`Unauthorized sync attempt for account: ${accountId}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let imapClient: ImapFlow | null = null; // Declare here for access in finally block
  // Declare variables that need to be accessed in the final response here
  let newUidsCount = 0;
  let processedCount = 0;
  let finalHighestUid = 0;

  try {
    const accountDetails = await getEmailAccountDetails(supabase, accountId);

    if (!accountDetails) {
      throw new Error(
        `Email account ${accountId} not found or error fetching details (see previous logs).`
      );
    }
    finalHighestUid = accountDetails.last_synced_uid || 0; // Initialize with current value

    logger.info(
      `Account details fetched for ${accountDetails.email}. Last synced UID: ${accountDetails.last_synced_uid}, Last synced at: ${accountDetails.last_synced_at}`
    );

    const password = decrypt(accountDetails.password_encrypted);
    const credentials: EmailCredentials = {
      email: accountDetails.email,
      password_encrypted: accountDetails.password_encrypted, // Or pass decrypted password directly if fetchNewEmailUids is adapted
      password: password, // Pass decrypted password
      imap_host: accountDetails.imap_host,
      imap_port: accountDetails.imap_port,
    };

    // IMAP Client Setup
    imapClient = new ImapFlow({
      host: credentials.imap_host,
      port: credentials.imap_port,
      secure: true, // Assuming true, adjust if necessary from accountDetails
      auth: {
        user: credentials.email,
        pass: password,
      },
      logger: console, // Enable imapflow detailed logging
    });

    logger.info(`Connecting to IMAP for account ${accountDetails.email}...`);
    await imapClient.connect();
    logger.info(`Connected. Opening INBOX for ${accountDetails.email}...`);
    await imapClient.mailboxOpen("INBOX");
    logger.info(`INBOX opened for ${accountDetails.email}.`);

    const lastSyncedUid = accountDetails.last_synced_uid || 0;
    // const lastSyncedAt = accountDetails.last_synced_at; // Not used by fetchNewEmailUids yet

    logger.info(
      `Fetching new emails for account ${accountDetails.email} since UID ${lastSyncedUid}`
    );
    // Pass the connected imapClient to fetchNewEmailUids
    const uidsToProcess = await fetchNewEmailUids(
      imapClient, // Pass the client
      lastSyncedUid
      // lastSyncedAt // Not currently used by fetchNewEmailUids
    );
    newUidsCount = uidsToProcess.length;

    if (uidsToProcess.length === 0) {
      logger.info(`No new emails for account ${accountDetails.email}`);
      await supabase
        .from("email_accounts")
        .update({ last_synced_at: new Date().toISOString() } as any) // Cast to any if type error persists
        .eq("id", accountId);
      // No need to update finalHighestUid here as it remains the same
      // Return early as no emails to process
      return NextResponse.json({
        success: true,
        message: "No new emails to sync.",
        accountId,
        totalNewEmails: 0,
        processedEmails: 0,
        highestUidProcessed: finalHighestUid,
      });
    }

    logger.info(
      `Found ${uidsToProcess.length} new emails for account ${
        accountDetails.email
      }. UIDs: ${uidsToProcess.join(", ")}`
    );

    // Sort UIDs in ascending order to process oldest first and update last_synced_uid correctly
    uidsToProcess.sort((a, b) => a - b);
    let currentBatchHighestUid = lastSyncedUid; // Track highest UID within the batch for DB update

    const batchSize = 5; // Process in smaller batches to avoid overwhelming server or function timeout

    for (let i = 0; i < uidsToProcess.length; i += batchSize) {
      const batchUids = uidsToProcess.slice(i, i + batchSize);
      logger.info(
        `Processing batch for account ${accountId}: UIDs ${batchUids.join(
          ", "
        )}`
      );

      const batchResults = await Promise.allSettled(
        batchUids.map(async (uid) => {
          try {
            // fetchAndParseEmail now uses the passed client
            const parsedEmail: ParsedEmailData = await fetchAndParseEmail(
              imapClient!,
              uid
            );

            // Get or create the folder_id (UUID)
            const currentMailbox = imapClient!.mailbox;
            let currentMailboxPath = "inbox";
            if (currentMailbox instanceof Boolean) {
              // do nothing
            } else if (currentMailbox instanceof Object) {
              currentMailboxPath = currentMailbox.path;
            }

            const folderUuid = await getOrCreateFolderId(
              supabase,
              accountId,
              currentMailboxPath
            );

            const {
              success: storeSuccess,
              emailId,
              error: storeError,
            } = await storeEmail(
              supabase,
              accountId, // accountId is correct here
              parsedEmail,
              folderUuid // Pass the actual folder UUID
            );

            if (!storeSuccess || !emailId) {
              throw new Error(
                `Failed to store email UID ${uid}: ${
                  storeError || "Unknown store error"
                }`
              );
            }

            // Pass necessary headers from parsedEmail to assignConversationId
            await assignConversationId(
              supabase,
              accountId,
              emailId,
              parsedEmail.messageId,
              parsedEmail.inReplyTo,
              parsedEmail.references
            );

            currentBatchHighestUid = Math.max(currentBatchHighestUid, uid);
            logger.info(
              `Successfully processed and stored email UID ${uid} for account ${accountId}. Email ID: ${emailId}`
            );
            return { uid, status: "success", emailId };
          } catch (emailError: any) {
            logger.error(
              `Error processing email UID ${uid} for account ${accountId}:`,
              emailError.message,
              emailError.stack // Log stack for more details
            );
            return { uid, status: "failed", error: emailError.message };
          }
        })
      );

      const successfulInBatch = batchResults.filter(
        (r) => r.status === "fulfilled" && (r.value as any).status === "success"
      ).length;
      processedCount += successfulInBatch;

      // Update sync info (last_synced_uid, last_synced_at) in DB for the account
      // Only update if there were successful operations in the batch to ensure currentBatchHighestUid is valid for processed emails
      if (successfulInBatch > 0) {
        finalHighestUid = currentBatchHighestUid; // Update the overall highest UID processed
        await supabase
          .from("email_accounts")
          .update({
            last_synced_uid: finalHighestUid,
            last_synced_at: new Date().toISOString(),
          } as any) // Cast to any if type error persists
          .eq("id", accountId);
        logger.info(
          `Batch processed for account ${accountId}. Updated last_synced_uid to ${finalHighestUid}.`
        );
      } else {
        logger.info(
          `Batch processed for account ${accountId}, but no emails successfully stored in this batch. last_synced_uid not updated.`
        );
      }
    }
  } catch (error: any) {
    logger.error(
      `Sync failed for account ${accountId}:`,
      error.message,
      error.stack
    );
    return NextResponse.json(
      { error: `Sync failed for account ${accountId}`, details: error.message },
      { status: 500 }
    );
  } finally {
    if (imapClient && imapClient.usable) {
      logger.info(`Logging out IMAP client for account ${accountId}...`);
      await imapClient.logout();
      logger.info(`IMAP client logged out for account ${accountId}.`);
    }
  }

  logger.info(
    `Sync completed for account ${accountId}. Total new UIDs found: ${newUidsCount}. Successfully processed: ${processedCount}.`
  );
  return NextResponse.json({
    success: true,
    accountId,
    totalNewEmails: newUidsCount,
    processedEmails: processedCount,
    highestUidProcessed: finalHighestUid,
  });
}
