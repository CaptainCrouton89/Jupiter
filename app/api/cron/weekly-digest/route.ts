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

export const maxDuration = 300; // 5 minutes, adjust as needed for AI processing

async function fetchUserEmailAccounts(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EmailAccountDetails[]> {
  const { data, error } = await supabase
    .from("email_accounts")
    .select(
      "id, email, name, imap_host, imap_port, smtp_host, smtp_port, password_encrypted, last_synced_uid, last_synced_at, user_id, is_active"
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    logger.error(`Error fetching email accounts for user ${userId}:`, error);
    throw new Error(`Failed to fetch email accounts for user ${userId}.`);
  }
  return data || [];
}

async function fetchNewslettersForUser(
  supabase: SupabaseClient<Database>,
  userAccountIds: string[]
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
      `Error fetching folders for accounts ${userAccountIds.join(", ")}:`,
      foldersError
    );
    return []; // Or throw, depending on desired error handling
  }

  if (!folders || folders.length === 0) {
    logger.info(`No folders found for accounts ${userAccountIds.join(", ")}.`);
    return [];
  }

  const folderIds = folders.map((f) => f.id);

  const { data: emails, error: emailsError } = await supabase
    .from("emails")
    .select("*") // Select all fields for now, can be optimized
    .in("account_id", userAccountIds)
    .in("folder_id", folderIds) // Filter by folders belonging to these accounts
    .eq("category", "newsletter") // Ensure this matches exactly what emailCategorizer uses
    .gte("received_at", sevenDaysAgo)
    .order("received_at", { ascending: false });

  if (emailsError) {
    logger.error(
      `Error fetching newsletters for accounts ${userAccountIds.join(", ")}:`,
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

        const accountIds = userEmailAccounts.map((acc) => acc.id);
        const newsletters = await fetchNewslettersForUser(supabase, accountIds);

        if (newsletters.length === 0) {
          logger.info(
            `No newsletters found for user ${userId} in the last 7 days. Skipping digest.`
          );
          // totalUsersProcessed++; // Count as processed, but no digest sent
          continue;
        }
        logger.info(
          `Found ${newsletters.length} newsletters to summarize for user ${userId}.`
        );

        const newsletterContentsToSummarize = newsletters.map((email) => ({
          subject: email.subject,
          from: email.from_name || email.from_email,
          content:
            email.body_text ||
            (email.body_html || "").replace(/<[^>]+>/g, " ").substring(0, 5000),
        }));

        const digestHtmlSummary = await generateDigestSummary(
          newsletterContentsToSummarize
        );

        const sendFromAccount = userEmailAccounts[0];
        let sendToEmail = sendFromAccount.email; // Default recipient

        // Attempt to find user's default email from user_settings
        const { data: userSetting } = await supabase
          .from("user_settings")
          .select("default_account_id")
          .eq("user_id", userId)
          .single();

        if (userSetting && userSetting.default_account_id) {
          const defaultAccount = userEmailAccounts.find(
            (acc) => acc.id === userSetting.default_account_id
          );
          if (defaultAccount) {
            sendToEmail = defaultAccount.email;
            logger.info(
              `Using default account email ${sendToEmail} for user ${userId}.`
            );
          }
        }

        await sendDigestEmail(
          sendFromAccount, // Send FROM this account
          sendToEmail, // Send TO this email (could be default or same as from)
          "Your Weekly Newsletter Digest",
          digestHtmlSummary
        );
        totalDigestsSent++;
        logger.info(
          `Weekly digest email successfully sent to ${sendToEmail} for user ${userId}.`
        );
        totalUsersProcessed++;
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
