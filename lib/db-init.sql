-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE email_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('inbox', 'sent', 'drafts', 'trash', 'spam', 'archive', 'custom')),
  parent_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  conversation_id TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  starred BOOLEAN NOT NULL DEFAULT FALSE,
  folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  type TEXT NOT NULL CHECK (type IN ('to', 'cc', 'bcc')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  email_signature TEXT,
  default_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Table to track email synchronization jobs
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  job_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(), -- Unique ID for this specific sync run
  status TEXT NOT NULL CHECK (status IN ('started', 'in_progress', 'completed', 'failed', 'no_new_emails')),
  total_uids_to_process INTEGER DEFAULT 0,
  uids_processed_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  CONSTRAINT fk_account FOREIGN KEY(account_id) REFERENCES email_accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_sync_logs_account_id ON sync_logs(account_id);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);

-- Create update triggers for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_accounts_modtime
BEFORE UPDATE ON email_accounts
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_folders_modtime
BEFORE UPDATE ON folders
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_emails_modtime
BEFORE UPDATE ON emails
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_user_settings_modtime
BEFORE UPDATE ON user_settings
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Set up Row Level Security (RLS)

-- Enable RLS on all tables
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies

-- email_accounts policies
CREATE POLICY "Users can view their own email accounts"
ON email_accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email accounts"
ON email_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email accounts"
ON email_accounts FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email accounts"
ON email_accounts FOR DELETE
USING (auth.uid() = user_id);

-- folders policies
CREATE POLICY "Users can view folders of their own accounts"
ON folders FOR SELECT
USING (EXISTS (
  SELECT 1 FROM email_accounts
  WHERE email_accounts.id = folders.account_id
  AND email_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can insert folders to their own accounts"
ON folders FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM email_accounts
  WHERE email_accounts.id = folders.account_id
  AND email_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can update folders of their own accounts"
ON folders FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM email_accounts
  WHERE email_accounts.id = folders.account_id
  AND email_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can delete folders of their own accounts"
ON folders FOR DELETE
USING (EXISTS (
  SELECT 1 FROM email_accounts
  WHERE email_accounts.id = folders.account_id
  AND email_accounts.user_id = auth.uid()
));

-- emails policies
CREATE POLICY "Users can view emails of their own accounts"
ON emails FOR SELECT
USING (EXISTS (
  SELECT 1 FROM email_accounts
  WHERE email_accounts.id = emails.account_id
  AND email_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can insert emails to their own accounts"
ON emails FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM email_accounts
  WHERE email_accounts.id = emails.account_id
  AND email_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can update emails of their own accounts"
ON emails FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM email_accounts
  WHERE email_accounts.id = emails.account_id
  AND email_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can delete emails of their own accounts"
ON emails FOR DELETE
USING (EXISTS (
  SELECT 1 FROM email_accounts
  WHERE email_accounts.id = emails.account_id
  AND email_accounts.user_id = auth.uid()
));

-- email_recipients policies
CREATE POLICY "Users can view recipients of their own emails"
ON email_recipients FOR SELECT
USING (EXISTS (
  SELECT 1 FROM emails
  JOIN email_accounts ON emails.account_id = email_accounts.id
  WHERE emails.id = email_recipients.email_id
  AND email_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can insert recipients to their own emails"
ON email_recipients FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM emails
  JOIN email_accounts ON emails.account_id = email_accounts.id
  WHERE emails.id = email_recipients.email_id
  AND email_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can update recipients of their own emails"
ON email_recipients FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM emails
  JOIN email_accounts ON emails.account_id = email_accounts.id
  WHERE emails.id = email_recipients.email_id
  AND email_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can delete recipients of their own emails"
ON email_recipients FOR DELETE
USING (EXISTS (
  SELECT 1 FROM emails
  JOIN email_accounts ON emails.account_id = email_accounts.id
  WHERE emails.id = email_recipients.email_id
  AND email_accounts.user_id = auth.uid()
));

-- attachments policies
CREATE POLICY "Users can view attachments of their own emails"
ON attachments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM emails
  JOIN email_accounts ON emails.account_id = email_accounts.id
  WHERE emails.id = attachments.email_id
  AND email_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can insert attachments to their own emails"
ON attachments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM emails
  JOIN email_accounts ON emails.account_id = email_accounts.id
  WHERE emails.id = attachments.email_id
  AND email_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can delete attachments of their own emails"
ON attachments FOR DELETE
USING (EXISTS (
  SELECT 1 FROM emails
  JOIN email_accounts ON emails.account_id = email_accounts.id
  WHERE emails.id = attachments.email_id
  AND email_accounts.user_id = auth.uid()
));

-- user_settings policies
CREATE POLICY "Users can view their own settings"
ON user_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
ON user_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON user_settings FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings"
ON user_settings FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX idx_folders_account_id ON folders(account_id);
CREATE INDEX idx_emails_account_id ON emails(account_id);
CREATE INDEX idx_emails_folder_id ON emails(folder_id);
CREATE INDEX idx_emails_conversation_id ON emails(conversation_id);
CREATE INDEX idx_email_recipients_email_id ON email_recipients(email_id);
CREATE INDEX idx_attachments_email_id ON attachments(email_id);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX idx_user_settings_default_account_id ON user_settings(default_account_id);