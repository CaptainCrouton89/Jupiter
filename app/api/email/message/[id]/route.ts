import { getSupabaseAdminClient } from "@/lib/auth/admin"; // Assuming this is the correct path
import { Database } from "@/lib/database.types";
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
  { params }: { params: { id: string } }
) {
  const emailId = params.id;

  if (!emailId) {
    return NextResponse.json(
      { error: "Email ID is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();

  try {
    // Fetch email data from 'emails' table
    const { data: emailData, error: emailError } = await supabase
      .from("emails")
      .select(
        `
        id,
        subject,
        from_name,
        from_email,
        body_html,
        received_at
      `
      )
      .eq("id", emailId)
      .single();

    if (emailError) {
      if (emailError.code === "PGRST116") {
        // "Searched for a single row, but 0 rows were found"
        return NextResponse.json({ error: "Email not found" }, { status: 404 });
      }
      console.error(`Error fetching email ${emailId}:`, emailError);
      return NextResponse.json(
        { error: `Database error: ${emailError.message}` },
        { status: 500 }
      );
    }

    if (!emailData) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Fetch attachments for this email from 'attachments' table
    const { data: attachmentsData, error: attachmentsError } = await supabase
      .from("attachments")
      .select(
        `filename,
        content_type,
        size
      `
      )
      .eq("email_id", emailId);

    if (attachmentsError) {
      console.error(
        `Error fetching attachments for email ${emailId}:`,
        attachmentsError
      );
      // Non-critical, proceed without attachments if query fails
    }

    // Map to the structure expected by the EmailViewPage (EmailDetails interface)
    // Note: EmailViewPage's EmailDetails has toName, toEmail, ccEmails, bccEmails
    // which we are not directly providing from the 'emails' table yet.
    const responseData: FetchedEmailDetails = {
      id: emailData.id,
      subject: emailData.subject,
      fromName: emailData.from_name,
      fromEmail: emailData.from_email,
      bodyHtml: emailData.body_html,
      receivedAt: emailData.received_at,
      attachments: ((attachmentsData as AttachmentRow[]) || []).map((att) => ({
        name: att.filename || "unnamed_attachment",
        size: att.size,
        type: att.content_type,
        url: "#", // Placeholder URL for now
      })),
    };

    // The EmailViewPage's EmailDetails expects toName, toEmail.
    // We need to map these explicitly for now even if they are placeholders.
    const finalResponse = {
      ...responseData,
      toName: null, // Placeholder, or derive if possible
      toEmail: "", // Placeholder, or derive if possible
      // ccEmails and bccEmails will be undefined, matching optional fields in EmailDetails
    };

    return NextResponse.json(finalResponse);
  } catch (error) {
    console.error("Unexpected error in GET /api/email/message/[id]:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected server error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
