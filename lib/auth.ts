import type { AuthError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type SignInCredentials = {
  email: string;
  password: string;
};

type SignUpCredentials = SignInCredentials & {
  name?: string;
};

export type AuthResponse = {
  success: boolean;
  error?: string;
  data?: any;
};

export const auth = {
  /**
   * Sign in with email and password
   */
  signInWithPassword: async ({
    email,
    password,
  }: SignInCredentials): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error("Sign in error:", error);
      return {
        success: false,
        error: (error as AuthError).message || "Failed to sign in",
      };
    }
  },

  /**
   * Sign up with email and password
   */
  signUp: async ({
    email,
    password,
    name,
  }: SignUpCredentials): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) throw error;

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error("Sign up error:", error);
      return {
        success: false,
        error: (error as AuthError).message || "Failed to sign up",
      };
    }
  },

  /**
   * Sign out the current user
   */
  signOut: async (): Promise<AuthResponse> => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      return {
        success: true,
      };
    } catch (error) {
      console.error("Sign out error:", error);
      return {
        success: false,
        error: (error as AuthError).message || "Failed to sign out",
      };
    }
  },

  /**
   * Get the current authenticated user
   */
  getSession: async (): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) throw error;

      return {
        success: true,
        data: data.user,
      };
    } catch (error) {
      console.error("Get user error (from former getSession):", error);
      return {
        success: false,
        error: (error as AuthError).message || "Failed to get user",
      };
    }
  },

  /**
   * Get the current user
   */
  getUser: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) throw error;

      return {
        success: true,
        data: data.user,
      };
    } catch (error) {
      console.error("Get user error:", error);
      return {
        success: false,
        error: (error as AuthError).message || "Failed to get user",
      };
    }
  },

  /**
   * Reset password
   */
  resetPassword: async (email: string): Promise<AuthResponse> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      return {
        success: true,
      };
    } catch (error) {
      console.error("Reset password error:", error);
      return {
        success: false,
        error: (error as AuthError).message || "Failed to reset password",
      };
    }
  },

  /**
   * Update password
   */
  updatePassword: async (password: string): Promise<AuthResponse> => {
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      return {
        success: true,
      };
    } catch (error) {
      console.error("Update password error:", error);
      return {
        success: false,
        error: (error as AuthError).message || "Failed to update password",
      };
    }
  },
};
