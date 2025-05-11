import { ImapFlow } from "imapflow";
import { AddressObject, Attachment, simpleParser } from "mailparser";
import { Readable } from "stream";

/**
 * Email attachment metadata interface
 */
export interface EmailAttachmentMeta {
  id?: string; // Will be set when stored in the database
  filename: string | null;
  contentType: string;
  contentDisposition: string | null;
  size: number;
  cid?: string; // Content-ID for inline attachments
  contentLocation?: string | null; // For inline images referenced by contentLocation
  checksum?: string; // Can be used for deduplication
}

/**
 * Structured email data interface
 */
export interface ParsedEmailData {
  // Email metadata
  messageId: string | null;
  inReplyTo: string | null;
  references: string[] | null;
  subject: string | null;
  date: Date | null;
  isRead: boolean; // Added for read status
  imapUid?: number; // IMAP UID of the message
  category?: string; // AI-determined category

  // Addresses
  from: {
    name: string | null;
    address: string | null;
  } | null;
  to: {
    name: string | null;
    address: string | null;
  }[];
  cc: {
    name: string | null;
    address: string | null;
  }[];
  bcc: {
    name: string | null;
    address: string | null;
  }[];

  // Content
  html: string | null;
  text: string | null;

  // Attachments
  attachments: EmailAttachmentMeta[];

  // Raw headers can be useful for debugging
  headers: Record<string, string | string[]>;
}

// Intermediate type for content parsing without IMAP-specific flags
export type BaseParsedEmailData = Omit<
  ParsedEmailData,
  "isRead" | "imapUid" | "category"
>;

/**
 * Helper to convert stream to buffer
 */
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Process address object to normalized format
 */
function processAddresses(
  addressObj: AddressObject | AddressObject[] | undefined
): { name: string | null; address: string | null }[] {
  if (!addressObj) {
    return [];
  }

  // If it's an array of AddressObject, take the first one
  const targetObj = Array.isArray(addressObj) ? addressObj[0] : addressObj;

  if (!targetObj || !Array.isArray(targetObj.value)) {
    return [];
  }

  return targetObj.value.map((addr: { name?: string; address?: string }) => ({
    name: addr.name || null,
    address: addr.address || null,
  }));
}

/**
 * Parse email attachments to extract metadata
 */
function processAttachments(attachments: Attachment[]): EmailAttachmentMeta[] {
  return attachments.map((attachment) => ({
    filename: attachment.filename || null,
    contentType: attachment.contentType,
    contentDisposition: attachment.contentDisposition || null,
    size: attachment.size,
    cid: attachment.cid,
    // Handle contentLocation which might not be present in current typings
    contentLocation: (attachment as any).contentLocation || null,
  }));
}

/**
 * Parse raw email content into structured data (without IMAP flags like isRead)
 * @param rawEmail Raw email content as buffer or string
 * @param logger Optional logger instance
 * @returns Parsed email data in a structured format, excluding isRead status
 */
export async function parseEmailContent(
  rawEmail: Buffer | string,
  logger?: any
): Promise<BaseParsedEmailData> {
  try {
    // Parse the raw email
    const parsed = await simpleParser(rawEmail);

    // Extract and normalize addresses
    const fromAddress = parsed.from
      ? {
          name: parsed.from.value[0]?.name || null,
          address: parsed.from.value[0]?.address || null,
        }
      : null;

    const toAddresses = processAddresses(parsed.to);
    const ccAddresses = processAddresses(parsed.cc);
    const bccAddresses = processAddresses(parsed.bcc);

    // Extract attachment metadata
    const attachmentsMeta = processAttachments(parsed.attachments);

    // Create references array from string
    const references = parsed.references
      ? Array.isArray(parsed.references)
        ? parsed.references
        : parsed.references.split(/\s+/).filter(Boolean)
      : null;

    // Convert headers to record for easier access
    const headers: Record<string, string | string[]> = {};
    parsed.headerLines.forEach((header: { key: string; line: string }) => {
      headers[header.key] = header.line;
    });

    return {
      messageId: parsed.messageId || null,
      inReplyTo: parsed.inReplyTo || null,
      references,
      subject: parsed.subject || null,
      date: parsed.date || null,
      from: fromAddress,
      to: toAddresses,
      cc: ccAddresses,
      bcc: bccAddresses,
      html: parsed.html || null,
      text: parsed.text || null,
      attachments: attachmentsMeta,
      headers,
    };
  } catch (error) {
    const errorMessage = `Failed to parse email: ${
      error instanceof Error ? error.message : String(error)
    }`;
    if (logger && logger.error) {
      logger.error("Error parsing email:", error);
    } else {
      console.error("Error parsing email:", error); // Fallback if no logger
    }
    throw new Error(errorMessage);
  }
}

