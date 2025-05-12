"use client";

import { ensureUserSettings } from "@/lib/auth";
import { createClient } from "@/lib/auth/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Get the error and error_description parameters from the URL
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      console.log("error", error);
      console.log("errorDescription", errorDescription);

      if (error) {
        console.error("OAuth error:", error, errorDescription);
        router.push(
          `/login?error=${encodeURIComponent(errorDescription || error)}`
        );
        return;
      }

      // Check for a redirectTo parameter
      const redirectTo = searchParams.get("redirectTo") || "/accounts";

      console.log("redirectTo", redirectTo);

      // Exchange the code for a session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      console.log("session", session);
      console.log("sessionError", sessionError);

      if (sessionError || !session) {
        console.error("Session error:", sessionError);
        router.push("/login?error=Failed+to+authenticate");
        return;
      }

      try {
        // Ensure user settings exist for this user
        await ensureUserSettings(session.user.id);
        console.log("User settings ensured for OAuth user:", session.user.id);

        // Redirect to the specified page or accounts page after successful sign-in
        router.push(redirectTo);
      } catch (err) {
        console.error("Error ensuring user settings:", err);
        // Still redirect to the destination even if there was an error setting user settings
        // as this is non-critical and we don't want to block the user
        router.push(redirectTo);
      }
    };

    console.log("redirect here");
    handleOAuthCallback();
  }, [router, searchParams, supabase.auth]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Signing you in...</h1>
        <p className="text-gray-500">
          Please wait while we complete the authentication process.
        </p>
      </div>
    </div>
  );
}
