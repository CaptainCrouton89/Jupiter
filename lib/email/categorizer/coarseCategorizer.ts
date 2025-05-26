import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type {
  CoarseCategorizationResult,
  EmailCategorizationInput,
  PreparedEmailData,
} from "./types";

const coarseCategorizationSchema = z.object({
  category: z.enum(["transactional", "promotional", "operational", "personal"]),
});

export async function categorizeEmailCoarsely(
  emailData: EmailCategorizationInput,
  preparedData: PreparedEmailData
): Promise<CoarseCategorizationResult> {
  const { from, subject } = emailData;
  const { emailBody, heuristicSignals } = preparedData;

  const systemPrompt = `
You are an email classification assistant performing the first stage of a two-stage categorization process.

Your task is to classify emails into one of four coarse categories:

1. **transactional**: Emails confirming actions, providing receipts, account notifications, password resets, order confirmations, shipping updates, verification emails, etc. These are typically automated, direct responses to user actions.

2. **promotional**: Marketing emails, advertisements, sales announcements, newsletters with promotional content, special offers, discount codes, product launches, etc. These are designed to drive sales or engagement.

3. **operational**: Regular updates, system notifications, status updates, maintenance notices, automated reports, etc. These provide information without direct promotional intent.

4. **personal**: Direct human-to-human communication, personal messages, conversations, individual correspondence, forwarded emails, etc. These are typically unique, conversational content between people.

Use the provided heuristic signals to inform your decision:
- Tracking pixels, unsubscribe mechanisms, and promotional keywords suggest promotional
- Automated patterns, receipts, and confirmations suggest transactional  
- Regular informational updates and system notifications suggest operational
- Personal sender domains and conversational content suggest personal

Choose the single most appropriate coarse category.
`;

  const mainPrompt = `
<sender>
${from?.address || "N/A"} (Name: ${from?.name || "N/A"})
</sender>

<subject>
${subject || "N/A"}
</subject>

<heuristic_signals>
Sender Info: Domain: ${
    heuristicSignals.senderAnalysis.domain || "N/A"
  }, Is Common Freemail: ${heuristicSignals.senderAnalysis.isCommonFreemail}
Unsubscribe Info: Has Opt-Out Mechanism: ${
    heuristicSignals.unsubscribeInfo.hasLinkOrButton
  }, List-Unsubscribe Header Present: ${!!heuristicSignals.unsubscribeInfo
    .listUnsubscribeHeader}
Tracking Pixel Detected: ${heuristicSignals.trackingPixelDetected}
Promotional Keywords Found: [${heuristicSignals.promotionalKeywords.join(
    ", "
  )}] (Count: ${heuristicSignals.promotionalKeywords.length})
Styling/Structure: Visually Rich: ${
    heuristicSignals.stylingAnalysis.isVisuallyRich
  }, Image Count: ${heuristicSignals.stylingAnalysis.imageCount}
Relevant Headers: X-Mailer Present: ${!!heuristicSignals.relevantHeaders
    .xMailer}, Campaign-ID Present: ${!!heuristicSignals.relevantHeaders
    .campaignId}
</heuristic_signals>

<body>
${emailBody.substring(0, 3000)}${
    emailBody.length > 3000 ? "(continued...)" : ""
  }
</body>

Based on the content and heuristic signals, classify this email into one of the four coarse categories.
`;

  try {
    const { object } = await generateObject({
      temperature: 0,
      model: openai("gpt-4.1-nano"),
      schema: coarseCategorizationSchema,
      system: systemPrompt,
      prompt: mainPrompt,
    });

    console.log("Coarse categorization result:", object);
    return object;
  } catch (error) {
    console.error("Error in coarse categorization:", error);
    return {
      category: "operational",
    };
  }
}
