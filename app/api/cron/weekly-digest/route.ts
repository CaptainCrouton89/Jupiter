import { createNewSupabaseAdminClient } from "@/lib/auth/admin";
import { WeeklyDigestService } from "@/lib/email/digest/weeklyDigestService";
import { NextRequest, NextResponse } from "next/server";

// Placeholder for a more robust logger if you have one
const logger = {
  info: (...args: any[]) => console.log("[WeeklyDigestRoute INFO]", ...args),
  warn: (...args: any[]) => console.warn("[WeeklyDigestRoute WARN]", ...args),
  error: (...args: any[]) =>
    console.error("[WeeklyDigestRoute ERROR]", ...args),
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

export async function GET(request: NextRequest) {
  logger.info("Weekly digest cron job for ALL USERS started.");

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized attempt to access weekly digest cron.");
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createNewSupabaseAdminClient();
  const digestService = new WeeklyDigestService(supabase);

  try {
    const { totalUsersProcessed, totalUsersFailed, totalDigestsSent } =
      await digestService.processAllUserDigests();

    logger.info(
      `Weekly digest cron job finished. Users Processed: ${totalUsersProcessed}, Users Failed: ${totalUsersFailed}, Digests Sent: ${totalDigestsSent}`
    );
    return NextResponse.json({
      message: "Weekly digest cron job executed successfully.",
      usersProcessed: totalUsersProcessed,
      usersFailed: totalUsersFailed,
      digestsSent: totalDigestsSent,
    });
  } catch (error: any) {
    logger.error(
      "General failure in weekly digest cron job execution:",
      error.message,
      error.stack
    );
    return NextResponse.json(
      {
        error: "Weekly digest cron job failed",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
