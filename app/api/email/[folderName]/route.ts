import { createClient } from "@/lib/auth/server";
import { Database } from "@/lib/database.types";
import { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Define the structure of the email data we want to return
export interface FolderEmail {
  id: string;
  from_name: string | null;
  from_email: string;
  subject: string | null;
  preview: string | null;
  received_at: string;
  read: boolean;
  starred: boolean;
  has_attachments: boolean;
  account_id: string;
  message_id: string | null;
  category: string;
}

function generatePreview(text: string | null, maxLength = 100): string | null {
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ folderName: string }> }
) {
  const supabase: SupabaseClient<Database> = await createClient();
  const { folderName } = await params;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);

  // Sanitize folderName to ensure it's a string and reasonable (e.g., capitalize first letter)
  // For direct use, ensure your folder names in DB match what comes from path (e.g. "inbox", "Spam")
  const targetFolderName = folderName.toUpperCase();

  if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
    return NextResponse.json(
      { error: "Invalid pagination parameters" },
      { status: 400 }
    );
  }

  const startIndex = (page - 1) * limit;
  const endIndex = page * limit - 1;

  try {
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

    const accountIds = userAccounts.map((acc: { id: string }) => acc.id);
    console.log("folderName", targetFolderName);

    const { data: folders, error: foldersError } = await supabase
      .from("folders")
      .select("id")
      .in("account_id", accountIds)
      .eq("name", targetFolderName); // Use targetFolderName from path param

    console.log("folders", folders);

    if (foldersError) {
      console.error(
        `Error fetching '${targetFolderName}' folders:`,
        foldersError
      );
      return NextResponse.json(
        { error: `Failed to fetch '${targetFolderName}' folder IDs` },
        { status: 500 }
      );
    }

    const folderIdsToFilter = folders ? folders.map((f) => f.id) : [];

    if (folderIdsToFilter.length === 0) {
      console.warn(
        `No '${targetFolderName}' folders found for user ${
          user.id
        } across accounts: ${accountIds.join(", ")}`
      );
      return NextResponse.json({
        emails: [],
        totalEmails: 0,
        hasNextPage: false,
        currentPage: page,
      });
    }

    let emailQuery = supabase
      .from("emails")
      .select(
        "id, from_name, from_email, subject, body_text, received_at, read, starred, has_attachments, account_id, message_id, category",
        { count: "exact" }
      )
      .in("account_id", accountIds)
      .in("folder_id", folderIdsToFilter);

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

    const fetchedEmails: FolderEmail[] = (emailsData || []).map(
      (email: any) => ({
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
        category: email.category,
      })
    );

    const hasNextPage = endIndex < totalEmailsCount - 1;

    return NextResponse.json({
      emails: fetchedEmails,
      totalEmails: totalEmailsCount,
      hasNextPage: hasNextPage,
      currentPage: page,
    });
  } catch (error) {
    console.error(`Unexpected error in /api/email/${targetFolderName}:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
