// "use server"; // Removed this directive

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../database.types"; // Assuming database.types.ts is in the parent directory (lib/)

// It\'s generally better to create the client instance on demand rather than a singleton
// if the environment variables might change or for testing purposes,
// but a singleton is okay for simplicity in many apps.
// Let\'s make it a function that returns a new client or a cached one.

let adminSupabaseClient: SupabaseClient<Database> | null = null;

/**
 * Returns a Supabase client initialized with the Service Role Key.
 * This client should be used for server-side operations requiring admin privileges
 * and can bypass RLS policies.
 *
 * IMPORTANT: Ensure SUPABASE_SERVICE_ROLE_KEY is set in your environment variables.
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> {
  console.log("[ADMIN_CLIENT_DEBUG] Trying to get Supabase admin client.");
  console.log(
    "[ADMIN_CLIENT_DEBUG] NEXT_PUBLIC_SUPABASE_URL:",
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
  console.log(
    "[ADMIN_CLIENT_DEBUG] SUPABASE_SERVICE_ROLE_KEY:",
    process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET (value hidden)" : "NOT SET"
  ); // Don't log the key itself

  if (adminSupabaseClient) {
    console.log("[ADMIN_CLIENT_DEBUG] Returning cached admin client.");
    return adminSupabaseClient;
  }
  console.log("[ADMIN_CLIENT_DEBUG] No cached client, creating new one.");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error("[ADMIN_CLIENT_ERROR] Supabase URL is not defined!");
    throw new Error(
      "Supabase URL is not defined in environment variables (NEXT_PUBLIC_SUPABASE_URL)."
    );
  }
  if (!supabaseServiceRoleKey) {
    console.error(
      "[ADMIN_CLIENT_ERROR] Supabase Service Role Key is not defined!"
    );
    throw new Error(
      "Supabase Service Role Key is not defined in environment variables (SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  console.log(
    "[ADMIN_CLIENT_DEBUG] Initializing new admin client with URL:",
    supabaseUrl
  );
  adminSupabaseClient = createClient<Database>(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  console.log("[ADMIN_CLIENT_DEBUG] New admin client initialized.");

  return adminSupabaseClient;
}

// Optional: A function to create a new admin client instance every time, without caching.
// This can be useful if you have concerns about statefulness of the cached client,
// though for most operations the cached version is fine.
export function createNewSupabaseAdminClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error(
      "[ADMIN_CLIENT_ERROR] Supabase URL is not defined! (createNew)"
    );
    throw new Error(
      "Supabase URL is not defined in environment variables (NEXT_PUBLIC_SUPABASE_URL)."
    );
  }
  if (!supabaseServiceRoleKey) {
    console.error(
      "[ADMIN_CLIENT_ERROR] Supabase Service Role Key is not defined! (createNew)"
    );
    throw new Error(
      "Supabase Service Role Key is not defined in environment variables (SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  console.log(
    "[ADMIN_CLIENT_DEBUG] Initializing new non-cached admin client with URL:",
    supabaseUrl
  );
  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
