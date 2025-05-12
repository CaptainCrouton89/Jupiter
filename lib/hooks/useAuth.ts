"use client";

import { clientSupabase } from "@/lib/auth/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { useCallback } from "react";

export function useAuth() {
  const {
    user,
    isLoading,
    error,
    isAuthenticated,
    setUser,
    setLoading,
    setError,
    signOut,
  } = useAuthStore();

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await clientSupabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setError(error.message);
          return { success: false, error: error.message };
        }

        if (data.user) {
          setUser(data.user);
          return { success: true };
        }

        return { success: false, error: "Unknown error occurred" };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setUser]
  );

  const signInWithGoogle = useCallback(
    async (redirectTo?: string) => {
      try {
        setLoading(true);
        setError(null);

        const finalRedirectTo = redirectTo || "/accounts";
        const { data, error } = await clientSupabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback?redirectTo=${finalRedirectTo}`,
          },
        });

        if (error) {
          setError(error.message);
          return { success: false, error: error.message };
        }

        return { success: true, data };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await clientSupabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setError(error.message);
          return { success: false, error: error.message };
        }

        // For email confirmation flow, user won't be immediately available
        if (data.user) {
          setUser(data.user);
        }

        return {
          success: true,
          user: data.user,
          emailConfirmation: !data.session, // If no session returned, email confirmation is required
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setUser]
  );

  const resetPassword = useCallback(
    async (email: string) => {
      try {
        setLoading(true);
        setError(null);

        const { error } = await clientSupabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: `${window.location.origin}/auth/reset-password`,
          }
        );

        if (error) {
          setError(error.message);
          return { success: false, error: error.message };
        }

        return { success: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  const updatePassword = useCallback(
    async (newPassword: string) => {
      try {
        setLoading(true);
        setError(null);

        const { error } = await clientSupabase.auth.updateUser({
          password: newPassword,
        });

        if (error) {
          setError(error.message);
          return { success: false, error: error.message };
        }

        return { success: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  return {
    user,
    isLoading,
    error,
    isAuthenticated,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  };
}
