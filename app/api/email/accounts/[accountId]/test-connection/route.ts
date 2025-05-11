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
        "email, password_encrypted, imap_host, imap_port, smtp_host, smtp_port"
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

    if (!account.password_encrypted) {
      return NextResponse.json(
        { message: "Account password not set" },
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
