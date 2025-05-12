// lib/email/digestPrompts.ts

// NewsletterContent interface definition is removed from this file.
// The functions getSummarizeSingleEmailPrompts and getIntroHookPrompts
// expect NewsletterContent as a parameter type, which will be resolved
// by TypeScript based on the type passed from the calling module (e.g., digestAI.ts)
// or via an explicit import in that calling module.

export const getSummarizeSingleEmailPrompts = (
  _categoryName: string, // categoryName is no longer used to format the prompt string itself here
  newsletter: {
    subject: string | null;
    from: string | null;
    content: string;
    receivedAt?: string;
  }
) => {
  const baseInfo = `
  FROM: ${newsletter.from || "N/A"}
  SUBJECT: ${newsletter.subject || "N/A"}
  CONTENT (potentially truncated):
  ${newsletter.content.substring(0, 3500)}
  `;

  // The detailed, category-specific instructions are removed from here.
  // They will now be part of the system prompt in digestAI.ts.
  return `Summarize the following email:\n\n${baseInfo}`;
};

export const getIntroHookPrompts = (
  categoryName: string,
  highlights: string
) => {
  let systemPrompt = "";
  const formattedCategory = categoryName.replace("-", " ");
  const baseSystem = `You are an assistant writing a concise introductory paragraph (hook) for a weekly email digest about "${formattedCategory}". The hook should be 1-2 sentences (max 250 chars) and highlight key themes or notable information from the provided email summaries. Be informative and avoid sensationalism.`;
  const userPrompt = `Based on these email summaries for the category "${formattedCategory}", write that summary paragraph:\n\n${highlights.substring(
    0,
    3500
  )}\n`;

  switch (categoryName.toLowerCase()) {
    case "newsletter":
      systemPrompt = `${baseSystem} This digest contains general newsletters. Do not editorialize.`;
      break;
    case "code-related":
      systemPrompt = `${baseSystem} This digest is for technical, code-related updates. Focus on critical alerts or important developments.`;
      break;
    case "marketing":
      systemPrompt = `${baseSystem} This digest features marketing emails. Emphasize compelling offers or new products.`;
      break;
    case "receipt":
    case "invoice":
      systemPrompt = `${baseSystem} This digest lists recent receipts and invoices. Highlight important financial documents.`;
      break;
    case "finances":
      systemPrompt = `${baseSystem} This digest covers financial updates like bank alerts or investment news. Highlight important financial changes.`;
      break;
    case "notification":
      systemPrompt = `${baseSystem} This digest compiles various notifications.`;
      break;
    case "account-related":
      systemPrompt = `${baseSystem} This digest includes important account-related messages.`;
      break;
    case "personal":
      systemPrompt = `${baseSystem} This digest summarizes personal correspondence. Keep the tone neutral and respectful of privacy.`;
      break;
    default:
      systemPrompt = baseSystem;
      break;
  }
  return { systemPrompt, userPrompt };
};
