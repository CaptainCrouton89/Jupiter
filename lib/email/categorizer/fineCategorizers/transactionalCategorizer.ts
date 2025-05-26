import { Category } from "@/types/settings";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { EmailCategorizationInput, PreparedEmailData } from "../types";

const transactionalSchema = z.object({
  category: z.enum([
    "payments",
    "finances",
    "account-related",
    "email-verification",
    "shipping-delivery",
    "system-alerts",
  ]),
});

export async function categorizeTransactionalEmail(
  emailData: EmailCategorizationInput,
  preparedData: PreparedEmailData
): Promise<{ category: Category }> {
  const { from, subject } = emailData;
  const { emailBody, heuristicSignals } = preparedData;

  const systemPrompt = `
You are categorizing emails that have been identified as transactional. Choose the most specific category:

1. **payments**: Purchase confirmations, receipts, invoices, payment due notices, transaction confirmations, order details, subscription billing, refund notifications.
   - Keywords: "receipt", "order confirmation", "invoice", "payment", "purchase", "transaction", "billing", "refund"

2. **finances**: Banking statements, investment updates, credit card alerts, account balance notifications, financial institution communications (but not direct payment confirmations).
   - Keywords: "statement", "account balance", "transaction alert", "investment", "banking", "credit card"

3. **account-related**: Password resets, account updates, terms of service updates, account verification for existing accounts, privacy policy changes.
   - Keywords: "password reset", "account update", "terms", "privacy policy", "account verification"

4. **email-verification**: Specific emails asking to verify email address or accept an invitation.
   - Keywords: "verify your email", "confirm your email address", "activate your account"

5. **shipping-delivery**: Order tracking, shipping updates, delivery confirmations, package notifications, return/exchange updates.
   - Keywords: "shipped", "delivered", "tracking", "package", "delivery", "return", "exchange"

6. **system-alerts**: Security alerts, login notifications, suspicious activity warnings, authentication alerts, account access notifications.
   - Keywords: "security alert", "login notification", "suspicious activity", "authentication", "access alert"

Choose the most specific category that fits the email content.
`;

  const mainPrompt = `
<sender>
${from?.address || "N/A"} (Name: ${from?.name || "N/A"})
</sender>

<subject>
${subject || "N/A"}
</subject>

<heuristic_signals>
Sender Domain: ${heuristicSignals.senderAnalysis.domain || "N/A"}
Automated Patterns: X-Mailer: ${!!heuristicSignals.relevantHeaders.xMailer}
Security Context: Login/Auth Keywords: ${heuristicSignals.promotionalKeywords.some(k => 
  ['login', 'password', 'security', 'verify', 'authentication'].includes(k.toLowerCase()))}
</heuristic_signals>

<body>
${emailBody.substring(0, 2000)}${
    emailBody.length > 2000 ? "(continued...)" : ""
  }
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
    return { category: "system-alerts" as Category };
  }
}
