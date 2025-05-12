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
    .select(
      "email, password_encrypted, imap_host, imap_port, provider, access_token_encrypted"
    )
    .eq("id", accountId)
    .single();

  if (accountError || !account) {
    console.error(
      "Error fetching account:",
      accountError?.message || "Account not found"
    );
    throw new Error("Failed to fetch email account details");
  }

  // Log the provider value fetched from the database
  console.log(
    `DEBUG: Account provider for ${accountId} is '${
      account.provider
    }', type: ${typeof account.provider}`
  );

  let authPayload;
  if (account.provider === "google") {
    if (!account.access_token_encrypted) {
      throw new Error("Google account access token not set");
    }
    const accessToken = decrypt(account.access_token_encrypted);
    console.log(
      `DEBUG: Decrypted access token for ${account.email}: '${
        accessToken ? "[PRESENT]" : "[EMPTY_OR_NULL]"
      }', length: ${accessToken?.length || 0}`
    );

    authPayload = {
      user: account.email,
      accessToken: accessToken,
    };
    account.imap_host = account.imap_host || "imap.gmail.com";
    account.imap_port = account.imap_port || 993;
  } else {
    if (!account.password_encrypted) {
      throw new Error("Account password not set for non-OAuth account");
    }
    const password = decrypt(account.password_encrypted);
    authPayload = {
      user: account.email,
      pass: password,
    };
    if (!account.imap_host || !account.imap_port) {
      throw new Error("IMAP host or port not set for password-based account");
    }
  }

  // 3. Connect to the IMAP server
  const imapClient = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: true,
    auth: authPayload as any,
    logger: process.env.NODE_ENV === "development" ? console : false,
  });

  try {
    // 4. Connect and access the INBOX
    console.log(
      `Connecting to IMAP server for account ${accountId} (${
        account.provider || "password-based"
      })`
    );
    await imapClient.connect();

    console.log(`Opening INBOX for account ${accountId}...`);
    const mailbox = await imapClient.mailboxOpen("INBOX");
    console.log(`INBOX opened with ${mailbox.exists} messages`);

    const uidList: number[] = [];
    const start = Math.max(1, mailbox.exists - limit + 1);
    const searchOptions = {
      seq: `${start}:*`,
    };

    for await (const message of imapClient.fetch(searchOptions.seq, {
      uid: true,
    })) {
      uidList.push(message.uid);
    }

    uidList.sort((a, b) => b - a);
    console.log(`Fetched ${uidList.length} UIDs for account ${accountId}`);
    return uidList;
  } catch (error) {
    console.error(`Error fetching emails for account ${accountId}:`, error);
    if (
      error instanceof Error &&
      error.message &&
      (error.message.includes("AUTHENTICATIONFAILED") ||
        error.message.includes("invalid credentials"))
    ) {
      throw new Error(
        `Authentication failed for ${account.email}. Please check credentials or re-authenticate.`
      );
    }
    throw new Error(
      `Failed to fetch emails: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
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
