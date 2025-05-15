"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmailAccount } from "@/types/email";
import { InfoIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";

interface AccountSelectorForTestProps {
  userEmailAccounts: EmailAccount[];
  selectedTestAccountId: string | null;
  defaultAccountId: string | null;
  onSelectTestAccount: (accountId: string | null) => void;
  isLoadingAllAccounts: boolean;
  isLoadingTest: boolean;
  isLoadingSettings: boolean;
  noAccountsAvailable: boolean;
}

export default function AccountSelectorForTest({
  userEmailAccounts,
  selectedTestAccountId,
  defaultAccountId,
  onSelectTestAccount,
  isLoadingAllAccounts,
  isLoadingTest,
  isLoadingSettings,
  noAccountsAvailable,
}: AccountSelectorForTestProps) {
  if (!isLoadingAllAccounts && noAccountsAvailable && !isLoadingSettings) {
    return (
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
    );
  }

  if (isLoadingAllAccounts && userEmailAccounts.length === 0) {
    return (
      <div className="flex items-center p-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md">
        <Loader2Icon className="mr-2 h-5 w-5 flex-shrink-0 animate-spin" />
        <p>Checking for available email accounts...</p>
      </div>
    );
  }

  if (userEmailAccounts && userEmailAccounts.length > 0) {
    return (
      <div className="space-y-2">
        <label htmlFor="account-select" className="text-sm font-medium">
          Select Account to Test:
        </label>
        <Select
          value={selectedTestAccountId ?? ""}
          onValueChange={(value) => onSelectTestAccount(value || null)}
          disabled={isLoadingAllAccounts || isLoadingTest || isLoadingSettings}
        >
          <SelectTrigger id="account-select" className="w-full sm:w-[300px]">
            <SelectValue placeholder="Choose an account..." />
          </SelectTrigger>
          <SelectContent>
            {userEmailAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.email}
                {account.id === defaultAccountId && " (Default)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return null;
}
