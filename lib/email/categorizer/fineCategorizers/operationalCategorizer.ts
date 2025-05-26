import { Category } from "@/types/settings";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { EmailCategorizationInput, PreparedEmailData } from "../types";

const operationalSchema = z.object({
  category: z.enum(["work", "notification"]),
});

export async function categorizeOperationalEmail(
  emailData: EmailCategorizationInput,
  preparedData: PreparedEmailData
): Promise<{ category: Category }> {
  const { from, subject, userWorkProfile } = emailData;
  const { emailBody } = preparedData;

  const defaultWorkCriteria =
    "emails pertaining to ongoing projects, team communications, client interactions, and notifications from work-specific tools (e.g., Jira, company platforms).";
  const effectiveWorkCriteria =
    userWorkProfile && userWorkProfile.trim() !== ""
      ? userWorkProfile
      : defaultWorkCriteria;

  const systemPrompt = `
You are categorizing emails that have been identified as operational (informational, non-promotional). Choose between:

1. **work**: Professional communications, project updates, team collaboration, client interactions, work-related tool notifications.
   - User's work criteria: ${effectiveWorkCriteria}
   - Consider: sender domain, work-related keywords, project names, professional context

2. **notification**: General operational notifications that don't fit work criteria - system updates, service notifications, maintenance notices, general informational updates.
   - Examples: Service outages, system maintenance, general platform updates, non-work tool notifications

The key is whether the content relates to the user's professional work context based on their defined criteria.
`;

  const mainPrompt = `
<sender>
${from?.address || "N/A"} (Name: ${from?.name || "N/A"})
</sender>

<subject>
${subject || "N/A"}
</subject>

<body>
${emailBody.substring(0, 2000)}${
    emailBody.length > 2000 ? "(continued...)" : ""
  }
</body>

Determine whether this operational email is work-related based on the user's work criteria or a general notification.
`;

  try {
    const { object } = await generateObject({
      temperature: 0,
      model: openai("gpt-4.1-nano"),
      schema: operationalSchema,
      system: systemPrompt,
      prompt: mainPrompt,
    });

    console.log("Operational fine categorization result:", object.category);
    return object;
  } catch (error) {
    console.error("Error in operational fine categorization:", error);
    return { category: "notification" as Category };
  }
}
