"use client";

import { clientSupabase } from "@/lib/auth/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { Session } from "@supabase/supabase-js";
import { useEffect } from "react";

interface AuthProviderProps {
  children: React.ReactNode;
  initialSession: Session | null;
}

export function AuthProvider({ children, initialSession }: AuthProviderProps) {
  const { setUser, setLoading, setError } = useAuthStore();

  // Initialize auth state from session
  useEffect(() => {
    if (initialSession?.user) {
      setUser(initialSession.user);
    } else {
      setLoading(false);
    }
  }, [initialSession, setUser, setLoading]);

  // Set up auth state change listener
  useEffect(() => {
    const {
      data: { subscription },
    } = clientSupabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      } else if (event === "USER_UPDATED" && session?.user) {
        setUser(session.user);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        setUser(session.user);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setError]);

  return <>{children}</>;
}
