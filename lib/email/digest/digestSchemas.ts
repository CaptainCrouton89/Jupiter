import { z } from "zod";

export const bulletsWithTitleSchema = z.object({
  title: z.string(),
  summaryBullets: z.array(z.string()),
});
export type BulletsWithTitle = z.infer<typeof bulletsWithTitleSchema>;

export const sentenceWithTitleSchema = z.object({
  title: z.string(),
  summaryContent: z.string(),
});
export type SentenceWithTitle = z.infer<typeof sentenceWithTitleSchema>;

export const onlyTitleSchema = z.object({
  title: z.string(),
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