/**
 * Fetch and parse a specific email from IMAP server
 * @param client Initialized ImapFlow client
 * @param uid UID of the email to fetch
 * @param logger Logger instance
 * @returns Parsed email data
 */
export async function fetchAndParseEmail(
  client: ImapFlow,
  uid: number,
  logger: any
): Promise<ParsedEmailData> {
  const uidString = String(uid);
  try {
    logger.info(
      `[fetchAndParseEmail] Attempting fetch for UID: ${uidString} using client.fetchOne()`
    );

    // Use client.fetchOne to get both flags and source (raw email content)
    const messageData = await client.fetchOne(
      uidString,
      { source: true, flags: true }, // Query for source and flags
      { uid: true } // Specify that uidString is a UID
    );

    if (!messageData) {
      throw new Error(
        `client.fetchOne did not return data for UID ${uidString}`
      );
    }

    if (!messageData.source) {
      throw new Error(
        `Email source not available for UID ${uidString} after client.fetchOne.`
      );
    }

    const rawEmail = messageData.source; // messageData.source is a Buffer
    const messageFlags = messageData.flags || new Set<string>(); // messageData.flags is a Set<string>

    logger.trace(
      `[fetchAndParseEmail] Flags from client.fetchOne for UID ${uidString}:`,
      messageFlags
    );

    const parsedContent = await parseEmailContent(rawEmail, logger);

    const isMessageRead = messageFlags.has("\\Seen");

    return {
      ...parsedContent,
      isRead: isMessageRead,
      imapUid: uid,
      // category: will be populated by AI logic elsewhere, after this function typically
    };
  } catch (error) {
    console.error(
      `[fetchAndParseEmail] Error in fetchAndParseEmail (using fetchOne) for UID ${uidString}:`,
      error
    );
    throw new Error(
      `Failed to fetch and parse email (using fetchOne): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Fetch and parse multiple emails from IMAP server
 * @param client Initialized ImapFlow client
 * @param uids Array of UIDs to fetch
 * @param batchSize Number of emails to fetch in each batch (defaults to 10)
 * @param accountId Account ID for logging context
 * @param logger Logger instance
 * @returns Array of parsed email data
 */
export async function fetchAndParseEmails(
  client: ImapFlow,
  uids: number[],
  batchSize: number = 10,
  accountId: string,
  logger: any
): Promise<ParsedEmailData[]> {
  const allParsedEmails: ParsedEmailData[] = [];
  const totalUids = uids.length;
  logger.info(
    `[fetchAndParseEmails] Starting batch fetch for account ${accountId}. Total UIDs: ${totalUids}, Batch Size: ${batchSize}`
  );

  for (let i = 0; i < totalUids; i += batchSize) {
    const batchUids = uids.slice(i, i + batchSize);
    logger.info(
      `[fetchAndParseEmails] Processing batch ${i / batchSize + 1}/${Math.ceil(
        totalUids / batchSize
      )} for account ${accountId}. UIDs: ${batchUids.join(", ")}`
    );
    try {
      // Fetch and parse emails in the current batch
      const promises = batchUids.map((uid) =>
        fetchAndParseEmail(client, uid, logger)
      );
      const parsedBatch = await Promise.all(promises);
      allParsedEmails.push(...parsedBatch);
      logger.info(
        `[fetchAndParseEmails] Successfully parsed batch ${
          i / batchSize + 1
        } for account ${accountId}. Emails in batch: ${parsedBatch.length}`
      );
    } catch (error) {
      logger.error(
        `[fetchAndParseEmails] Error processing batch starting with UID ${batchUids[0]} for account ${accountId}:`,
        error
      );
      // Decide if one failed email in a batch should stop the whole sync
      // For now, we log and continue with other batches
    }
  }
  logger.info(
    `[fetchAndParseEmails] Finished batch fetching for account ${accountId}. Total parsed emails: ${allParsedEmails.length}`
  );
  return allParsedEmails;
}
