"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { Loader2 } from "lucide-react";
import { Suspense, useCallback, useState } from "react";

export default function LoginPage() {
  const [isLoginView, setIsLoginView] = useState(false);

  const handleToggleForm = useCallback(() => {
    setIsLoginView((prev) => !prev);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-muted/40">
      <Suspense
        fallback={
          <div className="flex justify-center items-center min-h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        {isLoginView ? (
          <LoginForm onToggleForm={handleToggleForm} />
        ) : (
          <SignUpForm onToggleForm={handleToggleForm} />
        )}
      </Suspense>
    </div>
  );
}
