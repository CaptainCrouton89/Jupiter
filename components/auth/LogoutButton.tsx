"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/auth/client";
import { LogOutIcon } from "lucide-react";
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
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = await createClient();
    await supabase.auth.signOut();

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
      className={className}
      {...props}
    >
      {children ? (
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
