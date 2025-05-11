"use client";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { clientSupabase } from "@/lib/auth/client"; // Direct import for onAuthStateChange
import { useAuth } from "@/lib/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const { user, isLoading: authLoading, updatePassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // This effect handles the initial auth state change when the page loads
    // after the user clicks the password reset link.
    const { data: authListener } = clientSupabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          // Supabase has verified the token from the URL and prepared for password update.
          // The session might contain the user if they were already logged in on another tab.
          setShowForm(true);
          setError(null);
        } else if (event === "SIGNED_IN" && session?.user && showForm) {
          // This case might happen if the user somehow signs in while on this page after recovery started.
          // Or if the password update was successful and a new session is established.
          // We typically redirect after a successful password update from the form itself.
        } else if (event === "INITIAL_SESSION" && !session) {
          // If there's no session and no PASSWORD_RECOVERY event, the link might be invalid or expired.
          // The check for `code` in URL is a fallback if `PASSWORD_RECOVERY` isn't immediately fired.
          const code = searchParams.get("code"); // Supabase might use a code query param
          if (!code && !session) {
            setError(
              "Invalid or expired password reset link. Please try again."
            );
            toast.error("Invalid or expired password reset link.");
            router.push("/auth/forgot-password");
          }
        }
      }
    );

    return () => {
      authListener.subscription?.unsubscribe();
    };
  }, [router, searchParams, showForm]);

  const handleSuccess = useCallback(() => {
    router.push("/login"); // Redirect to login after successful password reset
  }, [router]);

  if (authLoading && !showForm && !error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg">Verifying reset link...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Error</h1>
        <p className="mb-4">{error}</p>
        <button
          onClick={() => router.push("/login")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (showForm || (user && !authLoading)) {
    // If PASSWORD_RECOVERY event was caught, or if a user session exists (e.g., from a still valid old session)
    // and we are past initial loading, show the form.
    // The `updatePassword` function from `useAuth` will handle the actual password update.
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-muted/40">
        <ResetPasswordForm onSuccess={handleSuccess} />
      </div>
    );
  }

  // Fallback loading state or if initial state hasn't resolved
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg">Loading...</p>
    </div>
  );
}
