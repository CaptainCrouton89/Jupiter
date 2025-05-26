import { Category } from "@/types/settings";
import type { EmailCategorizationInput, PreparedEmailData } from "../types";

export async function categorizePersonalEmail(
  _emailData: EmailCategorizationInput,
  _preparedData: PreparedEmailData
): Promise<{ category: Category }> {
  // For personal emails, we keep it simple since most personal communication
  // falls into the 'personal' category. We could add logic here for edge cases
  // if needed, but for now personal emails are categorized as 'personal'.
  
  console.log("Personal email categorized as personal");
  return { category: "personal" as Category };
}