import { Database } from "@/lib/database.types";
import { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
// import { logger as defaultLogger } from "./logger"; // Not strictly needed if logger is passed in
import { updateSyncLog } from "./supabaseOps";

export async function handleSyncFailure(
  supabase: SupabaseClient<Database>,
  logger: any, // Expect logger to be passed in
  jobId: string,
  error: any,
  httpStatus: number,
  userMessage: string,
  processedCount?: number
): Promise<NextResponse> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(
    `Sync failure for job ${jobId}: ${userMessage} - Details: ${errorMessage}`
  );
  if (error instanceof Error && error.stack) {
    logger.error("Stack trace:", error.stack);
  }

  await updateSyncLog(
    supabase,
    jobId,
    "failed",
    `${userMessage}: ${errorMessage}`.substring(0, 255),
    true, // isTerminal
    processedCount
  );

  return NextResponse.json(
    { error: userMessage, details: errorMessage },
    { status: httpStatus }
  );
}
