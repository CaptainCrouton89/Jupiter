import { EmailAccountDetails } from "@/app/api/internal/sync-account/[accountId]/supabaseOps"; // For type
import { createNewSupabaseAdminClient } from "@/lib/auth/admin";
import { Database, Tables } from "@/lib/database.types";
import { generateDigestSummary } from "@/lib/email/generateDigest";
import { sendDigestEmail } from "@/lib/email/sendEmail";
import { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Placeholder for a more robust logger if you have one
const logger = {
  info: (...args: any[]) => console.log("[WeeklyDigest INFO]", ...args),
  warn: (...args: any[]) => console.warn("[WeeklyDigest WARN]", ...args),
  error: (...args: any[]) => console.error("[WeeklyDigest ERROR]", ...args),
};

// Define RELEVANT_CATEGORIES, mirroring app/settings/page.tsx
const RELEVANT_CATEGORIES = [
  "newsletter",
  "marketing",
  "receipt",
  "invoice",
  "finances",
  "code-related",
  "notification",
  "account-related",
  "personal",
  // "email-verification" and "uncategorizable" are typically not digested
] as const;

export const maxDuration = 300; // 5 minutes, adjust as needed for AI processing

async function fetchUserEmailAccounts(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EmailAccountDetails[]> {
  const { data, error } = await supabase
    .from("email_accounts")
    .select(
      "id, email, name, imap_host, imap_port, smtp_host, smtp_port, password_encrypted, last_synced_uid, last_synced_at, user_id, is_active, provider, access_token_encrypted, refresh_token_encrypted"
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    logger.error(`Error fetching email accounts for user ${userId}:`, error);
    throw new Error(`Failed to fetch email accounts for user ${userId}.`);
  }
  return data || [];
}

async function fetchEmailsForCategory(
  supabase: SupabaseClient<Database>,
  userAccountIds: string[],
  categoryName: (typeof RELEVANT_CATEGORIES)[number]
): Promise<Tables<"emails">[]> {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // First, get all folder IDs for the given account IDs
  // We don't filter by folder name here, just get all folders and then filter emails by category.
  const { data: folders, error: foldersError } = await supabase
    .from("folders")
    .select("id")
    .in("account_id", userAccountIds);

  if (foldersError) {
    logger.error(
      `Error fetching folders for accounts ${userAccountIds.join(
        ", "
      )} for category ${categoryName}:`,
      foldersError
    );
    return []; // Or throw, depending on desired error handling
  }

  if (!folders || folders.length === 0) {
    logger.info(
      `No folders found for accounts ${userAccountIds.join(
        ", "
      )} for category ${categoryName}.`
    );
    return [];
  }

  const folderIds = folders.map((f) => f.id);

  const { data: emails, error: emailsError } = await supabase
    .from("emails")
    .select("*") // Select all fields for now, can be optimized
    .in("account_id", userAccountIds)
    .in("folder_id", folderIds) // Filter by folders belonging to these accounts
    .eq("category", categoryName) // Use the provided categoryName
    .gte("received_at", sevenDaysAgo)
    .order("received_at", { ascending: false });

  if (emailsError) {
    logger.error(
      `Error fetching emails for category ${categoryName} for accounts ${userAccountIds.join(
        ", "
      )}:`,
      emailsError
    );
    return [];
  }
  return emails || [];
}

async function fetchAllUserIdsWithActiveAccounts(
  supabase: SupabaseClient<Database>
): Promise<string[]> {
  const { data, error } = await supabase
    .from("email_accounts")
    .select("user_id", { count: "exact", head: false })
    .eq("is_active", true)
    .not("user_id", "is", null); // Ensure user_id is not null using .not

  if (error) {
    logger.error("Error fetching distinct user_ids:", error);
    throw new Error("Failed to fetch user_ids for digest.");
  }

  // Extract unique user_ids
  const userIds = data
    ? Array.from(new Set(data.map((item) => item.user_id)))
    : [];
  // Filter out any potential nulls that might have slipped through, and ensure they are strings
  return userIds.filter(
    (userId): userId is string => userId !== null && typeof userId === "string"
  );
}

export async function GET(request: NextRequest) {
  logger.info("Weekly digest cron job for ALL USERS started.");

  // 1. Authenticate the cron job request
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized attempt to access weekly digest cron.");
    return new Response("Unauthorized", { status: 401 });
  }

  // Removing userId from query params, will fetch all users
  // const url = new URL(request.url);
  // const userId = url.searchParams.get("userId");
  // if (!userId) {
  //   logger.warn("User ID not provided in cron request.");
  //   return NextResponse.json(
  //     { error: "User ID is required" },
  //     { status: 400 }
  //   );
  // }

  const supabase = createNewSupabaseAdminClient();
  let totalUsersProcessed = 0;
  let totalUsersFailed = 0;
  let totalDigestsSent = 0;

  try {
    const allUserIds = await fetchAllUserIdsWithActiveAccounts(supabase);

    if (allUserIds.length === 0) {
      logger.info("No users with active accounts found. Cron job exiting.");
      return NextResponse.json({
        message: "No users with active accounts to process.",
      });
    }

    logger.info(
      `Found ${allUserIds.length} users to process for weekly digests.`
    );

    for (const userId of allUserIds) {
      logger.info(`Processing weekly digest for user ID: ${userId}`);
      try {
        const userEmailAccounts = await fetchUserEmailAccounts(
          supabase,
          userId
        );
        if (userEmailAccounts.length === 0) {
          logger.info(
            `No active email accounts found for user ${userId}. Skipping digest.`
          );
          // totalUsersProcessed++; // Count as processed, but no digest sent
          continue;
        }

        // Fetch user settings for category preferences
        const { data: userSettings, error: userSettingsError } = await supabase
          .from("user_settings")
          .select("category_preferences, default_account_id")
          .eq("user_id", userId)
          .single();

        if (userSettingsError) {
          logger.error(
            `Error fetching user settings for user ${userId}:`,
            userSettingsError
          );
          totalUsersFailed++;
          continue;
        }

        // Ensure categoryPreferences is always a Record, even if empty
        const categoryPreferences: Record<
          (typeof RELEVANT_CATEGORIES)[number],
          { action: string; digest: boolean }
        > =
          (userSettings?.category_preferences as Record<
            (typeof RELEVANT_CATEGORIES)[number],
            { action: string; digest: boolean }
          >) ||
          ({} as Record<
            (typeof RELEVANT_CATEGORIES)[number],
            { action: string; digest: boolean }
          >);

        const accountIds = userEmailAccounts.map((acc) => acc.id);
        let digestsSentThisUser = 0;

        for (const category of RELEVANT_CATEGORIES) {
          if (categoryPreferences[category]?.digest) {
            logger.info(
              `User ${userId} has digest enabled for category: ${category}. Fetching emails.`
            );
            const emailsForCategory = await fetchEmailsForCategory(
              supabase,
              accountIds,
              category
            );

            if (emailsForCategory.length > 0) {
              logger.info(
                `Found ${emailsForCategory.length} emails for category ${category} for user ${userId}.`
              );

              const categorySpecificContents = emailsForCategory.map(
                (email) => ({
                  subject: email.subject,
                  from: email.from_name || email.from_email,
                  content:
                    email.body_text ||
                    (email.body_html || "")
                      .replace(/<[^>]+>/g, " ")
                      .substring(0, 5000),
                  receivedAt: email.received_at,
                  // category: category, // Not strictly needed if generateDigestSummary takes category
                })
              );

              // Generate and send digest for THIS category
              try {
                logger.info(
                  `Generating digest for category: ${category} for user ${userId}.`
                );
                const digestHtmlSummary = await generateDigestSummary(
                  categorySpecificContents,
                  userEmailAccounts[0]?.name || userId, // Pass userName
                  category // Pass category name
                );

                const sendFromAccount = userEmailAccounts[0];
                let sendToEmail = sendFromAccount.email; // Default recipient

                if (userSettings && userSettings.default_account_id) {
                  const defaultAccount = userEmailAccounts.find(
                    (acc) => acc.id === userSettings.default_account_id
                  );
                  if (defaultAccount) {
                    sendToEmail = defaultAccount.email;
                  }
                }

                const emailSubject = `Your Weekly ${category
                  .replace("-", " ")
                  .replace(/\b\w/g, (char) => char.toUpperCase())} Digest`;

                await sendDigestEmail(
                  sendFromAccount,
                  sendToEmail,
                  emailSubject,
                  digestHtmlSummary
                );
                logger.info(
                  `Digest for category ${category} successfully sent to ${sendToEmail} for user ${userId}.`
                );
                digestsSentThisUser++;
                totalDigestsSent++; // Increment global counter
              } catch (digestError: any) {
                logger.error(
                  `Error generating or sending digest for category ${category} for user ${userId}:`,
                  digestError.message,
                  digestError.stack
                );
                // Do not increment totalUsersFailed here, as other category digests for this user might succeed.
                // The overall try-catch for the user will handle if all their digests fail.
              }
            } else {
              logger.info(
                `No emails found for category ${category} for user ${userId} in the last 7 days.`
              );
            }
          }
        }

        if (digestsSentThisUser > 0) {
          totalUsersProcessed++; // Count user as processed if at least one digest was sent
        } else {
          logger.info(
            `No digests generated or sent for user ${userId} as no categories with emails were enabled for digest.`
          );
          // Optionally, count this user as "processed but no digest" if needed for stats.
          // For now, totalUsersProcessed increments only if a digest is sent.
        }
      } catch (userError: any) {
        logger.error(
          `Failed to process digest for user ${userId}:`,
          userError.message,
          userError.stack
        );
        totalUsersFailed++;
      }
    }

    logger.info(
      `Weekly digest cron job finished for all users. Users Processed: ${totalUsersProcessed}, Users Failed: ${totalUsersFailed}, Digests Sent: ${totalDigestsSent}`
    );
    return NextResponse.json({
      message: "Weekly digest cron job executed for all users.",
      usersProcessed: totalUsersProcessed,
      usersFailed: totalUsersFailed,
      digestsSent: totalDigestsSent,
    });
  } catch (error: any) {
    logger.error(
      "General failure in weekly digest cron job for ALL USERS:",
      error.message,
      error.stack
    );
    return NextResponse.json(
      {
        error: "Weekly digest cron job failed for all users",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
