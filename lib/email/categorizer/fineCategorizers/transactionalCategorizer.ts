import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { Category } from "@/types/settings";
import type { EmailCategorizationInput, PreparedEmailData } from "../types";

const transactionalSchema = z.object({
  category: z.enum(['payments', 'finances', 'account-related', 'email-verification', 'notification']),
});

export async function categorizeTransactionalEmail(
  emailData: EmailCategorizationInput,
  preparedData: PreparedEmailData
): Promise<{ category: Category }> {
  const { from, subject } = emailData;
  const { emailBody } = preparedData;

  const systemPrompt = `
You are categorizing emails that have been identified as transactional. Choose the most specific category:

1. **payments**: Purchase confirmations, receipts, invoices, payment due notices, transaction confirmations, order details, subscription billing, refund notifications.
   - Keywords: "receipt", "order confirmation", "invoice", "payment", "purchase", "transaction", "billing", "refund"

2. **finances**: Banking statements, investment updates, credit card alerts, account balance notifications, financial institution communications (but not direct payment confirmations).
   - Keywords: "statement", "account balance", "transaction alert", "investment", "banking", "credit card"

3. **account-related**: Security alerts, password resets, account updates, login notifications, terms of service updates, account verification for existing accounts.
   - Keywords: "security alert", "password reset", "account update", "login", "terms", "privacy policy"

4. **email-verification**: Specific emails asking to verify email address during new account signup.
   - Keywords: "verify your email", "confirm your email address", "activate your account"

5. **notification**: General transactional notifications that don't fit other categories - shipping updates, status changes, system alerts, CI/CD notifications.
   - Keywords: "shipped", "delivered", "status update", "deployment", "system notification"

Choose the most specific category that fits the email content.
`;

  const mainPrompt = `
<sender>
${from?.address || "N/A"} (Name: ${from?.name || "N/A"})
</sender>

<subject>
${subject || "N/A"}
</subject>

<body>
${emailBody.substring(0, 2000)}${emailBody.length > 2000 ? "(continued...)" : ""}
</body>

Categorize this transactional email into the most appropriate specific category.
`;

  try {
    const { object } = await generateObject({
      temperature: 0,
      model: openai("gpt-4.1-nano"),
      schema: transactionalSchema,
      system: systemPrompt,
      prompt: mainPrompt,
    });

    console.log("Transactional fine categorization result:", object.category);
    return object;
  } catch (error) {
    console.error("Error in transactional fine categorization:", error);
    return { category: "notification" as Category };
  }
}