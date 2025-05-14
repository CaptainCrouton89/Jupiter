import { createNewSupabaseAdminClient } from "@/lib/auth/admin";
import { NextResponse } from "next/server";

export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
  // 1. Authenticate the cron job request
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const supabase = await createNewSupabaseAdminClient();
  const now = new Date();
  let updatedCount = 0;
  let errorCount = 0;

  console.log(
    `[Cron-ResetCategorization] Starting monthly categorization reset at ${now}.`
  );

  try {
    // Fetch all user settings. In a very large system, consider pagination.
    const { data: userSettings, error: fetchError } = await supabase
      .from("user_settings")
      .select("id, user_id, last_categorization_reset_at, emails_since_reset"); // Select only necessary fields

    if (fetchError) {
      console.error(
        "[Cron-ResetCategorization] Error fetching user settings:",
        fetchError
      );
      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch user settings for reset.",
          error: fetchError.message,
        },
        { status: 500 }
      );
    }

    if (!userSettings || userSettings.length === 0) {
      console.log(
        "[Cron-ResetCategorization] No user settings found to reset."
      );
      return NextResponse.json({
        success: true,
        message: "No user settings found to reset.",
        updatedCount: 0,
      });
    }

    console.log(
      `[Cron-ResetCategorization] Found ${userSettings.length} user settings records to process.`
    );

    for (const setting of userSettings) {
      // Only update if it's a month old
      if (
        new Date(setting.last_categorization_reset_at) <
        new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      ) {
        const { error: updateError } = await supabase
          .from("user_settings")
          .update({
            emails_since_reset: 0,
            last_categorization_reset_at: now.toISOString(),
          })
          .eq("id", setting.id);

        if (updateError) {
          console.error(
            `[Cron-ResetCategorization] Error resetting categorization count for user_settings ID ${setting.id} (User ID: ${setting.user_id}):`,
            updateError
          );
          errorCount++;
        } else {
          updatedCount++;
        }
      }
    }

    console.log(
      `[Cron-ResetCategorization] Finished. Successfully reset ${updatedCount} records. Failed to reset ${errorCount} records.`
    );

    return NextResponse.json({
      success: true,
      message: "Monthly email categorization counts reset.",
      totalRecordsProcessed: userSettings.length,
      successfullyReset: updatedCount,
      failedToReset: errorCount,
    });
  } catch (error: any) {
    console.error(
      "[Cron-ResetCategorization] Unhandled error during cron job execution:",
      error
    );
    return NextResponse.json(
      {
        success: false,
        message: "Cron job failed with an unhandled error.",
        error: error.message,
        updatedCount,
        errorCount,
      },
      { status: 500 }
    );
  }
}
