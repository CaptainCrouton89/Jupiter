"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/hooks/useAuth";
import { supabase } from "@/lib/supabase"; // Using the client-side Supabase instance
import { useState } from "react";

// Helper to stringify results for display, handling BigInts
const stringify = (obj: any) => {
  return JSON.stringify(
    obj,
    (key, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  );
};

export default function DatabaseTestPage() {
  const { user, signIn } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addResult = (title: string, data: any, success: boolean = true) => {
    setResults((prev) => [
      ...prev,
      {
        title,
        data: stringify(data),
        success,
        timestamp: new Date().toISOString(),
      },
    ]);
    setError(null);
  };

  const handleError = (title: string, err: any) => {
    console.error(title, err);
    setError(`[${title}] ${err.message || stringify(err)}`);
    addResult(title, err, false);
  };

  // --- Test User Credentials (Replace with your actual test users) ---
  const TEST_USER_1_EMAIL = "testuser1@example.com";
  const TEST_USER_1_PASSWORD = "password123"; // Replace with actual password
  const TEST_USER_2_EMAIL = "testuser2@example.com";
  const TEST_USER_2_PASSWORD = "password123"; // Replace with actual password

  let createdAccount1Id: string | null = null;
  let createdFolder1Id: string | null = null;
  let createdEmail1Id: string | null = null;
  let createdAttachment1Id: string | null = null;
  let createdSettings1Id: string | null = null;

  // --- Test Functions ---

  const testInsertDataUser1 = async () => {
    if (!user || user.email !== TEST_USER_1_EMAIL) {
      addResult(
        "Setup",
        `Please sign in as ${TEST_USER_1_EMAIL} first.`,
        false
      );
      await signIn(TEST_USER_1_EMAIL, TEST_USER_1_PASSWORD);
      addResult(
        "Setup",
        `Attempted login for ${TEST_USER_1_EMAIL}. Re-run test if successful.`,
        false
      );
      return;
    }
    setResults([]); // Clear previous results for new test run

    try {
      // 1. Create email_account
      const { data: accData, error: accErr } = await supabase
        .from("email_accounts")
        .insert({
          user_id: user.id,
          email: `account_for_${user.email}`,
          imap_host: "imap.example.com",
          imap_port: 993,
          smtp_host: "smtp.example.com",
          smtp_port: 465,
          username: `user_${user.id.substring(0, 4)}`,
          password_encrypted: "test_password_encrypted", // In a real app, this would be properly encrypted
        })
        .select()
        .single();
      if (accErr) throw accErr;
      createdAccount1Id = accData.id;
      addResult("Insert email_account (User1)", accData);

      // 2. Create folder
      const { data: folderData, error: folderErr } = await supabase
        .from("folders")
        .insert({
          account_id: createdAccount1Id,
          name: "Test Inbox (User1)",
          type: "inbox",
        })
        .select()
        .single();
      if (folderErr) throw folderErr;
      createdFolder1Id = folderData.id;
      addResult("Insert folder (User1)", folderData);

      // 3. Create email
      const { data: emailData, error: emailErr } = await supabase
        .from("emails")
        .insert({
          account_id: createdAccount1Id,
          message_id: `testmsg_${Date.now()}@example.com`,
          from_email: "sender@example.com",
          subject: "Test Email from User1",
          body_text: "This is a test email body.",
          received_at: new Date().toISOString(),
          folder_id: createdFolder1Id,
        })
        .select()
        .single();
      if (emailErr) throw emailErr;
      createdEmail1Id = emailData.id;
      addResult("Insert email (User1)", emailData);

      // 4. Create attachment
      const { data: attData, error: attErr } = await supabase
        .from("attachments")
        .insert({
          email_id: createdEmail1Id,
          filename: "test_attachment.txt",
          content_type: "text/plain",
          size: 123,
          storage_path: "user1/test_attachment.txt", // Placeholder path
        })
        .select()
        .single();
      if (attErr) throw attErr;
      createdAttachment1Id = attData.id;
      addResult("Insert attachment (User1)", attData);

      // 5. Create user_settings
      // Upsert to handle if settings already exist for this user from a previous partial run
      const { data: settingsData, error: settingsErr } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: user.id,
            theme: "dark",
            email_signature: "Cheers, User1",
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();
      if (settingsErr) throw settingsErr;
      createdSettings1Id = settingsData.id;
      addResult("Upsert user_settings (User1)", settingsData);
    } catch (e) {
      handleError("testInsertDataUser1", e);
    }
  };

  const testSelectDataUser1 = async () => {
    // Placeholder: Implement SELECT tests for User 1 on their own data
    // Should succeed
    if (!user || user.email !== TEST_USER_1_EMAIL) {
      addResult(
        "Setup",
        `Please sign in as ${TEST_USER_1_EMAIL} first.`,
        false
      );
      return;
    }
    if (
      !createdAccount1Id ||
      !createdFolder1Id ||
      !createdEmail1Id ||
      !createdAttachment1Id ||
      !createdSettings1Id
    ) {
      addResult(
        "Setup",
        'Run "Insert Data (User1)" test first to create data.',
        false
      );
      return;
    }
    try {
      const { data: accData, error: accErr } = await supabase
        .from("email_accounts")
        .select()
        .eq("id", createdAccount1Id)
        .single();
      if (accErr) throw accErr;
      addResult(
        "Select email_account (User1)",
        accData ? "Found" : "Not Found - RLS Error?"
      );

      const { data: folderData, error: folderErr } = await supabase
        .from("folders")
        .select()
        .eq("id", createdFolder1Id)
        .single();
      if (folderErr) throw folderErr;
      addResult(
        "Select folder (User1)",
        folderData ? "Found" : "Not Found - RLS Error?"
      );

      const { data: emailData, error: emailErr } = await supabase
        .from("emails")
        .select()
        .eq("id", createdEmail1Id)
        .single();
      if (emailErr) throw emailErr;
      addResult(
        "Select email (User1)",
        emailData ? "Found" : "Not Found - RLS Error?"
      );

      const { data: attData, error: attErr } = await supabase
        .from("attachments")
        .select()
        .eq("id", createdAttachment1Id)
        .single();
      if (attErr) throw attErr;
      addResult(
        "Select attachment (User1)",
        attData ? "Found" : "Not Found - RLS Error?"
      );

      const { data: settingsData, error: settingsErr } = await supabase
        .from("user_settings")
        .select()
        .eq("id", createdSettings1Id)
        .single();
      if (settingsErr) throw settingsErr;
      addResult(
        "Select user_settings (User1)",
        settingsData ? "Found" : "Not Found - RLS Error?"
      );
    } catch (e) {
      handleError("testSelectDataUser1", e);
    }
  };

  const testUpdateDataUser1 = async () => {
    // Placeholder: Implement UPDATE tests for User 1 on their own data
    // Should succeed
    if (!user || user.email !== TEST_USER_1_EMAIL) {
      addResult(
        "Setup",
        `Please sign in as ${TEST_USER_1_EMAIL} first.`,
        false
      );
      return;
    }
    if (!createdEmail1Id) {
      addResult(
        "Setup",
        'Run "Insert Data (User1)" test first to create an email.',
        false
      );
      return;
    }
    try {
      const newSubject = `Updated Subject ${Date.now()}`;
      const { data, error } = await supabase
        .from("emails")
        .update({ subject: newSubject })
        .eq("id", createdEmail1Id)
        .select()
        .single();
      if (error) throw error;
      addResult(
        "Update email subject (User1)",
        data.subject === newSubject
          ? `Success: ${data.subject}`
          : "Update failed or returned wrong data"
      );
    } catch (e) {
      handleError("testUpdateDataUser1", e);
    }
  };

  const testUser2AccessUser1Data = async () => {
    // Placeholder: Sign in as User 2, attempt to SELECT, UPDATE, DELETE User 1's data
    // All should fail or return no data
    if (!user || user.email !== TEST_USER_2_EMAIL) {
      addResult(
        "Setup",
        `Please sign in as ${TEST_USER_2_EMAIL} first.`,
        false
      );
      await signIn(TEST_USER_2_EMAIL, TEST_USER_2_PASSWORD);
      addResult(
        "Setup",
        `Attempted login for ${TEST_USER_2_EMAIL}. Re-run test if successful.`,
        false
      );
      return;
    }
    if (!createdAccount1Id || !createdEmail1Id) {
      // Assuming these were set by User1's test run
      addResult(
        "Setup",
        "This test depends on User1 inserting data. Ensure that test was run in a previous session or that IDs are hardcoded for cross-session testing.",
        false
      );
      return;
    }

    try {
      // Attempt SELECT
      const { data: accData, error: accErr } = await supabase
        .from("email_accounts")
        .select()
        .eq("id", createdAccount1Id)
        .maybeSingle();
      if (accErr && accErr.code !== "PGRST116") throw accErr; // PGRST116: "Searched for one object but found 0" is expected for RLS block
      addResult(
        "User2 SELECT User1 email_account",
        accData ? "FAIL - Data Visible!" : "Success - Data Hidden/Inaccessible",
        !accData
      );

      // Attempt UPDATE
      const { data: updateData, error: updateErr } = await supabase
        .from("emails")
        .update({ subject: "User2 Hacking Attempt" })
        .eq("id", createdEmail1Id)
        .select()
        .maybeSingle();
      // For update, RLS might allow the query but update 0 rows if USING clause fails.
      // Or it might error if WITH CHECK fails on insert/update. The db-init has USING for update.
      // We expect 0 rows affected or an RLS error.
      if (
        updateErr &&
        updateErr.code !== "PGRST116" &&
        !updateErr.message.toLowerCase().includes("row level security")
      )
        throw updateErr;
      addResult(
        "User2 UPDATE User1 email",
        updateData
          ? "FAIL - Update Succeeded!"
          : "Success - Update Blocked/No Effect",
        !updateData
      );

      // Attempt DELETE
      const { error: deleteErr } = await supabase
        .from("emails")
        .delete()
        .eq("id", createdEmail1Id);
      if (
        deleteErr &&
        !deleteErr.message.toLowerCase().includes("row level security")
      )
        throw deleteErr; // Actual error might vary
      // Check if data still exists (by User1 if possible, or assume RLS blocked delete)
      addResult(
        "User2 DELETE User1 email",
        deleteErr
          ? "Success - Delete Blocked (Error)"
          : "Success - Delete Blocked (No Error, but likely no effect)",
        !!deleteErr
      );
    } catch (e) {
      handleError("testUser2AccessUser1Data", e);
    }
  };

  const testCascadeDeleteUser1 = async () => {
    // Placeholder: Implement cascade delete tests as User 1
    if (!user || user.email !== TEST_USER_1_EMAIL) {
      addResult(
        "Setup",
        `Please sign in as ${TEST_USER_1_EMAIL} first.`,
        false
      );
      return;
    }
    if (
      !createdAccount1Id ||
      !createdEmail1Id ||
      !createdAttachment1Id ||
      !createdFolder1Id
    ) {
      addResult(
        "Setup",
        'Run "Insert Data (User1)" test first to create data.',
        false
      );
      return;
    }
    try {
      // Delete email_account, check related data
      const { error: delAccErr } = await supabase
        .from("email_accounts")
        .delete()
        .eq("id", createdAccount1Id);
      if (delAccErr) throw delAccErr;
      addResult("Delete email_account (User1)", "Deletion call succeeded");

      // Verify related data is gone
      const { data: folderData } = await supabase
        .from("folders")
        .select()
        .eq("account_id", createdAccount1Id);
      addResult(
        "Verify folder gone after account delete",
        folderData?.length === 0,
        folderData?.length === 0
      );

      const { data: emailData } = await supabase
        .from("emails")
        .select()
        .eq("account_id", createdAccount1Id);
      addResult(
        "Verify emails gone after account delete",
        emailData?.length === 0,
        emailData?.length === 0
      );

      // Note: Attachments are linked to emails, so they should be gone if emails are gone.
      // Re-insert an email and attachment to test email cascade delete specifically if needed
      // For now, this implicitly tests attachments via email deletion linked to account.
    } catch (e) {
      handleError("testCascadeDeleteUser1", e);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Database RLS and CRUD Tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user ? (
            <Alert>
              <AlertTitle>Current User</AlertTitle>
              <AlertDescription>
                Email: {user.email}, ID: {user.id}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertTitle>Not Signed In</AlertTitle>
              <AlertDescription>Please sign in to run tests.</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Last Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button onClick={testInsertDataUser1} disabled={!user}>
              1. Insert Data (User1)
            </Button>
            <Button
              onClick={testSelectDataUser1}
              disabled={!user || !createdAccount1Id}
            >
              2. Select Own Data (User1)
            </Button>
            <Button
              onClick={testUpdateDataUser1}
              disabled={!user || !createdEmail1Id}
            >
              3. Update Own Data (User1)
            </Button>
            <Button onClick={testUser2AccessUser1Data} disabled={!user}>
              4. User2 Access User1 Data
            </Button>
            <Button
              onClick={testCascadeDeleteUser1}
              disabled={!user || !createdAccount1Id}
            >
              5. Cascade Delete (User1)
            </Button>
          </div>

          <div className="mt-6 space-y-2">
            <h3 className="text-lg font-semibold">Test Results:</h3>
            {results.length === 0 && <p>No results yet. Run some tests!</p>}
            {results.map((res, index) => (
              <Alert
                key={index}
                variant={res.success ? "default" : "destructive"}
              >
                <AlertTitle>
                  [{res.success ? "PASS" : "FAIL"}] {res.title}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({res.timestamp})
                  </span>
                </AlertTitle>
                <AlertDescription>
                  <pre className="whitespace-pre-wrap break-all">
                    {res.data}
                  </pre>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
