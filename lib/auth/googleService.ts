import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../database.types";
import { decrypt } from "./encryption";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number; // Typically 3600 seconds
  scope: string;
  token_type: "Bearer";
  id_token?: string; // Only if 'openid' scope was included
  refresh_token?: string; // Google might issue a new refresh token, though often doesn't
}

export async function refreshGoogleAccessToken(
  encryptedRefreshToken: string
): Promise<{
  newAccessToken: string;
  newExpiresAt: string;
  newRefreshToken?: string;
} | null> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error(
      "[GoogleTokenRefresh] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET"
    );
    return null;
  }

  let refreshToken: string;
  try {
    refreshToken = decrypt(encryptedRefreshToken);
  } catch (e) {
    console.error("[GoogleTokenRefresh] Failed to decrypt refresh token:", e);
    return null;
  }

  if (!refreshToken) {
    console.error("[GoogleTokenRefresh] Decrypted refresh token is empty.");
    return null;
  }

  try {
    console.log(
      "[GoogleTokenRefresh] Attempting to refresh Google access token..."
    );
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokens: GoogleTokenResponse = await response.json();

    if (!response.ok) {
      console.error(
        "[GoogleTokenRefresh] Failed to refresh token. Status:",
        response.status,
        "Response:",
        tokens
      );
      // Specific error for invalid_grant often means refresh token is revoked/expired
      if (tokens && (tokens as any).error === "invalid_grant") {
        console.error(
          "[GoogleTokenRefresh] Refresh token is invalid or revoked. User re-authentication required."
        );
        // Potentially mark the account as needing re-auth in your DB here
      }
      return null;
    }

    if (!tokens.access_token) {
      console.error(
        "[GoogleTokenRefresh] No new access_token received from Google."
      );
      return null;
    }

    const newAccessToken = tokens.access_token;
    const newExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    // Google might occasionally return a new refresh token
    const newRefreshToken = tokens.refresh_token;

    console.log(
      "[GoogleTokenRefresh] Successfully refreshed Google access token."
    );
    return {
      newAccessToken,
      newExpiresAt,
      newRefreshToken,
    };
  } catch (error) {
    console.error(
      "[GoogleTokenRefresh] Unexpected error during token refresh:",
      error
    );
    return null;
  }
}

// Helper to update the database, can be called from the sync route
export async function updateEmailAccountTokens(
  supabase: SupabaseClient<Database>,
  accountId: string,
  newEncryptedAccessToken: string,
  newExpiresAt: string,
  newEncryptedRefreshToken?: string | null // Optional, if Google returns a new one
) {
  const updateData: Partial<
    Database["public"]["Tables"]["email_accounts"]["Update"]
  > = {
    access_token_encrypted: newEncryptedAccessToken,
    token_expires_at: newExpiresAt,
    last_oauth_error: null, // Clear any previous OAuth error
  };

  if (newEncryptedRefreshToken) {
    updateData.refresh_token_encrypted = newEncryptedRefreshToken;
  }

  const { error } = await supabase
    .from("email_accounts")
    .update(updateData)
    .eq("id", accountId);

  if (error) {
    console.error(
      `[GoogleTokenRefresh] Failed to update tokens in DB for account ${accountId}:`,
      error
    );
    // Depending on policy, you might want to throw here or handle more gracefully
  }
  console.log(
    `[GoogleTokenRefresh] Successfully updated tokens in DB for account ${accountId}`
  );
}
