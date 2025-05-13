import { decrypt } from "@/lib/auth/encryption";
import {
  DigestEmailData,
  EmailSummaryItem,
  getDigestHtmlTemplate,
} from "../templates/digestTemplate";
import {
  generateIntroHook,
  IndividualEmailSummary,
  summarizeSingleEmail,
} from "./digestAI";

export interface EmailContent {
  subject: string | null;
  from: string | null;
  content: string;
  receivedAt?: string;
}

export async function generateDigestSummary(
  emails: EmailContent[],
  userName: string | undefined,
  categoryName: string
): Promise<string> {
  const formattedCategoryName = categoryName
    .replace("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const overallTitle = `Your Weekly ${formattedCategoryName} Digest`;

  if (!emails || emails.length === 0) {
    const noNewsData: DigestEmailData = {
      overallTitle,
      hookIntro: `No new ${formattedCategoryName.toLowerCase()} to summarize this week! Enjoy the peace.`,
      emailSummaries: [],
      userName,
      categoryName,
    };
    return getDigestHtmlTemplate(noNewsData);
  }

  // Calls to summarizeSingleEmail and generateIntroHook now use the imported versions
  const summaryPromises = emails.map(async (email) => {
    let decryptedContent = "";
    let decryptedSubject = "(Subject Unavailable)";
    const decryptedSender = email.from || "Unknown Sender";

    try {
      // Decrypt Subject
      if (email.subject && typeof email.subject === "string") {
        decryptedSubject = decrypt(email.subject);
      }
    } catch (error) {
      console.error(`[Digest] Failed to decrypt email subject:`, error);
    }

    try {
      if (email.content && typeof email.content === "string") {
        decryptedContent = decrypt(email.content);
      } else {
        console.warn(
          "[Digest] Email content missing or not a string:",
          decryptedSubject
        );
        decryptedContent = "Content unavailable (encryption issue).";
      }
    } catch (error) {
      console.error(
        `[Digest] Failed to decrypt email content for "${decryptedSubject}":`,
        error
      );
      decryptedContent = "Content could not be decrypted.";
    }

    const emailForSummary: EmailContent = {
      subject: decryptedSubject,
      from: decryptedSender,
      content: decryptedContent,
      receivedAt: email.receivedAt,
    };
    return summarizeSingleEmail(emailForSummary, categoryName);
  });
  const settledSummaries = await Promise.allSettled(summaryPromises);

  const emailSummaries: EmailSummaryItem[] = [];

  settledSummaries.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      const originalEmail = emails[index]; // originalEmail.subject is encrypted here
      let summaryData = result.value as IndividualEmailSummary;

      const summaryType =
        "summaryBullets" in summaryData
          ? "bullets"
          : "summaryContent" in summaryData
          ? "sentence"
          : "sentence-only";

      let currentSummaryItem: EmailSummaryItem = {
        title: summaryData.title,
        emailTitle: summaryData.title,
        emailContent:
          "summaryContent" in summaryData && summaryData.summaryContent
            ? summaryData.summaryContent
            : "summaryBullets" in summaryData && summaryData.summaryBullets
            ? summaryData.summaryBullets.join("\\n")
            : "Content not directly available in summary object",
        source: originalEmail.from || "Unknown Sender",
        summaryType: summaryType as "sentence" | "sentence-only" | "bullets",
        content:
          "summaryContent" in summaryData
            ? summaryData.summaryContent
            : undefined,
        bullets:
          "summaryBullets" in summaryData
            ? summaryData.summaryBullets
            : undefined,
        category: categoryName,
        receivedAt: originalEmail.receivedAt || "",
      };

      if (currentSummaryItem) {
        emailSummaries.push(currentSummaryItem);
      }
    }
  });

  if (emailSummaries.length === 0) {
    const noSummariesData: DigestEmailData = {
      overallTitle,
      hookIntro: `We tried to summarize your ${formattedCategoryName.toLowerCase()} this week, but it seems there was an issue. We'll try again next week!`,
      emailSummaries: [],
      userName,
      categoryName,
    };
    return getDigestHtmlTemplate(noSummariesData);
  }

  const introHookContent = await generateIntroHook(
    emailSummaries,
    categoryName
  );

  const digestEmailData: DigestEmailData = {
    overallTitle: overallTitle,
    hookIntro: introHookContent, // Use the content from the awaited call
    emailSummaries: emailSummaries,
    userName: userName,
    categoryName: categoryName,
  };

  return getDigestHtmlTemplate(digestEmailData);
}
