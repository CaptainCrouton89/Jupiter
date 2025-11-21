import { Category } from "@/types/settings";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { EmailCategorizationInput, PreparedEmailData } from "../types";

const promotionalSchema = z.object({
  category: z.enum(["marketing", "newsletter"]),
});

export async function categorizePromotionalEmail(
  emailData: EmailCategorizationInput,
  preparedData: PreparedEmailData
): Promise<{ category: Category }> {
  const { from, subject } = emailData;
  const { emailBody, heuristicSignals } = preparedData;

  const systemPrompt = `
You are categorizing emails that have been identified as promotional. Choose between:

1. **marketing**: Direct sales and promotional content with clear commercial intent - advertisements, special offers, discount codes, product launches, sales announcements, promotional campaigns.
   - Characteristics: Clear call-to-action to buy/purchase, discount codes, sales language, product showcases
   - Keywords: "sale", "discount", "offer", "buy now", "shop", "limited time", "special price"

2. **newsletter**: Regular informational updates from subscribed sources that may contain some promotional content but are primarily informational - company updates, blog digests, industry news, educational content with subscription-based delivery.
   - Characteristics: Regular publication schedule, informational content, educational value, less aggressive sales language
   - Keywords: "newsletter", "digest", "weekly update", "monthly roundup", "blog post", "industry news"

The key distinction: Marketing is primarily selling, newsletters are primarily informing (even if they contain some promotional elements).
`;

  const mainPrompt = `
<sender>
${from?.address || "N/A"} (Name: ${from?.name || "N/A"})
</sender>

<subject>
${subject || "N/A"}
</subject>

<heuristic_signals>
Promotional Keywords: [${heuristicSignals.promotionalKeywords.join(", ")}]
Unsubscribe Mechanism: ${heuristicSignals.unsubscribeInfo.hasLinkOrButton}
Visually Rich: ${heuristicSignals.stylingAnalysis.isVisuallyRich}
</heuristic_signals>

<body>
${emailBody.substring(0, 2000)}${
    emailBody.length > 2000 ? "(continued...)" : ""
  }
</body>

Determine whether this is direct marketing content or newsletter content.
`;

  try {
    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema: promotionalSchema,
      system: systemPrompt,
      prompt: mainPrompt,
      temperature: 1,
      providerOptions: {
        openai: {
          reasoningEffort: "minimal",
        },
      },
    });

    console.log("Promotional fine categorization result:", object.category);
    return object;
  } catch (error) {
    console.error("Error in promotional fine categorization:", error);
    return { category: "marketing" as Category };
  }
}
