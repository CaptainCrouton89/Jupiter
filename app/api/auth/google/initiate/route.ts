import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI; // e.g., http://localhost:3000/api/auth/google/callback or your production URL

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
    "https://www.googleapis.com/auth/gmail.readonly", // Read access to Gmail
    // Add other scopes as needed, e.g., for sending mail or modifying labels
    // "https://mail.google.com/" // Full access to Gmail (use with caution)
  ];

  const authUrlParams = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline", // Important to get a refresh token
    prompt: "consent", // Optional: force consent screen every time for testing, or to ensure user re-consents if scopes change
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
