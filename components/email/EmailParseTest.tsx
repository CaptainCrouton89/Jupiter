"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface EmailParseTestProps {
  accountId: string;
  uid: number;
}

export function EmailParseTest({ accountId, uid }: EmailParseTestProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [parsedEmail, setParsedEmail] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const parseEmail = async () => {
    if (!accountId || !uid) {
      toast.error("Account ID and UID are required");
      return;
    }

    setIsParsing(true);
    setError(null);
    setParsedEmail(null);

    try {
      const response = await fetch(
        `/api/email/parse-email/${accountId}/${uid}`
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || data.error || "Failed to parse email");
        toast.error("Failed to parse email");
        return;
      }

      setParsedEmail(data.email);
      toast.success("Email parsed successfully");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      toast.error("An error occurred while parsing the email");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Parse Email (UID: {uid})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button onClick={parseEmail} disabled={isParsing} className="w-full">
            {isParsing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Parsing...
              </>
            ) : (
              "Parse Email"
            )}
          </Button>

          {error && (
            <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-md">
              <h3 className="font-semibold mb-1">Error</h3>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {parsedEmail && (
            <div className="border rounded-md p-4 space-y-3">
              <h3 className="font-semibold">Parsed Email</h3>

              <div>
                <h4 className="text-sm font-medium">Subject</h4>
                <p className="text-sm">
                  {parsedEmail.subject || <em>No subject</em>}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium">From</h4>
                <p className="text-sm">
                  {parsedEmail.from ? (
                    `${parsedEmail.from.name || ""} <${
                      parsedEmail.from.address
                    }>`
                  ) : (
                    <em>Unknown sender</em>
                  )}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium">To</h4>
                <ul className="text-sm list-disc pl-5">
                  {parsedEmail.to && parsedEmail.to.length > 0 ? (
                    parsedEmail.to.map((to: any, i: number) => (
                      <li key={i}>
                        {to.name ? `${to.name} <${to.address}>` : to.address}
                      </li>
                    ))
                  ) : (
                    <li>
                      <em>No recipients</em>
                    </li>
                  )}
                </ul>
              </div>

              {parsedEmail.cc && parsedEmail.cc.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium">CC</h4>
                  <ul className="text-sm list-disc pl-5">
                    {parsedEmail.cc.map((cc: any, i: number) => (
                      <li key={i}>
                        {cc.name ? `${cc.name} <${cc.address}>` : cc.address}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium">Date</h4>
                <p className="text-sm">
                  {parsedEmail.date ? (
                    new Date(parsedEmail.date).toLocaleString()
                  ) : (
                    <em>No date</em>
                  )}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium">Content</h4>
                <p className="text-sm">
                  {parsedEmail.hasHtml
                    ? "HTML content available"
                    : "No HTML content"}{" "}
                  •
                  {parsedEmail.hasText
                    ? "Text content available"
                    : "No text content"}
                </p>
              </div>

              {parsedEmail.attachmentCount > 0 && (
                <div>
                  <h4 className="text-sm font-medium">
                    Attachments ({parsedEmail.attachmentCount})
                  </h4>
                  <ul className="text-sm list-disc pl-5">
                    {parsedEmail.attachments.map((att: any, i: number) => (
                      <li key={i}>
                        {att.filename || "Unnamed attachment"} (
                        {att.contentType}, {formatBytes(att.size)})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium">Message ID</h4>
                <p className="text-sm truncate">
                  {parsedEmail.messageId || <em>No message ID</em>}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper to format bytes
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
