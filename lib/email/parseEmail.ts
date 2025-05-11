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
export type BaseParsedEmailData = Omit<ParsedEmailData, "isRead">;

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
 * @returns Parsed email data in a structured format, excluding isRead status
 */
export async function parseEmailContent(
  rawEmail: Buffer | string
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
    console.error("Error parsing email:", error);
    throw new Error(
      `Failed to parse email: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Fetch and parse a specific email from IMAP server
 * @param client Initialized ImapFlow client
 * @param uid UID of the email to fetch
 * @returns Parsed email data
 */
export async function fetchAndParseEmail(
  client: ImapFlow,
  uid: number
): Promise<ParsedEmailData> {
  const uidString = String(uid);
  try {
    console.log(
      `[fetchAndParseEmail] Attempting main fetch for UID: ${uidString} using client.download()`
    );

    let messageStream: Readable | undefined;
    let messageFlags: Set<string> = new Set(); // Initialize, though flags might not be reliably fetched

    // Use client.download to fetch the email content.
    // The third argument {uid: true} ensures it uses UID for fetching.
    const downloadInfo = await client.download(uidString, undefined, {
      uid: true,
    });

    if (downloadInfo && downloadInfo.content) {
      if (typeof downloadInfo.content.pipe === "function") {
        messageStream = downloadInfo.content as Readable;
      } else if (Buffer.isBuffer(downloadInfo.content)) {
        messageStream = Readable.from(downloadInfo.content);
      } else if (typeof downloadInfo.content === "string") {
        messageStream = Readable.from(Buffer.from(downloadInfo.content));
      } else {
        console.error(
          "[fetchAndParseEmail] downloadInfo.content is not a recognized streamable type"
        );
      }

      // Attempt to get flags if available, but don't rely on it for critical logic yet
      if (
        downloadInfo.meta &&
        (downloadInfo.meta as any).flags instanceof Set
      ) {
        messageFlags = (downloadInfo.meta as any).flags as Set<string>;
        console.log(
          `[fetchAndParseEmail] Flags from client.download for UID ${uidString}:`,
          messageFlags
        );
      } else {
        console.log(
          `[fetchAndParseEmail] No flags reliably found in downloadInfo.meta for UID ${uidString}`
        );
      }
    } else {
      throw new Error(
        `client.download did not return content for UID ${uidString}`
      );
    }

    if (!messageStream) {
      throw new Error(
        `Email stream not available for UID ${uidString} after client.download.`
      );
    }

    const rawEmail = await streamToBuffer(messageStream);
    const parsedContent = await parseEmailContent(rawEmail);

    // For now, default isRead to false. Fetching/syncing read status can be a separate improvement.
    const isMessageRead = messageFlags.has("\\Seen");

    return {
      ...parsedContent,
      isRead: isMessageRead, // Use flags if found, otherwise will be false if not \Seen
    };
  } catch (error) {
    console.error(
      `[fetchAndParseEmail] Error in fetchAndParseEmail (using download) for UID ${uidString}:`,
      error
    );
    throw new Error(
      `Failed to fetch and parse email (using download): ${
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
 * @returns Array of parsed email data
 */
export async function fetchAndParseEmails(
  client: ImapFlow,
  uids: number[],
  batchSize: number = 10
): Promise<ParsedEmailData[]> {
  const results: ParsedEmailData[] = [];
  const errors: { uid: number; error: string }[] = [];

  // Process in batches to avoid memory issues with large numbers of emails
  for (let i = 0; i < uids.length; i += batchSize) {
    const batchUids = uids.slice(i, i + batchSize);

    // Process each batch in parallel but limit concurrency
    const batchPromises = batchUids.map(async (uid) => {
      try {
        return await fetchAndParseEmail(client, uid);
      } catch (error) {
        errors.push({
          uid,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);

    // Filter out null results (errors) and add to results array
    results.push(
      ...batchResults.filter(
        (result): result is ParsedEmailData => result !== null
      )
    );
  }

  // Log any errors that occurred during batch processing
  if (errors.length > 0) {
    console.error(
      `[fetchAndParseEmails] Failed to fetch and parse ${errors.length} emails in batch:`,
      errors
    );
  }

  return results;
}
