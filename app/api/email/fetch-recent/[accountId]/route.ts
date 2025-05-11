import { createClient } from "@/lib/auth/server";
import { fetchRecentEmailUids } from "@/lib/email/fetchEmails";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  const supabase = await createClient();
  const { accountId } = params;

  if (!accountId) {
    return NextResponse.json(
      { message: "Account ID is required" },
      { status: 400 }
    );
  }

  // Check authorization
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Verify the account exists and belongs to the user
  const { data: account, error: accountError } = await supabase
    .from("email_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (accountError || !account) {
    return NextResponse.json(
      { message: "Account not found or not authorized" },
      { status: 404 }
    );
  }

  try {
    // Set limit from query parameter or default to 10
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    // Fetch the most recent email UIDs
    const uids = await fetchRecentEmailUids(accountId, limit);

    return NextResponse.json({
      message: "Fetched recent email UIDs successfully",
      count: uids.length,
      uids,
    });
  } catch (error) {
    console.error("Error in fetch-recent API:", error);
    return NextResponse.json(
      {
        message: "Failed to fetch recent emails",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
