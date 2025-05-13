import { EmailAccountDetails } from "@/app/api/internal/sync-account/[accountId]/supabaseOps"; // For type
import { decrypt } from "@/lib/auth/encryption";
import { Database, Tables } from "@/lib/database.types";
import {
  EmailContent,
  generateDigestSummary,
} from "@/lib/email/digest/generateDigest"; // Import EmailContent
import { sendDigestEmail } from "@/lib/email/sendEmail";
import { SupabaseClient } from "@supabase/supabase-js";
import { convert as htmlToText } from "html-to-text"; // Added for cleaning

// Placeholder for a more robust logger if you have one
const logger = {
  info: (...args: any[]) => console.log("[WeeklyDigestService INFO]", ...args),
  warn: (...args: any[]) => console.warn("[WeeklyDigestService WARN]", ...args),
  error: (...args: any[]) =>
    console.error("[WeeklyDigestService ERROR]", ...args),
};

const RELEVANT_CATEGORIES = [
  "newsletter",
  "marketing",
  "receipt",
  "invoice",
  "finances",
  "code-related",
  "notification",
  "account-related",
  "personal",
] as const;
type RelevantCategory = (typeof RELEVANT_CATEGORIES)[number];

// Align ProcessedEmailContent with EmailContent expected by generateDigestSummary
interface ProcessedEmailContent extends EmailContent {}

// More specific type for what the digest service needs from user settings
interface UserDigestPreferences {
  category_preferences: Record<
    RelevantCategory,
    { action: string; digest: boolean }
  >;
  default_account_id?: string | null;
}

export class WeeklyDigestService {
  private supabase: SupabaseClient<Database>;

  constructor(supabaseAdminClient: SupabaseClient<Database>) {
    this.supabase = supabaseAdminClient;
  }

  private async fetchAllUserIdsWithActiveAccounts(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("email_accounts")
      .select("user_id", { count: "exact", head: false })
      .eq("is_active", true)
      .not("user_id", "is", null);

    if (error) {
      logger.error("Error fetching distinct user_ids:", error);
      throw new Error("Failed to fetch user_ids for digest.");
    }
    const userIds = data
      ? Array.from(new Set(data.map((item) => item.user_id)))
      : [];
    return userIds.filter(
      (userId): userId is string =>
        userId !== null && typeof userId === "string"
    );
  }

