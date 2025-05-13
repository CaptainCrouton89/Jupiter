import { Database } from "@/lib/database.types";

// Convenient type aliases from database schema
export type EmailAccount =
  Database["public"]["Tables"]["email_accounts"]["Row"];
export type EmailAccountInsert =
  Database["public"]["Tables"]["email_accounts"]["Insert"];
export type EmailAccountUpdate =
  Database["public"]["Tables"]["email_accounts"]["Update"];

export type Email = Database["public"]["Tables"]["emails"]["Row"];
export type EmailInsert = Database["public"]["Tables"]["emails"]["Insert"];
export type EmailUpdate = Database["public"]["Tables"]["emails"]["Update"];

export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];
export type UserSettingsInsert =
  Database["public"]["Tables"]["user_settings"]["Insert"];
export type UserSettingsUpdate =
  Database["public"]["Tables"]["user_settings"]["Update"];
export interface EmailAddress {
  email: string;
  name?: string | null;
}
