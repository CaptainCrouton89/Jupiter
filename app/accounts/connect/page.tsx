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
    // Construct the correct callback URL for after OAuth
    // The callback URL should bring the user back to the accounts page, or show a success message
    const callbackUrl = `${window.location.origin}/api/auth/google/callback`; // Adjust if microsoft has a different callback

    // Redirect to the backend OAuth initiation endpoint
    // The backend will then redirect to the OAuth provider
    // It should include the callback_url so Supabase knows where to go after auth
    // And potentially a next_url so our callback handler knows where to send the user finally.
    let redirectTo = `/api/auth/${provider}/initiate`;

    // For Supabase OAuth, redirectTo is often handled by the server-side SDK method itself.
    // If /api/auth/google/initiate internally calls Supabase client.auth.signInWithOAuth, ensure its redirectTo option is set correctly.
    // For example, it should point to your /api/auth/google/callback.
    // The /api/auth/google/callback will then handle the session and redirect to a final page, e.g., /accounts or /settings.

    // If your /api/auth/google/initiate route itself is the one that starts the OAuth flow,
    // it might construct a URL with query parameters for Supabase, one of which could be `redirect_to_after_auth_completes`.
    // This is highly dependent on your /api/auth/${provider}/initiate implementation.

    // For now, assuming your backend initiation route handles redirecting to Supabase/Google appropriately.
    router.push(redirectTo);
  };

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 flex justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Connect New Email Account</CardTitle>
          <CardDescription>
            Enter your email account details below or use a provider to connect
            it to Jupiter.
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
