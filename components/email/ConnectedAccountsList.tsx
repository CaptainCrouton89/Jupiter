"use client";

import { EmailConnectionForm } from "@/components/email/EmailConnectionForm";
import { TestEmailFetch } from "@/components/email/TestEmailFetch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Database } from "@/lib/database.types";
import { EmailConnectionFormValues } from "@/lib/validations/email";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
// import { MoreHorizontal } from "lucide-react"; // For a potential dropdown menu
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";

// Define the type for a single account, using the Row type from generated Supabase types
// Also adding fields that might come from the database or be derived client-side
export type AccountForList =
  Database["public"]["Tables"]["email_accounts"]["Row"] & {
    is_connected?: boolean; // Placeholder, actual status logic TBD
    // last_synced?: string | null; // Example for future use
  };

interface ConnectedAccountsListProps {
  accounts: AccountForList[];
  // onEdit?: (account: Account) => void; // Define later
  // onDelete?: (accountId: string) => void; // Define later
  // onTestConnection?: (accountId: string) => void; // Define later
}

// Helper to format date, can be moved to a utils file
// const formatDate = (dateString: string | null | undefined) => {
//   if (!dateString) return "Never";
//   try {
//     return new Date(dateString).toLocaleDateString("en-US", {
//       year: "numeric",
//       month: "short",
//       day: "numeric",
//       hour: "2-digit",
//       minute: "2-digit",
//     });
//   } catch (e) {
//     return "Invalid Date";
//   }
// };

