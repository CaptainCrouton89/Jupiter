import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod"; // Zod is needed for z.ZodType and schema manipulations if any

// Import Schemas and Types from digestSchemas.ts
import {
  bulletsOnlySummarySchema,
  individualEmailSummarySchema,
  introHookSchema,
  sentenceOnlySummarySchema,
  type IndividualEmailSummary,
} from "./digestSchemas";

// Import Prompt functions from digestPrompts.ts
import {
  getIntroHookPrompts,
  getSummarizeSingleEmailPrompts,
} from "./digestPrompts";

// Import NewsletterContent from its definition (currently in generateDigest.ts)
// Adjust path if NewsletterContent is moved to a dedicated types file later.
import type { NewsletterContent } from "./generateDigest";

// Function to summarize a single email
export async function summarizeSingleEmail(
  newsletter: NewsletterContent,
  categoryName: string
): Promise<IndividualEmailSummary | null> {
  const userPrompt = getSummarizeSingleEmailPrompts(categoryName, newsletter);
  let systemPrompt: string;
  let generationSchema: z.ZodType<any, any, any>;
  let rawSummary: any; // To store result from generateObject
  let normalizedSummary: Partial<IndividualEmailSummary>;
  const modelName = "gpt-4.1-mini"; // Consistent model for summarization

  // Base instruction for JSON output, to be appended to specific task instructions.
  const jsonInstructionBullets =
    "Respond with a JSON object strictly matching the provided schema, using only the 'summaryBullets' field.";
  const jsonInstructionSentence =
    "Respond with a JSON object strictly matching the provided schema, using only the 'summarySentence' field.";

  try {
    if (categoryName.toLowerCase() === "newsletter") {
      systemPrompt = `You are an AI assistant. Your task is to summarize an email newsletter. Provide 1-5 concise bullet points summarizing main topics, any calls to action, and notable announcements. For each critical point, provide a bullet point. Do not use every bullet point if there are not enough critical points. ${jsonInstructionBullets}`;
      generationSchema = bulletsOnlySummarySchema;

      const result = await generateObject({
        model: openai(modelName),
        temperature: 0.1,
        schema: generationSchema,
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: 250,
      });
      rawSummary = result.object;
      const summary = rawSummary as { summaryBullets?: string[] }; // Type assertion
      normalizedSummary = {
        summaryBullets: summary.summaryBullets || [],
        summarySentence: undefined,
      };
    } else {
      // Tailored system prompts for other categories
      generationSchema = sentenceOnlySummarySchema; // Same schema for all these

      switch (categoryName.toLowerCase()) {
        case "code-related":
          systemPrompt = `You are an AI assistant. Your task is to summarize a code-related technical email for a software engineer. Provide a single, concise summary sentence (around 15-30 words) covering PR updates, build statuses, error messages, or important technical discussions. Mention specific repository or issue numbers if present. ${jsonInstructionSentence}`;
          break;
        case "marketing":
          systemPrompt = `You are an AI assistant. Your task is to summarize a marketing email. Provide a single, concise summary sentence (around 15-30 words) identifying the main product/service, key benefits highlighted, and any special offers or deadlines. ${jsonInstructionSentence}`;
          break;
        case "receipt":
        case "invoice":
          systemPrompt = `You are an AI assistant. Your task is to summarize a financial document (receipt or invoice). Provide a single, concise summary sentence (around 10-25 words) stating the vendor/store name, total amount, and transaction/due date. If the amount is notably large or the item important, briefly highlight this. ${jsonInstructionSentence}`;
          break;
        case "finances":
          systemPrompt = `You are an AI assistant. Your task is to summarize a financial update email. Provide a single, concise summary sentence (around 15-30 words) explaining the update (e.g., bank alert, investment news). If it mentions a large transaction, critical alert, or significant status change, highlight this. ${jsonInstructionSentence}`;
          break;
        case "notification":
          systemPrompt = `You are an AI assistant. Your task is to summarize a notification email. Provide a single, concise summary sentence (around 10-25 words) explaining the core message (e.g., shipping update, social media mention, system alert). ${jsonInstructionSentence}`;
          break;
        case "account-related":
          systemPrompt = `You are an AI assistant. Your task is to summarize an account-related email. Provide a single, concise summary sentence (around 15-30 words) explaining the message (e.g., security alert, ToS update, login confirmation). ${jsonInstructionSentence}`;
          break;
        case "personal":
          systemPrompt = `You are an AI assistant. Your task is to summarize a personal email. Provide a brief, neutral summary sentence (around 15-30 words) of its main point, maintaining privacy. ${jsonInstructionSentence}`;
          break;
        default:
          // For any other category, including potentially "uncategorizable"
          // Decide if this should be sentence or bullets. Given the structure, sentence is easier.
          systemPrompt = `You are an AI assistant. Your task is to summarize an email of an undetermined category. Provide a single, concise summary sentence capturing its main point. ${jsonInstructionSentence}`;
          generationSchema = sentenceOnlySummarySchema; // Ensure schema matches instruction
          break;
      }

      const result = await generateObject({
        model: openai(modelName),
        temperature: 0.1,
        schema: generationSchema,
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: 250,
      });
      rawSummary = result.object;
      const summary = rawSummary as { summarySentence?: string }; // Type assertion
      normalizedSummary = {
        summarySentence: summary.summarySentence || "",
        summaryBullets: undefined,
      };
    }

    // Validate the normalized summary against the comprehensive schema
    const validationResult =
      individualEmailSummarySchema.safeParse(normalizedSummary);
    if (!validationResult.success) {
      console.error(
        `Validation failed for normalized summary (category: ${categoryName}, subject: ${newsletter.subject}):`,
        validationResult.error.errors
      );
      return null;
    }
    return validationResult.data;
  } catch (error) {
    console.error(
      `Error summarizing email "${
        newsletter.subject || "[No Subject]"
      }" for category "${categoryName}":`,
      error
    );
    return null;
  }
}

// Function to generate the intro hook
export async function generateIntroHook(
  emailSummariesForHook: Array<{
    title: string;
    bullets: string[];
    summaryType?: "sentence" | "bullets";
    content?: string | string[];
  }>,
  categoryName: string
): Promise<string> {
  if (emailSummariesForHook.length === 0) {
    return `Here's your weekly roundup for ${categoryName.replace("-", " ")}.`;
  }
  const highlights = emailSummariesForHook
    .map((s) => {
      let preview: string;
      if (s.summaryType === "sentence" && typeof s.content === "string") {
        preview = s.content;
      } else if (s.summaryType === "bullets" && Array.isArray(s.content)) {
        preview = s.content.join("; ");
      } else if (s.bullets && s.bullets.length > 0) {
        preview = s.bullets.join("; ");
      } else {
        preview = "Summary unavailable";
      }
      return `Email: "${s.title}" highlights: ${preview}`;
    })
    .join("\n\n");

  const { systemPrompt: introSystemPrompt, userPrompt: introUserPrompt } =
    getIntroHookPrompts(categoryName, highlights);

  try {
    const { object: intro } = await generateObject({
      model: openai("gpt-4.1-mini"), // Reflecting user's manual change
      temperature: 0.1,
      schema: introHookSchema,
      system: introSystemPrompt,
      prompt: introUserPrompt,
      maxTokens: 150,
    });
    return intro.hookParagraph;
  } catch (error) {
    console.error("Error generating intro hook:", error);
    return "Welcome to your weekly newsletter digest! Here's what's new:";
  }
}
