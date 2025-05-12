import { ImapFlow, SearchObject } from "imapflow";
import { getConnectedImapClient } from "./imapService"; // Import the new service

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
  let imapClient: ImapFlow | null = null; // Keep client variable for finally block

  try {
    // 1. Get connected client using the new service
    // Supabase client and logger will use defaults in imapService or can be passed if needed
    const { client: connectedClient, accountDetails } =
      await getConnectedImapClient(accountId);
    imapClient = connectedClient;

    console.log(
      `[fetchRecentEmailUids] Successfully connected for account ${accountDetails.email} via ImapService`
    );

    // 2. Access the INBOX (client is already connected)
    console.log(
      `[fetchRecentEmailUids] Opening INBOX for account ${accountId}...`
    );
    const mailbox = await imapClient.mailboxOpen("INBOX");
    console.log(
      `[fetchRecentEmailUids] INBOX opened with ${mailbox.exists} messages`
    );

    const uidList: number[] = [];
    const start = Math.max(1, mailbox.exists - limit + 1);
    const searchSeq = `${start}:${mailbox.exists > 0 ? "*" : start}`;
    // Ensure search sequence is valid even if mailbox.exists is 0
    // If mailbox.exists is 0, start will be 1, searchSeq will be "1:1"
    // ImapFlow fetch with "1:*" on empty mailbox might error or return empty, "1:1" might be safer if it means UID 1.
    // More robust: if mailbox.exists === 0, return [] directly.

    if (mailbox.exists === 0) {
      console.log(
        `[fetchRecentEmailUids] No messages in INBOX for account ${accountId}.`
      );
      return [];
    }

    for await (const message of imapClient.fetch(searchSeq, {
      uid: true,
    })) {
      uidList.push(message.uid);
    }

    uidList.sort((a, b) => b - a); // Sort descending to get most recent first
    // If limit was applied, ensure we only return that many. The search itself fetches a range.
    const limitedUidList = uidList.slice(0, limit);

    console.log(
      `[fetchRecentEmailUids] Fetched ${limitedUidList.length} UIDs for account ${accountId}`
    );
    return limitedUidList;
  } catch (error) {
    console.error(
      `[fetchRecentEmailUids] Error fetching emails for account ${accountId}:`,
      error
    );

    if (
      error instanceof Error &&
      (error.message.includes("AUTHENTICATIONFAILED") ||
        error.message.includes("AuthError") ||
        error.message.includes("Invalid credentials"))
    ) {
      throw new Error(
        `Authentication failed for account ${accountId}. Please check credentials or re-authenticate.`
      );
    }
    throw new Error(
      `[fetchRecentEmailUids] Failed to fetch emails: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    if (imapClient) {
      try {
        await imapClient.logout();
        console.log(
          `[fetchRecentEmailUids] Disconnected from IMAP server for account ${accountId}`
        );
      } catch (e) {
        console.error(
          `[fetchRecentEmailUids] Error disconnecting from IMAP server for account ${accountId}:`,
          e
        );
      }
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
    `TODO: Fetch email details for account ${accountId}, UIDs:`, // Keep existing console log
    uids
  );
  return [];
}

/**
 * Fetches UIDs of new emails since the last known UID.
 * @param client An already connected and mailbox-opened ImapFlow client.
 * @param lastUid The last UID that was successfully synced. Fetches UIDs greater than this.
 * @returns A promise that resolves to an array of new email UIDs.
 */
export async function fetchNewEmailUids(
  client: ImapFlow, // This function now takes a connected client
  lastUid: number
): Promise<number[]> {
  if (!client || !client.usable) {
    // console.error("[fetchNewEmailUids] IMAP client is not connected or usable.");
    throw new Error("IMAP client is not connected or usable.");
  }
  // Check if mailbox is an object and has a path, implying it's open and details are available
  if (
    !client.mailbox ||
    typeof client.mailbox !== "object" ||
    !client.mailbox.path
  ) {
    // console.error("[fetchNewEmailUids] IMAP mailbox is not open or path is unavailable. Please call mailboxOpen('INBOX') first.");
    throw new Error(
      "IMAP mailbox is not open or path is unavailable. Please call mailboxOpen('INBOX') first."
    );
  }

  const searchCriteria: SearchObject = {
    uid: `${lastUid + 1}:*`,
  };

  try {
    // console.log(`[fetchNewEmailUids] Searching for UIDs > ${lastUid} in mailbox ${client.mailbox.path}`);
    const uids: number[] = await client.search(searchCriteria, { uid: true });
    // console.log(`[fetchNewEmailUids] Found ${uids.length} UIDs:`, uids);
    return uids.sort((a, b) => a - b); // Sort ascending as per original logic
  } catch (error) {
    console.error("[fetchNewEmailUids] Error fetching new email UIDs:", error);
    return []; // Return empty array on error, as per original logic
  }
}
