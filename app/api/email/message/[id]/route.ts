import { getServerSession } from "@/lib/auth/server"; // Updated imports
import type { Database } from "@/lib/database.types"; // Ensure correct path and import type
import { NextResponse } from "next/server";

// Corresponds to EmailDetails in app/(dashboard)/[folder]/[id]/page.tsx
// but we'll fetch based on what's in the 'emails' and 'attachments' tables.
interface FetchedEmailDetails {
  id: string;
  subject: string | null;
  fromName: string | null; // from 'emails' table
  fromEmail: string; // from 'emails' table
  // For 'to', 'cc', 'bcc' - these are not directly on the 'emails' table per storeEmail.ts
  // We'll need to derive them or add them to the schema later.
  // For now, the EmailViewPage will handle their absence or use placeholders.
  bodyHtml: string | null; // from 'emails' table
  receivedAt: string; // from 'emails' table (should be ISO string)
  attachments: {
    name: string;
    size: number | null;
    type: string | null;
    url: string;
  }[]; // from 'attachments' table
}

// Define a more specific type for what we expect from the attachments query
type AttachmentRow = Database["public"]["Tables"]["attachments"]["Row"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: emailId } = await params;

  if (!emailId) {
    return NextResponse.json(
      { error: "Email ID is required" },
      { status: 400 }
    );
  }

  try {
    const { user, supabase } = await getServerSession(); // Use getServerSession
    // const supabase = await createClient(); // Or create client separately if session isn't needed immediately for other logic

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: email, error } = await supabase // Use the supabase instance from getServerSession
      .from("emails")
      .select(
        `
        *,
        attachments (
          id,
          filename,
          content_type,
          size,
          storage_path
        )
      `
      )
      .eq("id", emailId)
      // Ensure RLS policies on 'emails' and 'email_accounts' correctly restrict access to user's own data.
      // The user_id from the session can be used by RLS.
      .single();

    if (error) {
      console.error("Error fetching email:", error);
      if (error.code === "PGRST116") {
        // Not found
        return NextResponse.json({ error: "Email not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Failed to fetch email" },
        { status: 500 }
      );
    }

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    return NextResponse.json(email);
  } catch (err) {
    console.error("Unexpected error fetching email:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: emailId } = await params;
  const { read } = await request.json(); // Expecting { read: boolean }

  if (!emailId) {
    return NextResponse.json(
      { error: "Email ID is required" },
      { status: 400 }
    );
  }
  if (typeof read !== "boolean") {
    return NextResponse.json(
      { error: "'read' status (boolean) is required in the request body" },
      { status: 400 }
    );
  }

  try {
    const { user, supabase } = await getServerSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First, verify the user has access to this email via RLS or an explicit check
    // (RLS is preferred)
    // As a basic check, we can fetch the email and see if RLS allows it.
    // This also confirms the email exists before attempting an update.
    const { data: existingEmail, error: fetchError } = await supabase
      .from("emails")
      .select("id, account_id") // Select minimal fields, account_id might be needed for further auth checks
      .eq("id", emailId)
      .single();

    if (fetchError || !existingEmail) {
      if (fetchError && fetchError.code === "PGRST116") {
        return NextResponse.json({ error: "Email not found" }, { status: 404 });
      }
      console.error(
        "Error fetching email for status update (pre-check):",
        fetchError
      );
      return NextResponse.json(
        { error: "Failed to verify email before update" },
        { status: 500 }
      );
    }

    // Here you might add another check if RLS isn't fully covering the case:
    // e.g., check if existingEmail.account_id belongs to an account owned by user.id

    const { data, error: updateError } = await supabase
      .from("emails")
      .update({ read: read, updated_at: new Date().toISOString() })
      .eq("id", emailId)
      .select("id, read, updated_at") // Return the updated fields
      .single();

    if (updateError) {
      console.error("Error updating email read status:", updateError);
      return NextResponse.json(
        { error: "Failed to update email status" },
        { status: 500 }
      );
    }

    if (!data) {
      // Should not happen if the pre-check passed and update didn't error, but good practice
      return NextResponse.json(
        { error: "Email not found after update attempt" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Unexpected error updating email status:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
