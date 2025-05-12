import type { AuthError, User } from "@supabase/supabase-js";
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

// Helper function to ensure user settings exist
async function ensureUserSettings(userId: string): Promise<void> {
  try {
    // Check if settings already exist
    const { data: existingSettings, error: fetchError } = await supabase
      .from("user_settings")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle(); // Use maybeSingle to handle 0 or 1 row without erroring on 0

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 means 0 rows, which is fine
      console.error("Error fetching user settings:", fetchError);
      // Don't block login/signup for this, but log it
      return;
    }

    if (!existingSettings) {
      // Settings do not exist, create them
      const { error: insertError } = await supabase
        .from("user_settings")
        .insert({
          user_id: userId,
          category_preferences: {}, // Initialize with an empty object
          theme: "light", // Default theme
          notifications_enabled: true, // Default notification preference
        });

      if (insertError) {
        console.error("Error creating user settings:", insertError);
        // Don't block login/signup for this, but log it
      } else {
        console.log(`Default user settings created for user ID: ${userId}`);
      }
    }
  } catch (error) {
    console.error("Unexpected error in ensureUserSettings:", error);
  }
}

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

      if (data.user) {
        // User object should exist on successful sign-in
        await ensureUserSettings(data.user.id);
      }

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

      // After successful sign-up, user data is in data.user
      if (data.user) {
        await ensureUserSettings(data.user.id);
      }

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

      // Ensure user is explicitly of type User | null
      const user: User | null = data.user;

      return {
        success: true,
        data: user, // data.user is already the user object
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

      // Ensure user is explicitly of type User | null
      const user: User | null = data.user;

      return {
        success: true,
        data: user, // data.user is already the user object
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
