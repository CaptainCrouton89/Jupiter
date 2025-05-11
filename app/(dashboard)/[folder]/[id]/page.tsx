"use client";

import DOMPurify from "dompurify"; // For HTML sanitization
import {
  AlertTriangle,
  Archive,
  CornerDownLeft,
  Download,
  Loader2,
  MailWarning,
  MoreVertical,
  Paperclip,
  Reply,
  ReplyAll,
  Trash2,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner"; // Added sonner imports

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow, parseISO } from "date-fns"; // For date formatting

// Define the structure of an attachment based on what the API provides
interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string; // Path for generating download URL
}

// Define the structure of the email details fetched from the API
interface EmailDetails {
  id: string;
  subject: string | null;
  from_name: string | null;
  from_email: string;
  to_name: string | null; // May not be directly available
  to_email: string; // May not be directly available
  body_html: string | null;
  body_text: string | null;
  received_at: string; // ISO date string
  created_at: string; // ISO date string
  attachments: Attachment[];
  // Add other fields as needed, e.g., cc, bcc, read status
  read?: boolean;
}

export default function EmailViewPage() {
  const params = useParams();
  const emailId = params.id as string;

  const [email, setEmail] = useState<EmailDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (emailId) {
      const fetchEmailDetails = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/email/message/${emailId}`);
          if (!response.ok) {
            if (response.status === 404) {
              throw new Error("Email not found.");
            }
            const errorData = await response.json();
            throw new Error(errorData.error || `Error: ${response.status}`);
          }
          const data: EmailDetails = await response.json();
          setEmail(data);

          // If email is unread, mark it as read
          if (data && !data.read) {
            try {
              const patchResponse = await fetch(
                `/api/email/message/${emailId}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ read: true }),
                }
              );
              if (!patchResponse.ok) {
                const patchErrorData = await patchResponse.json();
                throw new Error(
                  patchErrorData.error || "Failed to mark as read."
                );
              }
              // Update local state to reflect read status immediately
              setEmail((prevEmail) =>
                prevEmail ? { ...prevEmail, read: true } : null
              );
              toast.success("Email marked as read.");
            } catch (patchErr: any) {
              console.error("Error marking email as read:", patchErr);
              toast.error(patchErr.message || "Could not mark email as read.");
              // Optionally, revert local state if API call failed, though it might be confusing
            }
          }
        } catch (err: any) {
          setError(err.message || "Failed to load email.");
          toast.error(err.message || "Failed to load email.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchEmailDetails();
    }
  }, [emailId]);

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
    } catch (e) {
      return "Invalid date";
    }
  };

  const sanitizeHtml = (htmlContent: string | null | undefined): string => {
    if (!htmlContent) return "";
    // Ensure DOMPurify runs only on the client-side
    if (typeof window !== "undefined") {
      return DOMPurify.sanitize(htmlContent, { USE_PROFILES: { html: true } });
    }
    return htmlContent; // Fallback for SSR, though rendering should be client-side
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading email...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <MailWarning className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive">
          Error Loading Email
        </h2>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-6">
          Try Again
        </Button>
      </div>
    );
  }

  if (!email) {
    // This case should ideally be handled by the 404 from the API,
    // but as a fallback:
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold">Email Not Found</h2>
        <p className="text-muted-foreground">
          The email you are looking for does not exist or you may not have
          permission to view it.
        </p>
      </div>
    );
  }

  const hasAttachments = email.attachments && email.attachments.length > 0;

  return (
    <div className="flex flex-col h-full">
      <Toaster position="top-right" /> {/* Added Toaster component */}
      <div className="flex items-center p-4 border-b">
        <div className="flex items-center gap-2">
          {/* Placeholder action buttons - functionality to be implemented */}
          <Button variant="outline" size="icon" aria-label="Reply">
            <Reply className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Reply to all">
            <ReplyAll className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Forward">
            <CornerDownLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Mark as unread">
            <MailWarning className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Archive">
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Move to trash">
            <Trash2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Mark as important</DropdownMenuItem>
              <DropdownMenuItem>Report spam</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Print email</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={undefined /* Placeholder for avatar image */}
                alt={email.from_name || email.from_email}
              />
              <AvatarFallback>
                {email.from_name
                  ? email.from_name.substring(0, 2).toUpperCase()
                  : email.from_email.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="grid gap-0.5">
              <div className="font-semibold flex items-center gap-2">
                {email.from_name || email.from_email}
                <span className="text-xs font-normal text-muted-foreground">
                  &lt;{email.from_email}&gt;
                </span>
              </div>
              {/* Placeholder for To/Cc/Bcc - data needs to be fetched or inferred */}
              <div className="text-xs text-muted-foreground">
                To: {email.to_email || "Undisclosed recipients"}
              </div>
              {/* Add Cc/Bcc if available */}
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              {hasAttachments && <Paperclip className="h-4 w-4" />}
              <span>{formatDate(email.received_at)}</span>
            </div>
            <Badge
              variant={email.read ? "outline" : "secondary"}
              className="mt-1"
            >
              {email.read ? "Read" : "Unread"}
            </Badge>
          </div>
        </div>

        <Separator className="my-4" />

        <h1 className="text-2xl font-bold mb-4">
          {email.subject || "(No Subject)"}
        </h1>

        {/* Email Body */}
        {/* Use dangerouslySetInnerHTML with sanitized HTML */}
        {/* For text body, use <pre> or similar for formatting */}
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(email.body_html || email.body_text),
          }}
        />

        {/* Attachments Section */}
        {hasAttachments && (
          <>
            <Separator className="my-6" />
            <div className="mb-4">
              <h2 className="text-lg font-semibold flex items-center">
                <Paperclip className="h-5 w-5 mr-2" />
                Attachments ({email.attachments.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {email.attachments.map((att) => (
                <div
                  key={att.id}
                  className="border rounded-lg p-3 flex flex-col items-start gap-2 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2">
                    {/* Basic icon, could be more specific based on file_type */}
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                    <span
                      className="text-sm font-medium truncate"
                      title={att.file_name}
                    >
                      {att.file_name}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {(att.file_size / 1024).toFixed(1)} KB - {att.file_type}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-auto w-full"
                    onClick={() => {
                      /* TODO: Implement download from att.storage_path */ alert(
                        "Download: " + att.file_name
                      );
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {/* Reply/Forward quick actions at the bottom - optional */}
      <div className="p-4 border-t mt-auto">
        <div className="flex gap-2">
          <Button variant="outline">
            <Reply className="mr-2 h-4 w-4" /> Reply
          </Button>
          <Button variant="outline">
            <ReplyAll className="mr-2 h-4 w-4" /> Reply All
          </Button>
          <Button variant="outline">
            <CornerDownLeft className="mr-2 h-4 w-4" /> Forward
          </Button>
        </div>
      </div>
    </div>
  );
}
