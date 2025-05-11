import type { EmailAccount, Folder, UserSettings } from "@/types/email";
import { supabase } from "./supabase";

/**
 * Email Accounts API
 */
export const emailAccountsAPI = {
  /**
   * Get all email accounts for the current user
   */
  getAll: async (userId: string) => {
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
  getById: async (id: string) => {
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
    account: Omit<EmailAccount, "id" | "created_at" | "updated_at">
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
    account: Partial<Omit<EmailAccount, "id" | "created_at" | "updated_at">>
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
  delete: async (id: string) => {
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
   * Get emails for a specific folder
   */
  getByFolder: async (
    folderId: string,
    { page = 1, limit = 50 }: { page?: number; limit?: number } = {}
  ) => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from("emails")
      .select("*, account_id(*)", { count: "exact" })
      .eq("folder_id", folderId)
      .order("received_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return {
      data,
      pagination: {
        total: count || 0,
        page,
        pageSize: limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  },

  /**
   * Get a single email by ID
   */
  getById: async (id: string) => {
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
  markAsRead: async (id: string, isRead: boolean = true) => {
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
  toggleStar: async (id: string, isStarred: boolean) => {
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
 * Folders API
 */
export const foldersAPI = {
  /**
   * Get all folders for an account
   */
  getByAccount: async (accountId: string) => {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .eq("account_id", accountId);

    if (error) throw error;
    return data;
  },

  /**
   * Create a new folder
   */
  create: async (folder: Omit<Folder, "id" | "created_at" | "updated_at">) => {
    const { data, error } = await supabase
      .from("folders")
      .insert([folder])
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
  get: async (userId: string) => {
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
    >
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
