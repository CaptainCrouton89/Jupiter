import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!GOOGLE_CLIENT_ID || !REDIRECT_URI) {
    console.error("Google OAuth environment variables not set.");
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 500 }
    );
  }

  const state = randomBytes(16).toString("hex");

  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email", // Get user's email address
    "https://www.googleapis.com/auth/userinfo.profile", // Get user's basic profile info
    "https://mail.google.com/", // Full access for IMAP, SMTP, POP3 via XOAUTH2
    "https://www.googleapis.com/auth/gmail.readonly", // Read all resources and their metadata
    "https://www.googleapis.com/auth/gmail.modify", // Create, read, update, delete drafts, labels, messages, threads. Send messages.
    "https://www.googleapis.com/auth/gmail.send",
  ];

  const authUrlParams = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline", // Important to get a refresh token
    prompt: "consent", // Force consent screen to ensure user approves new/changed scopes
    state: state,
  });

  const authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authUrlParams.toString()}`;

  // Create the redirect response
  const response = NextResponse.redirect(authorizationUrl);

  // Set the state cookie on the response
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 15, // 15 minutes
    path: "/", // Important: ensure path allows callback to read it
  });

  return response;
}
