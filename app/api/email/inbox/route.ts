import { createClient } from "@/lib/auth/server"; // Assuming server-side Supabase client
import { Database } from "@/lib/database.types";
import { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Define the structure of the email data we want to return
export interface InboxEmail {
  id: string;
  from_name: string | null;
  from_email: string;
  subject: string | null;
  preview: string | null; // A short preview of the email body
  received_at: string; // ISO date string
  read: boolean;
  starred: boolean;
  has_attachments: boolean;
  account_id: string; // To know which account it belongs to, useful for account-specific actions later
  message_id: string | null;
}

// Helper to generate a preview from text
// This is a very basic preview generator, can be improved
function generatePreview(text: string | null, maxLength = 100): string | null {
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export async function GET(request: Request) {
  const supabase: SupabaseClient<Database> = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all email accounts linked to the user
    const { data: userAccounts, error: accountsError } = await supabase
      .from("email_accounts")
      .select("id")
      .eq("user_id", user.id);

    if (accountsError) {
      console.error("Error fetching user accounts:", accountsError);
      return NextResponse.json(
        { error: "Failed to fetch user accounts" },
        { status: 500 }
      );
    }

    if (!userAccounts || userAccounts.length === 0) {
      return NextResponse.json({ emails: [] }); // No accounts, so no emails
    }

    // Explicitly type 'acc'
    const accountIds = userAccounts.map((acc: { id: string }) => acc.id);

    // Fetch emails from the 'emails' table for all linked accounts
    const { data: emailsData, error: emailsError } = await supabase
      .from("emails")
      .select(
        "id, from_name, from_email, subject, body_text, received_at, read, starred, has_attachments, account_id, message_id"
      )
      .in("account_id", accountIds)
      .order("received_at", { ascending: false })
      .limit(50); // Add a sensible limit for now

    if (emailsError) {
      console.error("Error fetching emails:", emailsError);
      return NextResponse.json(
        { error: "Failed to fetch emails" },
        { status: 500 }
      );
    }

    // Explicitly type 'email' based on the select query
    // This type can be more precisely derived from Database types if needed
    const inboxEmails: InboxEmail[] = emailsData.map((email: any) => ({
      id: email.id,
      from_name: email.from_name,
      from_email: email.from_email,
      subject: email.subject,
      preview: generatePreview(email.body_text),
      received_at: email.received_at,
      read: email.read,
      starred: email.starred,
      has_attachments: email.has_attachments,
      account_id: email.account_id,
      message_id: email.message_id,
    }));

    return NextResponse.json({ emails: inboxEmails });
  } catch (error) {
    console.error("Unexpected error in inbox API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
