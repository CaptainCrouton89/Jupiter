export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      email_accounts: {
        Row: {
          access_token_encrypted: string | null;
          created_at: string;
          email: string;
          id: string;
          imap_host: string | null;
          imap_port: number | null;
          is_active: boolean;
          last_oauth_error: string | null;
          last_synced_at: string | null;
          last_synced_uid: number | null;
          name: string | null;
          password_encrypted: string | null;
          provider: string | null;
          refresh_token_encrypted: string | null;
          scopes: string[] | null;
          smtp_host: string | null;
          smtp_port: number | null;
          token_expires_at: string | null;
          updated_at: string;
          user_id: string;
          username: string | null;
        };
        Insert: {
          access_token_encrypted?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          imap_host?: string | null;
          imap_port?: number | null;
          is_active?: boolean;
          last_oauth_error?: string | null;
          last_synced_at?: string | null;
          last_synced_uid?: number | null;
          name?: string | null;
          password_encrypted?: string | null;
          provider?: string | null;
          refresh_token_encrypted?: string | null;
          scopes?: string[] | null;
          smtp_host?: string | null;
          smtp_port?: number | null;
          token_expires_at?: string | null;
          updated_at?: string;
          user_id: string;
          username?: string | null;
        };
        Update: {
          access_token_encrypted?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          imap_host?: string | null;
          imap_port?: number | null;
          is_active?: boolean;
          last_oauth_error?: string | null;
          last_synced_at?: string | null;
          last_synced_uid?: number | null;
          name?: string | null;
          password_encrypted?: string | null;
          provider?: string | null;
          refresh_token_encrypted?: string | null;
          scopes?: string[] | null;
          smtp_host?: string | null;
          smtp_port?: number | null;
          token_expires_at?: string | null;
          updated_at?: string;
          user_id?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      emails: {
        Row: {
          account_id: string;
          body_html: string | null;
          body_text: string | null;
          category: string;
          created_at: string;
          from_email: string;
          from_name: string | null;
          id: string;
          imap_uid: string | null;
          message_id: string;
          received_at: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          body_html?: string | null;
          body_text?: string | null;
          category?: string;
          created_at?: string;
          from_email: string;
          from_name?: string | null;
          id?: string;
          imap_uid?: string | null;
          message_id: string;
          received_at: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          body_html?: string | null;
          body_text?: string | null;
          category?: string;
          created_at?: string;
          from_email?: string;
          from_name?: string | null;
          id?: string;
          imap_uid?: string | null;
          message_id?: string;
          received_at?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "emails_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "email_accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      sync_logs: {
        Row: {
          account_id: string;
          completed_at: string | null;
          error_message: string | null;
          id: string;
          job_id: string;
          started_at: string;
          status: string;
          total_uids_to_process: number | null;
          uids_processed_count: number | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          completed_at?: string | null;
          error_message?: string | null;
          id?: string;
          job_id?: string;
          started_at?: string;
          status: string;
          total_uids_to_process?: number | null;
          uids_processed_count?: number | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          completed_at?: string | null;
          error_message?: string | null;
          id?: string;
          job_id?: string;
          started_at?: string;
          status?: string;
          total_uids_to_process?: number | null;
          uids_processed_count?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_account";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "email_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sync_logs_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "email_accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      user_settings: {
        Row: {
          category_preferences: Json | null;
          created_at: string;
          default_account_id: string | null;
          email_signature: string | null;
          id: string;
          notifications_enabled: boolean;
          theme: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_preferences?: Json | null;
          created_at?: string;
          default_account_id?: string | null;
          email_signature?: string | null;
          id?: string;
          notifications_enabled?: boolean;
          theme?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_preferences?: Json | null;
          created_at?: string;
          default_account_id?: string | null;
          email_signature?: string | null;
          id?: string;
          notifications_enabled?: boolean;
          theme?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_default_account_id_fkey";
            columns: ["default_account_id"];
            isOneToOne: false;
            referencedRelation: "email_accounts";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
