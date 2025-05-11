export interface EmailAccount {
  id: string;
  user_id: string;
  email: string;
  name?: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  username: string;
  password_encrypted: string;
  created_at: string;
  updated_at: string;
}

export interface Email {
  id: string;
  account_id: string;
  message_id: string;
  conversation_id?: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body_html?: string;
  body_text?: string;
  received_at: string;
  read: boolean;
  starred: boolean;
  folder_id: string;
  has_attachments: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface Attachment {
  id: string;
  email_id: string;
  filename: string;
  content_type: string;
  size: number;
  storage_path: string;
  created_at: string;
}

export interface Folder {
  id: string;
  account_id: string;
  name: string;
  type: "inbox" | "sent" | "drafts" | "trash" | "spam" | "archive" | "custom";
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  theme: "light" | "dark" | "system";
  email_signature?: string;
  default_account_id?: string;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}
