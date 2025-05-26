import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod"; // Zod is needed for z.ZodType and schema manipulations if any

// Import Schemas and Types from digestSchemas.ts
import {
  BulletsWithTitle,
  bulletsWithTitleSchema,
  introHookSchema,
  OnlyTitle,
  onlyTitleSchema,
  SentenceWithTitle,
  sentenceWithTitleSchema,
} from "./digestSchemas";

// Import Prompt functions from digestPrompts.ts
import {
  getIntroHookPrompts,
  getSummarizeSingleEmailPrompt,
} from "./digestPrompts";

// Import NewsletterContent from its definition (currently in generateDigest.ts)
// Adjust path if NewsletterContent is moved to a dedicated types file later.
import { Category } from "@/types/settings";
import { EmailSummaryItem } from "../templates/digestTemplate";
import type { EmailContent } from "./generateDigest";

const titleAndBulletsCategories: Category[] = ["newsletter"];
const titleOnlyCategories: Category[] = [
  "shipping-delivery",
  "system-alerts", 
  "system-updates",
  "account-related",
  "email-verification",
  "uncategorizable",
];
const titleAndSummaryCategories: Category[] = [
  "marketing",
  "payments",
  "finances",
  "personal",
  "work",
];

export type IndividualEmailSummary =
  | BulletsWithTitle
  | SentenceWithTitle
  | OnlyTitle;

// Function to summarize a single email
export async function summarizeSingleEmail(
  email: EmailContent,
  categoryName: string
): Promise<IndividualEmailSummary | null> {
  const { systemPrompt, prompt } = getSummarizeSingleEmailPrompt(
    categoryName,
    email
  );

  let generationSchema: z.ZodType<any>;

  if (titleAndBulletsCategories.includes(categoryName as Category)) {
    generationSchema = bulletsWithTitleSchema;
  } else if (titleAndSummaryCategories.includes(categoryName as Category)) {
    generationSchema = sentenceWithTitleSchema;
  } else if (titleOnlyCategories.includes(categoryName as Category)) {
    generationSchema = onlyTitleSchema;
  } else {
    throw new Error(`Unsupported category: ${categoryName}`);
  }

  try {
    const { object: summary } = await generateObject({
      model: openai("gpt-4.1-mini"),
      temperature: 0.1,
      schema: generationSchema,
      system: systemPrompt,
      prompt: prompt,
    });
    return summary as IndividualEmailSummary;
  } catch (error) {
    console.error(
      `Error summarizing email "${
        email.subject || "[No Subject]"
      }" for category "${categoryName}":`,
      error
    );
    return null;
  }
}

// Function to generate the intro hook
export async function generateIntroHook(
  emailSummaries: EmailSummaryItem[],
  categoryName: string
): Promise<string> {
  const highlights = emailSummaries
    .map(
      (s) =>
        `${s.title} - ${s.emailTitle}: ${
          s.content || (s.bullets || []).join("; ")
        }`
    )
    .join("\n");

  const { systemPrompt, prompt } = getIntroHookPrompts(
    categoryName,
    highlights
  );

  try {
    const { object: intro } = await generateObject({
      model: openai("gpt-4.1-mini"), // Reflecting user's manual change
      temperature: 0.1,
      schema: introHookSchema,
      system: systemPrompt,
      prompt: prompt,
    });
    return intro.hookParagraph;
  } catch (error) {
    console.error("Error generating intro hook:", error);
    return "Welcome to your weekly newsletter digest! Here's what's new:";
  }
}
