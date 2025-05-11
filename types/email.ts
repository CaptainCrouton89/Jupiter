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

export type Folder = Database["public"]["Tables"]["folders"]["Row"];
export type FolderInsert = Database["public"]["Tables"]["folders"]["Insert"];
export type FolderUpdate = Database["public"]["Tables"]["folders"]["Update"];

export type Attachment = Database["public"]["Tables"]["attachments"]["Row"];
export type AttachmentInsert =
  Database["public"]["Tables"]["attachments"]["Insert"];
export type AttachmentUpdate =
  Database["public"]["Tables"]["attachments"]["Update"];

export type EmailRecipient =
  Database["public"]["Tables"]["email_recipients"]["Row"];
export type EmailRecipientInsert =
  Database["public"]["Tables"]["email_recipients"]["Insert"];
export type EmailRecipientUpdate =
  Database["public"]["Tables"]["email_recipients"]["Update"];

export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];
export type UserSettingsInsert =
  Database["public"]["Tables"]["user_settings"]["Insert"];
export type UserSettingsUpdate =
  Database["public"]["Tables"]["user_settings"]["Update"];

// Additional helper types not directly from the database
export interface EmailAddress {
  email: string;
  name?: string | null;
}

export interface FullEmail extends Omit<Email, "from_name" | "from_email"> {
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  account?: EmailAccount;
  folder?: Folder;
  attachments?: Attachment[];
}

export interface EmailWithRecipients extends Email {
  recipients: EmailRecipient[];
  account?: EmailAccount;
}

export type FolderType =
  | "inbox"
  | "sent"
  | "drafts"
  | "trash"
  | "spam"
  | "archive"
  | "custom";

export type RecipientType = "to" | "cc" | "bcc";

export type EmailSortCriteria = "date" | "sender" | "subject" | "priority";
export type SortDirection = "asc" | "desc";

export interface EmailFilter {
  read?: boolean;
  starred?: boolean;
  hasAttachments?: boolean;
  fromEmail?: string;
  toEmail?: string;
  subject?: string;
  dateFrom?: Date;
  dateTo?: Date;
  folderId?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
