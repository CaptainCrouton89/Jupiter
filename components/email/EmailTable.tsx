"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InboxEmail } from "@/lib/store/features/api/emailsApi";
import { cn } from "@/lib/utils";
import { Loader2, Mail, ShieldAlert, Star } from "lucide-react";
import { useRouter } from "next/navigation";

const getCategoryNameFromCategory = (category: string | undefined): string => {
  if (!category) return "Uncategorizable";

  switch (category.toLowerCase()) {
    case "newsletter":
      return "Newsletter";
    case "marketing":
      return "Marketing";
    case "receipt":
      return "Receipt";
    case "invoice":
      return "Invoice";
    case "finances":
      return "Finances";
    case "code-related":
      return "Code";
    case "notification":
      return "Notification";
    case "account-related":
      return "Account";
    case "personal":
      return "Personal";
    case "email-verification":
      return "Verification";
    case "uncategorizable":
    default:
      return "Unknown";
  }
};

// Helper function to determine badge class names based on category
const getCategoryBadgeClassName = (category: string | undefined): string => {
  if (!category)
    return "border-transparent bg-muted text-muted-foreground hover:bg-muted/80"; // Default for undefined

  switch (category.toLowerCase()) {
    case "newsletter":
      return "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200/80 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900/70";
    case "marketing":
      return "border-transparent bg-purple-100 text-purple-800 hover:bg-purple-200/80 dark:bg-purple-900/50 dark:text-purple-300 dark:hover:bg-purple-900/70";
    case "receipt":
      return "border-transparent bg-green-100 text-green-800 hover:bg-green-200/80 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900/70";
    case "invoice":
      return "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200/80 dark:bg-yellow-900/50 dark:text-yellow-300 dark:hover:bg-yellow-900/70";
    case "finances":
      return "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-200/80 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900/70";
    case "code-related":
      return "border-transparent bg-slate-200 text-slate-800 hover:bg-slate-300/80 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-700/80";
    case "notification":
      return "border-transparent bg-sky-100 text-sky-800 hover:bg-sky-200/80 dark:bg-sky-900/50 dark:text-sky-300 dark:hover:bg-sky-900/70";
    case "account-related":
      return "border-transparent bg-orange-100 text-orange-800 hover:bg-orange-200/80 dark:bg-orange-900/50 dark:text-orange-300 dark:hover:bg-orange-900/70";
    case "personal":
      return "border-transparent bg-pink-100 text-pink-800 hover:bg-pink-200/80 dark:bg-pink-900/50 dark:text-pink-300 dark:hover:bg-pink-900/70";
    case "email-verification":
      return "border-transparent bg-teal-100 text-teal-800 hover:bg-teal-200/80 dark:bg-teal-900/50 dark:text-teal-300 dark:hover:bg-teal-900/70";
    case "uncategorizable":
    default:
      return "border-transparent bg-gray-200 text-gray-700 hover:bg-gray-300/80 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-700/80";
  }
};

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

interface EmailTableProps {
  emails: InboxEmail[];
  isLoading: boolean;
  hasMore: boolean;
  loadMoreRef: (node?: Element | null | undefined) => void;
  folderType: "inbox" | "spam"; // To differentiate styling or behavior if needed
  onStarToggle?: (emailId: string) => void; // Optional: if starring is different or not always present
  // Add other props like onEmailSelect, onArchive, etc. as needed
}

