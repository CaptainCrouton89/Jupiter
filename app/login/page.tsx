"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export default function LoginPage() {
  const [isLoginView, setIsLoginView] = useState(true);
  const [shouldRedirectTo, setShouldRedirectTo] = useState<string | null>(null);
  const router = useRouter();

  const handleToggleForm = useCallback(() => {
    setIsLoginView((prev) => !prev);
  }, []);

  // Effect to handle fallback redirect if router.push doesn't work
  // useEffect(() => {
  //   if (shouldRedirectTo) {
  //     const redirectTimer = setTimeout(() => {
  //       console.log("Fallback redirect triggered to:", shouldRedirectTo);
  //       window.location.href = shouldRedirectTo;
  //     }, 1000); // Wait 1 second to see if router.push works first

  //     return () => clearTimeout(redirectTimer);
  //   }
  // }, [shouldRedirectTo]);

  const handleAuthSuccess = useCallback(
    (emailConfirmationRequired?: boolean) => {
      console.log(
        "Auth success callback called, emailConfirmationRequired:",
        emailConfirmationRequired
      );

      if (isLoginView || !emailConfirmationRequired) {
        // If login was successful, or signup was successful without email confirmation,
        // redirect to accounts page
        console.log("Redirecting to /accounts");
        toast.success("Redirecting to your accounts...");
        router.push("/accounts");

        // Set up fallback redirect
        setShouldRedirectTo("/accounts");
      }
      // If signup requires email confirmation, we stay on the page (or show a message)
      // The form itself will show a toast message.
    },
    [isLoginView, router]
  );

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-muted/40">
      {isLoginView ? (
        <LoginForm
          onSuccess={handleAuthSuccess}
          onToggleForm={handleToggleForm}
        />
      ) : (
        <SignUpForm
          onSuccess={handleAuthSuccess}
          onToggleForm={handleToggleForm}
        />
      )}
    </div>
  );
}
