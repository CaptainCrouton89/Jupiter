"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/useAuth";
import { Loader2, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

interface LogoutButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick" | "disabled"> {
  onLogout?: () => void;
  redirectPath?: string;
}

export function LogoutButton({
  onLogout,
  redirectPath = "/login",
  variant = "outline",
  size,
  className,
  children,
  ...props
}: LogoutButtonProps) {
  const { signOut, isLoading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();

    toast.success("Successfully logged out");
    onLogout?.();
    router.push(redirectPath);
    router.refresh();
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLogout}
      disabled={isLoading}
      className={className}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : children ? (
        children
      ) : (
        <>
          <LogOutIcon className="h-4 w-4" />
          <span className="sr-only">Logout</span>
        </>
      )}
    </Button>
  );
}
