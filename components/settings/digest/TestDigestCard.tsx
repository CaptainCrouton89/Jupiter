"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppSelector } from "@/lib/store/hooks";
import { selectUserSettings } from "@/lib/store/features/settings/settingsSlice";
import { Loader2, Mail, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TestDigestCard() {
  const [isSending, setIsSending] = useState(false);
  const { userEmailAccounts, default_account_id } = useAppSelector(selectUserSettings);

  const hasEmailAccounts = userEmailAccounts && userEmailAccounts.length > 0;
  const defaultAccount = userEmailAccounts?.find(acc => acc.id === default_account_id);

  const sendTestDigest = async () => {
    if (!hasEmailAccounts) {
      toast.error("Please connect an email account first.");
      return;
    }

    // Use default account if set, otherwise use first account
    const accountToUse = defaultAccount || userEmailAccounts[0];

    setIsSending(true);

    try {
      const response = await fetch("/api/email/test-digest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accountId: accountToUse.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Failed to send test digest.");
        return;
      }

      toast.success(
        data.message || "Test digest sent successfully! Check your email."
      );
    } catch (error) {
      toast.error("An unexpected error occurred while sending test digest.");
      console.error("Send test digest error:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Weekly Digest</CardTitle>
        <CardDescription>
          Send yourself a test digest email to preview what your weekly summaries will look like
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasEmailAccounts && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need to connect at least one email account before you can send a test digest.
            </AlertDescription>
          </Alert>
        )}
        
        {hasEmailAccounts && (
          <>
            <p className="text-sm text-muted-foreground">
              The test digest will be sent to: <span className="font-medium">{defaultAccount?.email || userEmailAccounts[0]?.email}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              The digest will include emails from the past 7 days for categories where you have digest enabled.
            </p>
          </>
        )}

        <Button
          onClick={sendTestDigest}
          disabled={isSending || !hasEmailAccounts}
          className="w-full"
        >
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending Test Digest...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Send Test Digest
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}