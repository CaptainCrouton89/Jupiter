import { closeImapClient } from "@/app/api/internal/sync-account/[accountId]/imapOps";
import { logger } from "@/app/api/internal/sync-account/[accountId]/logger"; // Using a shared logger
import { createClient } from "@/lib/auth/server";
import { categorizeEmail } from "@/lib/email/categorizer/emailCategorizer";
import { getConnectedImapClient } from "@/lib/email/imapService";
import { fetchAndParseEmails } from "@/lib/email/parseEmail";
import type { CategoryPreferences } from "@/types/settings";
import { Category } from "@/types/settings";
import { ImapFlow } from "imapflow";
import { NextResponse } from "next/server";

interface CategorizationTestEmailFE {
  uid: number;
  messageId: string | null;
  subject: string | null;
  from: { name: string | null; address: string | null } | null;
  date: string | null; // ISO string
  category: Category;
  bodyTextSnippet: string | null;
}

const MAX_UIDS_TO_FETCH_INITIALLY = 25; // Fetch a bit more than requested to account for parsing/categorization failures
const BODY_SNIPPET_LENGTH = 250;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!accountId) {
    return NextResponse.json(
      { error: "accountId is required" },
      { status: 400 }
    );
  }

  let imapConnection: Awaited<
    ReturnType<typeof getConnectedImapClient>
  > | null = null;
  let mailboxLock: Awaited<ReturnType<ImapFlow["getMailboxLock"]>> | null =
    null;

  try {
    logger.info(
      `[TestCategorization] Starting for accountId: ${accountId}, user: ${user.id}, limit: ${limit}`
    );
    imapConnection = await getConnectedImapClient(accountId, undefined, logger);
    const { client, accountDetails } = imapConnection;

    logger.info(
      `[TestCategorization] Successfully connected to IMAP for ${accountDetails.email}`
    );

    mailboxLock = await client.getMailboxLock("INBOX");
    logger.info("[TestCategorization] INBOX selected and locked.");

    // Fetch all UIDs, sort descending (latest first)
    const allUidsOnServer = await client.search({ all: true }, { uid: true });
    allUidsOnServer.sort((a, b) => b - a); // Latest first

    const uidsToFetch = allUidsOnServer.slice(0, MAX_UIDS_TO_FETCH_INITIALLY);

    logger.info(
      `[TestCategorization] Found ${
        allUidsOnServer.length
      } total UIDs. Attempting to fetch latest ${
        uidsToFetch.length
      } UIDs: ${uidsToFetch.join(",")}`
    );

    if (uidsToFetch.length === 0) {
      logger.info("[TestCategorization] No UIDs found in INBOX.");
      return NextResponse.json({ emails: [] });
    }

    const { data: userSettings, error: settingsError } = await supabase
      .from("user_settings")
      .select("category_preferences")
      .eq("user_id", user.id)
      .single();

    let userWorkProfile: string | undefined;
    if (settingsError && settingsError.code !== "PGRST116") {
      logger.error(
        `[TestCategorization] Error fetching user settings for user ${user.id}:`,
        settingsError
      );
      // Continue without custom profile, or throw error if critical
    } else if (userSettings && userSettings.category_preferences) {
      const prefs = userSettings.category_preferences as CategoryPreferences;
      if (prefs.work && prefs.work.profileDescription) {
        userWorkProfile = prefs.work.profileDescription;
        logger.info(
          `[TestCategorization] Using custom work profile for user ${
            user.id
          }: \"${userWorkProfile.substring(0, 50)}...\"`
        );
      }
    }
    if (!userWorkProfile) {
      logger.info(
        `[TestCategorization] No custom work profile for user ${user.id}. Using default.`
      );
    }

    const parsedEmails = await fetchAndParseEmails(
      client,
      uidsToFetch,
      10, // batchSize for fetchAndParseEmails
      accountId,
      logger
    );
    logger.info(
      `[TestCategorization] Parsed ${parsedEmails.length} emails out of ${uidsToFetch.length} fetched.`
    );

    // Limit emails to categorize and run in parallel
    const emailsToProcess = parsedEmails.slice(0, limit);
    
    const categorizedEmailsResult = await Promise.allSettled(
      emailsToProcess.map(async (parsedEmail) => {
        const categorizationInput = {
          from: parsedEmail.from,
          subject: parsedEmail.subject,
          textContent: parsedEmail.text,
          htmlContent: parsedEmail.html,
          headers: parsedEmail.headers,
          userWorkProfile,
        };
        const categorization = await categorizeEmail(categorizationInput);

        parsedEmail.category = categorization.category; // Assign category

        return {
          uid: parsedEmail.imapUid || 0, // Should always have imapUid from fetchAndParseEmail
          messageId: parsedEmail.messageId,
          subject: parsedEmail.subject,
          from: parsedEmail.from,
          date: parsedEmail.date ? parsedEmail.date.toISOString() : null,
          category: parsedEmail.category as Category, // Ensure type
          bodyTextSnippet: parsedEmail.text
            ? parsedEmail.text.substring(0, BODY_SNIPPET_LENGTH) +
              (parsedEmail.text.length > BODY_SNIPPET_LENGTH ? "..." : "")
            : null,
        };
      })
    );

    // Filter successful results and log errors
    const successfulResults: CategorizationTestEmailFE[] = [];
    categorizedEmailsResult.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
      } else {
        logger.error(
          `[TestCategorization] Failed to categorize email UID ${emailsToProcess[index].imapUid}: ${result.reason.message}`,
          result.reason
        );
      }
    });

    logger.info(
      `[TestCategorization] Successfully processed and categorized ${successfulResults.length} emails.`
    );
    return NextResponse.json({ emails: successfulResults });
  } catch (error: any) {
    logger.error(
      `[TestCategorization] Error during test categorization for accountId ${accountId}: ${error.message}`,
      error
    );
    return NextResponse.json(
      { error: "Failed to run categorization test. " + error.message },
      { status: 500 }
    );
  } finally {
    if (mailboxLock) {
      try {
        await mailboxLock.release();
        logger.info("[TestCategorization] Mailbox lock released.");
      } catch (releaseError: any) {
        logger.error(
          `[TestCategorization] Error releasing mailbox lock: ${releaseError.message}`,
          releaseError
        );
      }
    }
    if (imapConnection?.client) {
      await closeImapClient(
        imapConnection.client,
        imapConnection.accountDetails.email
      );
      logger.info("[TestCategorization] IMAP client closed.");
    }
  }
}
