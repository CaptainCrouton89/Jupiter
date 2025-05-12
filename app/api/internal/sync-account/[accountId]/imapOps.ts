import { ImapFlow } from "imapflow";
import { logger } from "./logger";

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
