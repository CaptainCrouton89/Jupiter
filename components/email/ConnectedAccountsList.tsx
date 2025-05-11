"use client";

import { EmailConnectionForm } from "@/components/email/EmailConnectionForm";
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

  if (accounts.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No connected accounts yet.</p>
        <p>Click the button above to connect your first email account.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <Card key={account.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle
                    className="text-lg truncate"
                    title={account.name || account.email}
                  >
                    {account.name || "Unnamed Account"}
                  </CardTitle>
                  <CardDescription className="truncate" title={account.email}>
                    {account.email}
                  </CardDescription>
                </div>
                {/* Placeholder for connection status badge */}
                <Badge
                  variant={
                    account.is_connected === undefined
                      ? "outline"
                      : account.is_connected
                      ? "default"
                      : "destructive"
                  }
                >
                  {account.is_connected === undefined
                    ? "Unknown"
                    : account.is_connected
                    ? "Connected"
                    : "Issue"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  IMAP: {account.imap_host}:{account.imap_port}
                </p>
                <p>
                  SMTP: {account.smtp_host}:{account.smtp_port}
                </p>
                {/* We don\'t have last_synced in the select query, and it\'s hypothetical anyway */}
                {/* <p>Last synced: {formatDate(account.last_synced)}</p> */}
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 pt-4">
              {/* Placeholder for action buttons */}
              {/* <Button variant="outline" size="sm" onClick={() => onTestConnection?.(account.id)}>Test</Button> */}
              {/* <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit?.(account)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete?.(account.id)} className="text-destructive">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu> */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEditClick(account)}
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteClick(account)}
                disabled={isDeleting && accountToDelete?.id === account.id}
              >
                {isDeleting && accountToDelete?.id === account.id
                  ? "Removing..."
                  : "Remove"}
              </Button>
            </CardFooter>
          </Card>
        ))}
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
              isLoading={isSubmittingEdit}
              initialData={{
                accountName: editingAccount.name || "",
                emailAddress: editingAccount.email,
                // Password should be left blank in the form for editing to avoid showing encrypted
                // The schema requires it, so user must re-type if changing, or re-type old one if not.
                password: "",
                imapServer: editingAccount.imap_host,
                imapPort: editingAccount.imap_port,
                smtpServer: editingAccount.smtp_host,
                smtpPort: editingAccount.smtp_port,
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
