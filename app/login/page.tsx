"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export default function LoginPage() {
  const [isLoginView, setIsLoginView] = useState(true);
  const router = useRouter();

  const handleToggleForm = useCallback(() => {
    setIsLoginView((prev) => !prev);
  }, []);

  const handleAuthSuccess = useCallback(
    (emailConfirmationRequired?: boolean) => {
      if (isLoginView || !emailConfirmationRequired) {
        // If login was successful, or signup was successful without email confirmation,
        // redirect to dashboard or home.
        router.push("/"); // Or your desired dashboard route
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
