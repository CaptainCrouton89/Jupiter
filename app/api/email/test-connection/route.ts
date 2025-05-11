import { emailConnectionSchema } from "@/lib/validations/email"; // We'll use this to validate incoming data
import { ImapFlow } from "imapflow";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// We only need a subset of the schema for testing, password is key.
const testConnectionSchema = emailConnectionSchema.pick({
  emailAddress: true,
  password: true,
  imapServer: true,
  imapPort: true,
  smtpServer: true,
  smtpPort: true,
  security: true,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedBody = testConnectionSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: parsedBody.error.format() },
        { status: 400 }
      );
    }

    const {
      emailAddress,
      password,
      imapServer,
      imapPort,
      smtpServer,
      smtpPort,
      security,
    } = parsedBody.data;

    let imapSecure = false;
    let smtpSecure = false;
    let tlsOptions = {};

    if (security === "SSL/TLS") {
      imapSecure = true;
      smtpSecure = true;
    } else if (security === "STARTTLS") {
      // For STARTTLS, secure is often false initially, and then connection is upgraded.
      // Nodemailer handles this with `secure: false` and `requireTLS: true` or relies on opportunistic TLS.
      // ImapFlow handles this with `secure: false` and then `tls: { servername: host }` often or similar config.
      // We'll set secure to false and let the libraries handle STARTTLS negotiation if available.
      imapSecure = false;
      smtpSecure = false;
      // For STARTTLS, rejectUnauthorized might need to be false if using self-signed certs for local tests
      // but for production, it should be true. For simplicity, we'll keep default behavior.
      // tlsOptions = { rejectUnauthorized: process.env.NODE_ENV === 'production' };
    } else {
      // 'None'
      imapSecure = false;
      smtpSecure = false;
    }

    let imapError: string | null = null;
    let smtpError: string | null = null;

    // Test IMAP Connection
    const imapClient = new ImapFlow({
      host: imapServer,
      port: imapPort,
      secure: imapSecure,
      auth: {
        user: emailAddress,
        pass: password,
      },
      logger: false, // Disable verbose logging for tests, or use a custom logger for debug
      tls:
        imapSecure || security === "STARTTLS"
          ? { rejectUnauthorized: false, ...tlsOptions }
          : undefined,
      disableAutoEnable: true, // Add this to potentially avoid some server compatibility issues
    });

    try {
      await imapClient.connect();
      await imapClient.logout();
    } catch (err: any) {
      imapError = err.message || "IMAP connection failed";
      // Attempt to get more specific error type if available
      if (err.responseCode) imapError += ` (Code: ${err.responseCode})`;
      if (err.source === "timeout") imapError = "IMAP connection timed out.";
      if (err.code === "ETIMEDOUT")
        imapError = "IMAP connection timed out (ETIMEDOUT).";
      if (err.code === "ECONNREFUSED")
        imapError = "IMAP connection refused (ECONNREFUSED).";
      // console.error('IMAP Test Error:', err); // For server-side debugging
    }

    // Test SMTP Connection
    const transporter = nodemailer.createTransport({
      host: smtpServer,
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for other ports (especially 587 for STARTTLS)
      auth: {
        user: emailAddress,
        pass: password,
      },
      tls:
        smtpSecure || security === "STARTTLS"
          ? { rejectUnauthorized: false, ...tlsOptions }
          : undefined,
      // requireTLS: security === 'STARTTLS', // Alternative way to enforce STARTTLS with nodemailer
    });

    try {
      await transporter.verify();
    } catch (err: any) {
      smtpError = err.message || "SMTP connection failed";
      if (err.code === "ETIMEDOUT")
        smtpError = "SMTP connection timed out (ETIMEDOUT).";
      if (err.code === "ECONNREFUSED")
        smtpError = "SMTP connection refused (ECONNREFUSED).";
      if (err.responseCode) smtpError += ` (Code: ${err.responseCode})`;
      // console.error('SMTP Test Error:', err); // For server-side debugging
    }

    if (imapError && smtpError) {
      return NextResponse.json(
        {
          success: false,
          message: "Both IMAP and SMTP connections failed.",
          imapError,
          smtpError,
        },
        { status: 400 }
      );
    }
    if (imapError) {
      return NextResponse.json(
        {
          success: false,
          message: "IMAP connection failed, SMTP connection successful.",
          imapError,
          smtpError: null,
        },
        { status: 400 }
      );
    }
    if (smtpError) {
      return NextResponse.json(
        {
          success: false,
          message: "SMTP connection failed, IMAP connection successful.",
          imapError: null,
          smtpError,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "IMAP and SMTP connections successful!",
    });
  } catch (error: any) {
    // console.error('Test Connection API Error:', error); // For server-side debugging
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
