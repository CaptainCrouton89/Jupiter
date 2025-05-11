"use client";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const handleSuccess = useCallback(() => {
    // Optionally, redirect or show a persistent success message on this page
    // For now, the form shows a toast, and we can redirect to login.
    router.push("/login");
  }, [router]);

  const handleToggleToLogin = useCallback(() => {
    router.push("/login");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-muted/40">
      <ForgotPasswordForm
        onSuccess={handleSuccess}
        onToggleForm={handleToggleToLogin}
      />
    </div>
  );
}
