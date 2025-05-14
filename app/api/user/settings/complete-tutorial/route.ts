import { createClient } from "@/lib/auth/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { error: updateError } = await supabase
      .from("user_settings")
      .update({ tutorial_completed: true })
      .eq("user_id", user.id);

    if (updateError) {
      // If no user_settings row exists, create one
      if (
        updateError.code === "PGRST116" ||
        updateError.message.includes("No rows found")
      ) {
        // PGRST116 is 'No rows found' for .single()
        // Let's try to upsert, or insert if not found, then update.
        // A cleaner way is to ensure user_settings is created on sign-up.
        // For now, we'll try an insert then update approach if the update failed to find a row.
        const { error: insertError } = await supabase
          .from("user_settings")
          .insert({ user_id: user.id, tutorial_completed: true });

        if (insertError) {
          console.error(
            "Error inserting user_settings for tutorial completion:",
            insertError
          );
          return NextResponse.json(
            {
              error: "Failed to create user settings to complete tutorial.",
              details: insertError.message,
            },
            { status: 500 }
          );
        }
      } else {
        console.error("Error updating tutorial_completed status:", updateError);
        return NextResponse.json(
          {
            error: "Failed to update tutorial status.",
            details: updateError.message,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ message: "Tutorial completed successfully." });
  } catch (e: any) {
    console.error("Unexpected error completing tutorial:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred.", details: e.message },
      { status: 500 }
    );
  }
}
