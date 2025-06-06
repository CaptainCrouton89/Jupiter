import { createNewSupabaseAdminClient } from "@/lib/auth/admin"; // Using server client
import { NextResponse } from "next/server";
// Assume logger setup
// import { logger } from '@/lib/logger';

// Placeholder for Supabase client and logger for now
const supabase_placeholder = {
  from: (table: string) => ({
    select: (columns: string) => {
      // Mocking the behavior where select() itself can be awaited or chained with .eq()
      // For the immediate use case: await supabase.from('...').select('...')
      const mockEq = (column: string, value: any) =>
        Promise.resolve({
          data: [{ id: "1", email: "test@example.com" }],
          error: null,
        });
      const thenable = Promise.resolve({
        data: [{ id: "1", email: "test@example.com" }],
        error: null,
      });

      // Attach .eq to the thenable for chaining, though not strictly used by current linter error line
      (thenable as any).eq = mockEq;
      return thenable;
    },
  }),
};
const logger_placeholder = {
  info: (...args: any[]) => console.log(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};

// This function can be adjusted based on Vercel's recommendations for cron job execution time
export const maxDuration = 300; // 5 minutes

interface SyncAccountResponse {
  message: string;
  email: string;
  newUidsFetched: number;
  emailsSuccessfullyStored: number;
  emailsFailedToStore: number;
  lastUidEffectivelyProcessed: number;
}

export async function GET(request: Request) {
  // 1. Authenticate the cron job request (e.g., using a secret token)
  const authHeader = request.headers.get("authorization");
  console.log("authHeader", authHeader);
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const supabase = await createNewSupabaseAdminClient();

  // Initialize aggregate counters
  let totalUsersProcessed = 0;
  let totalAccountsSuccessfullySynced = 0;
  let totalAccountsFailedToSync = 0;
  let totalNewEmailsFetched = 0;
  let totalEmailsSuccessfullyStored = 0;
  let totalEmailsFailedToStore = 0;
  const processedUserIds = new Set<string>();

  try {
    // 2. Fetch all active email accounts
    const { data: accounts, error: fetchError } = await supabase
      .from("email_accounts")
      .select("id, email, user_id") // Ensure user_id is selected
      .eq("is_active", true); // Assuming an 'is_active' column

    if (fetchError) {
      console.error("Error fetching email accounts for cron:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch accounts", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      console.log("No active email accounts to sync.");
      return NextResponse.json({
        message: "No active email accounts to sync.",
        totalUsersProcessed,
        totalAccountsSuccessfullySynced,
        totalAccountsFailedToSync,
        totalNewEmailsFetched,
        totalEmailsSuccessfullyStored,
        totalEmailsFailedToStore,
      });
    }

    console.log(
      `Cron job starting: Found ${accounts.length} active email accounts to sync.`
    );

    // 3. For each account, trigger the individual sync endpoint
    //    Consider processing in parallel with a concurrency limit to avoid overwhelming the system/API.
    const syncPromises = accounts.map(async (account) => {
      if (account.user_id) {
        // Ensure user_id is present before adding
        processedUserIds.add(account.user_id);
      }
      try {
        // Construct the full URL for the internal sync endpoint
        const syncUrl = new URL(
          `/api/internal/sync-account/${account.id}`,
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        );

        console.log(
          `Triggering sync for account: ${account.email} (ID: ${
            account.id
          }) via ${syncUrl.toString()}`
        );

        const response = await fetch(syncUrl.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // If your internal sync endpoint requires auth, pass the necessary token
            // For example, using an internal system token different from the cron job secret
            Authorization: `Bearer ${
              process.env.INTERNAL_API_SECRET || process.env.CRON_JOB_SECRET
            }`,
          },
        });

        if (!response.ok) {
          const errorBody = await response.text(); // Read response body for more details
          console.error(
            `Failed to trigger sync for account ${account.id}. Status: ${response.status}. Body: ${errorBody}`
          );
          totalAccountsFailedToSync++;
        } else {
          const result: SyncAccountResponse = await response.json();
          console.log(
            `Successfully synced account ${account.id}. Fetched: ${result.newUidsFetched}, Stored: ${result.emailsSuccessfullyStored}`
          );
          totalAccountsSuccessfullySynced++;
          totalNewEmailsFetched += result.newUidsFetched || 0;
          totalEmailsSuccessfullyStored += result.emailsSuccessfullyStored || 0;
          totalEmailsFailedToStore += result.emailsFailedToStore || 0;
        }
      } catch (syncError: any) {
        console.error(
          `Error triggering sync for account ${account.id}:`,
          syncError
        );
        totalAccountsFailedToSync++;
      }
    });

    await Promise.all(syncPromises); // Wait for all sync triggers to complete (or fail)

    totalUsersProcessed = processedUserIds.size;

    console.log(
      `Cron job finished. Users: ${totalUsersProcessed}, Accounts OK: ${totalAccountsSuccessfullySynced}, Accounts Fail: ${totalAccountsFailedToSync}, New Fetched: ${totalNewEmailsFetched}, Stored OK: ${totalEmailsSuccessfullyStored}, Store Fail: ${totalEmailsFailedToStore}`
    );
    return NextResponse.json({
      message: "Email sync cron job executed.",
      totalUsersProcessed,
      totalAccountsSuccessfullySynced,
      totalAccountsFailedToSync,
      totalNewEmailsFetched,
      totalEmailsSuccessfullyStored,
      totalEmailsFailedToStore,
      details: accounts.map((acc) => acc.id), // Optional: list of account IDs processed
    });
  } catch (error: any) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      {
        error: "Cron job failed",
        details: error.message,
        // Return partial stats if available, or defaults
        totalUsersProcessed,
        totalAccountsSuccessfullySynced,
        totalAccountsFailedToSync,
        totalNewEmailsFetched,
        totalEmailsSuccessfullyStored,
        totalEmailsFailedToStore,
      },
      { status: 500 }
    );
  }
}
