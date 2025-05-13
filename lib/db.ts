import type { EmailAccount, UserSettings } from "@/types/email";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";
/**
 * Email Accounts API
 */
export const emailAccountsAPI = {
  /**
   * Get all email accounts for the current user
   */
  getAll: async (userId: string, supabase: SupabaseClient<Database>) => {
    const { data, error } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;
    return data;
  },

  /**
   * Get a single email account by ID
   */
  getById: async (id: string, supabase: SupabaseClient<Database>) => {
    const { data, error } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new email account
   */
  create: async (
    account: Omit<EmailAccount, "id" | "created_at" | "updated_at">,
    supabase: SupabaseClient<Database>
  ) => {
    const { data, error } = await supabase
      .from("email_accounts")
      .insert([account])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an existing email account
   */
  update: async (
    id: string,
    account: Partial<Omit<EmailAccount, "id" | "created_at" | "updated_at">>,
    supabase: SupabaseClient<Database>
  ) => {
    const { data, error } = await supabase
      .from("email_accounts")
      .update(account)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete an email account
   */
  delete: async (id: string, supabase: SupabaseClient<Database>) => {
    const { error } = await supabase
      .from("email_accounts")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },
};

/**
 * Emails API
 */
export const emailsAPI = {
  /**
   * Get a single email by ID
   */
  getById: async (id: string, supabase: SupabaseClient<Database>) => {
    const { data, error } = await supabase
      .from("emails")
      .select("*, account_id(*), email_recipients(*)")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Mark an email as read/unread
   */
  markAsRead: async (
    id: string,
    isRead: boolean = true,
    supabase: SupabaseClient<Database>
  ) => {
    const { data, error } = await supabase
      .from("emails")
      .update({ read: isRead })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Star/unstar an email
   */
  toggleStar: async (
    id: string,
    isStarred: boolean,
    supabase: SupabaseClient<Database>
  ) => {
    const { data, error } = await supabase
      .from("emails")
      .update({ starred: isStarred })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
/**
 * User Settings API
 */
export const userSettingsAPI = {
  /**
   * Get user settings
   */
  get: async (userId: string, supabase: SupabaseClient<Database>) => {
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update user settings
   */
  update: async (
    userId: string,
    settings: Partial<
      Omit<UserSettings, "id" | "created_at" | "updated_at" | "user_id">
    >,
    supabase: SupabaseClient<Database>
  ) => {
    const { data, error } = await supabase
      .from("user_settings")
      .update(settings)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
