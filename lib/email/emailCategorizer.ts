import { Category } from "@/types/settings";
import { openai } from "@ai-sdk/openai"; // Assuming you are using OpenAI
import { generateObject } from "ai";
import fs from "fs/promises"; // For logging
import { convert as htmlToText } from "html-to-text"; // Added import
import path from "path"; // For logging
import { z } from "zod";
import type { ParsedEmailData } from "./parseEmail"; // Assuming ParsedEmailData is in a sibling file

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

// Define the schema for the AI's response
const emailCategorizationSchema = z.object({
  category: z
    .enum([
      "newsletter",
      "code-related",
      "marketing",
      "receipt",
      "invoice",
      "finances",
      "personal",
      "notification",
      "account-related",
      "email-verification",
    ])
    .describe(
      "The category of the email, one of the categories in the <categories> section."
    ),
});

export type EmailCategorizationResult = z.infer<
  typeof emailCategorizationSchema
>;

interface EmailCategorizationInput {
  from: ParsedEmailData["from"];
  subject: ParsedEmailData["subject"];
  textContent: ParsedEmailData["text"];
  htmlContent: ParsedEmailData["html"];
  headers?: Record<string, string | string[]>; // Added for heuristic analysis
}

// --- Heuristic Helper Functions ---

function hasTrackingPixel(htmlContent: string | null | undefined): boolean {
  if (!htmlContent) return false;
  // Look for 1x1 images or common tracking patterns
  // Example: <img src="..." width="1" height="1">
  // Example: <img style="display:none;width:1px;height:1px;" src="...">
  const trackingPixelRegex =
    /<img[^>]*?(width=["']1["']|height=["']1["'])[^>]*?>|<img[^>]*?style=["'][^"]*?(display:\s*none|visibility:\s*hidden)[^"]*?width:\s*1px[^"]*?height:\s*1px[^"]*?["'][^>]*?>/gi;
  return trackingPixelRegex.test(htmlContent);
}

function getUnsubscribeInfo(
  htmlContent: string | null | undefined,
  textContent: string | null | undefined,
  headers?: Record<string, string | string[]>
): { hasLinkOrButton: boolean; listUnsubscribeHeader?: string } {
  let hasLinkOrButton = false;
  const unsubscribeKeywords =
    /unsubscribe|opt-out|manage preferences|remove me/i;

  if (htmlContent) {
    // Look for <a> tags with unsubscribe keywords in text or href
    const anchorRegex =
      /<a[^>]*href[^>]*>[^<]*?(unsubscribe|opt-out|manage preferences|remove me)[^<]*?<\/a>/gi;
    if (anchorRegex.test(htmlContent)) {
      hasLinkOrButton = true;
    }
  }
  if (
    !hasLinkOrButton &&
    textContent &&
    unsubscribeKeywords.test(textContent)
  ) {
    hasLinkOrButton = true;
  }

  const listUnsubscribe =
    headers?.["list-unsubscribe"] || headers?.["List-Unsubscribe"];

  return {
    hasLinkOrButton,
    listUnsubscribeHeader: Array.isArray(listUnsubscribe)
      ? listUnsubscribe.join(", ")
      : listUnsubscribe,
  };
}

const COMMON_PROMOTIONAL_KEYWORDS = [
  "sale",
  "discount",
  "offer",
  "limited time",
  "free",
  "save",
  "shop now",
  "exclusive",
  "promotion",
  "deals",
  "special",
  "win",
  "prize",
  "congratulations",
  "act now",
  "last chance",
  "clearance",
  "lowest price",
  "buy now",
  "click here",
  "learn more",
  "discover",
  "explore",
  "new arrivals",
  "best seller",
  "don't miss",
  "get yours",
  "upgrade",
  "premium",
  "subscribe",
  "download",
  "register",
  "webinar",
];

function extractPromotionalKeywords(
  fullText: string,
  subject: string | null | undefined,
  limit: number = 5
): string[] {
  const foundKeywords = new Set<string>();
  const textToSearch = `${subject || ""} ${fullText}`.toLowerCase();

  for (const keyword of COMMON_PROMOTIONAL_KEYWORDS) {
    if (textToSearch.includes(keyword.toLowerCase())) {
      foundKeywords.add(keyword);
      if (foundKeywords.size >= limit) break;
    }
  }
  return Array.from(foundKeywords);
}

function analyzeSender(
  from: ParsedEmailData["from"],
  headers?: Record<string, string | string[]>
): {
  domain: string | null;
  isCommonFreemail: boolean;
  dkimStatus?: string;
  spfStatus?: string;
} {
  const emailAddress = from?.address;
  const domain = emailAddress
    ? emailAddress.substring(emailAddress.lastIndexOf("@") + 1)
    : null;
  const commonFreemailDomains = [
    "gmail.com",
    "outlook.com",
    "yahoo.com",
    "hotmail.com",
    "aol.com",
    "icloud.com",
    "mail.com",
    "zoho.com",
    "protonmail.com",
  ];
  const isCommonFreemail = domain
    ? commonFreemailDomains.includes(domain.toLowerCase())
    : false;

  let dkimStatus: string | undefined;
  let spfStatus: string | undefined;

  const authResultsHeader =
    headers?.["authentication-results"] || headers?.["Authentication-Results"];
  if (authResultsHeader) {
    const authHeaderString = Array.isArray(authResultsHeader)
      ? authResultsHeader.join(";")
      : authResultsHeader;
    const dkimMatch = authHeaderString.match(/dkim=([\w-]+)/i);
    if (dkimMatch) dkimStatus = dkimMatch[1];
    const spfMatch = authHeaderString.match(/spf=([\w-]+)/i);
    if (spfMatch) spfStatus = spfMatch[1];
  }

  return { domain, isCommonFreemail, dkimStatus, spfStatus };
}

function analyzeStylingAndStructure(htmlContent: string | null | undefined): {
  isVisuallyRich: boolean; // Placeholder, more complex logic needed
  usesLayoutTables: boolean;
  imageCount: number;
} {
  if (!htmlContent)
    return { isVisuallyRich: false, usesLayoutTables: false, imageCount: 0 };

  const usesLayoutTables =
    /<table[^>]*layout=["']fixed["']|<table[^>]*role=["']presentation["']/i.test(
      htmlContent
    );
  const imageTags = (htmlContent.match(/<img/gi) || []).length;

  // Basic check for visual richness: many images or heavy inline styling (crude)
  const hasManyImages = imageTags > 3;
  const hasHeavyInlineStyles =
    (htmlContent.match(/style=["'][^"']{50,}/gi) || []).length > 2; // more than 2 long style attributes
  const isVisuallyRich = hasManyImages || hasHeavyInlineStyles;

  return {
    isVisuallyRich,
    usesLayoutTables,
    imageCount: imageTags,
  };
}

function getRelevantHeaders(headers?: Record<string, string | string[]>): {
  xMailer?: string;
  precedence?: string;
  campaignId?: string; // e.g., X-Campaign-ID, X-Mailgun-Campaign-Id
  messageId?: string;
  xJupiterGenerated?: string;
} {
  if (!headers) return {};
  const getHeader = (name: string) => {
    const value = headers[name.toLowerCase()] || headers[name];
    return Array.isArray(value) ? value.join(", ") : value;
  };

  return {
    xMailer: getHeader("X-Mailer"),
    precedence: getHeader("Precedence"),
    campaignId:
      getHeader("X-Campaign-ID") ||
      getHeader("X-Mailgun-Campaign-Id") ||
      getHeader("X-SES-CONFIGURATION-SET"), // Add more as discovered
    messageId: getHeader("Message-ID"),
    xJupiterGenerated: getHeader("X-Jupiter-Generated"),
  };
}

// --- New Helper Function for Forwarded Emails ---
function isForwardedEmail(
  subject: string | null | undefined,
  textContent: string | null | undefined,
  htmlContent: string | null | undefined
): boolean {
  if (subject) {
    const lowerSubject = subject.toLowerCase();
    if (
      lowerSubject.startsWith("fwd:") ||
      lowerSubject.startsWith("fw:") ||
      lowerSubject.startsWith("forward:")
    ) {
      return true;
    }
  }

  const bodyContent =
    textContent ||
    (htmlContent
      ? htmlContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")
      : "");
  const lowerBody = bodyContent.toLowerCase();

  const forwardingIndicators = [
    "---------- forwarded message ----------",
    "begin forwarded message",
    "-----original message-----",
    "from: ", // Often seen in plain text forwards with sender details
    "subject: ", // Similarly
    "date: ", // And date
    "to: ", // And recipient
  ];

  // Check for presence of multiple simple indicators that often appear in forwarded email headers in the body
  let foundIndicators = 0;
  if (
    lowerBody.includes("from: ") &&
    lowerBody.includes("subject: ") &&
    (lowerBody.includes("date: ") || lowerBody.includes("sent: "))
  ) {
    // Check if these are near the top of the email, common in forwards
    const searchArea = lowerBody.substring(0, 500); // Search in the first 500 chars
    if (searchArea.includes("from: ") && searchArea.includes("subject: ")) {
      return true;
    }
  }

  for (const indicator of forwardingIndicators) {
    if (lowerBody.includes(indicator)) {
      // More specific checks for very common phrases
      if (
        indicator === "---------- forwarded message ----------" ||
        indicator === "begin forwarded message" ||
        indicator === "-----original message-----"
      ) {
        return true;
      }
    }
  }

  return false;
}
// --- End New Helper Function ---

// --- End Heuristic Helper Functions ---

/**
 * Categorizes an email using an AI model and heuristic signals.
 * @param emailData Relevant parts of the parsed email, including headers.
 * @returns A promise that resolves to the email categorization result.
 */
export async function categorizeEmail(
  emailData: EmailCategorizationInput
): Promise<{ category: Category }> {
  const { from, subject, textContent, htmlContent, headers } = emailData;

  // Prepare a reduced version of emailData for logging and potential AI input reduction
  // Keep original headers for heuristic calculation, but don't log/send them all
  const loggedInputData = {
    from,
    subject,
    textContent,
    // Log only the first ~200 chars of HTML to save log space, we process it separately for AI
    htmlContentPreview:
      htmlContent?.substring(0, 200) +
      (htmlContent && htmlContent.length > 200 ? "..." : ""),
    // Selectively log only a few potentially useful raw headers, not all
    loggedHeaders: {
      From: headers?.["from"] || headers?.["From"],
      Subject: headers?.["subject"] || headers?.["Subject"],
      "List-Unsubscribe":
        headers?.["list-unsubscribe"] || headers?.["List-Unsubscribe"],
      "X-Mailer": headers?.["x-mailer"] || headers?.["X-Mailer"],
      "X-Jupiter-Generated":
        headers?.["x-jupiter-generated"] || headers?.["X-Jupiter-Generated"],
    },
  };

  // Log the *reduced* input
  // await appendToLog(`INPUT: ${JSON.stringify(loggedInputData, null, 2)}`);

  // --- Gather Heuristic Signals Early (needed for immediate check) ---
  const relevantHeaders = getRelevantHeaders(headers);

  // --- Immediate Check for Jupiter-Generated Emails ---
  if (relevantHeaders.xJupiterGenerated === "Digest") {
    console.log(
      "Jupiter-generated digest email detected, categorizing as uncategorizable."
    );
    return { category: "uncategorizable" };
  }
  // --- End Immediate Check ---

  // Check for forwarding indicators first
  if (isForwardedEmail(subject, textContent, htmlContent)) {
    console.log("Forwarded email detected, categorizing as personal.");
    return { category: "personal" };
  }

  // Prepare email body for AI
  let emailBody = "";
  let contentSource = ""; // For logging

  if (htmlContent) {
    contentSource = "htmlContent";
    emailBody = htmlToText(htmlContent, {
      wordwrap: false, // Disable wordwrap
      preserveNewlines: false, // Let the library handle block elements for newlines
      baseElements: { selectors: ["body"], returnDomByDefault: true }, // Process body content primarily
      selectors: [
        { selector: "a", options: { ignoreHref: true } },
        { selector: "img", format: "skip" },
        { selector: "style", format: "skip" },
        { selector: "script", format: "skip" },
        // Ensure common block elements create appropriate spacing
        {
          selector: "p",
          options: { leadingLineBreaks: 1, trailingLineBreaks: 1 },
        },
        {
          selector: "div",
          options: { leadingLineBreaks: 1, trailingLineBreaks: 1 },
        },
        { selector: "br", format: "lineBreak" },
        // Add others like h1-h6, lists if needed, but defaults might suffice
      ],
      // Removed empty formatters object
    });

    // Comprehensive cleanup: Remove characters that are NOT letters, numbers, punctuation, symbols, or standard whitespace.
    // This targets control chars, format chars (ZWNJ, ZWJ, etc.), and other non-renderables.
    // The 'u' flag is crucial for Unicode property escapes.
    emailBody = emailBody.replace(/[^\p{L}\p{N}\p{P}\p{S}\s]/gu, "");

    // After library conversion, do some final whitespace cleanup
    // 1. Normalize various Unicode space characters that survived the previous step (e.g., part of \s) to a regular space
    emailBody = emailBody.replace(
      /[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g,
      " "
    );
    // 2. Collapse multiple standard spaces (now that Unicode spaces are normalized) into a single space
    emailBody = emailBody.replace(/ {2,}/g, " ");
    // 3. Condense multiple newlines (3 or more) into exactly two newlines, just in case.
    emailBody = emailBody.replace(/(\r\n|\r|\n){3,}/g, "\n\n");

    // Trim any leading/trailing whitespace left by the conversion and cleaning
    emailBody = emailBody.trim();
  } else if (textContent) {
    contentSource = "textContent";
    emailBody = textContent.trim(); // Just trim textContent
  } else {
    contentSource = "neither";
  }

  await appendToLog(`INFO: Using ${contentSource} for email body generation.`);

  // Still replace URLs after cleaning
  emailBody = emailBody.replace(/https?:\/\/[^\s\/$.?#][^\s]*/gi, "[URL]");

  // --- Gather Remaining Heuristic Signals ---
  const trackingPixelDetected = hasTrackingPixel(htmlContent);
  const unsubscribeInfo = getUnsubscribeInfo(htmlContent, textContent, headers);
  const promotionalKeywords = extractPromotionalKeywords(emailBody, subject, 5);
  const senderAnalysis = analyzeSender(from, headers);
  const stylingAnalysis = analyzeStylingAndStructure(htmlContent);

  const heuristicSignalsForLogging = {
    trackingPixelDetected,
    unsubscribeInfo,
    promotionalKeywords,
    senderAnalysis,
    stylingAnalysis,
    relevantHeaders,
  };
  console.log(
    "Heuristic Signals:",
    JSON.stringify(heuristicSignalsForLogging, null, 2)
  );
  // --- End Gather Heuristic Signals ---

  // Enhanced prompt for the AI model
  const mainPrompt = `
<sender>
${from?.address || "N/A"} (Name: ${from?.name || "N/A"})
</sender>

<subject>
${subject || "N/A"}
</subject>

<heuristic_signals>
Sender Info: Domain: ${senderAnalysis.domain || "N/A"}, Is Common Freemail: ${
    senderAnalysis.isCommonFreemail
  }, DKIM: ${senderAnalysis.dkimStatus || "N/A"}, SPF: ${
    senderAnalysis.spfStatus || "N/A"
  }
Unsubscribe Info: Has Opt-Out Mechanism: ${
    unsubscribeInfo.hasLinkOrButton
  }, List-Unsubscribe Header Present: ${!!unsubscribeInfo.listUnsubscribeHeader}
Tracking Pixel Detected: ${trackingPixelDetected}
Promotional Keywords Found (sample): [${promotionalKeywords.join(
    ", "
  )}] (Count: ${promotionalKeywords.length})
Styling/Structure: Visually Rich: ${
    stylingAnalysis.isVisuallyRich
  }, Uses Layout Tables: ${stylingAnalysis.usesLayoutTables}, Image Count: ${
    stylingAnalysis.imageCount
  }
Relevant Headers: X-Mailer Present: ${!!relevantHeaders.xMailer}, Precedence Present: ${!!relevantHeaders.precedence}, Campaign-ID Present: ${!!relevantHeaders.campaignId}
</heuristic_signals>

<body>
${emailBody.substring(0, 1500)}${
    emailBody.length > 1500 ? "(continued...)" : ""
  }
</body>

Based on the heuristic signals and the core email content, categorize this email.
  `;

  // console.log("Full prompt to AI:", mainPrompt); // Uncomment for debugging full prompt

  // Log the main prompt being sent to the AI
  await appendToLog(`PROMPT: ${mainPrompt}`);

  const systemPrompt = `
You are an advanced email categorization assistant for Silas Rhyneer, a software engineer.
Your goal is to accurately categorize incoming emails based on their content and provided heuristic signals.
Use the heuristic signals as strong indicators to help refine your categorization.
Respond with the single most likely category. "uncategorizable" should be used only as a last resort if no other category fits well.

<categories_explanation>
- newsletter: Regular updates from a subscribed source (e.g., mailing list, publication).
  - Signals: Often has 'unsubscribe' links (check 'List-Unsubscribe Header' or 'Has Opt-Out Mechanism'), may use tracking pixels. Sender domain might be known for newsletters.
- marketing: Promotional content, advertisements, special offers, calls to action, typically from businesses.
  - Signals: Often uses rich HTML ('Visually Rich', 'Image Count'), tracking pixels, unsubscribe options, promotional keywords. Sender might be a company.
- receipt: Confirmation of a purchase, transaction, or subscription. Includes order details, amounts.
  - Signals: Keywords like "receipt", "order confirmation", "invoice". Sender domain often a known merchant. Usually transactional, not overly promotional.
- invoice: A bill requesting payment for goods or services.
  - Signals: Keywords like "invoice", "payment due". Often includes an attached PDF. Sender is a business or service provider.
- finances: Related to banking, investments, financial statements, credit card alerts (but not direct invoices/receipts).
  - Signals: From financial institutions. Keywords like "statement", "account update", "transaction alert" (if not a receipt). High importance on sender legitimacy (DKIM/SPF).
- code-related: For Silas (software engineer), this includes GitHub/GitLab notifications, CI/CD alerts, technical discussions (e.g., from forums, mailing lists), API updates, bug reports, dev tool updates.
  - Signals: Sender domain (e.g., github.com, gitlab.com, atlassian.net), keywords related to code, repositories, pull requests, builds. 'X-Mailer' might indicate automated systems. Subject lines often contain project names or issue numbers.
- notification: General alerts or updates not fitting other specific categories. Examples: shipping notifications, non-code-related CI/CD (e.g. deployment success/failure), social media direct mentions if not a separate category, system alerts.
  - Signals: 'Precedence' header (e.g., 'bulk', 'list' if not a newsletter). Can be from various services. Less interactive than personal emails.
- account-related: Security alerts, password resets, account verification steps (distinct from 'email-verification' if it's about an existing account update), ToS updates, login notifications.
  - Signals: Keywords like "security alert", "password reset", "verify your account", "account update". High importance of sender legitimacy (DKIM/SPF). Usually direct and important.
- personal: Direct communication between individuals or small groups. Conversations, personal arrangements.
  - Signals: Less likely to have formal unsubscribe, tracking pixels, or be visually rich (unless it's an e-card). Sender is often a person's name or a common freemail domain. Usually unique content, not template-based.
- email-verification: A specific type of email asking the user to click a link to confirm their email address, typically during a new account sign-up.
  - Signals: Keywords "verify your email", "confirm your address". Usually a single call to action (a link). Often plain.
- uncategorizable: Use as a LAST RESORT if no other category accurately describes the email, even considering the heuristic signals. Also use for emails identified as system-generated digests via the 'X-Jupiter-Generated' header.
</categories_explanation>

Respond with the JSON object matching the schema, containing only the determined category.
  `;

  try {
    const { object } = await generateObject({
      model: openai("gpt-4.1-nano"),
      schema: emailCategorizationSchema,
      system: systemPrompt,
      prompt: mainPrompt, // Use the new mainPrompt
    });
    console.log("Email categorization result:", object.category);
    // Log the output
    await appendToLog(`OUTPUT: ${JSON.stringify(object, null, 2)}`);
    return object as EmailCategorizationResult;
  } catch (error) {
    console.error("Error categorizing email:", error);
    // Log the error output
    const errorOutput = {
      category: "uncategorizable",
      error: (error as Error).message,
    };
    await appendToLog(
      `OUTPUT (Error): ${JSON.stringify(errorOutput, null, 2)}`
    );
    return {
      category: "uncategorizable" as Category,
    };
  }
}
