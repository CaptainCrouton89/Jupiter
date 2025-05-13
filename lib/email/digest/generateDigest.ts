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

  // emails are now expected to have decrypted content and subject
  const summaryPromises = emails.map(async (email) => {
    // Directly use the provided subject and content, assuming they are decrypted
    const emailForSummary: EmailContent = {
      subject: email.subject || "(Subject Unavailable)", // Use directly, provide fallback
      from: email.from || "Unknown Sender",
      content: email.content, // Use directly
      receivedAt: email.receivedAt,
    };
    // If content is empty after cleaning (e.g. was only an image, or decryption failed upstream and placeholder used)
    // we might want to skip summarizing or handle it gracefully in summarizeSingleEmail
    if (
      !emailForSummary.content ||
      emailForSummary.content.trim() === "" ||
      emailForSummary.content.trim() === "[URL]"
    ) {
      // Skip summarizing if content is effectively empty or just a placeholder
      // This might return a specific marker or null to be filtered later
      console.warn(
        `[Digest] Skipping summary for email with empty/placeholder content. Subject: ${emailForSummary.subject}`
      );
      // Return a structure that indicates this email should be skipped or handled as having no summarizable content
      return {
        title: emailForSummary.subject || "(Title Unavailable)",
        summaryContent: "This email contained no summarizable text content.",
        category: categoryName,
        // no summaryBullets implies it's a sentence-only or skipped summary
      } as IndividualEmailSummary; // Adjust type assertion as needed based on IndividualEmailSummary structure
    }
    return summarizeSingleEmail(emailForSummary, categoryName);
  });
  const settledSummaries = await Promise.allSettled(summaryPromises);

  const emailSummaries: EmailSummaryItem[] = [];

  settledSummaries.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      const originalEmail = emails[index];
      let summaryData = result.value as IndividualEmailSummary;

      const summaryType =
        "summaryBullets" in summaryData
          ? "bullets"
          : "summaryContent" in summaryData
          ? "sentence"
          : "sentence-only";

      let currentSummaryItem: EmailSummaryItem = {
        title: summaryData.title, // This should come from summarizeSingleEmail now
        emailTitle: summaryData.title, // Use the title from the summary
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
