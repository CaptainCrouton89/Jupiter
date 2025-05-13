import { createNewSupabaseAdminClient } from "@/lib/auth/admin";
import { NextResponse } from "next/server";

export const maxDuration = 60; // 1 minute should be sufficient

export async function GET(request: Request) {
  // 1. Authenticate the cron job request
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("[CronDeleteEmails] Unauthorized access attempt.");
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const supabase = await createNewSupabaseAdminClient();
  let deletedCount = 0;

  try {
    // 2. Calculate the date 14 days ago
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fourteenDaysAgoIsoString = fourteenDaysAgo.toISOString();

    console.log(
      `[CronDeleteEmails] Starting job. Deleting emails received before ${fourteenDaysAgoIsoString}.`
    );

    // 3. Delete emails older than 14 days
    // We delete in batches to avoid potential timeouts or resource limits
    const BATCH_SIZE = 1000; // Adjust batch size as needed
    let batchDeletedCount = 0;
    let totalDeletedCount = 0;

    do {
      batchDeletedCount = 0; // Reset for this batch
      const { data: emailsToDelete, error: selectError } = await supabase
        .from("emails")
        .select("id") // Only select IDs needed for deletion
        .lt("received_at", fourteenDaysAgoIsoString)
        .limit(BATCH_SIZE);

      if (selectError) {
        console.error(
          "[CronDeleteEmails] Error selecting batch of old emails:",
          selectError
        );
        throw new Error(
          `Failed to select batch of old emails: ${selectError.message}`
        );
      }

      if (emailsToDelete && emailsToDelete.length > 0) {
        const idsToDelete = emailsToDelete.map((email) => email.id);

        const { count, error: deleteError } = await supabase
          .from("emails")
          .delete()
          .in("id", idsToDelete);

        if (deleteError) {
          console.error(
            "[CronDeleteEmails] Error deleting batch of old emails:",
            deleteError
          );
          // Decide if you want to stop or continue with the next batch
          // For now, we'll throw an error to stop the job on failure
          throw new Error(
            `Failed to delete batch of old emails: ${deleteError.message}`
          );
        }

        batchDeletedCount = count || 0;
        totalDeletedCount += batchDeletedCount;
        console.log(
          `[CronDeleteEmails] Deleted batch of ${batchDeletedCount} emails.`
        );
      } else {
        // No more emails older than 14 days found in this batch check
        console.log("[CronDeleteEmails] No more old emails found to delete.");
      }
    } while (batchDeletedCount >= BATCH_SIZE); // Continue if the last batch was full

    deletedCount = totalDeletedCount;
    console.log(
      `[CronDeleteEmails] Job finished successfully. Deleted ${deletedCount} emails.`
    );

    return NextResponse.json({
      message: "Email deletion cron job executed successfully.",
      deletedCount: deletedCount,
    });
  } catch (error: any) {
    console.error("[CronDeleteEmails] Cron job failed:", error);
    return NextResponse.json(
      {
        error: "Cron job failed",
        details: error.message,
        deletedCount: deletedCount, // Report count even on failure
      },
      { status: 500 }
    );
  }
}
