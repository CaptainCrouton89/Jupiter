import { decrypt } from "@/lib/auth/encryption";
import { ImapFlow } from "imapflow";
import { logger } from "./logger";
import { EmailAccountDetails } from "./supabaseOps";

export async function createImapClient(
  account: EmailAccountDetails,
  decryptedPassword?: string
): Promise<ImapFlow> {
  let pass = decryptedPassword;
  if (!pass) {
    if (!account.password_encrypted) {
      logger.error(
        `Encrypted password not found for account ${account.id} and was not provided directly.`
      );
      throw new Error(
        `Encrypted password not found for account ${account.id} and not provided.`
      );
    }
    try {
      pass = decrypt(account.password_encrypted);
    } catch (e: any) {
      logger.error(`Decryption failed for account ${account.id}: ${e.message}`);
      throw new Error(
        `Decryption failed for account ${account.id}: ${e.message}`
      );
    }
  }
  if (!pass) {
    logger.error(`Decrypted password is empty for account ${account.id}.`);
    throw new Error(`Decrypted password is empty for account ${account.id}.`);
  }

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_port === 993,
    auth: {
      user: account.email,
      pass: pass,
    },
    logger: {
      info: () => {},
      debug: () => {},
      warn: (obj) => logger.warn("[IMAP_FLOW_WARN]", JSON.stringify(obj)),
      error: (obj) => logger.error("[IMAP_FLOW_ERROR]", JSON.stringify(obj)),
    },
    disableAutoIdle: true,
  });
  return client;
}

export async function connectImapClient(
  client: ImapFlow,
  email: string
): Promise<void> {
  logger.info(`Attempting IMAP connection for ${email}...`);
  await client.connect();
  logger.info(`IMAP connection successful for ${email}.`);
}

export async function getMailboxLock(
  client: ImapFlow,
  mailboxName: string,
  email: string
): Promise<Awaited<ReturnType<ImapFlow["getMailboxLock"]>>> {
  logger.info(
    `Attempting to get mailbox lock for '${mailboxName}' for ${email}...`
  );
  const lock = await client.getMailboxLock(mailboxName);
  logger.info(`Mailbox '${mailboxName}' selected and locked for ${email}.`);
  return lock;
}

export async function fetchNewEmailUids(
  client: ImapFlow,
  lastSyncedUid: number = 0
): Promise<number[]> {
  logger.info(`Fetching UIDs since: ${lastSyncedUid}`);

  const query: any = {};
  if (lastSyncedUid > 0) {
    query.uid = `${lastSyncedUid + 1}:*`;
  } else {
    query.all = true;
  }
  logger.info(
    `IMAP search: ${query.uid ? `UIDs ${query.uid}` : "all messages"}`
  );

  let uids = await client.search(query, { uid: true });
  logger.info(
    `Raw UIDs from search: ${
      Array.isArray(uids) ? uids.join(", ") : "Not an array or empty"
    }`
  );

  if (Array.isArray(uids) && uids.length > 0) {
    uids.sort((a, b) => a - b);
    logger.info(`Found and sorted UIDs: ${uids.join(", ")}`);

    if (uids.length > 50) {
      uids = uids.slice(-50);
      logger.info(`Limited to the latest 50 UIDs. Count: ${uids.length}`);
    }
  } else {
    logger.info(`No new UIDs found since: ${lastSyncedUid}`);
    uids = [];
  }
  return uids;
}

export async function markMessagesAsSeen(
  client: ImapFlow,
  uids: number[]
): Promise<void> {
  if (uids.length === 0 || !client || !client.usable) {
    logger.info("IMAP: No UIDs to mark as seen or client not usable.");
    return;
  }
  try {
    logger.info(
      `IMAP: Attempting to mark ${uids.length} UIDs as \\Seen: ${uids.join(
        ", "
      )}`
    );
    await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
    logger.info(`IMAP: Successfully marked ${uids.length} UIDs as \\Seen.`);
  } catch (flagErr: any) {
    logger.error(
      `IMAP: Failed to mark UIDs as \\Seen: ${uids.join(", ")}. Error: ${
        flagErr.message
      }`
    );
  }
}

export async function closeImapClient(
  client: ImapFlow,
  email: string,
  mailboxLock?: Awaited<ReturnType<ImapFlow["getMailboxLock"]>> | null
): Promise<void> {
  if (mailboxLock) {
    try {
      await mailboxLock.release();
      logger.info(`Mailbox lock released for ${email}.`);
    } catch (releaseError: any) {
      logger.error(
        `Error releasing mailbox lock for ${email}: ${releaseError.message}`,
        releaseError
      );
    }
  }
  if (client && client.usable) {
    logger.info(`Closing IMAP connection for ${email}...`);
    try {
      await client.logout();
      logger.info(`IMAP connection closed for ${email}.`);
    } catch (logoutErr: any) {
      logger.error(
        `IMAP logout error for ${email}: ${logoutErr.message}`,
        logoutErr
      );
    }
  }
}
