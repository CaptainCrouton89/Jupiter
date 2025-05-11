import { createClient } from "@/lib/auth/server"; // Using server client
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

export async function POST(request: Request) {
  // 1. Authenticate the cron job request (e.g., using a secret token)
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];

  if (token !== process.env.CRON_JOB_SECRET) {
    console.warn("Unauthorized cron job attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  let accountsProcessed = 0;
  let accountsFailed = 0;

  try {
    // 2. Fetch all active email accounts
    const { data: accounts, error: fetchError } = await supabase
      .from("email_accounts")
      .select("id, email") // Only select necessary fields
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
        accountsProcessed,
        accountsFailed,
      });
    }

    console.log(
      `Cron job starting: Found ${accounts.length} active email accounts to sync.`
    );

    // 3. For each account, trigger the individual sync endpoint
    //    Consider processing in parallel with a concurrency limit to avoid overwhelming the system/API.
    const syncPromises = accounts.map(async (account) => {
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
          accountsFailed++;
        } else {
          console.log(`Successfully triggered sync for account ${account.id}`);
          accountsProcessed++;
        }
      } catch (syncError: any) {
        console.error(
          `Error triggering sync for account ${account.id}:`,
          syncError
        );
        accountsFailed++;
      }
    });

    await Promise.all(syncPromises); // Wait for all sync triggers to complete (or fail)

    console.log(
      `Cron job finished. Processed: ${accountsProcessed}, Failed: ${accountsFailed}`
    );
    return NextResponse.json({
      message: "Cron job executed.",
      accountsProcessed,
      accountsFailed,
    });
  } catch (error: any) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      { error: "Cron job failed", details: error.message },
      { status: 500 }
    );
  }
}
