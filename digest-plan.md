# Weekly Newsletter Digest Plan

This document outlines the plan to implement a weekly newsletter digest feature. The feature will:

1.  Run weekly as a cron job.
2.  Fetch all emails categorized as "newsletter" from the last 7 days for a user, across all their linked email accounts, including those in the "Spam" folder.
3.  Use an AI model to generate a single, comprehensive summary of all fetched newsletters.
4.  Email this summary (digest) to the user, from one of their linked email accounts.

## I. Prerequisite Adjustments (If any, based on current understanding)

- **Email Categorization & Folder Assignment**:
  - Currently, `emailProcessing.ts` moves emails categorized as "newsletter" to a "Spam" folder. The user has clarified this is acceptable. The digest logic will need to explicitly query both "INBOX" and "Spam" folders (or more broadly, all folders belonging to the user's accounts) and filter by `category = 'newsletter'`.
  - The `folders.type` in `supabaseOps.ts` during `getOrCreateFolderId` is hardcoded to "inbox" for new folders. The `folders` table schema (`database.types.ts`) does list "spam" as a valid type. We need to ensure that when the "Spam" folder is created or fetched, its `type` is correctly identified or handled. For fetching, we are primarily relying on `folder.name` which is 'Spam'.

## II. New Components & Modifications

### 1. Cron Job for Weekly Digest

- **File**: `app/api/cron/weekly-digest/route.ts`
- **Trigger**: Configured via Vercel (or other cron provider) to run weekly (e.g., every Sunday at 8 AM).
- **Authentication**:
  - Implement `Bearer ${process.env.CRON_SECRET}` authentication, similar to `app/api/cron/email-sync/route.ts`.
- **Logic**:
  - Accept a `userId` as a query parameter (e.g., `/api/cron/weekly-digest?userId=xxx`).
    - _Consideration_: How will this `userId` be provided by the cron scheduler? If a global digest for _all_ users is intended (each user gets their own), the cron job might fetch all users and trigger individual digest generations. For now, assume one user per trigger.
  - **Fetch User's Email Accounts**:
    - Use `createNewSupabaseAdminClient()` to get a Supabase client.
    - Query `email_accounts` table for all accounts where `user_id` matches and `is_active = true`.
    - This will provide `account_id`, `email` (user's own email address, useful for sending the digest), `smtp_host`, `smtp_port`, `password_encrypted`.
  - **Fetch Newsletters**:
    - For each `account_id` belonging to the user:
      - Query the `folders` table to get IDs of _all_ folders associated with that `account_id`. (Alternatively, if "Spam" is consistently named, query for "INBOX" and "Spam" by name).
      - Query the `emails` table:
        - `account_id` in the list of user's account IDs.
        - `folder_id` in the list of folder IDs obtained above for that account.
        - `category = 'newsletter'` (ensure this is the exact string used by `emailCategorizer.ts`).
        - `received_at` within the last 7 days.
        - Select `subject`, `from_name`, `from_email`, `body_text`, `body_html`.
  - **Handle No Newsletters**: If no newsletters are found, log and potentially send a "No news this week" email or skip.
  - **Generate Digest Summary**:
    - Collate all fetched newsletter content (prefer `body_text`, fallback to stripped `body_html`).
    - Create a new AI prompt for summarization. Include context like "You are creating a weekly newsletter digest. Summarize the following newsletter articles into a single, coherent digest with bullet points for each main topic."
    - Call a new function, similar to `categorizeEmail` but for summarization (e.g., `generateDigestSummary(newsletterContents: string[])`), using the OpenAI API (e.g., `gpt-4.1-mini` or a newer model suited for summarization).
    - This function will live in a new file, e.g., `lib/email/generateDigest.ts`.
  - **Send Digest Email**:
    - Choose one of the user's active email accounts to send the email _from_. The first active one fetched could be the default.
    - Decrypt its `password_encrypted`.
    - Use `nodemailer` (setup similar to `app/api/email/accounts/[accountId]/test-connection/route.ts`) to send an email:
      - `from`: The chosen user's email account.
      - `to`: The same user's email account (or a primary email if defined elsewhere for the user).
      - `subject`: "Your Weekly Newsletter Digest"
      - `html`: The formatted AI-generated summary.
  - **Logging**: Log steps, successes, and failures extensively.

### 2. AI Digest Generation Service

- **File**: `lib/email/generateDigest.ts` (new file)
- **Function**: `async function generateDigestSummary(newsletters: Array<{subject: string, from: string, content: string}>): Promise<string>`
- **Logic**:
  - Construct a detailed prompt for the AI, feeding it the subjects, senders, and content of all newsletters.
  - Use `openai.generateObject` (or similar from `ai` SDK) with a schema for the expected summary format (e.g., a simple string, or a more structured JSON if preferred for formatting later).
  - Handle errors and return the summary string.

### 3. Modifications to Existing Code

- **`emailProcessing.ts`**:
  - No immediate change needed if querying "Spam" folder for newsletters is acceptable for the digest. If a dedicated "Newsletter" folder is desired in the future and newsletters should not be marked as read automatically, this file would need adjustment. For now, we proceed with the user's clarification.
- **`lib/database.types.ts` / Schema**:
  - No changes seem immediately necessary for the `emails` or `folders` table if we query broadly and filter.
  - The `folders.type` for "Spam" folder: Ensure it's set to 'spam' if `getOrCreateFolderId` in `supabaseOps.ts` creates it. Currently, it defaults `type` to "inbox".
    - **Action**: Modify `getOrCreateFolderId` in `app/api/internal/sync-account/[accountId]/supabaseOps.ts`:
      - Accept an optional `folderType` parameter.
      - If `folderPath.toUpperCase() === 'SPAM'`, set `type: 'spam'`.
      - If `folderPath.toUpperCase() === 'INBOX'`, set `type: 'inbox'`.
      - Default to a sensible type or make it required if not "INBOX" or "SPAM".

### 4. Helper for Sending Email

- **File**: `lib/email/sendEmail.ts` (new file, or integrate into the cron job route initially)
- **Function**: `async function sendDigestEmail(userAccount: EmailAccountDetails, toEmail: string, subject: string, htmlBody: string): Promise<void>`
- **Logic**:
  - Takes user's email account details (for SMTP auth), recipient email, subject, and HTML body.
  - Decrypts password.
  - Sets up `nodemailer` transporter.
  - Sends the email.
  - Handles errors.

## III. Database Considerations

- **Querying Emails**:
  - Ensure efficient querying of the `emails` table, especially the `received_at` and `category` fields. Indexes on `(account_id, category, received_at)` and `(account_id, folder_id, category, received_at)` might be beneficial.
  - Fetching emails from the last 7 days should be efficient with an index on `received_at`.
- **Storing Digest**:
  - For now, the digest is generated and emailed, not stored in the DB. This is simpler.
  - Future enhancement: Store past digests for user reference.

## IV. Environment Variables

- `CRON_SECRET`: Already used by `email-sync`, can be reused.
- `INTERNAL_API_SECRET`: Already used by `email-sync`.
- `OPENAI_API_KEY`: Already implied by usage of `@ai-sdk/openai`.
- `NEXT_PUBLIC_APP_URL`: Used by `email-sync`, likely needed.

## V. Step-by-Step Implementation Plan

1.  **Modify `getOrCreateFolderId`**: Update `app/api/internal/sync-account/[accountId]/supabaseOps.ts` to correctly set folder `type` (especially for 'spam').
2.  **Create AI Digest Generation Service**:
    - Create `lib/email/generateDigest.ts`.
    - Implement `generateDigestSummary` function using OpenAI to summarize provided newsletter content.
3.  **Create Email Sending Helper**:
    - Create `lib/email/sendEmail.ts` (or plan to write this logic directly in the cron route initially).
    - Implement function to send email using `nodemailer` and user's account credentials.
4.  **Develop Weekly Digest Cron Job Route**:
    - Create `app/api/cron/weekly-digest/route.ts`.
    - Implement authentication.
    - Implement logic to fetch user accounts.
    - Implement logic to fetch newsletters from the last 7 days (category 'newsletter') from all relevant folders for the user.
    - Integrate `generateDigestSummary` to create the digest.
    - Integrate email sending logic to send the digest to the user.
    - Add robust logging.
5.  **Testing**:
    - Unit test AI summarization if possible (mocking OpenAI calls).
    - Unit test email sending (mocking nodemailer).
    - Integration test the cron job endpoint locally (e.g., using Postman or `curl` with the `CRON_SECRET`).
    - Manually trigger and verify end-to-end flow: email fetching, summarization, and receiving the digest email.
    - Test with various scenarios: no newsletters, few newsletters, many newsletters.
6.  **Deployment & Cron Configuration**:
    - Deploy the changes.
    - Configure the cron job on Vercel (or other provider) to call the new endpoint weekly, passing the appropriate `userId` (or modify to handle all users).

## VI. Open Questions & Considerations

- **User Specificity**: How is the `userId` for the digest determined/passed to the cron job?
  - _Assumption for now_: Passed as a query param. If it's for _all_ users, the cron job needs to iterate through all users.
- **Primary Email for Digest**: If a user has multiple email accounts, which one receives the digest?
  - _Assumption for now_: Send to the same email account used to send _from_, or the first one listed for the user. A `user_settings` table might have a `default_email_for_notifications` if more specific routing is needed. `user_settings` table has `default_account_id`. This could be used to determine the recipient address.
- **Error Handling**: What happens if AI summarization fails? Or email sending fails? The cron job should log these errors clearly.
- **Rate Limits**: Be mindful of OpenAI API rate limits if summarizing a very large number of newsletters or for many users.
- **Content Length**: OpenAI models have token limits. If the combined text of all newsletters is too long, it might need to be truncated or processed in chunks (though summarization generally implies reduction).
- **Cost**: OpenAI API calls incur costs. This should be monitored.

This plan provides a comprehensive approach. Let me know if you want to adjust or prioritize any part.
