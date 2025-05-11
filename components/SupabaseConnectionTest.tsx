"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { EmailAccount } from "@/types/email";
import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";

export default function SupabaseConnectionTest() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<number | null>(null);
  const [emailData, setEmailData] = useState<EmailAccount[] | null>(null);

  async function testConnection() {
    setLoading(true);
    setSuccess(null);
    setError(null);
    setAccounts(null);
    setEmailData(null);

    try {
      // Test the connection by making a simple query
      const {
        data,
        error: queryError,
        count,
      } = await supabase.from("email_accounts").select("*", { count: "exact" });

      if (queryError) {
        throw queryError;
      }

      // If we get here, the connection was successful
      setSuccess(true);
      setAccounts(count || 0);
      setEmailData(data);
    } catch (err) {
      console.error("Supabase connection error:", err);
      setSuccess(false);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Supabase Connection Test</CardTitle>
        <CardDescription>
          Test the connection to your Supabase database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {success === true && (
            <div className="flex items-center p-4 bg-green-100 text-green-800 rounded-md">
              <Check className="h-5 w-5 mr-2" />
              <div>
                <p className="font-medium">Connection successful!</p>
                <p className="text-sm">
                  {accounts} email account{accounts !== 1 ? "s" : ""} found in
                  database.
                </p>
              </div>
            </div>
          )}

          {success === false && (
            <div className="flex items-center p-4 bg-red-100 text-red-800 rounded-md">
              <X className="h-5 w-5 mr-2" />
              <div>
                <p className="font-medium">Connection failed</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {emailData && emailData.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Email Accounts:</h3>
              <ul className="text-sm space-y-1">
                {emailData.map((account) => (
                  <li key={account.id} className="p-2 bg-gray-50 rounded">
                    {account.email} ({account.name || "Unnamed"})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={testConnection} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? "Testing..." : "Test Connection"}
        </Button>
      </CardFooter>
    </Card>
  );
}