export function EmailTable({
  emails,
  isLoading,
  hasMore,
  loadMoreRef,
  folderType,
  onStarToggle,
}: EmailTableProps) {
  const router = useRouter();

  const handleEmailClick = (emailId: string) => {
    router.push(`/${folderType}/${emailId}`);
  };

  const handleStarClick = (
    e: React.MouseEvent<SVGSVGElement | HTMLButtonElement>,
    emailId: string
  ) => {
    e.stopPropagation(); // Prevent row click
    if (onStarToggle) {
      onStarToggle(emailId);
    } else {
      // Default star toggle logic or log warning
      console.warn("onStarToggle not provided for email:", emailId);
    }
  };

  if (emails.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full border rounded-md p-8">
        {folderType === "inbox" ? (
          <Mail className="h-16 w-16 text-muted-foreground/50" />
        ) : (
          <ShieldAlert className="h-16 w-16 text-muted-foreground/50" />
        )}
        <p className="mt-4 text-xl font-semibold">
          {folderType === "inbox" ? "It's quiet in here" : "No spam here!"}
        </p>
        <p className="mt-2 text-muted-foreground">
          {folderType === "inbox"
            ? "No emails in your inbox yet."
            : "Your spam folder is currently empty."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border flex-grow overflow-y-auto">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            {(() => {
              if (folderType === "inbox") {
                return (
                  <>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead className="w-[25%]">From</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="hidden md:table-cell w-[100px]">
                      Category
                    </TableHead>
                    <TableHead className="hidden lg:table-cell w-[100px] text-right">
                      Date
                    </TableHead>
                  </>
                );
              }
              if (folderType === "spam") {
                return (
                  <>
                    <TableHead className="w-[60px] hidden sm:table-cell">
                      Star
                    </TableHead>
                    <TableHead className="w-[150px] sm:w-[200px]">
                      From
                    </TableHead>
                    <TableHead>Subject & Preview</TableHead>
                    <TableHead className="w-[100px] text-right hidden md:table-cell">
                      Category
                    </TableHead>
                    <TableHead className="w-[100px] text-right hidden md:table-cell">
                      Date
                    </TableHead>
                  </>
                );
              }
              return null;
            })()}
          </TableRow>
        </TableHeader>
        <TableBody>
          {emails.map((email, index) => (
            <TableRow
              key={email.id}
              ref={index === emails.length - 5 ? loadMoreRef : undefined} // Ensure ref is correctly applied
              tabIndex={0}
              role="row"
              aria-selected={false} // Add aria-selected
              aria-label={
                `Email from ${email.from_name || email.from_email}, ` +
                `Subject: ${email.subject || "(No Subject)"}, ` +
                `Received: ${formatDate(email.received_at)}`
              }
              className={cn(
                "cursor-pointer",
                folderType === "inbox" &&
                  (!email.read
                    ? "font-medium bg-muted/30 hover:bg-muted/40"
                    : "hover:bg-muted/20"),
                folderType === "spam" &&
                  (email.read
                    ? "hover:bg-muted/50"
                    : "font-semibold bg-primary/5 hover:bg-muted/50")
              )}
              onClick={() => handleEmailClick(email.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleEmailClick(email.id);
                }
              }}
            >
              {folderType === "inbox" && (
                <>
                  <TableCell className="px-2" role="gridcell">
                    <div className="flex items-center justify-center h-4 w-4 rounded border"></div>
                  </TableCell>
                  <TableCell className="px-2" role="gridcell">
                    <Star
                      className={cn(
                        "h-4 w-4",
                        email.starred
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground hover:text-yellow-500"
                      )}
                      aria-hidden="true"
                      onClick={(e) => handleStarClick(e, email.id)}
                    />
                  </TableCell>
                  <TableCell
                    role="gridcell"
                    className="overflow-hidden break-words whitespace-normal min-w-0"
                  >
                    {email.from_name || email.from_email}
                  </TableCell>
                  <TableCell role="gridcell">
                    <div className="flex flex-col overflow-hidden">
                      <span
                        className={cn(
                          !email.read && "font-semibold",
                          "block truncate"
                        )}
                        title={email.subject || "(No Subject)"}
                      >
                        {email.subject || "(No Subject)"}
                      </span>
                      <span
                        className="text-muted-foreground text-sm block truncate max-w-[350px] sm:max-w-[450px] md:max-w-[600px] lg:max-w-[700px]"
                        title={email.preview || "(No preview available)"}
                      >
                        {email.preview || "(No preview available)"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    className="hidden md:table-cell px-2"
                    role="gridcell"
                  >
                    {email.category && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          getCategoryBadgeClassName(email.category)
                        )}
                      >
                        {getCategoryNameFromCategory(email.category)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className="hidden lg:table-cell text-right pr-4"
                    role="gridcell"
                  >
                    {formatDate(email.received_at)}
                  </TableCell>
                </>
              )}
              {folderType === "spam" && (
                <>
                  <TableCell className="hidden sm:table-cell">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        email.starred
                          ? "text-yellow-400 hover:text-yellow-500"
                          : "text-muted-foreground hover:text-accent-foreground"
                      )}
                      onClick={(e) => handleStarClick(e, email.id)}
                    >
                      <Star className="h-5 w-5" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="truncate">
                      {email.from_name || email.from_email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="truncate max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-2xl">
                        {email.subject}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl">
                        {email.preview}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    {email.category && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          getCategoryBadgeClassName(email.category)
                        )}
                      >
                        {email.category.replace(/-/g, " ")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    {formatDate(email.received_at)}
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {isLoading &&
        emails.length > 0 && ( // Show loader only if there are already emails (i.e., loading more)
          <div className="flex justify-center items-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading more emails...</p>
          </div>
        )}
      {!hasMore && emails.length > 0 && !isLoading && (
        <div className="text-center py-4 text-muted-foreground">
          <p>All emails loaded.</p>
        </div>
      )}
    </div>
  );
}