export function ConnectedAccountsList({
  accounts,
}: ConnectedAccountsListProps) {
  const router = useRouter();
  const [editingAccount, setEditingAccount] = useState<AccountForList | null>(
    null
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [accountToDelete, setAccountToDelete] = useState<AccountForList | null>(
    null
  );
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // State for testing connection
  const [isTestingConnection, setIsTestingConnection] = useState<string | null>(
    null
  ); // Store ID of account being tested
  // State for showing email fetch test UI
  const [emailFetchTestAccount, setEmailFetchTestAccount] = useState<
    string | null
  >(null);

  const handleEditClick = (account: AccountForList) => {
    setEditingAccount(account);
    setIsEditModalOpen(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setEditingAccount(null); // Clear editing account when modal closes
  };

  const handleEditSubmit = async (values: EmailConnectionFormValues) => {
    if (!editingAccount) return;
    setIsSubmittingEdit(true);
    try {
      const response = await fetch(`/api/email/accounts/${editingAccount.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.message || "Failed to update account.");
        return;
      }
      toast.success(data.message || "Account updated successfully!");
      handleEditModalClose();
      router.refresh(); // Refresh the page to show updated accounts list
    } catch (error) {
      toast.error("An unexpected error occurred while updating the account.");
      console.error("Update account error:", error);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const placeholderTestConnectionEdit = async (
    values: EmailConnectionFormValues
  ): Promise<boolean> => {
    toast.info(
      "Test connection for an existing account is not yet fully implemented in this edit form. Please save changes first."
    );
    // In a real scenario for edit, this might re-test with potentially updated values before saving,
    // or we might have a separate 'Test' button on the card itself.
    // For now, returning false as this form's primary goal is to save.
    return false;
  };

  const placeholderInitiateOAuth = (provider: "google" | "microsoft") => {
    toast.info(
      `OAuth connection for ${provider} is typically done when adding a new account.`
    );
    console.log(
      `Placeholder: Initiate OAuth for ${provider} from edit form. This might be for re-authentication.`
    );
    // This function might be used in the future if re-authentication is needed
    // or if we allow changing connection type, though that's less common for OAuth.
  };

  const handleDeleteClick = (account: AccountForList) => {
    setAccountToDelete(account);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!accountToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/email/accounts/${accountToDelete.id}`,
        {
          method: "DELETE",
        }
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.message || "Failed to delete account.");
        return;
      }
      toast.success(data.message || "Account deleted successfully!");
      setIsDeleteAlertOpen(false);
      setAccountToDelete(null);
      router.refresh();
    } catch (error) {
      toast.error("An unexpected error occurred while deleting the account.");
      console.error("Delete account error:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestConnection = async (
    accountId: string,
    accountEmail: string
  ) => {
    setIsTestingConnection(accountId);
    toast.info(`Testing connection for ${accountEmail}...`);
    try {
      const response = await fetch(
        `/api/email/accounts/${accountId}/test-connection`,
        {
          method: "POST",
        }
      );
      const data = await response.json();
      if (!response.ok) {
        let errorMessage = `Failed to connect to ${accountEmail}.`;
        if (data.message) errorMessage += ` ${data.message}`;
        if (data.imap?.error) errorMessage += ` IMAP: ${data.imap.error}`;
        if (data.smtp?.error) errorMessage += ` SMTP: ${data.smtp.error}`;
        toast.error(errorMessage, { duration: 8000 });
      } else {
        toast.success(
          data.message || `Successfully connected to ${accountEmail}!`
        );
        // Optionally refresh data or update a connection status field here if implemented
        // router.refresh();
      }
    } catch (error) {
      toast.error(
        `An unexpected error occurred while testing connection for ${accountEmail}.`
      );
      console.error("Test connection error:", error);
    } finally {
      setIsTestingConnection(null);
    }
  };

  if (accounts.length === 0) {
    return (
      <>
        <div className="mb-6 flex items-center">
          <Link href="/settings" passHref>
            <Button variant="outline" size="sm">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Settings
            </Button>
          </Link>
        </div>
        <div className="text-center text-muted-foreground py-8">
          <p>No connected accounts yet.</p>
          <p>Click the button above to connect your first email account.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center">
        <Link href="/settings" passHref>
          <Button variant="outline" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Button>
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => {
          // Log every account object being processed
          console.log(
            "Processing account:",
            JSON.parse(JSON.stringify(account))
          );

          let accountDetailsJsx: React.ReactNode;

          if (account.provider) {
            console.log(
              `Account ${account.email || account.id} (ID: ${
                account.id
              }) - Showing provider: '${account.provider}'`
            );
            accountDetailsJsx = (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Connected via
                  </p>
                  <p className="text-sm text-foreground font-semibold capitalize">
                    {account.provider}
                  </p>
                </div>
              </div>
            );
          } else if (account.imap_host && account.smtp_host) {
            console.log(
              `Account ${account.email || account.id} (ID: ${
                account.id
              }) - Showing IMAP/SMTP`
            );
            accountDetailsJsx = (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    IMAP Server
                  </p>
                  <p className="text-sm text-foreground break-all">
                    {account.imap_host || (
                      <span className="italic">Not set</span>
                    )}
                    :{account.imap_port || <span className="italic">N/A</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    SMTP Server
                  </p>
                  <p className="text-sm text-foreground break-all">
                    {account.smtp_host || (
                      <span className="italic">Not set</span>
                    )}
                    :{account.smtp_port || <span className="italic">N/A</span>}
                  </p>
                </div>
              </div>
            );
          } else {
            console.log(
              `Account ${account.email || account.id} (ID: ${
                account.id
              }) - Showing incomplete/other message. Provider: '${
                account.provider
              }', IMAP: '${account.imap_host}', SMTP: '${account.smtp_host}'`
            );
            return (
              <p className="text-muted-foreground italic">
                Configuration details are incomplete or not applicable.
              </p>
            );
          }

          return (
            <div key={account.id} className="space-y-4">
              <Card className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle
                        className="text-lg truncate"
                        title={account.name || account.email}
                      >
                        {account.name || "Unnamed Account"}
                      </CardTitle>
                      <CardDescription
                        className="truncate"
                        title={account.email}
                      >
                        {account.email}
                      </CardDescription>
                    </div>
                    {/* Replace connection status badge with authentication type badge */}
                    <Badge variant="outline">
                      {account.provider ? "OAuth 2.0" : "Password / Manual"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow pt-4 text-sm">
                  {accountDetailsJsx}
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      handleTestConnection(account.id, account.email)
                    }
                    disabled={isTestingConnection === account.id}
                  >
                    {isTestingConnection === account.id ? "Testing..." : "Test"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      setEmailFetchTestAccount(
                        emailFetchTestAccount === account.id ? null : account.id
                      )
                    }
                  >
                    {emailFetchTestAccount === account.id
                      ? "Hide Fetch"
                      : "Fetch Emails"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => handleEditClick(account)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => handleDeleteClick(account)}
                    disabled={isDeleting && accountToDelete?.id === account.id}
                  >
                    {isDeleting && accountToDelete?.id === account.id
                      ? "Removing..."
                      : "Remove"}
                  </Button>
                </CardFooter>
              </Card>

              {/* Show TestEmailFetch component when this account is selected */}
              {emailFetchTestAccount === account.id && (
                <TestEmailFetch accountId={account.id} />
              )}
            </div>
          );
        })}
      </div>

      {editingAccount && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Edit Account: {editingAccount.name || editingAccount.email}
              </DialogTitle>
              <DialogDescription>
                Update the connection details for this email account. Password
                field must be re-entered to make changes or keep the same.
              </DialogDescription>
            </DialogHeader>
            <EmailConnectionForm
              onSubmit={handleEditSubmit}
              onTestConnection={placeholderTestConnectionEdit} // Using placeholder for now
              onInitiateOAuth={placeholderInitiateOAuth} // Add the new prop
              isLoading={isSubmittingEdit}
              initialData={{
                accountName: editingAccount.name || "",
                emailAddress: editingAccount.email,
                // Password should be left blank in the form for editing to avoid showing encrypted
                // The schema requires it, so user must re-type if changing, or re-type old one if not.
                password: "",
                imapServer: editingAccount.imap_host ?? undefined,
                imapPort: editingAccount.imap_port ?? undefined,
                smtpServer: editingAccount.smtp_host ?? undefined,
                smtpPort: editingAccount.smtp_port ?? undefined,
                // Assuming security is SSL/TLS as per current form default, adjust if it's stored and varies
                security: "SSL/TLS",
              }}
            />
            {/* DialogFooter and DialogClose can be part of EmailConnectionForm if it always runs in a dialog */}
            {/* Or handled here if EmailConnectionForm is more general */}
          </DialogContent>
        </Dialog>
      )}

      {accountToDelete && (
        <AlertDialog
          open={isDeleteAlertOpen}
          onOpenChange={setIsDeleteAlertOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                account{" "}
                <span className="font-semibold">
                  {accountToDelete.name || accountToDelete.email}
                </span>{" "}
                and remove its data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => setAccountToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Yes, delete account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
