import {
  DigestEmailData,
  EmailSummaryItem,
  getDigestHtmlTemplate,
} from "./templates/digestTemplate";

import { generateIntroHook, summarizeSingleEmail } from "./digestAI";
import type { IndividualEmailSummary } from "./digestSchemas";
export interface NewsletterContent {
  subject: string | null;
  from: string | null;
  content: string;
  receivedAt?: string;
}

export async function generateDigestSummary(
  newsletters: NewsletterContent[],
  userName: string | undefined,
  categoryName: string
): Promise<string> {
  const formattedCategoryName = categoryName
    .replace("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const overallTitle = `Your Weekly ${formattedCategoryName} Digest`;

  if (!newsletters || newsletters.length === 0) {
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
  const summaryPromises = newsletters.map(
    (email) => summarizeSingleEmail(email, categoryName) // Imported function
  );
  const settledSummaries = await Promise.allSettled(summaryPromises);

  const successfulEmailSummaries: EmailSummaryItem[] = [];
  const summariesForHook: Array<{
    title: string;
    bullets: string[];
    summaryType?: "sentence" | "bullets";
    content?: string | string[];
  }> = [];

  settledSummaries.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      const summaryData = result.value as IndividualEmailSummary; // result.value is Promise<IndividualEmailSummary | null>
      const originalEmail = newsletters[index];
      let currentSummaryItem: EmailSummaryItem | null = null;

      if (summaryData.summarySentence) {
        currentSummaryItem = {
          emailTitle: originalEmail.subject || "Untitled Email",
          source: originalEmail.from || "Unknown Sender",
          summaryType: "sentence",
          content: summaryData.summarySentence,
          category: categoryName,
          receivedAt: originalEmail.receivedAt,
        };
      } else if (
        summaryData.summaryBullets &&
        summaryData.summaryBullets.length > 0
      ) {
        currentSummaryItem = {
          emailTitle: originalEmail.subject || "Untitled Email",
          source: originalEmail.from || "Unknown Sender",
          summaryType: "bullets",
          content: summaryData.summaryBullets,
          category: categoryName,
          receivedAt: originalEmail.receivedAt,
        };
      }

      if (currentSummaryItem) {
        successfulEmailSummaries.push(currentSummaryItem);
        summariesForHook.push({
          title: currentSummaryItem.emailTitle,
          bullets:
            summaryData.summaryBullets ||
            (summaryData.summarySentence ? [summaryData.summarySentence] : []),
          summaryType: currentSummaryItem.summaryType,
          content: currentSummaryItem.content,
        });
      }
    }
  });

  if (successfulEmailSummaries.length === 0) {
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
    // Renamed to avoid conflict with imported generateIntroHook
    summariesForHook,
    categoryName
  );

  const digestEmailData: DigestEmailData = {
    overallTitle: overallTitle,
    hookIntro: introHookContent, // Use the content from the awaited call
    emailSummaries: successfulEmailSummaries,
    userName: userName,
    categoryName: categoryName,
  };

  return getDigestHtmlTemplate(digestEmailData);
}