  private async fetchUserEmailAccounts(
    userId: string
  ): Promise<EmailAccountDetails[]> {
    const { data, error } = await this.supabase
      .from("email_accounts")
      .select(
        "id, email, name, imap_host, imap_port, smtp_host, smtp_port, password_encrypted, last_synced_uid, last_synced_at, user_id, is_active, provider, access_token_encrypted, refresh_token_encrypted"
      )
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error) {
      logger.error(`Error fetching email accounts for user ${userId}:`, error);
      throw new Error(`Failed to fetch email accounts for user ${userId}.`);
    }
    return data || [];
  }

  private async fetchUserSettings(
    userId: string
  ): Promise<UserDigestPreferences | null> {
    const { data, error } = await this.supabase
      .from("user_settings")
      .select("category_preferences, default_account_id")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        logger.warn(`No user settings found for user ${userId}.`);
        return {
          category_preferences:
            {} as UserDigestPreferences["category_preferences"],
        }; // Return default instead of null
      }
      logger.error(`Error fetching user settings for user ${userId}:`, error);
      throw new Error(`Failed to fetch user settings for ${userId}.`);
    }

    const categoryPreferences =
      (data?.category_preferences as UserDigestPreferences["category_preferences"]) ||
      ({} as UserDigestPreferences["category_preferences"]);

    return {
      ...data,
      category_preferences: categoryPreferences,
    } as UserDigestPreferences;
  }

  private async fetchEmailsForCategory(
    userAccountIds: string[],
    categoryName: RelevantCategory
  ): Promise<Tables<"emails">[]> {
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: emails, error: emailsError } = await this.supabase
      .from("emails")
      .select("*")
      .in("account_id", userAccountIds)
      .eq("category", categoryName)
      .gte("received_at", sevenDaysAgo)
      .order("received_at", { ascending: false });

    if (emailsError) {
      logger.error(
        `Error fetching emails for category ${categoryName} for accounts ${userAccountIds.join(
          ", "
        )}:`,
        emailsError
      );
      return [];
    }
    return emails || [];
  }

  private cleanEmailBody(
    rawHtml: string | null,
    rawText: string | null
  ): string {
    let body = "";
    if (rawHtml) {
      body = htmlToText(rawHtml, {
        wordwrap: false,
        preserveNewlines: false,
        baseElements: { selectors: ["body"], returnDomByDefault: true },
        selectors: [
          { selector: "a", options: { ignoreHref: true } },
          { selector: "img", format: "skip" },
          { selector: "style", format: "skip" },
          { selector: "script", format: "skip" },
          {
            selector: "p",
            options: { leadingLineBreaks: 1, trailingLineBreaks: 1 },
          },
          {
            selector: "div",
            options: { leadingLineBreaks: 1, trailingLineBreaks: 1 },
          },
          { selector: "br", format: "lineBreak" },
        ],
      });
      // Unicode character cleanup (letters, numbers, punctuation, symbols, whitespace)
      body = body.replace(/[^\p{L}\p{N}\p{P}\p{S}\s]/gu, "");
    } else if (rawText) {
      body = rawText;
    }

    // Normalize various Unicode space characters to a regular space
    body = body.replace(/[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g, " ");
    // Collapse multiple standard spaces into a single space
    body = body.replace(/ {2,}/g, " ");
    // Condense multiple newlines (3 or more) into exactly two newlines
    body = body.replace(/(\r\n|\r|\n){3,}/g, "\n\n");
    // Trim any leading/trailing whitespace
    body = body.trim();
    // Replace URLs
    body = body.replace(/https?:\/\/[^\s\/$.?#][^\s]*/gi, "[URL]");

    return body;
  }

  private prepareEmailContents(
    emails: Tables<"emails">[]
  ): ProcessedEmailContent[] {
    return emails.map((email) => {
      let fromValue: string;
      try {
        fromValue = email.from_name
          ? decrypt(email.from_name)
          : email.from_email
          ? decrypt(email.from_email)
          : "Unknown Sender";
      } catch (error) {
        logger.warn(
          `Error decrypting sender info for email ${email.id} (From Name: ${
            email.from_name ? "Exists" : "Missing"
          }, From Email: ${email.from_email ? "Exists" : "Missing"}):`,
          error
        );
        fromValue = "Unknown Sender (Decryption Error)";
      }

      let plainSubject: string;
      try {
        plainSubject = email.subject ? decrypt(email.subject) : "No Subject";
        if (plainSubject === null || plainSubject === undefined)
          plainSubject = "No Subject (Decryption Result Empty)";
      } catch (error) {
        logger.warn(
          `Error decrypting subject for email ${email.id} (Original: "${(
            email.subject || ""
          ).substring(0, 70)}..."):`,
          error
        );
        plainSubject = email.subject || "[Subject Decryption Failed]";
      }

      let decryptedBodyText: string | null = null;
      if (email.body_text) {
        try {
          decryptedBodyText = decrypt(email.body_text);
        } catch (error) {
          logger.warn(
            `Error decrypting body_text for email ${email.id} (Subject: "${plainSubject}"):`,
            error
          );
          decryptedBodyText = "[Content Decryption Failed]"; // Placeholder after failed decryption
        }
      }

      let decryptedBodyHtml: string | null = null;
      if (email.body_html) {
        try {
          decryptedBodyHtml = decrypt(email.body_html);
        } catch (error) {
          logger.warn(
            `Error decrypting body_html for email ${email.id} (Subject: "${plainSubject}"):`,
            error
          );
          // Keep as HTML-like string placeholder for consistency if needed, but cleaning will target text
          decryptedBodyHtml = "<p>[Content Decryption Failed]</p>";
        }
      }

      // Clean the email body content using the new helper method
      const cleanedContentForDigest = this.cleanEmailBody(
        decryptedBodyHtml,
        decryptedBodyText
      );

      return {
        subject: plainSubject,
        from: fromValue,
        content: cleanedContentForDigest, // Use the fully cleaned content
        receivedAt: email.received_at === null ? undefined : email.received_at, // Ensure null becomes undefined
      };
    });
  }

  private async generateAndSendCategoryDigest(
    userEmailAccounts: EmailAccountDetails[],
    userId: string,
    category: RelevantCategory,
    emailsToDigest: ProcessedEmailContent[],
    userSettings: UserDigestPreferences | null // Can be null if settings not found
  ): Promise<boolean> {
    if (emailsToDigest.length === 0) {
      logger.info(
        `No emails to digest for category ${category} for user ${userId}.`
      );
      return false;
    }

    try {
      logger.info(
        `Generating digest for category: ${category} for user ${userId}. ${emailsToDigest.length} emails.`
      );

      const digestHtmlSummary = await generateDigestSummary(
        emailsToDigest, // This should now be compatible
        userEmailAccounts[0]?.name || userId,
        category
      );

      const sendFromAccount = userEmailAccounts[0]; // Requires at least one account
      let sendToEmail = sendFromAccount.email;

      if (userSettings?.default_account_id) {
        const defaultAccount = userEmailAccounts.find(
          (acc) => acc.id === userSettings.default_account_id
        );
        if (defaultAccount) {
          sendToEmail = defaultAccount.email;
        }
      }

      const emailSubject = `Your Weekly ${category
        .replace(/-/g, " ") // Replace all hyphens
        .replace(/\b\w/g, (char) => char.toUpperCase())} Digest`;

      await sendDigestEmail(
        sendFromAccount,
        sendToEmail,
        emailSubject,
        digestHtmlSummary
      );
      logger.info(
        `Digest for category ${category} successfully sent to ${sendToEmail} for user ${userId}.`
      );
      return true;
    } catch (digestError: any) {
      logger.error(
        `Error generating or sending digest for category ${category} for user ${userId}:`,
        digestError.message,
        digestError.stack
      );
      return false;
    }
  }

  public async processUserDigest(
    userId: string
  ): Promise<{ userId: string; success: boolean; digestsSent: number }> {
    logger.info(`Processing weekly digest for user ID: ${userId}`);
    let digestsSentThisUser = 0;

    const userEmailAccounts = await this.fetchUserEmailAccounts(userId);
    if (userEmailAccounts.length === 0) {
      logger.info(
        `No active email accounts found for user ${userId}. Skipping digest.`
      );
      return { userId, success: true, digestsSent: 0 };
    }

    const userSettings = await this.fetchUserSettings(userId);
    // UserSettings might be null if not found, but we ensured fetchUserSettings returns a default structure for category_preferences
    const categoryPreferences =
      userSettings?.category_preferences ||
      ({} as UserDigestPreferences["category_preferences"]);
    const accountIds = userEmailAccounts.map((acc) => acc.id);

    for (const category of RELEVANT_CATEGORIES) {
      if (categoryPreferences[category]?.digest) {
        logger.info(
          `User ${userId} has digest enabled for category: ${category}. Fetching emails.`
        );
        const rawEmails = await this.fetchEmailsForCategory(
          accountIds,
          category
        );

        if (rawEmails.length > 0) {
          logger.info(
            `Found ${rawEmails.length} emails for category ${category} for user ${userId}. Preparing content.`
          );
          const preparedContents = this.prepareEmailContents(rawEmails);

          const sent = await this.generateAndSendCategoryDigest(
            userEmailAccounts,
            userId,
            category,
            preparedContents,
            userSettings // Pass the possibly null userSettings
          );
          if (sent) {
            digestsSentThisUser++;
          }
        } else {
          logger.info(
            `No emails found for category ${category} for user ${userId} in the last 7 days.`
          );
        }
      }
    }

    if (digestsSentThisUser > 0) {
      logger.info(
        `Successfully sent ${digestsSentThisUser} digests for user ${userId}.`
      );
    } else {
      logger.info(
        `No digests generated or sent for user ${userId} as no categories with emails were enabled or had content.`
      );
    }
    return { userId, success: true, digestsSent: digestsSentThisUser };
  }

  public async processAllUserDigests(): Promise<{
    totalUsersProcessed: number;
    totalUsersFailed: number;
    totalDigestsSent: number;
  }> {
    let totalUsersProcessed = 0;
    let totalUsersFailed = 0;
    let totalDigestsSent = 0;

    const allUserIds = await this.fetchAllUserIdsWithActiveAccounts();

    if (allUserIds.length === 0) {
      logger.info("No users with active accounts found. Exiting.");
      return {
        totalUsersProcessed: 0,
        totalUsersFailed: 0,
        totalDigestsSent: 0,
      };
    }

    logger.info(
      `Found ${allUserIds.length} users to process for weekly digests.`
    );

    for (const userId of allUserIds) {
      try {
        const result = await this.processUserDigest(userId);
        // Regardless of digestsSent, if processUserDigest didn't throw, user processing was 'successful' at this level
        totalUsersProcessed++;
        totalDigestsSent += result.digestsSent;
      } catch (userProcessingError: any) {
        logger.error(
          `Critical error processing digest for user ${userId}:`,
          userProcessingError.message,
          userProcessingError.stack
        );
        totalUsersFailed++;
      }
    }

    logger.info(
      `Weekly digest processing finished. Users Processed: ${totalUsersProcessed}, Users Failed (critical): ${totalUsersFailed}, Digests Sent: ${totalDigestsSent}`
    );
    return { totalUsersProcessed, totalUsersFailed, totalDigestsSent };
  }
}
