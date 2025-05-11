"use client";

import { clientSupabase } from "@/lib/auth/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { User } from "@supabase/supabase-js";
import { useEffect } from "react";

interface AuthProviderProps {
  children: React.ReactNode;
  initialUser: User | null;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const { setUser, setLoading, setError } = useAuthStore();

  // Initialize auth state from user
  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
    } else {
      setLoading(false);
    }
  }, [initialUser, setUser, setLoading]);

  // Set up auth state change listener
  useEffect(() => {
    const {
      data: { subscription },
    } = clientSupabase.auth.onAuthStateChange(async (event, session) => {
      // Regardless of the event, always try to get the user from the server
      // to ensure the user object is authentic.
      // SIGNED_OUT is an exception, as getUser() would likely return null or error anyway.
      if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false); // Ensure loading is false on sign out
        return;
      }

      // For SIGNED_IN, USER_UPDATED, TOKEN_REFRESHED, and INITIAL_SESSION events,
      // fetch the user from the server.
      if (
        event === "SIGNED_IN" ||
        event === "USER_UPDATED" ||
        event === "TOKEN_REFRESHED" ||
        event === "INITIAL_SESSION" // Handle case where app loads and there might be a session
      ) {
        setLoading(true);
        try {
          const {
            data: { user },
            error,
          } = await clientSupabase.auth.getUser();
          if (error) {
            // If getUser returns an error, it could mean the session is invalid
            // or the user is not authenticated.
            console.error("Error fetching user:", error);
            setUser(null);
            setError(error.message);
          } else {
            setUser(user);
          }
        } catch (e) {
          console.error("Exception fetching user:", e);
          setUser(null);
          setError(e instanceof Error ? e.message : "Failed to fetch user");
        } finally {
          setLoading(false);
        }
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setError]);

  return <>{children}</>;
}
