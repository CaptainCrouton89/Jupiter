export const getSummarizeSingleEmailPrompt = (
  categoryName: string,
  email: {
    subject: string | null;
    from: string | null;
    content: string;
    receivedAt?: string;
  }
) => {
  let systemPrompt = "";

  const jsonInstructionSentence = "Use JSON format for the summary.";

  switch (categoryName.toLowerCase()) {
    // Title with bullets
    case "newsletter":
      systemPrompt = `Your task is to provide abbreviated information from a newsletter email. It will need a title and 2-5 bullet points. Focus on the most important information, and only include one bullet point per critical topic covered in the email—you do not need to use all 5 bullet points. 
      
      For a title, use a more concise, 1-sentence title that captures the most important information from the email. ${jsonInstructionSentence}`;
      break;
    // Title with summary
    case "work":
      systemPrompt = `Your task is to provide a title, and brief summary of an work email. The title should be concise so it can be understood at a glance. The summary should be a 1-3 sentences summarizing the work email. Explain the message (e.g., project update, meeting request, task assignment). ${jsonInstructionSentence}`;
      break;
    case "marketing":
      systemPrompt = `Your task is to provide a title, and brief summary of an marketing email. The title should be concise so it can be understood at a glance. The summary should be a single, concise summary sentence (around 15-30 words) identifying the main product/service, key benefits highlighted, and any special offers or deadlines. ${jsonInstructionSentence}`;
      break;
    case "payments":
      systemPrompt = `Your task is to provide a title, and brief summary of an receipt or invoice email. The title should be concise so it can be understood at a glance. The summary should be single, concise summary sentence (around 10-25 words) summarizing a financial document (receipt or invoice). Stating the vendor/store name, total amount, and transaction/due date. If the amount is notably large or the item important, briefly highlight this. ${jsonInstructionSentence}`;
      break;
    case "finances":
      systemPrompt = `Your task is to provide a title, and brief summary of a financial update email. The title should be concise so it can be understood at a glance. The summary should be a single, concise summary sentence (around 15-30 words) summarizing a financial update email. Explain the update (e.g., bank alert, investment news). If it mentions a large transaction, critical alert, or significant status change, highlight this. ${jsonInstructionSentence}`;
      break;
    case "personal":
      systemPrompt = `Your task is to provide a title, and brief summary of a personal email. The title should be concise so it can be understood at a glance. The summary should be 1-3 brief, neutral summary sentences. ${jsonInstructionSentence}`;
      break;
    // Single sentence summaries
    case "shipping-delivery":
      systemPrompt = `Your task is to provide a single, concise summary sentence (around 10-25 words) summarizing a shipping/delivery email. Explain the core message (e.g., shipped, delivered, tracking update). ${jsonInstructionSentence}`;
      break;
    case "system-alerts":
      systemPrompt = `Your task is to provide a single, concise summary sentence (around 10-25 words) summarizing a system alert email. Explain the core message (e.g., security alert, login notification, suspicious activity). ${jsonInstructionSentence}`;
      break;
    case "system-updates":
      systemPrompt = `Your task is to provide a single, concise summary sentence (around 10-25 words) summarizing a system update email. Explain the core message (e.g., maintenance, service update, platform announcement). ${jsonInstructionSentence}`;
      break;
    case "account-related":
      systemPrompt = `Your task is to provide a single, concise summary sentence (around 15-30 words) summarizing an account-related email. Explain the message (e.g., security alert, ToS update, login confirmation). ${jsonInstructionSentence}`;
      break;
    default:
      // For any other category, including potentially "uncategorizable"
      // Decide if this should be sentence or bullets. Given the structure, sentence is easier.
      systemPrompt = `Your task is to summarize an email of an undetermined category. Provide a single, concise summary sentence capturing its main point. ${jsonInstructionSentence}`;
      break;
  }

  const baseInfo = `
  FROM: ${email.from || "N/A"}
  SUBJECT: ${email.subject || "N/A"}
  CONTENT (potentially truncated):
  ${email.content.substring(0, 3500)}
  `;

  const prompt = `Summarize the following email:\n\n${baseInfo}`;
  return { systemPrompt, prompt };
};

export const getIntroHookPrompts = (
  categoryName: string,
  highlights: string
) => {
  const formattedCategory = categoryName.replace("-", " ");
  const systemPrompt = `You are an assistant writing a concise introductory paragraph (hook) for a weekly email digest of "${formattedCategory}". You will be provided a collection of email summaries, and you will write a hook that highlights notable information from the provided email summaries. The hook should be 1-2 sentences (max 250 chars) and be informative. 

Remember:
- Highlight critical information
- Avoid sensationalism
- Be concise and precise
- Do not editorialize`;

  const prompt = `Write that summary paragraph for this content:\n\n${highlights.substring(
    0,
    3500
  )}\n`;

  return { systemPrompt, prompt };
};
