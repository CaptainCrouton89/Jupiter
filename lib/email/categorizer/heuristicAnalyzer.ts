import type { ParsedEmailData } from "../parseEmail";
import type { HeuristicSignals } from "./types";

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

function hasTrackingPixel(htmlContent: string | null | undefined): boolean {
  if (!htmlContent) return false;
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
  isVisuallyRich: boolean;
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

  const hasManyImages = imageTags > 3;
  const hasHeavyInlineStyles =
    (htmlContent.match(/style=["'][^"']{50,}/gi) || []).length > 2;
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
  campaignId?: string;
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
      getHeader("X-SES-CONFIGURATION-SET"),
    messageId: getHeader("Message-ID"),
    xJupiterGenerated: getHeader("X-Jupiter-Generated"),
  };
}

export function analyzeHeuristicSignals(
  emailBody: string,
  subject: string | null | undefined,
  htmlContent: string | null | undefined,
  textContent: string | null | undefined,
  from: ParsedEmailData["from"],
  headers?: Record<string, string | string[]>
): HeuristicSignals {
  return {
    trackingPixelDetected: hasTrackingPixel(htmlContent),
    unsubscribeInfo: getUnsubscribeInfo(htmlContent, textContent, headers),
    promotionalKeywords: extractPromotionalKeywords(emailBody, subject, 5),
    senderAnalysis: analyzeSender(from, headers),
    stylingAnalysis: analyzeStylingAndStructure(htmlContent),
    relevantHeaders: getRelevantHeaders(headers),
  };
}