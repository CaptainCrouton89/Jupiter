"use client";

import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CornerDownLeft,
  CornerDownRight,
  Loader2,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

// Placeholder for the detailed email structure
// This will be fetched based on the ID
interface EmailDetails {
  id: string;
  subject: string | null;
  fromName: string | null;
  fromEmail: string;
  toName: string | null; // Or an array if multiple recipients
  toEmail: string; // Or an array
  ccEmails?: string[];
  bccEmails?: string[];
  bodyHtml: string | null; // Or bodyText
  receivedAt: string; // Or sentAt for sent items
  attachments?: { name: string; size: number; type: string; url: string }[];
  // Add other relevant fields like conversation_id, labels, etc.
}

interface EmailViewPageProps {
  params: Promise<{
    folder: string;
    id: string;
  }>;
}

export default function EmailViewPage({ params }: EmailViewPageProps) {
  const router = useRouter();
  const { folder, id } = use(params);
  const [email, setEmail] = useState<EmailDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      const fetchEmailDetails = async () => {
        setIsLoading(true);
        setError(null);
        try {
          // TODO: Replace with actual API call to fetch email by its database ID
          // For example: /api/emails/${id} or /api/folder/${folder}/emails/${id}
          // This endpoint will need to fetch from your 'emails' table in Supabase
          const response = await fetch(`/api/email/message/${id}`); // Tentative API endpoint
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to fetch email ${id}`);
          }
          const data: EmailDetails = await response.json();
          setEmail(data);
        } catch (err: any) {
          console.error(`Error fetching email ${id}:`, err);
          setError(err.message || "An unexpected error occurred.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchEmailDetails();
    }
  }, [id, folder]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading email...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-lg font-semibold text-destructive">
          Error loading email
        </p>
        <p className="mt-2 text-center text-muted-foreground">{error}</p>
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mt-6"
        >
          Go Back
        </Button>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-lg">Email not found.</p>
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mt-6"
        >
          Go Back
        </Button>
      </div>
    );
  }

  // Determine display names
  const fromDisplayName = email.fromName || email.fromEmail;
  const toDisplayName = email.toName || email.toEmail;

  return (
    <div className="flex flex-col h-full p-4 md:p-6 bg-card text-card-foreground">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          title="Back to ${folder}"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" title="Archive">
            <Archive className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" title="Delete">
            <Trash2 className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" title="Reply">
            <CornerDownLeft className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" title="Reply All">
            <CornerDownRight className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" title="More options">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Email Metadata */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">
          {email.subject || "(No Subject)"}
        </h1>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex flex-col">
            <span>
              From:{" "}
              <span className="font-medium text-foreground">
                {fromDisplayName}
              </span>
            </span>
            <span>
              To:{" "}
              <span className="font-medium text-foreground">
                {toDisplayName}
              </span>
            </span>
            {email.ccEmails && email.ccEmails.length > 0 && (
              <span>
                Cc:{" "}
                <span className="font-medium text-foreground">
                  {email.ccEmails.join(", ")}
                </span>
              </span>
            )}
          </div>
          <span>{new Date(email.receivedAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Email Body */}
      {/*
        SECURITY NOTE: Using an iframe with srcdoc and sandbox is safer than dangerouslySetInnerHTML.
        Adjust sandbox permissions as needed. Be restrictive by default.
        Common sandbox values: "allow-same-origin" (if content is from your domain and trusted),
        "allow-popups", "allow-scripts" (use with extreme caution and only if content is sanitized/trusted).
        For external email content, it's often best to omit "allow-scripts" and "allow-same-origin".
      */}
      {email.bodyHtml ? (
        <iframe
          className="flex-grow w-full h-full border-0"
          srcDoc={email.bodyHtml}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          // Consider adding: allow-downloads, allow-forms (if needed and trusted)
          // Avoid: allow-scripts, allow-same-origin unless content is fully trusted/sanitized
          title={`Email content for ${email.subject || "email"}`}
        />
      ) : (
        <div className="flex-grow overflow-auto">
          <p>(No content to display)</p>
        </div>
      )}

      {/* Attachments (Placeholder) */}
      {email.attachments && email.attachments.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-lg font-medium mb-2">
            Attachments ({email.attachments.length})
          </h3>
          {/* TODO: Implement attachment rendering */}
          <ul>
            {email.attachments.map((att) => (
              <li key={att.name}>
                {att.name} ({att.size} bytes)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Debug Info */}
      <div className="mt-auto pt-4 border-t text-xs text-muted-foreground">
        <p>Folder: {folder}</p>
        <p>Email ID: {id}</p>
      </div>
    </div>
  );
}
