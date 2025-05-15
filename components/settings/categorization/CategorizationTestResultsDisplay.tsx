"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  getCategoryColor,
  getTextColorForBackground,
} from "@/lib/email/categoryColors";
import type { Category } from "@/types/settings";
import { AlertTriangleIcon, InfoIcon } from "lucide-react";

export interface CategorizationTestEmailForDisplay {
  uid: number;
  messageId: string | null;
  subject: string | null;
  from: { name: string | null; address: string | null } | null;
  date: string | null; // ISO string
  category: Category;
  bodyTextSnippet: string | null;
}

interface CategorizationTestResultsDisplayProps {
  testData: CategorizationTestEmailForDisplay[] | null;
  isLoadingTest: boolean;
  error: string | null;
}

export default function CategorizationTestResultsDisplay({
  testData,
  isLoadingTest,
  error,
}: CategorizationTestResultsDisplayProps) {
  if (error) {
    return (
      <div className="flex items-center p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
        <AlertTriangleIcon className="mr-2 h-5 w-5 flex-shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  if (testData && testData.length === 0 && !isLoadingTest) {
    return (
      <div className="flex items-center p-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md">
        <InfoIcon className="mr-2 h-5 w-5 flex-shrink-0" />
        <p>
          No emails were found or categorized in your specified account for this
          test.
        </p>
      </div>
    );
  }

  if (testData && testData.length > 0) {
    return (
      <Accordion type="single" collapsible className="w-full">
        {testData.map((email, index) => (
          <AccordionItem
            value={`email-${index}`}
            key={email.messageId || index}
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex justify-between items-center w-full pr-2 gap-3">
                <div className="truncate text-left flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {email.subject || "(No Subject)"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    From: {email.from?.name || email.from?.address || "Unknown"}
                  </p>
                </div>
                <span
                  className="px-3 py-1.5 text-xs font-semibold rounded-full flex-shrink-0 transition-colors duration-200 whitespace-nowrap"
                  style={{
                    backgroundColor: getCategoryColor(email.category),
                    color: getTextColorForBackground(
                      getCategoryColor(email.category)
                    ),
                  }}
                >
                  {email.category
                    .replace("-", " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground p-4">
              <p className="mb-2">
                <strong>Date:</strong>{" "}
                {email.date ? new Date(email.date).toLocaleString() : "N/A"}
              </p>
              <p className="mb-1 font-medium">Body Snippet:</p>
              <p className="whitespace-pre-line bg-gray-50 p-3 rounded-md max-h-48 overflow-y-auto">
                {email.bodyTextSnippet || "(No body text available)"}
              </p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }

  return null;
}
