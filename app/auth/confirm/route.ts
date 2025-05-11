import { createClient } from "@/lib/auth/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/"; // Default redirect for email confirmation

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // Redirect based on OTP type
      if (type === "recovery") {
        // For password recovery, redirect to the page where the user can set a new password.
        // The page itself will handle the session and show the form.
        // Supabase handles the code verification via the link itself.
        // We might pass the access_token if needed, but Supabase client handles it.
        redirect("/auth/reset-password");
      } else if (
        type === "signup" ||
        type === "magiclink" ||
        type === "email_change" ||
        type === "email"
      ) {
        // For email confirmation (signup, magiclink, email change)
        redirect(next);
      } else {
        // Unknown OTP type, redirect to error
        redirect("/error?message=Invalid+OTP+type");
      }
    }
  }

  // If token_hash or type is missing, or if verifyOtp fails
  redirect("/error?message=Invalid+or+expired+confirmation+link");
}
