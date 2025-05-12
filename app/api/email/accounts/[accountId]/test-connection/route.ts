import { decrypt } from "@/lib/auth/encryption";
import { createClient } from "@/lib/auth/server";
import { ImapFlow } from "imapflow";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { Readable } from "stream";

// Helper to convert stream to string
async function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

export async function POST(
  request: Request, // Keep request for potential future use, though not strictly needed now
  { params }: { params: Promise<{ accountId: string }> }
) {
  const supabase = await createClient();
  const { accountId } = await params;

  if (!accountId) {
    return NextResponse.json(
      { message: "Account ID is required" },
      { status: 400 }
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: account, error: fetchError } = await supabase
      .from("email_accounts")
      .select(
        "email, password_encrypted, imap_host, imap_port, smtp_host, smtp_port, provider, access_token_encrypted, token_expires_at"
      )
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !account) {
      return NextResponse.json(
        { message: "Account not found or not authorized" },
        { status: 404 }
      );
    }

    // Handle OAuth providers (e.g., Google)
    if (account.provider === "google") {
      if (!account.access_token_encrypted) {
        return NextResponse.json(
          { message: "Google account access token not found." },
          { status: 400 }
        );
      }
      try {
        const accessToken = decrypt(account.access_token_encrypted);

        // Optional: Check token expiry if available (client-side check before API call)
        if (account.token_expires_at) {
          const expiryDate = new Date(account.token_expires_at);
          if (expiryDate < new Date()) {
            // Token is likely expired, though API call will confirm
            // Consider prompting for re-authentication or attempting refresh token flow (future)
            console.warn(`Access token for ${account.email} may have expired.`);
            // For now, we'll still attempt the API call as the expiry might be slightly off
            // or a refresh mechanism (not yet implemented here) might handle it.
          }
        }

        const userInfoResponse = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!userInfoResponse.ok) {
          const errorData = await userInfoResponse.json().catch(() => ({})); // Try to get error details
          console.error(
            `Google API error for ${account.email} (token test):`,
            userInfoResponse.status,
            errorData
          );
          return NextResponse.json(
            {
              message:
                "Failed to verify Google account connection. Token may be invalid or expired.",
              details: errorData.error?.message || "API request failed",
            },
            { status: 400 } // Or userInfoResponse.status if you want to propagate it
          );
        }
        // const userInfo = await userInfoResponse.json(); // Can use if needed
        return NextResponse.json({
          message: "Google account connection successful.",
        });
      } catch (oauthError: any) {
        console.error(
          `Error during Google OAuth connection test for ${account.email}:`,
          oauthError
        );
        return NextResponse.json(
          { message: "Error testing Google connection: " + oauthError.message },
          { status: 500 }
        );
      }
    } else {
      // Existing IMAP/SMTP logic for non-OAuth accounts or accounts without 'provider' field

      // Ensure all required IMAP/SMTP fields are present for a manual connection test
      if (!account.email) {
        return NextResponse.json(
          { message: "Account email address not found." },
          { status: 400 }
        );
      }
      if (!account.password_encrypted) {
        return NextResponse.json(
          { message: "Account password not set for manual configuration." },
          { status: 400 }
        );
      }
      if (!account.imap_host || !account.imap_port) {
        return NextResponse.json(
          {
            message:
              "IMAP server host or port not set for manual configuration.",
          },
          { status: 400 }
        );
      }
      if (!account.smtp_host || !account.smtp_port) {
        return NextResponse.json(
          {
            message:
              "SMTP server host or port not set for manual configuration.",
          },
          { status: 400 }
        );
      }

      const password = decrypt(account.password_encrypted);

      let imapSuccess = false;
      let smtpSuccess = false;
      let imapError: string | null = null;
      let smtpError: string | null = null;

      // Test IMAP connection
      const imapClient = new ImapFlow({
        host: account.imap_host,
        port: account.imap_port,
        secure: true,
        auth: {
          user: account.email,
          pass: password,
        },
        logger: false, // Set to true for debugging IMAP flow
      });

      try {
        await imapClient.connect();
        await imapClient.logout();
        imapSuccess = true;
      } catch (err: any) {
        console.error(`IMAP connection error for ${account.email}:`, err);
        imapError = err.message || "IMAP connection failed.";
        // Attempt to get more specific error type if available
        if (err.source === "authentication") {
          imapError = "IMAP authentication failed. Check username or password.";
        }
      }

      // Test SMTP connection
      const transporter = nodemailer.createTransport({
        host: account.smtp_host,
        port: account.smtp_port,
        secure: true,
        auth: {
          user: account.email,
          pass: password,
        },
        tls: {
          rejectUnauthorized: false, // Important for some servers, especially self-signed certs
        },
      });

      try {
        await transporter.verify();
        smtpSuccess = true;
      } catch (err: any) {
        console.error(`SMTP connection error for ${account.email}:`, err);
        smtpError = err.message || "SMTP connection failed.";
        if (err.code === "EAUTH" || err.responseCode === 535) {
          smtpError = "SMTP authentication failed. Check username or password.";
        }
      }

      if (imapSuccess && smtpSuccess) {
        // Optionally, update last_tested_at or connection_status in DB here
        return NextResponse.json({
          message: "IMAP and SMTP connections successful.",
        });
      } else {
        return NextResponse.json(
          {
            message: "One or more connection tests failed.",
            imap: { success: imapSuccess, error: imapError },
            smtp: { success: smtpSuccess, error: smtpError },
          },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error(
      "POST /api/email/accounts/[accountId]/test-connection Error:",
      error
    );
    if (
      error instanceof Error &&
      error.message.includes("Unsupported state or unable to authenticate")
    ) {
      return NextResponse.json(
        {
          message:
            "Authentication error: Unsupported state or unable to authenticate. Check IMAP/SMTP server capabilities and credentials.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "An unexpected error occurred during connection testing" },
      { status: 500 }
    );
  }
}
