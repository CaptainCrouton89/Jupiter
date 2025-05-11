"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmailParseTest } from "./EmailParseTest";

interface TestEmailFetchProps {
  accountId: string;
}

export function TestEmailFetch({ accountId }: TestEmailFetchProps) {
  const [isFetching, setIsFetching] = useState(false);
  const [uids, setUids] = useState<number[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);

  const fetchEmails = async () => {
    if (!accountId) {
      toast.error("No account ID provided.");
      return;
    }

    setIsFetching(true);
    setUids([]);
    setCount(null);
    setSelectedUid(null);

    try {
      const response = await fetch(
        `/api/email/fetch-recent/${accountId}?limit=20`
      );
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Failed to fetch emails.");
        return;
      }

      if (Array.isArray(data.uids)) {
        setUids(data.uids);
        setCount(data.uids.length);
        toast.success(`Retrieved ${data.uids.length} email UIDs`);
      } else {
        toast.error("Invalid response format from server");
      }
    } catch (error) {
      toast.error("An unexpected error occurred while fetching emails.");
      console.error("Fetch emails error:", error);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test Email Fetching</CardTitle>
          <CardDescription>
            Fetch recent emails (UIDs only) from this account's INBOX
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={fetchEmails}
            disabled={isFetching}
            className="w-full"
          >
            {isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching Emails...
              </>
            ) : (
              "Fetch Recent Email UIDs"
            )}
          </Button>

          {count !== null && (
            <div className="mt-4">
              <p className="text-sm font-medium">Found {count} emails</p>
            </div>
          )}

          {uids.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">
                Email UIDs (Most Recent First):
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {uids.slice(0, 20).map((uid) => (
                  <Button
                    key={uid}
                    variant={selectedUid === uid ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setSelectedUid(uid === selectedUid ? null : uid)
                    }
                  >
                    {uid}
                  </Button>
                ))}
              </div>
              {uids.length > 20 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Showing 20 of {uids.length} UIDs
                </p>
              )}
              {selectedUid && (
                <p className="text-sm mt-4">
                  Selected UID:{" "}
                  <span className="font-semibold">{selectedUid}</span>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUid && (
        <EmailParseTest accountId={accountId} uid={selectedUid} />
      )}
    </div>
  );
}
