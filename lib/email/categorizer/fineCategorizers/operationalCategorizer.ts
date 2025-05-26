import { Category } from "@/types/settings";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { EmailCategorizationInput, PreparedEmailData } from "../types";

const operationalSchema = z.object({
  category: z.enum(["work", "system-updates"]),
});

export async function categorizeOperationalEmail(
  emailData: EmailCategorizationInput,
  preparedData: PreparedEmailData
): Promise<{ category: Category }> {
  const { from, subject, userWorkProfile } = emailData;
  const { emailBody, heuristicSignals } = preparedData;

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
   - Examples: Slack notifications, Jira updates, GitHub notifications, team communications

2. **system-updates**: General operational notifications that don't fit work criteria - system updates, service notifications, maintenance notices, platform status updates.
   - Examples: Service outages, system maintenance, app updates, platform announcements, non-work tool notifications
   - Keywords: "maintenance", "update", "service", "downtime", "upgrade", "status"

The key is whether the content relates to the user's professional work context based on their defined criteria.
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
Is Common Freemail: ${heuristicSignals.senderAnalysis.isCommonFreemail}
Work-Related Keywords: ${heuristicSignals.promotionalKeywords.some(k => 
  ['project', 'team', 'client', 'jira', 'slack', 'github', 'meeting'].includes(k.toLowerCase()))}
System Keywords: ${heuristicSignals.promotionalKeywords.some(k => 
  ['maintenance', 'update', 'service', 'downtime', 'upgrade', 'status'].includes(k.toLowerCase()))}
</heuristic_signals>

<body>
${emailBody.substring(0, 2000)}${
    emailBody.length > 2000 ? "(continued...)" : ""
  }
</body>

Determine whether this operational email is work-related based on the user's work criteria or a general system update.
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
    return { category: "system-updates" as Category };
  }
}
