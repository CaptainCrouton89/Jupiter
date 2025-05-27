import { createClient } from "@/lib/auth/server";
import { createNewSupabaseAdminClient } from "@/lib/auth/admin";
import { WeeklyDigestService } from "@/lib/email/digest/weeklyDigestService";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { message: "Account ID is required" },
        { status: 400 }
      );
    }

    // Verify the account belongs to the user
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("id, user_id")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { message: "Account not found or not authorized" },
        { status: 404 }
      );
    }

    // Create an admin client for the digest service
    const adminSupabase = createNewSupabaseAdminClient();

    // Initialize the digest service
    const digestService = new WeeklyDigestService(adminSupabase);

    // Process the digest for this specific user
    const result = await digestService.processUserDigest(user.id);

    if (result.success && result.digestsSent > 0) {
      return NextResponse.json({
        message: `Test digest${
          result.digestsSent > 1 ? "s" : ""
        } sent successfully! ${result.digestsSent} digest${
          result.digestsSent > 1 ? "s" : ""
        } were sent based on your preferences.`,
        digestsSent: result.digestsSent,
      });
    } else if (result.success && result.digestsSent === 0) {
      return NextResponse.json({
        message:
          "No digests were sent. Make sure you have digest enabled for at least one category with emails from the past 7 days.",
        digestsSent: 0,
      });
    } else {
      return NextResponse.json(
        { message: "Failed to send test digest" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Test digest error:", error);
    return NextResponse.json(
      {
        message: "An error occurred while sending the test digest",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}