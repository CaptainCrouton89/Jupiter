"use client";

import { EmailConnectionForm } from "@/components/email/EmailConnectionForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmailConnectionFormValues } from "@/lib/validations/email";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function ConnectAccountPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleTestConnection = async (
    values: EmailConnectionFormValues
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/email/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.message || "Test connection failed.");
        return false;
      }
      toast.success(data.message || "Test connection successful!");
      return true;
    } catch (error) {
      toast.error("An unexpected error occurred while testing the connection.");
      console.error("Test connection error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (values: EmailConnectionFormValues) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/email/save-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.message || "Failed to save account.");
        return;
      }
      toast.success(data.message || "Account saved successfully!");
      router.push("/accounts"); // Redirect to the new accounts list page
      router.refresh();
    } catch (error) {
      toast.error("An unexpected error occurred while saving the account.");
      console.error("Save account error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitiateOAuth = (provider: "google" | "microsoft") => {
    toast.info(`Initiating connection with ${provider}...`);

    // Build redirect URL with next parameter
    // This ensures after OAuth we come back to accounts page
    const redirectUrl = `/api/auth/${provider}/initiate?next=/accounts`;

    // Use window.location.href for a hard redirect instead of router.push
    // This prevents client-side navigation which can cause CORS issues
    window.location.href = redirectUrl;
  };

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 flex justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <Button variant="outline" onClick={() => router.back()}>
            Back to Accounts
          </Button>
        </CardHeader>
        <CardContent>
          <EmailConnectionForm
            onSubmit={handleSubmit}
            onTestConnection={handleTestConnection}
            onInitiateOAuth={handleInitiateOAuth}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
