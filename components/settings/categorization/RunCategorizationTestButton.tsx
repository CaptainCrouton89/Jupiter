"use client";

import { Button } from "@/components/ui/button";
import { Loader2Icon } from "lucide-react";

interface RunCategorizationTestButtonProps {
  onRunTest: () => void;
  canRunTest: boolean;
  isLoadingTest: boolean;
  isLoadingAllAccounts: boolean;
  isLoadingSettings: boolean;
  isInitialLoadProcessDone: boolean;
  selectedTestAccountId: string | null;
}

export default function RunCategorizationTestButton({
  onRunTest,
  canRunTest,
  isLoadingTest,
  isLoadingAllAccounts,
  isLoadingSettings,
  isInitialLoadProcessDone,
  selectedTestAccountId,
}: RunCategorizationTestButtonProps) {
  const buttonText = () => {
    if (
      isLoadingTest ||
      isLoadingAllAccounts ||
      (isLoadingSettings && !isInitialLoadProcessDone && !selectedTestAccountId)
    ) {
      if (isLoadingTest) return "Running Test...";
      if (
        isLoadingAllAccounts ||
        (isLoadingSettings && !isInitialLoadProcessDone)
      ) {
        return "Loading Account Data...";
      }
      return "Select an account";
    }
    if (!selectedTestAccountId) return "Select an Account to Run Test";
    return "Run Categorization Test";
  };

  const showLoader =
    isLoadingTest ||
    isLoadingAllAccounts ||
    (isLoadingSettings && !isInitialLoadProcessDone && !selectedTestAccountId);

  return (
    <Button
      onClick={onRunTest}
      disabled={!canRunTest}
      className="w-full sm:w-auto"
    >
      {showLoader && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
      {buttonText()}
    </Button>
  );
}
