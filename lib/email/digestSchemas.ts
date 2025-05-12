import { z } from "zod";

// Schema for summarizing a single email by AI
export const individualEmailSummarySchema = z
  .object({
    summarySentence: z
      .string()
      .optional()
      .describe(
        "A single concise summary sentence for this email. Use if appropriate for the category (e.g., marketing, receipt)."
      ),
    summaryBullets: z
      .array(z.string())
      .optional()
      .describe(
        "1-5 key bullet points summarizing this single email. Use if appropriate for the category (e.g., newsletter, code-related)."
      ),
  })
  .refine((data) => data.summarySentence || data.summaryBullets, {
    message: "Either summarySentence or summaryBullets must be provided.",
  })
  .refine((data) => !(data.summarySentence && data.summaryBullets), {
    message:
      "Only one of summarySentence or summaryBullets should be provided.",
  });
export type IndividualEmailSummary = z.infer<
  typeof individualEmailSummarySchema
>;

// Category-specific schemas for direct AI generation
export const sentenceOnlySummarySchema = z.object({
  summarySentence: z
    .string()
    .describe("A single concise summary sentence for this email."),
});
export type SentenceOnlySummary = z.infer<typeof sentenceOnlySummarySchema>;

export const bulletsOnlySummarySchema = z.object({
  summaryBullets: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe(
      "1-5 key, concise bullet points summarizing this single email. 1 bullet point for short emails, 5 for long ones, and 3 for medium-length emails."
    ),
});
export type BulletsOnlySummary = z.infer<typeof bulletsOnlySummarySchema>;

// Schema for the intro hook by AI
export const introHookSchema = z.object({
  hookParagraph: z
    .string()
    .describe(
      "A short, engaging introductory paragraph (2-3 sentences) that highlights the most interesting information or themes from the provided email summaries."
    ),
});
export type IntroHook = z.infer<typeof introHookSchema>;
