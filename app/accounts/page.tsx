import { ConnectedAccountsList } from "@/components/email/ConnectedAccountsList";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/auth/server"; // Assuming this is your server-side Supabase client helper
import { Database } from "@/lib/database.types";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AccountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: accounts, error: accountsError } = await supabase
    .from("email_accounts")
    .select(
      "id, name, email, provider, imap_host, imap_port, smtp_host, smtp_port, is_active, last_synced_at, last_synced_uid"
    ) // Added 'provider' field
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (accountsError) {
    // It's better to show an error message on the page than just console logging
    console.error("Error fetching accounts:", accountsError);
    // We can pass this error to the UI if needed, or show a generic message
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Connected Accounts
          </h1>
          <p className="text-muted-foreground">
            Manage your connected email accounts.
          </p>
        </div>
        <Link href="/accounts/connect">
          <Button>Connect New Account</Button>
        </Link>
      </div>

      {accountsError && (
        <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          <p>
            Could not load your email accounts. Error: {accountsError.message}
          </p>
        </div>
      )}
      <ConnectedAccountsList
        accounts={
          (accounts as Database["public"]["Tables"]["email_accounts"]["Row"][]) ||
          []
        }
      />
    </div>
  );
}
