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

  let uidsResults = await client.search(query, { uid: true });

  let uids: number[];
  if (Array.isArray(uidsResults)) {
    // Filter out UIDs that are not strictly greater than lastSyncedUid
    uids = uidsResults.filter((uid) => uid > lastSyncedUid);
  } else {
    // Handle cases where search might not return an array (e.g., null or other type)
    uids = [];
  }

  logger.info(
    `Raw UIDs from search (after filtering > ${lastSyncedUid}): ${uids.join(
      ", "
    )}`
  );

  if (uids.length > 0) {
    uids.sort((a, b) => a - b);
    logger.info(`Found and sorted UIDs: ${uids.join(", ")}`);

    if (uids.length > 50) {
      uids = uids.slice(-50);
      logger.info(`Limited to the latest 50 UIDs. Count: ${uids.length}`);
    }
  } else {
    logger.info(`No new UIDs found strictly greater than: ${lastSyncedUid}`);
    // uids is already [] if it enters here due to the previous uids.length > 0 check
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

export async function getJunkFolderRemoteName(
  client: ImapFlow,
  logger: any // Assuming logger has info, warn, error methods
): Promise<string | null> {
  try {
    logger.info("IMAP: Listing mailboxes to find Junk folder...");
    const mailboxes: import("imapflow").ListResponse[] = await client.list();
    let junkPath: string | null = null;

    // First, look for \Junk attribute using specialUse
    for (const mailbox of mailboxes) {
      if (mailbox.specialUse === "\\Junk") {
        logger.info(
          `IMAP: Found Junk folder by specialUse attribute \\Junk: '${mailbox.path}'`
        );
        junkPath = mailbox.path;
        break;
      }
    }

    // If not found by attribute, try common names (case-insensitive)
    if (!junkPath) {
      const commonJunkNames = ["junk", "spam"];
      for (const mailbox of mailboxes) {
        const mailboxNameLower = mailbox.name.toLowerCase();
        if (commonJunkNames.includes(mailboxNameLower)) {
          logger.info(
            `IMAP: Found potential Junk folder by common name: '${mailbox.path}' (matches '${mailboxNameLower}')`
          );
          junkPath = mailbox.path;
          break; // Take the first common name match
        }
      }
    }

    // Check for Gmail specific Spam folder if still not found
    if (!junkPath) {
      const gmailSpamPattern = /\[gmail\]\/spam/i; // Matches "[Gmail]/Spam", "[Google Mail]/Spam" etc.
      for (const mailbox of mailboxes) {
        if (gmailSpamPattern.test(mailbox.path)) {
          logger.info(
            `IMAP: Found potential Gmail Spam folder by pattern: '${mailbox.path}'`
          );
          junkPath = mailbox.path;
          break;
        }
      }
    }

    if (junkPath) {
      logger.info(`IMAP: Using Junk folder: '${junkPath}'`);
    } else {
      logger.warn("IMAP: Could not identify a Junk/Spam folder on the server.");
    }
    return junkPath;
  } catch (error: any) {
    logger.error(
      `IMAP: Error listing mailboxes to find Junk folder: ${error.message}`,
      error
    );
    return null;
  }
}

export async function moveMessagesToJunk(
  client: ImapFlow,
  uids: number[],
  junkFolderName: string,
  logger: any // Assuming logger has info, warn, error methods
): Promise<number[]> {
  const successfullyMovedUids: number[] = [];
  if (uids.length === 0 || !client || !client.usable) {
    logger.info("IMAP: No UIDs to move to Junk or client not usable.");
    return successfullyMovedUids;
  }

  logger.info(
    `IMAP: Attempting to move ${
      uids.length
    } UIDs to Junk folder '${junkFolderName}': ${uids.join(", ")}`
  );

  for (const uid of uids) {
    try {
      // Ensure UID is a string for ImapFlow
      const uidString = String(uid);
      // messageMove moves from the *currently selected mailbox*
      await client.messageMove(uidString, junkFolderName, { uid: true });
      logger.info(
        `IMAP: Successfully moved UID ${uidString} to '${junkFolderName}'.`
      );
      successfullyMovedUids.push(uid);
    } catch (moveError: any) {
      // It's possible the message doesn't exist (e.g., already moved/deleted)
      // Or the mailbox doesn't allow moving messages.
      // ImapFlow might throw an error with a `responseText` like "NO [NONEXISTENT]..."
      logger.warn(
        `IMAP: Failed to move UID ${uid} to '${junkFolderName}'. Error: ${
          moveError.message
        } (Code: ${moveError.code || "N/A"}, Response: ${
          moveError.responseText || "N/A"
        })`
      );
      // Decide if specific errors should halt the process or be critical.
      // For now, we log and continue with other UIDs.
    }
  }
  logger.info(
    `IMAP: Finished moving messages to Junk. Successfully moved ${
      successfullyMovedUids.length
    }/${uids.length} UIDs: ${successfullyMovedUids.join(", ")}`
  );
  return successfullyMovedUids;
}
