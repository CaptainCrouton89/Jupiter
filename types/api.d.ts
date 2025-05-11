import { Attachment, Email, EmailAccount, Folder, UserSettings } from "./email";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface EmailsResponse extends PaginatedResponse<Email[]> {}

export interface EmailResponse extends ApiResponse<Email> {}

export interface EmailAccountsResponse extends ApiResponse<EmailAccount[]> {}

export interface EmailAccountResponse extends ApiResponse<EmailAccount> {}

export interface FoldersResponse extends ApiResponse<Folder[]> {}

export interface FolderResponse extends ApiResponse<Folder> {}

export interface AttachmentsResponse extends ApiResponse<Attachment[]> {}

export interface AttachmentResponse extends ApiResponse<Attachment> {}

export interface UserSettingsResponse extends ApiResponse<UserSettings> {}
