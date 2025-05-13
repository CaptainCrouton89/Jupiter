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

export async function getArchiveFolderRemoteName(
  client: ImapFlow,
  logger: any
): Promise<string | null> {
  try {
    logger.info("IMAP: Listing mailboxes to find Archive folder...");
    const mailboxes: import("imapflow").ListResponse[] = await client.list();
    let archivePath: string | null = null;

    // Look for \Archive attribute
    for (const mailbox of mailboxes) {
      if (mailbox.specialUse === "\\Archive") {
        logger.info(
          `IMAP: Found Archive folder by specialUse attribute \\Archive: '${mailbox.path}'`
        );
        archivePath = mailbox.path;
        break;
      }
    }

    // If not found, try common names
    if (!archivePath) {
      const commonArchiveNames = ["archive", "archived", "all mail"]; // Added "All Mail" common for Gmail
      for (const mailbox of mailboxes) {
        const mailboxNameLower = mailbox.name.toLowerCase();
        if (commonArchiveNames.includes(mailboxNameLower)) {
          logger.info(
            `IMAP: Found potential Archive folder by common name: '${mailbox.path}' (matches '${mailboxNameLower}')`
          );
          archivePath = mailbox.path;
          break;
        }
      }
    }

    // Check for Gmail specific All Mail folder if still not found
    if (!archivePath) {
      const gmailAllMailPattern = /\[gmail\]\/all mail/i; // Matches "[Gmail]/All Mail"
      for (const mailbox of mailboxes) {
        if (gmailAllMailPattern.test(mailbox.path)) {
          logger.info(
            `IMAP: Found potential Gmail All Mail folder by pattern: '${mailbox.path}'`
          );
          archivePath = mailbox.path;
          break;
        }
      }
    }

    if (archivePath) {
      logger.info(`IMAP: Using Archive folder: '${archivePath}'`);
    } else {
      logger.warn("IMAP: Could not identify an Archive folder on the server.");
    }
    return archivePath;
  } catch (error: any) {
    logger.error(
      `IMAP: Error listing mailboxes to find Archive folder: ${error.message}`,
      error
    );
    return null;
  }
}

export async function getTrashFolderRemoteName(
  client: ImapFlow,
  logger: any
): Promise<string | null> {
  try {
    logger.info("IMAP: Listing mailboxes to find Trash folder...");
    const mailboxes: import("imapflow").ListResponse[] = await client.list();
    let trashPath: string | null = null;

    // Look for \Trash attribute
    for (const mailbox of mailboxes) {
      if (mailbox.specialUse === "\\Trash") {
        logger.info(
          `IMAP: Found Trash folder by specialUse attribute \\Trash: '${mailbox.path}'`
        );
        trashPath = mailbox.path;
        break;
      }
    }

    // If not found, try common names
    if (!trashPath) {
      const commonTrashNames = [
        "trash",
        "deleted items",
        "bin",
        "deleted messages",
      ];
      for (const mailbox of mailboxes) {
        const mailboxNameLower = mailbox.name.toLowerCase();
        if (commonTrashNames.includes(mailboxNameLower)) {
          logger.info(
            `IMAP: Found potential Trash folder by common name: '${mailbox.path}' (matches '${mailboxNameLower}')`
          );
          trashPath = mailbox.path;
          break;
        }
      }
    }

    // Check for Gmail specific Trash folder if still not found
    if (!trashPath) {
      const gmailTrashPattern = /\[gmail\]\/trash/i; // Matches "[Gmail]/Trash"
      for (const mailbox of mailboxes) {
        if (gmailTrashPattern.test(mailbox.path)) {
          logger.info(
            `IMAP: Found potential Gmail Trash folder by pattern: '${mailbox.path}'`
          );
          trashPath = mailbox.path;
          break;
        }
      }
    }

    if (trashPath) {
      logger.info(`IMAP: Using Trash folder: '${trashPath}'`);
    } else {
      logger.warn("IMAP: Could not identify a Trash folder on the server.");
    }
    return trashPath;
  } catch (error: any) {
    logger.error(
      `IMAP: Error listing mailboxes to find Trash folder: ${error.message}`,
      error
    );
    return null;
  }
}

// Refactored function to handle moving messages to any target folder
export async function moveMessagesToServerFolder(
  client: ImapFlow,
  uids: number[],
  targetFolderName: string,
  actionName: string, // e.g., "Junk", "Archive", "Trash" for logging
  logger: any
): Promise<number[]> {
  const successfullyMovedUids: number[] = [];
  if (uids.length === 0 || !client || !client.usable || !targetFolderName) {
    if (!targetFolderName)
      logger.warn(
        `IMAP: Cannot move messages, target folder name is invalid for action: ${actionName}.`
      );
    else
      logger.info(
        `IMAP: No UIDs to move to ${actionName} or client not usable.`
      );
    return successfullyMovedUids;
  }

  logger.info(
    `IMAP: Attempting to move ${
      uids.length
    } UIDs to ${actionName} folder '${targetFolderName}': ${uids.join(", ")}`
  );

  for (const uid of uids) {
    try {
      const uidString = String(uid);
      // Ensure the client is in the correct state (mailbox selected)
      // Assuming the lock is already held on INBOX where these UIDs reside
      await client.messageMove(uidString, targetFolderName, { uid: true });
      logger.info(
        `IMAP: Successfully moved UID ${uidString} to '${targetFolderName}' (${actionName}).`
      );
      successfullyMovedUids.push(uid);
    } catch (moveError: any) {
      logger.warn(
        `IMAP: Failed to move UID ${uid} to '${targetFolderName}' (${actionName}). Error: ${
          moveError.message
        } (Code: ${moveError.code || "N/A"}, Response: ${
          moveError.responseText || "N/A"
        })`
      );
    }
  }
  logger.info(
    `IMAP: Finished moving messages to ${actionName}. Successfully moved ${
      successfullyMovedUids.length
    }/${uids.length} UIDs: ${successfullyMovedUids.join(", ")}`
  );
  return successfullyMovedUids;
}
