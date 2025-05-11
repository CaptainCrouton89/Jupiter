"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from "@/lib/validations/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
  onToggleForm?: () => void; // To switch back to login/signup
}

export function ForgotPasswordForm({
  onSuccess,
  onToggleForm,
}: ForgotPasswordFormProps) {
  const { resetPassword, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    const result = await resetPassword(data.email);

    if (!result.success) {
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.error("An unknown error occurred.");
      }
      return;
    }

    toast.success("Password reset email sent. Please check your inbox.");
    onSuccess?.();
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Forgot Password</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>
          {errors.root && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">
              {errors.root.message}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending link...
              </>
            ) : (
              "Send Reset Link"
            )}
          </Button>
          {onToggleForm && (
            <div className="text-center text-sm">
              Remember your password?{" "}
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={onToggleForm} // Use the passed toggle function
              >
                Log in
              </Button>
            </div>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
