import { Category } from "@/types/settings";
import fs from "fs/promises"; // For logging
import path from "path"; // For logging
import { categorizeEmailCoarsely } from "./coarseCategorizer";
import { isForwardedEmail, preprocessEmail } from "./emailPreprocessor";
import {
  categorizeOperationalEmail,
  categorizePersonalEmail,
  categorizePromotionalEmail,
  categorizeTransactionalEmail,
} from "./fineCategorizers";
import type {
  EmailCategorizationInput,
  EmailCategorizationResult,
} from "./types";

// Define the log file path (adjust as needed, e.g., outside the lib directory in a dedicated logs folder)
const categorizationLogPath = path.join(
  process.cwd(),
  "email-categorization.log"
);

// Helper function to append to log file
async function appendToLog(logEntry: string) {
  try {
    if (process.env.NODE_ENV === "development") {
      const timestamp = new Date().toISOString();
      await fs.appendFile(
        categorizationLogPath,
        `${timestamp} - ${logEntry}\n`
      );
    }
  } catch (err) {
    console.error("Failed to write to categorization log:", err);
  }
}

export type { EmailCategorizationInput, EmailCategorizationResult };

/**
 * Categorizes an email using a multi-step AI approach with heuristic signals.
 * First performs coarse categorization, then fine categorization within that category.
 * @param emailData Relevant parts of the parsed email, including headers.
 * @returns A promise that resolves to the email categorization result.
 */
export async function categorizeEmail(
  emailData: EmailCategorizationInput
): Promise<EmailCategorizationResult> {
  const { subject, textContent, htmlContent, headers } = emailData;

  // --- Immediate Check for Jupiter-Generated Emails ---
  if (
    headers?.["x-jupiter-generated"] === "Digest" ||
    headers?.["X-Jupiter-Generated"] === "Digest" ||
    (subject && /Your Weekly \w+ Digest/i.test(subject))
  ) {
    console.log(
      "Jupiter-generated digest email detected, categorizing as uncategorizable."
    );
    return {
      category: "uncategorizable",
      coarseCategory: "operational",
    };
  }

  // Check for forwarding indicators first
  if (isForwardedEmail(subject, textContent, htmlContent)) {
    console.log("Forwarded email detected, categorizing as personal.");
    return {
      category: "personal",
      coarseCategory: "personal",
    };
  }

  // Preprocess the email
  const preparedData = preprocessEmail(emailData);

  await appendToLog(
    `INFO: Using ${preparedData.contentSource} for email body generation.`
  );
  console.log(
    "Heuristic Signals:",
    JSON.stringify(preparedData.heuristicSignals, null, 2)
  );

  // Step 1: Coarse categorization
  const coarseResult = await categorizeEmailCoarsely(emailData, preparedData);
  console.log(`Coarse categorization: ${coarseResult.category}`);

  await appendToLog(
    `COARSE CATEGORIZATION: ${JSON.stringify(coarseResult, null, 2)}`
  );

  // Step 2: Fine categorization based on coarse category
  let fineResult: { category: Category };

  switch (coarseResult.category) {
    case "transactional":
      fineResult = await categorizeTransactionalEmail(emailData, preparedData);
      break;
    case "promotional":
      fineResult = await categorizePromotionalEmail(emailData, preparedData);
      break;
    case "operational":
      fineResult = await categorizeOperationalEmail(emailData, preparedData);
      break;
    case "personal":
      fineResult = await categorizePersonalEmail(emailData, preparedData);
      break;
    default:
      fineResult = { category: "uncategorizable" as Category };
  }

  const finalResult: EmailCategorizationResult = {
    category: fineResult.category,
    coarseCategory: coarseResult.category,
  };

  console.log(
    `Final categorization: ${finalResult.category} (coarse: ${finalResult.coarseCategory})`
  );
  await appendToLog(`FINAL RESULT: ${JSON.stringify(finalResult, null, 2)}`);

  return finalResult;
}
