"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./useAuth"; // Assuming useAuth is in the same directory or adjust path

interface UseProtectedRouteOptions {
  redirectTo?: string;
}

/**
 * A client-side hook to protect routes.
 * It checks if the user is authenticated and redirects to a specified path (default: /login) if not.
 *
 * @param options - Optional configuration for the hook.
 * @param options.redirectTo - The path to redirect to if the user is not authenticated. Defaults to '/login'.
 * @returns An object containing `isAuthenticated`, `isLoading`, and `user` from the `useAuth` hook.
 */
export function useProtectedRoute(options: UseProtectedRouteOptions = {}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const { redirectTo = "/login" } = options;

  useEffect(() => {
    // Only redirect if loading is complete and user is not authenticated.
    if (!isLoading && !isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  // Return the auth state so components can use it if needed (e.g., to show a loading spinner).
  return { isAuthenticated, isLoading, user };
}
