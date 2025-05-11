"use client";

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
import { Database } from "@/lib/database.types";
// import { MoreHorizontal } from "lucide-react"; // For a potential dropdown menu
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";

// Define the type for a single account, using the Row type from generated Supabase types
type Account = Database["public"]["Tables"]["email_accounts"]["Row"] & {
  // We might add these fields later based on actual data availability
  is_connected?: boolean;
  last_synced?: string | null;
};

interface ConnectedAccountsListProps {
  accounts: Account[];
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
  if (accounts.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No connected accounts yet.</p>
        <p>Click the button above to connect your first email account.</p>
      </div>
    );
  }

  return (
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
            <Button variant="outline" size="sm" disabled>
              Edit
            </Button>
            <Button variant="destructive" size="sm" disabled>
              Remove
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
