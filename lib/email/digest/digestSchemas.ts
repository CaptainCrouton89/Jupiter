import { z } from "zod";

export const bulletsWithTitleSchema = z.object({
  title: z.string().describe("Concise title for this email"),
  summaryBullets: z
    .array(z.string())
    .describe(
      "2-5 bullet points highlighting the most important information from the email."
    ),
});
export type BulletsWithTitle = z.infer<typeof bulletsWithTitleSchema>;

export const sentenceWithTitleSchema = z.object({
  title: z.string().describe("Concise title for this email"),
  summaryContent: z
    .string()
    .describe(
      "A brief summary of the email, highlighting the most important information."
    ),
});
export type SentenceWithTitle = z.infer<typeof sentenceWithTitleSchema>;

export const onlyTitleSchema = z.object({
  title: z.string().describe("A concise summary of the email."),
});
export type OnlyTitle = z.infer<typeof onlyTitleSchema>;

export const introHookSchema = z.object({
  hookParagraph: z
    .string()
    .describe(
      "A short, engaging introductory paragraph (2-3 sentences) that highlights the most interesting information or themes from the provided email summaries."
    ),
});
export type IntroHook = z.infer<typeof introHookSchema>;
