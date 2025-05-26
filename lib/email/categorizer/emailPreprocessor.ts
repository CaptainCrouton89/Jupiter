import { convert as htmlToText } from "html-to-text";
import type { EmailCategorizationInput, PreparedEmailData } from "./types";
import { analyzeHeuristicSignals } from "./heuristicAnalyzer";

export function isForwardedEmail(
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
    "from: ",
    "subject: ",
    "date: ",
    "to: ",
  ];

  if (
    lowerBody.includes("from: ") &&
    lowerBody.includes("subject: ") &&
    (lowerBody.includes("date: ") || lowerBody.includes("sent: "))
  ) {
    const searchArea = lowerBody.substring(0, 500);
    if (searchArea.includes("from: ") && searchArea.includes("subject: ")) {
      return true;
    }
  }

  for (const indicator of forwardingIndicators) {
    if (lowerBody.includes(indicator)) {
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

export function preprocessEmail(emailData: EmailCategorizationInput): PreparedEmailData {
  const { from, subject, textContent, htmlContent, headers } = emailData;

  // Prepare email body for AI
  let emailBody = "";
  let contentSource = "";

  if (htmlContent) {
    contentSource = "htmlContent";
    emailBody = htmlToText(htmlContent, {
      wordwrap: false,
      preserveNewlines: false,
      baseElements: { selectors: ["body"], returnDomByDefault: true },
      selectors: [
        { selector: "a", options: { ignoreHref: true } },
        { selector: "img", format: "skip" },
        { selector: "style", format: "skip" },
        { selector: "script", format: "skip" },
        {
          selector: "p",
          options: { leadingLineBreaks: 1, trailingLineBreaks: 1 },
        },
        {
          selector: "div",
          options: { leadingLineBreaks: 1, trailingLineBreaks: 1 },
        },
        { selector: "br", format: "lineBreak" },
      ],
    });

    // Comprehensive cleanup
    emailBody = emailBody.replace(/[^\p{L}\p{N}\p{P}\p{S}\s]/gu, "");

    // Normalize various Unicode space characters
    emailBody = emailBody.replace(
      /[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g,
      " "
    );
    // Collapse multiple spaces
    emailBody = emailBody.replace(/ {2,}/g, " ");
    // Condense multiple newlines
    emailBody = emailBody.replace(/(\r\n|\r|\n){3,}/g, "\n\n");

    emailBody = emailBody.trim();
  } else if (textContent) {
    contentSource = "textContent";
    emailBody = textContent.trim();
  } else {
    contentSource = "neither";
  }

  // Replace URLs
  emailBody = emailBody.replace(/https?:\/\/[^\s\/$.?#][^\s]*/gi, "[URL]");

  // Analyze heuristic signals
  const heuristicSignals = analyzeHeuristicSignals(
    emailBody,
    subject,
    htmlContent,
    textContent,
    from,
    headers
  );

  return {
    emailBody,
    contentSource,
    heuristicSignals,
  };
}