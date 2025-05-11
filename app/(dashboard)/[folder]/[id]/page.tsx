"use client";

import { getAttachmentDownloadUrl } from "@/lib/supabase/storage"; // Import for download URL
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
import { useEffect, useRef, useState } from "react";
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
  from_avatar_url?: string;
  tags?: string[];
}

export default function EmailViewPage() {
  const params = useParams();
  const emailId = params.id as string;

  const [email, setEmail] = useState<EmailDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref for the iframe to access its properties
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
    console.log("Original HTML:", htmlContent); // Log before sanitization
    // Ensure DOMPurify runs only on the client-side
    if (typeof window !== "undefined") {
      const sanitized = DOMPurify.sanitize(htmlContent, {
        USE_PROFILES: { html: true },
      });
      console.log("Sanitized HTML:", sanitized); // Log after sanitization
      return sanitized;
    }
    console.log(
      "Sanitized HTML (SSR fallback - no sanitization):",
      htmlContent
    ); // Log SSR fallback
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

  // Define sanitizedHtmlBody for the initial render of the iframe
  const initialSanitizedHtmlBody = email
    ? sanitizeHtml(email.body_html || email.body_text)
    : "";

  return (
    <div className="flex flex-col h-full">
      {/* --- Fixed Header Section --- */}
      <div>
        <div className="flex items-center p-4 border-b">
          <div className="flex items-center gap-2">
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
        <div className="px-4">
          <div className="flex items-center p-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={email.from_avatar_url || undefined}
                  alt={email.from_name || email.from_email}
                />
                <AvatarFallback>
                  {email.from_name
                    ? email.from_name.substring(0, 2).toUpperCase()
                    : email.from_email.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-0.5">
                <div className="font-semibold truncate">
                  {email.from_name || email.from_email}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  To: {email.to_email}
                </div>
              </div>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              {formatDistanceToNow(parseISO(email.received_at), {
                addSuffix: true,
              })}
            </div>
          </div>
          <Separator />
          <div className="p-4 space-y-2">
            <h1 className="text-2xl font-bold break-words">
              {email.subject || "(No Subject)"}
            </h1>
            {email.tags && email.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {email.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* --- End Fixed Header Section --- */}

      {/* --- Scrollable Email Body & Attachments Section --- */}
      <div className="flex-1 overflow-y-auto">
        <iframe
          ref={iframeRef}
          id="email-body-iframe"
          className="w-full h-full border-0 email-body-iframe"
          srcDoc={initialSanitizedHtmlBody}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          title={`Email body for ${email.subject || "email"}`}
        />

        {/* Attachments Section - moved inside scrollable area */}
        {email.attachments && email.attachments.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="pt-4">
              <h3 className="text-lg font-semibold mb-2">
                Attachments ({email.attachments.length})
              </h3>
              <ul className="space-y-2">
                {email.attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate" title={att.file_name}>
                        {att.file_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({(att.file_size / 1024).toFixed(2)} KB)
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const { downloadUrl, error } =
                            await getAttachmentDownloadUrl(att.storage_path);
                          if (error || !downloadUrl) {
                            toast.error(
                              `Failed to get download link for ${
                                att.file_name
                              }: ${error?.message || "Unknown error"}`
                            );
                            return;
                          }
                          window.open(downloadUrl, "_blank");
                        } catch (e: any) {
                          toast.error(
                            `Error downloading ${att.file_name}: ${e.message}`
                          );
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
      {/* --- End Scrollable Email Body & Attachments Section --- */}
    </div>
  );
}
