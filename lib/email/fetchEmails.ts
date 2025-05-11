import { decrypt } from "@/lib/auth/encryption";
import { createClient } from "@/lib/auth/server";
import { ImapFlow } from "imapflow";

/**
 * Fetches recent email UIDs from the INBOX of a given email account
 * @param accountId The email account ID in the database
 * @param limit Maximum number of emails to fetch (defaults to 50)
 * @returns Array of UIDs for the most recent emails in the INBOX
 */
export async function fetchRecentEmailUids(
  accountId: string,
  limit: number = 50
): Promise<number[]> {
  const supabase = await createClient();

  // 1. Get the email account details from Supabase
  const { data: account, error: accountError } = await supabase
    .from("email_accounts")
    .select("email, password_encrypted, imap_host, imap_port")
    .eq("id", accountId)
    .single();

  if (accountError || !account) {
    console.error(
      "Error fetching account:",
      accountError?.message || "Account not found"
    );
    throw new Error("Failed to fetch email account details");
  }

  if (!account.password_encrypted) {
    throw new Error("Account password not set");
  }

  // 2. Decrypt the password
  const password = decrypt(account.password_encrypted);

  // 3. Connect to the IMAP server
  const imapClient = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: true, // Assume SSL/TLS for security
    auth: {
      user: account.email,
      pass: password,
    },
    logger: console, // DEBUG: Pass console object for imapflow logging
  });

  try {
    // 4. Connect and access the INBOX
    console.log(`Connecting to IMAP server for account ${accountId}...`);
    await imapClient.connect();

    console.log(`Opening INBOX for account ${accountId}...`);
    const mailbox = await imapClient.mailboxOpen("INBOX");
    console.log(`INBOX opened with ${mailbox.exists} messages`);

    // 5. Fetch UIDs of the most recent emails (up to the limit)
    // We're using SEARCH command to find all messages in the INBOX and sort by date (newest first)
    const uidList: number[] = [];

    // Use the sequence set from the last 'limit' messages, or all if fewer than limit
    const start = Math.max(1, mailbox.exists - limit + 1);
    const searchOptions = {
      seq: `${start}:*`, // From 'start' to end of mailbox
    };

    // Perform the search to get UIDs
    for await (const message of imapClient.fetch(
      { seq: searchOptions.seq },
      { uid: true }
    )) {
      uidList.push(message.uid);
    }

    // Sort UIDs in descending order (newest first)
    uidList.sort((a, b) => b - a);

    console.log(`Fetched ${uidList.length} UIDs for account ${accountId}`);

    // 6. Log the results (for now)
    console.log(`Recent email UIDs for account ${accountId}:`, uidList);

    return uidList;
  } catch (error) {
    console.error(`Error fetching emails for account ${accountId}:`, error);
    throw new Error(
      `Failed to fetch emails: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    // 7. Close the connection
    try {
      await imapClient.logout();
      console.log(`Disconnected from IMAP server for account ${accountId}`);
    } catch (e) {
      console.error(
        `Error disconnecting from IMAP server for account ${accountId}:`,
        e
      );
    }
  }
}

/**
 * Fetches full email details for specific UIDs
 * This is a more advanced function that will be expanded in future subtasks
 */
export async function fetchEmailsByUids(
  accountId: string,
  uids: number[]
): Promise<any[]> {
  // This will be implemented in the next subtask (5.3)
  // For now, just return a placeholder
  console.log(
    `TODO: Fetch email details for account ${accountId}, UIDs:`,
    uids
  );
  return [];
}

// Define a basic EmailCredentials type for use in fetchNewEmailUids
// This should ideally match the structure provided by getEmailCredentials
interface EmailCredentials {
  email: string;
  password_encrypted: string; // Or decrypted password if handled before calling
  imap_host: string;
  imap_port: number;
  // Assuming password will be decrypted before or during createImapConnection
  password?: string;
}

/**
 * Fetches UIDs of new emails from the INBOX of a given email account
 * since the last sync point (UID or date).
 * @param credentials The email account credentials (host, port, user, pass).
 * @param lastSyncedUid The last UID that was successfully synced. Fetches UIDs greater than this.
 * @param lastSyncedAt The timestamp of the last successful sync (ISO string). Used if lastSyncedUid is 0 or not reliable.
 * @returns Array of UIDs for new emails, sorted in ascending order.
 */
export async function fetchNewEmailUids(
  credentials: EmailCredentials, // Assumes password in credentials.password is decrypted
  lastSyncedUid: number = 0,
  lastSyncedAt?: string | null
): Promise<number[]> {
  const imapClient = new ImapFlow({
    host: credentials.imap_host,
    port: credentials.imap_port,
    secure: true, // Assume SSL/TLS
    auth: {
      user: credentials.email,
      pass: credentials.password || decrypt(credentials.password_encrypted), // Decrypt if not already
    },
    logger: console, // DEBUG: Pass console object for imapflow logging
  });

  try {
    await imapClient.connect();
    const mailboxInfo = await imapClient.mailboxOpen("INBOX");

    let searchOptions: Record<string, any> = {}; // Using Record<string, any> for flexibility with imapflow.SearchObject

    if (lastSyncedUid > 0 && lastSyncedUid < mailboxInfo.uidNext) {
      searchOptions = { uid: `${lastSyncedUid + 1}:*` };
    } else if (lastSyncedAt) {
      const date = new Date(lastSyncedAt);
      const day = date.getDate().toString().padStart(2, "0");
      const month = date.toLocaleString("en-US", { month: "short" });
      const year = date.getFullYear();
      const formattedDate = `${day}-${month}-${year}`;
      searchOptions = { since: formattedDate };
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const day = thirtyDaysAgo.getDate().toString().padStart(2, "0");
      const month = thirtyDaysAgo.toLocaleString("en-US", { month: "short" });
      const year = thirtyDaysAgo.getFullYear();
      const formattedDate = `${day}-${month}-${year}`;
      searchOptions = { since: formattedDate };
    }

    // The second argument { uid: true } to imapClient.search is to ensure UIDs are returned.
    // imapflow documentation confirms .search(criteria, options)
    const uids = await imapClient.search(searchOptions, { uid: true });

    const numericUids = uids.filter(
      (uid) => typeof uid === "number" && uid > lastSyncedUid
    ) as number[];

    return numericUids.sort((a, b) => a - b);
  } catch (error) {
    console.error(
      `Error fetching new email UIDs for ${credentials.email}:`,
      error
    );
    throw new Error(
      `Failed to fetch new email UIDs: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    try {
      if (imapClient.usable) {
        await imapClient.logout();
      }
    } catch (e) {
      console.error(`Error during IMAP logout for ${credentials.email}:`, e);
    }
  }
}
