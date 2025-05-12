"use client";

import { EmailConnectionForm } from "@/components/email/EmailConnectionForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      router.push("/accounts"); // Redirect to accounts list
      router.refresh(); // Refresh server components on the target page
    } catch (error) {
      toast.error("An unexpected error occurred while saving the account.");
      console.error("Save account error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitiateOAuth = (provider: "google" | "microsoft") => {
    toast.info(`Initiating connection with ${provider}...`);
    // TODO: Redirect to backend endpoint, e.g., /api/auth/${provider}/initiate
    // This backend endpoint will then redirect to the OAuth provider.
    // For now, we just log it.
    console.log(`Initiating OAuth with ${provider}`);
    // Example of how you might redirect from the client if your backend handler
    // is set up to expect a direct navigation:
    // router.push(`/api/auth/${provider}/initiate`);
  };

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 flex justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Connect New Email Account</CardTitle>
          <CardDescription>
            Enter your email account details below to connect it to Jupiter.
          </CardDescription>
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
