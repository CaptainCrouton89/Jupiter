import { ImapFlow } from "imapflow";
import { logger } from "./logger";
import { EmailAccountDetails } from "./supabaseOps";

export async function createImapClient(
  account: EmailAccountDetails,
  authPayload: {
    user: string;
    xoauth2?: string;
    accessToken?: string;
    password?: string;
  }
): Promise<ImapFlow> {
  let imapAuthConf: {
    user: string;
    pass?: string;
    xoauth2?: string;
    accessToken?: string;
  };

  // Check for accessToken first (mimicking fetchEmails.ts behavior for Google)
  if (authPayload.accessToken) {
    imapAuthConf = {
      user: authPayload.user,
      accessToken: authPayload.accessToken,
    };
  } else if (authPayload.xoauth2) {
    // Then check for xoauth2
    imapAuthConf = { user: authPayload.user, xoauth2: authPayload.xoauth2 };
  } else if (authPayload.password) {
    // Then password
    imapAuthConf = { user: authPayload.user, pass: authPayload.password };
  } else {
    logger.error(
      `IMAP Auth config error: No valid auth method (accessToken, xoauth2, or password) provided for ${account.email}`
    );
    throw new Error(
      "Invalid authPayload: missing accessToken, xoauth2, or password."
    );
  }

  const imapConfig: any = {
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_port === 993, // Standard for IMAPS
    auth: imapAuthConf, // Use the explicitly constructed auth config
    logger: {
      info: () => {},
      debug: () => {},
      warn: (obj: any) => logger.warn("[IMAP_FLOW_WARN]", JSON.stringify(obj)),
      error: (obj: any) =>
        logger.error("[IMAP_FLOW_ERROR]", JSON.stringify(obj)),
    },
    disableAutoIdle: true,
  };

  // Specific settings for Google OAuth2
  if (
    account.provider === "google" &&
    (imapAuthConf.accessToken || imapAuthConf.xoauth2)
  ) {
    imapConfig.host = "imap.gmail.com";
    imapConfig.port = 993;
    imapConfig.secure = true;
  }

  const client = new ImapFlow(imapConfig);
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
