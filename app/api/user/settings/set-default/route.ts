import { createClient } from "@/lib/auth/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { accountId } = await request.json();

    if (!accountId || typeof accountId !== "string") {
      return NextResponse.json(
        { message: "accountId is required and must be a string" },
        { status: 400 }
      );
    }

    // Check if the accountId belongs to the user to prevent unauthorized changes
    const { data: accountData, error: accountError } = await supabase
      .from("email_accounts")
      .select("id")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !accountData) {
      return NextResponse.json(
        { message: "Invalid accountId or account does not belong to user." },
        { status: 404 }
      );
    }

    // Upsert user settings
    const { error: upsertError } = await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        default_account_id: accountId,
        updated_at: new Date().toISOString(), // Explicitly set updated_at
      },
      {
        onConflict: "user_id", // If user_id already exists, update the row
      }
    );

    if (upsertError) {
      console.error("Error upserting user settings:", upsertError);
      return NextResponse.json(
        {
          message: "Failed to update default account.",
          error: upsertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Default account updated successfully.",
    });
  } catch (error: any) {
    console.error("Set default account API error:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred.", error: error.message },
      { status: 500 }
    );
  }
}
