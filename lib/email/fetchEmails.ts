import { decrypt } from "@/lib/auth/encryption";
import { createClient } from "@/lib/auth/server";
import { ImapFlow, SearchObject } from "imapflow";

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
    // logger: console, // DEBUG: Pass console object for imapflow logging
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

// Make sure this interface is exported
export interface EmailCredentials {
  email: string;
  password_encrypted: string;
  password?: string; // Decrypted password, optional if not already decrypted
  imap_host: string;
  imap_port: number;
}

/**
 * Fetches UIDs of new emails since the last known UID.
 * @param client An already connected and mailbox-opened ImapFlow client.
 * @param lastUid The last UID that was successfully synced. Fetches UIDs greater than this.
 * @returns A promise that resolves to an array of new email UIDs.
 */
export async function fetchNewEmailUids(
  client: ImapFlow,
  lastUid: number
): Promise<number[]> {
  if (!client || !client.usable) {
    throw new Error("IMAP client is not connected or usable.");
  }
  // Check if mailbox is an object and has a path, implying it's open and details are available
  if (
    !client.mailbox ||
    typeof client.mailbox !== "object" ||
    !client.mailbox.path
  ) {
    throw new Error(
      "IMAP mailbox is not open or path is unavailable. Please call mailboxOpen('INBOX') first."
    );
  }

  const searchCriteria: SearchObject = {
    uid: `${lastUid + 1}:*`,
  };

  try {
    const uids: number[] = await client.search(searchCriteria, { uid: true });
    return uids.sort((a, b) => a - b);
  } catch (error) {
    console.error("Error fetching new email UIDs:", error);
    return [];
  }
}
