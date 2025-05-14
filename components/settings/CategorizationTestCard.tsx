"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getCategoryColor,
  getTextColorForBackground,
} from "@/lib/email/categoryColors";
import type { EmailAccount } from "@/types/email";
import type { Category } from "@/types/settings";
import {
  AlertTriangleIcon,
  InfoIcon,
  Loader2Icon,
  MailCheckIcon,
} from "lucide-react";
import Link from "next/link";

export interface CategorizationTestEmail {
  uid: number;
  messageId: string | null;
  subject: string | null;
  from: { name: string | null; address: string | null } | null;
  date: string | null; // ISO string
  category: Category;
  bodyTextSnippet: string | null;
}

interface CategorizationTestCardProps {
  defaultAccountId: string | null;
  allUserEmailAccounts: EmailAccount[] | null;
  isLoadingAllAccounts: boolean;
  isLoadingSettings: boolean; // Renamed from isLoading for clarity
  initialLoadComplete: boolean;
  categorizationTest: {
    data: CategorizationTestEmail[] | null;
    isLoading: boolean;
    error: string | null;
  };
  onRunTest: () => void;
}

export default function CategorizationTestCard({
  defaultAccountId,
  allUserEmailAccounts,
  isLoadingAllAccounts,
  isLoadingSettings,
  initialLoadComplete,
  categorizationTest,
  onRunTest,
}: CategorizationTestCardProps) {
  const getAccountIdentifier = () => {
    if (defaultAccountId) return "default account.";
    if (allUserEmailAccounts && allUserEmailAccounts.length > 0) {
      return `first registered account (${allUserEmailAccounts[0].email}).`;
    }
    return "account.";
  };

  return (
    <section>
      <Card data-tour-id="test-categorization-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <MailCheckIcon className="mr-2 h-5 w-5" /> Test Email Categorization
          </CardTitle>
          <CardDescription>
            See how the AI categorizes your 20 most recent emails from your
            {getAccountIdentifier()} This helps you understand the
            categorization logic before customizing it further.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!defaultAccountId &&
            !isLoadingAllAccounts &&
            (!allUserEmailAccounts || allUserEmailAccounts.length === 0) &&
            !isLoadingSettings && (
              <div className="flex items-center p-4 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md">
                <InfoIcon className="mr-2 h-5 w-5 flex-shrink-0" />
                <p>
                  No email accounts found. Please add an email account via the{" "}
                  <Link
                    href="/accounts"
                    className="font-medium underline hover:text-yellow-800"
                  >
                    Account Management
                  </Link>{" "}
                  section to use this feature.
                </p>
              </div>
            )}
          {isLoadingAllAccounts && !defaultAccountId && (
            <div className="flex items-center p-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md">
              <Loader2Icon className="mr-2 h-5 w-5 flex-shrink-0 animate-spin" />
              <p>Checking for available email accounts...</p>
            </div>
          )}
          <Button
            onClick={onRunTest}
            disabled={
              categorizationTest.isLoading ||
              isLoadingAllAccounts ||
              (!defaultAccountId &&
                (!allUserEmailAccounts || allUserEmailAccounts.length === 0)) ||
              (isLoadingSettings && !initialLoadComplete) // Disable if main settings are still loading
            }
            className="w-full sm:w-auto"
          >
            {categorizationTest.isLoading ||
            isLoadingAllAccounts ||
            (isLoadingSettings && !initialLoadComplete && !defaultAccountId) ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                {categorizationTest.isLoading
                  ? "Running Test..."
                  : "Loading Accounts..."}
              </>
            ) : (
              "Run Categorization Test"
            )}
          </Button>

          {categorizationTest.error && (
            <div className="flex items-center p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
              <AlertTriangleIcon className="mr-2 h-5 w-5 flex-shrink-0" />
              <p>{categorizationTest.error}</p>
            </div>
          )}

          {categorizationTest.data &&
            categorizationTest.data.length === 0 &&
            !categorizationTest.isLoading && (
              <div className="flex items-center p-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md">
                <InfoIcon className="mr-2 h-5 w-5 flex-shrink-0" />
                <p>
                  No emails were found or categorized in your specified account
                  for this test.
                </p>
              </div>
            )}

          {categorizationTest.data && categorizationTest.data.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              {categorizationTest.data.map((email, index) => (
                <AccordionItem
                  value={`email-${index}`}
                  key={email.messageId || index}
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex justify-between items-center w-full pr-2">
                      <div className="truncate text-left">
                        <p className="font-medium truncate">
                          {email.subject || "(No Subject)"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          From:{" "}
                          {email.from?.name || email.from?.address || "Unknown"}
                        </p>
                      </div>
                      <span
                        className="ml-4 px-3 py-1.5 text-xs font-semibold rounded-full flex-shrink-0 transition-colors duration-200"
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
                      {email.date
                        ? new Date(email.date).toLocaleString()
                        : "N/A"}
                    </p>
                    <p className="mb-1 font-medium">Body Snippet:</p>
                    <p className="whitespace-pre-line bg-gray-50 p-3 rounded-md max-h-48 overflow-y-auto">
                      {email.bodyTextSnippet || "(No body text available)"}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
