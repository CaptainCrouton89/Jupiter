"use client"; // Add use client for hooks

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Loader2, Mail, Paperclip, Star } from "lucide-react"; // Added Mail, Loader2 and AlertTriangle
import { useEffect, useState } from "react"; // Added useEffect and useState

// Define the structure of the email data expected from the API
// This should match the InboxEmail interface in app/api/email/inbox/route.ts
export interface InboxEmail {
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
}

// Removed dummy email data

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function InboxPage() {
  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/email/inbox");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch emails");
      }
      const data = await response.json();
      setEmails(data.emails || []);
    } catch (err: any) {
      console.error("Error fetching emails:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleRefresh = () => {
    fetchEmails(); // Re-fetch emails
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading emails...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-lg font-semibold text-destructive">
          Error loading emails
        </p>
        <p className="mt-2 text-center text-muted-foreground">{error}</p>
        <Button onClick={handleRefresh} variant="outline" className="mt-6">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Inbox ({emails.length})</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Refresh
          </Button>
          {/* Placeholder for Archive button functionality */}
          <Button variant="outline" size="sm" disabled>
            Archive
          </Button>
        </div>
      </div>

      {emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full border rounded-md p-8">
          <Mail className="h-16 w-16 text-muted-foreground/50" />{" "}
          {/* You might need to import Mail icon */}
          <p className="mt-4 text-xl font-semibold">It's quiet in here</p>
          <p className="mt-2 text-muted-foreground">
            No emails in your inbox yet.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"></TableHead>{" "}
                {/* Checkbox/Select */}
                <TableHead className="w-[30px]"></TableHead> {/* Star */}
                <TableHead className="w-[30px]"></TableHead> {/* Attachment */}
                <TableHead className="w-[200px]">From</TableHead>
                <TableHead>Subject</TableHead>
                {/* Removed one empty TableHead as it seemed to be for spacing that might not be needed or can be handled by Subject column width */}
                <TableHead className="text-right w-[100px]">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow
                  key={email.id}
                  className={`cursor-pointer ${
                    !email.read
                      ? "font-medium bg-muted/30 hover:bg-muted/40"
                      : "hover:bg-muted/20"
                  }`}
                  // TODO: onClick={() => router.push(`/inbox/${email.id}`)} - for navigating to detail view
                >
                  <TableCell className="px-2">
                    {/* Placeholder for checkbox for selection */}
                    <div className="flex items-center justify-center h-4 w-4 rounded border">
                      {/* {email.read && <Check className="h-3 w-3 text-primary" />} */}
                    </div>
                  </TableCell>
                  <TableCell className="px-2">
                    <Star
                      className={`h-4 w-4 ${
                        email.starred
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground hover:text-yellow-500"
                      }`}
                      // TODO: onClick={(e) => { e.stopPropagation(); toggleStar(email.id); }}
                    />
                  </TableCell>
                  <TableCell className="px-2">
                    {email.has_attachments && (
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>{email.from_name || email.from_email}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className={!email.read ? "font-semibold" : ""}>
                        {email.subject || "(No Subject)"}
                      </span>
                      <span className="text-muted-foreground text-sm truncate max-w-[300px] sm:max-w-[400px] md:max-w-[500px]">
                        {email.preview || "(No preview available)"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {formatDate(email.received_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
