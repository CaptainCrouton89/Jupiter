import { createClient } from "@/lib/auth/server"; // Assuming server-side Supabase client
import { Database } from "@/lib/database.types";
import { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server"; // Added NextRequest

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

export async function GET(request: NextRequest) {
  // Changed to NextRequest
  const supabase: SupabaseClient<Database> = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get page and limit from query parameters
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);
  const folderType = url.searchParams.get("folderType"); // Get folderType

  if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
    return NextResponse.json(
      { error: "Invalid pagination parameters" },
      { status: 400 }
    );
  }

  const startIndex = (page - 1) * limit;
  const endIndex = page * limit - 1;

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
      return NextResponse.json({
        emails: [],
        totalEmails: 0,
        hasNextPage: false,
      });
    }

    // Explicitly type 'acc'
    const accountIds = userAccounts.map((acc: { id: string }) => acc.id);

    let folderIdsToFilter: string[] | null = null;

    if (folderType) {
      const { data: folders, error: foldersError } = await supabase
        .from("folders")
        .select("id")
        .in("account_id", accountIds)
        .eq("type", folderType);

      if (foldersError) {
        console.error(`Error fetching ${folderType} folders:`, foldersError);
        return NextResponse.json(
          { error: `Failed to fetch ${folderType} folder IDs` },
          { status: 500 }
        );
      }
      folderIdsToFilter = folders ? folders.map((f) => f.id) : [];
      if (folderIdsToFilter.length === 0) {
        // If no folders of the specified type exist, return empty results
        return NextResponse.json({
          emails: [],
          totalEmails: 0,
          hasNextPage: false,
          currentPage: page,
        });
      }
    }

    // Base query for emails
    let emailQuery = supabase
      .from("emails")
      .select(
        "id, from_name, from_email, subject, body_text, received_at, read, starred, has_attachments, account_id, message_id",
        { count: "exact" } // Request total count along with data
      )
      .in("account_id", accountIds);

    // Apply folder ID filter if folderType was specified and folder IDs were found
    if (folderIdsToFilter) {
      emailQuery = emailQuery.in("folder_id", folderIdsToFilter);
    }

    // Apply ordering and pagination
    emailQuery = emailQuery
      .order("received_at", { ascending: false })
      .range(startIndex, endIndex);

    const {
      data: emailsData,
      error: emailsError,
      count: totalEmails,
    } = await emailQuery;

    if (emailsError) {
      console.error("Error fetching emails:", emailsError);
      return NextResponse.json(
        { error: "Failed to fetch emails" },
        { status: 500 }
      );
    }

    const totalEmailsCount = totalEmails || 0;

    // Explicitly type 'email' based on the select query
    // This type can be more precisely derived from Database types if needed
    const inboxEmails: InboxEmail[] = (emailsData || []).map((email: any) => ({
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

    const hasNextPage = endIndex < totalEmailsCount - 1;

    return NextResponse.json({
      emails: inboxEmails,
      totalEmails: totalEmailsCount,
      hasNextPage: hasNextPage,
      currentPage: page,
    });
  } catch (error) {
    console.error("Unexpected error in inbox API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
