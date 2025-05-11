import { openai } from "@ai-sdk/openai"; // Assuming you are using OpenAI
import { generateObject } from "ai";
import { z } from "zod";
import type { ParsedEmailData } from "./parseEmail"; // Assuming ParsedEmailData is in a sibling file

// Define the schema for the AI's response
const spamEvaluationSchema = z.object({
  spamScore: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Likelihood of the email being spam, from 0 (not spam) to 1 (definitely spam)."
    ),
});

export type SpamEvaluationResult = z.infer<typeof spamEvaluationSchema>;

interface SpamEvaluationInput {
  from: ParsedEmailData["from"];
  subject: ParsedEmailData["subject"];
  textContent: ParsedEmailData["text"];
  htmlContent: ParsedEmailData["html"];
}

/**
 * Evaluates an email for spam likelihood using an AI model.
 * @param emailData Relevant parts of the parsed email.
 * @returns A promise that resolves to the spam evaluation result.
 */
export async function evaluateEmailForSpam(
  emailData: SpamEvaluationInput
): Promise<SpamEvaluationResult> {
  const { from, subject, textContent, htmlContent } = emailData;

  // Construct a prompt for the AI model.
  // Prioritize text content, fallback to HTML if text is not available.
  const emailBody = textContent || htmlContent || "";

  // Simplified prompt, you may want to make this more detailed
  const prompt = `
    Evaluate the following email for spam.
    Sender: ${from?.address || "N/A"} (Name: ${from?.name || "N/A"})
    Subject: ${subject || "N/A"}
    Body (first 500 characters):
    ${emailBody.substring(0, 500)}

    Based on this information, provide a spamScore (0.0 to 1.0).
  `;

  const systemPrompt = `
You are a spam evaluator. You are given an email and you need to evaluate it for spam.
You will be given the email body and the sender's address.
You need to evaluate the email for spam and provide a spamScore (0.0 to 1.0), where 0.0 is not spam and 1.0 is definitely spam.

<context>
- My name is Silas Rhyneer
- I am a software engineer
</context>

Things I want marked as spam:
- Commercial emails
- Emails that don't contain interesting content

Things I do NOT want marked as spam:
- Emails from individuals
- Emails that are not commercial
- Emails that contain interesting content
  `;

  try {
    const { object } = await generateObject({
      model: openai("gpt-4.1-nano"),
      schema: spamEvaluationSchema,
      system: systemPrompt,
      prompt: prompt,
    });
    return object as SpamEvaluationResult;
  } catch (error) {
    console.error("Error evaluating email for spam:", error);
    // Fallback: consider it not spam or handle error as needed
    return {
      spamScore: 0, // Default to not spam in case of error
    };
  }
}
