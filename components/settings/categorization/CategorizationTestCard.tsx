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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCategoryColor,
  getTextColorForBackground,
} from "@/lib/email/categoryColors";
import { selectUserSettings } from "@/lib/store/features/settings/settingsSlice";
import { useAppSelector } from "@/lib/store/hooks";
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
  onRunTest: () => void;
  onSelectTestAccount: (accountId: string | null) => void;
}

export default function CategorizationTestCard({
  onRunTest,
  onSelectTestAccount,
}: CategorizationTestCardProps) {
  const {
    default_account_id,
    userEmailAccounts,
    status,
    categorizationTest, // This comes from the slice { data, isLoading, error, selectedAccountId }
  } = useAppSelector(selectUserSettings);

  const isLoadingSettings = status === "loading";
  // isLoadingAllAccounts can be inferred if userEmailAccounts is empty and status is loading
  const isLoadingAllAccounts =
    status === "loading" && userEmailAccounts.length === 0;
  // initialLoadComplete can be inferred from status not being 'idle' or 'loading'
  const initialLoadComplete = status === "succeeded" || status === "failed";
  const selectedTestAccountId = categorizationTest.selectedAccountId;

  const getAccountIdentifier = () => {
    if (selectedTestAccountId) {
      const selectedAccount = userEmailAccounts?.find(
        (acc) => acc.id === selectedTestAccountId
      );
      return selectedAccount
        ? `account (${selectedAccount.email}).`
        : "selected account.";
    }
    if (default_account_id) return "default account.";
    if (userEmailAccounts && userEmailAccounts.length > 0) {
      return `first registered account (${userEmailAccounts[0].email}).`;
    }
    return "account.";
  };

  const noAccountsAvailable =
    !isLoadingAllAccounts &&
    (!userEmailAccounts || userEmailAccounts.length === 0);

  const canRunTest =
    selectedTestAccountId &&
    !categorizationTest.isLoading &&
    !isLoadingAllAccounts &&
    !isLoadingSettings; // Simplified this condition as initialLoadComplete is derived

  return (
    <section>
      <Card data-tour-id="test-categorization-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <MailCheckIcon className="mr-2 h-5 w-5" /> Test Email Categorization
          </CardTitle>
          <CardDescription>
            See how the AI categorizes your 20 most recent emails from your
            {" " +
              (selectedTestAccountId &&
              userEmailAccounts?.find((acc) => acc.id === selectedTestAccountId)
                ? `selected account (${
                    userEmailAccounts.find(
                      (acc) => acc.id === selectedTestAccountId
                    )?.email
                  }).`
                : "chosen account.")}{" "}
            This helps you understand the categorization logic before
            customizing it further.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isLoadingAllAccounts &&
            noAccountsAvailable &&
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
          {/* Simplified loading state for accounts based on Redux status and accounts list */}
          {isLoadingAllAccounts && userEmailAccounts.length === 0 && (
            <div className="flex items-center p-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md">
              <Loader2Icon className="mr-2 h-5 w-5 flex-shrink-0 animate-spin" />
              <p>Checking for available email accounts...</p>
            </div>
          )}

          {userEmailAccounts && userEmailAccounts.length > 0 && (
            <div className="space-y-2">
              <label htmlFor="account-select" className="text-sm font-medium">
                Select Account to Test:
              </label>
              <Select
                value={selectedTestAccountId ?? ""}
                onValueChange={(value) => onSelectTestAccount(value || null)}
                disabled={
                  isLoadingAllAccounts ||
                  categorizationTest.isLoading ||
                  isLoadingSettings
                }
              >
                <SelectTrigger
                  id="account-select"
                  className="w-full sm:w-[300px]"
                >
                  <SelectValue placeholder="Choose an account..." />
                </SelectTrigger>
                <SelectContent>
                  {userEmailAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.email}
                      {account.id === default_account_id && " (Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={onRunTest}
            disabled={!canRunTest}
            className="w-full sm:w-auto"
          >
            {categorizationTest.isLoading ||
            isLoadingAllAccounts ||
            (isLoadingSettings &&
              !initialLoadComplete && // Keep initialLoadComplete if it implies more than just settings loading
              !selectedTestAccountId) ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                {categorizationTest.isLoading
                  ? "Running Test..."
                  : isLoadingAllAccounts ||
                    (isLoadingSettings && !initialLoadComplete)
                  ? "Loading Account Data..."
                  : "Select an account"}
              </>
            ) : !selectedTestAccountId ? (
              "Select an Account to Run Test"
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
                      <div className="flex-grow min-w-0 truncate max-w-[70%]">
                        <div className="w-full">
                          <p className="font-medium truncate">
                            {email.subject || "(No Subject)"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            From:{" "}
                            {email.from?.name ||
                              email.from?.address ||
                              "Unknown"}
                          </p>
                        </div>
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
                          .replace(/\b\w/g, (l: string) => l.toUpperCase())}
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
