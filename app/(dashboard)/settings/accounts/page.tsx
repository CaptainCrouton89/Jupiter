import { ConnectedAccountsList } from "@/components/email/ConnectedAccountsList";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/auth/server";
import { Database } from "@/lib/database.types";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AccountsSettingsPage() {
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
    .select("id, name, email, imap_host, imap_port, smtp_host, smtp_port")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (accountsError) {
    console.error("Error fetching accounts:", accountsError);
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Connected Accounts
        </h1>
        <p className="text-muted-foreground">
          Manage your connected email accounts.
        </p>
      </div>
      <div className="mb-6 flex justify-end">
        <Link href="/settings/accounts/connect">
          <Button>Connect New Account</Button>
        </Link>
      </div>
      {accountsError && (
        <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          <p>Could not load your email accounts. Please try again later.</p>
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
