import { Category } from "@/types/settings";
import type { ParsedEmailData } from "../parseEmail";

export type CoarseCategory = 'transactional' | 'promotional' | 'operational' | 'personal';

export interface EmailCategorizationInput {
  from: ParsedEmailData["from"];
  subject: ParsedEmailData["subject"];
  textContent: ParsedEmailData["text"];
  htmlContent: ParsedEmailData["html"];
  headers?: Record<string, string | string[]>;
  userWorkProfile?: string;
}

export interface HeuristicSignals {
  trackingPixelDetected: boolean;
  unsubscribeInfo: {
    hasLinkOrButton: boolean;
    listUnsubscribeHeader?: string;
  };
  promotionalKeywords: string[];
  verificationKeywords: string[];
  senderAnalysis: {
    domain: string | null;
    isCommonFreemail: boolean;
    dkimStatus?: string;
    spfStatus?: string;
  };
  stylingAnalysis: {
    isVisuallyRich: boolean;
    usesLayoutTables: boolean;
    imageCount: number;
  };
  relevantHeaders: {
    xMailer?: string;
    precedence?: string;
    campaignId?: string;
    messageId?: string;
    xJupiterGenerated?: string;
  };
}

export interface CoarseCategorizationResult {
  category: CoarseCategory;
}

export interface EmailCategorizationResult {
  category: Category;
  coarseCategory: CoarseCategory;
}

export interface PreparedEmailData {
  emailBody: string;
  contentSource: string;
  heuristicSignals: HeuristicSignals;
}