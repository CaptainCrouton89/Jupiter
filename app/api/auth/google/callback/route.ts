import { encrypt } from "@/lib/auth/encryption"; // For token encryption
import { createClient } from "@/lib/auth/server"; // Assuming Supabase server client
import type { Database } from "@/lib/database.types"; // Import Database types
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies(); // Ensure we await if cookies() returns a Promise
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("User not authenticated for OAuth callback:", userError);
    // Create a new URL object based on the request URL for proper redirection
    const loginRedirectUrl = new URL("/login?error=unauthenticated", req.url);
    return NextResponse.redirect(loginRedirectUrl);
  }

  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const receivedState = searchParams.get("state");

  const storedStateCookie = cookieStore.get("google_oauth_state");
  const storedState = storedStateCookie?.value;

  // Prepare a base response for setting/clearing cookies on redirect
  // We will redirect, so create a response object to modify its headers for cookie operations.
  const redirectResponse = NextResponse.redirect(
    new URL("/accounts/connect", req.url)
  ); // Default redirect

  // Clear the state cookie once read, on the outgoing response
  redirectResponse.cookies.set("google_oauth_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0, // Expire immediately
    path: "/",
  });

  if (!storedState || !receivedState || storedState !== receivedState) {
    console.error("OAuth state mismatch. Possible CSRF attack.");
    redirectResponse.headers.set(
      "Location",
      new URL("/accounts/connect?error=state_mismatch", req.url).toString()
    );
    return redirectResponse;
  }

  if (!code) {
    const error = searchParams.get("error");
    console.error("OAuth callback error:", error || "No code received.");
    redirectResponse.headers.set(
      "Location",
      new URL(
        `/accounts/connect?error=${error || "oauth_failed"}`,
        req.url
      ).toString()
    );
    return redirectResponse;
  }

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !REDIRECT_URI) {
    console.error("Google OAuth client credentials or redirect URI not set.");
    redirectResponse.headers.set(
      "Location",
      new URL("/accounts/connect?error=config_error", req.url).toString()
    );
    return redirectResponse;
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Failed to exchange code for tokens:", tokens);
      redirectResponse.headers.set(
        "Location",
        new URL(
          `/accounts/connect?error=token_exchange_failed&details=${
            tokens.error_description || tokens.error || ""
          }`,
          req.url
        ).toString()
      );
      return redirectResponse;
    }

    const {
      access_token,
      refresh_token,
      expires_in,
      scope: granted_scopes_string,
    } = tokens;

    if (!access_token) {
      console.error("No access_token received from Google.");
      redirectResponse.headers.set(
        "Location",
        new URL("/accounts/connect?error=no_access_token", req.url).toString()
      );
      return redirectResponse;
    }

    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    const userInfo = await userInfoResponse.json();

    if (!userInfoResponse.ok || !userInfo.email) {
      console.error("Failed to fetch user info from Google:", userInfo);
      redirectResponse.headers.set(
        "Location",
        new URL("/accounts/connect?error=userinfo_failed", req.url).toString()
      );
      return redirectResponse;
    }

    const emailAddress = userInfo.email;
    // Use email as name by default, or Google's provided name if available
    const accountName = userInfo.name || emailAddress;

    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;
    const tokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;
    const scopesArray = granted_scopes_string
      ? granted_scopes_string.split(" ")
      : [];

    // Type assertion for insert/update data - assuming schema will be updated
    const accountDataForDb = {
      user_id: user.id,
      email: emailAddress,
      name: accountName,
      provider: "google",
      access_token_encrypted: encryptedAccessToken,
      refresh_token_encrypted: encryptedRefreshToken,
      token_expires_at: tokenExpiresAt,
      scopes: scopesArray,
      last_oauth_error: null,
      // Nullify IMAP/SMTP specific fields for OAuth accounts if your schema requires them
      // or if you want to explicitly clear them.
      imap_host: null,
      imap_port: null,
      smtp_host: null,
      smtp_port: null,
      password_encrypted: null,
      // `username` field might be `accountName` or specific to IMAP; adjust as needed.
      // If `username` is strictly for IMAP and not a general friendly name, set to null.
      username: accountName, // Or null if 'name' field is the primary friendly name
    } as any; // Using 'as any' temporarily due to schema/type differences. THIS SHOULD BE RESOLVED BY UPDATING DB SCHEMA AND TYPES.
    // For updates, we need a slightly different approach if some fields are not updatable.
    const accountUpdateData = {
      access_token_encrypted: encryptedAccessToken,
      refresh_token_encrypted: encryptedRefreshToken,
      token_expires_at: tokenExpiresAt,
      scopes: scopesArray,
      last_oauth_error: null,
      name: accountName, // Update name if it changed in Google profile
      provider: "google", // Ensure provider is set on update as well
      // Ensure other fields like email, user_id are not in update if they are immutable post-creation
    } as Partial<Database["public"]["Tables"]["email_accounts"]["Update"]>;

    const { data: existingAccount, error: existingAccountError } =
      await supabase
        .from("email_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("email", emailAddress)
        .eq("provider", "google")
        .maybeSingle();

    if (existingAccountError && existingAccountError.code !== "PGRST116") {
      console.error(
        "Error checking for existing email account:",
        existingAccountError
      );
      redirectResponse.headers.set(
        "Location",
        new URL("/accounts/connect?error=db_check_error", req.url).toString()
      );
      return redirectResponse;
    }

    if (existingAccount) {
      const { error: updateError } = await supabase
        .from("email_accounts")
        .update(accountUpdateData as any) // Using 'as any' temporarily
        .eq("id", existingAccount.id);
      if (updateError) {
        console.error("Error updating OAuth account:", updateError);
        redirectResponse.headers.set(
          "Location",
          new URL(
            "/accounts/connect?error=db_update_failed",
            req.url
          ).toString()
        );
        return redirectResponse;
      }
      console.log(
        "Google OAuth account tokens updated successfully for user:",
        user.id,
        "email:",
        emailAddress
      );
    } else {
      const { error: insertError } = await supabase
        .from("email_accounts")
        .insert(accountDataForDb); // Removed 'as any' here to see if previous type assertion helps, but likely still needs schema update.
      if (insertError) {
        console.error("Error inserting new OAuth account:", insertError);
        redirectResponse.headers.set(
          "Location",
          new URL(
            "/accounts/connect?error=db_insert_failed",
            req.url
          ).toString()
        );
        return redirectResponse;
      }
      console.log(
        "Google OAuth account connected successfully for user:",
        user.id,
        "email:",
        emailAddress
      );
    }

    redirectResponse.headers.set(
      "Location",
      new URL("/accounts?success=google_connected", req.url).toString()
    );
    return redirectResponse;
  } catch (error) {
    console.error("Unexpected error in Google OAuth callback:", error);
    redirectResponse.headers.set(
      "Location",
      new URL("/accounts/connect?error=callback_exception", req.url).toString()
    );
    return redirectResponse;
  }
}
