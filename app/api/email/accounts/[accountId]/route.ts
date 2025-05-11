import { encrypt } from "@/lib/auth/encryption";
import { createClient } from "@/lib/auth/server";
import { Database } from "@/lib/database.types";
import { emailConnectionSchema } from "@/lib/validations/email";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  const supabase = await createClient();
  const { accountId } = params;

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
    const body = await request.json();
    const validatedData = emailConnectionSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { message: "Invalid data", errors: validatedData.error.format() },
        { status: 400 }
      );
    }

    const updatePayload: Partial<
      Database["public"]["Tables"]["email_accounts"]["Update"]
    > = {
      name: validatedData.data.accountName,
      email: validatedData.data.emailAddress,
      username: validatedData.data.emailAddress, // Assuming username is same as email for IMAP/SMTP
      imap_host: validatedData.data.imapServer,
      imap_port: validatedData.data.imapPort,
      smtp_host: validatedData.data.smtpServer,
      smtp_port: validatedData.data.smtpPort,
      // security settings (like SSL/TLS) might need to be stored if they vary from defaults
      // For now, we assume they are handled by port numbers or are default true
    };

    // Fetch the existing account to check ownership and current password
    const { data: existingAccount, error: fetchError } = await supabase
      .from("email_accounts")
      .select("id, user_id, password_encrypted")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existingAccount) {
      return NextResponse.json(
        { message: "Account not found or not authorized" },
        { status: 404 }
      );
    }

    // Handle password update: only encrypt and update if a new password is provided
    // and it's not an empty string (assuming form sends empty string if not changed)
    if (
      validatedData.data.password &&
      validatedData.data.password.trim() !== ""
    ) {
      // A new password has been entered. We need to check if it's different from the old one.
      // However, we can't directly compare the new plain text password with the stored encrypted one.
      // The most straightforward approach for an edit form is: if the password field is filled,
      // assume the user intends to change it.
      updatePayload.password_encrypted = encrypt(validatedData.data.password);
    } // If password field is empty/not provided, we don't update password_encrypted

    const { data: updatedAccount, error: updateError } = await supabase
      .from("email_accounts")
      .update(updatePayload)
      .eq("id", accountId)
      .eq("user_id", user.id) // Re-affirm user_id for safety, though covered by prior fetch
      .select()
      .single();

    if (updateError) {
      console.error("Error updating account:", updateError);
      return NextResponse.json(
        { message: "Failed to update account", error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error("PUT /api/email/accounts/[accountId] Error:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  const supabase = await createClient();
  const { accountId } = params;

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
    // First, verify the account exists and belongs to the user before deleting
    const {
      error: fetchError,
      count, // We only need to know if it exists and is owned by user
    } = await supabase
      .from("email_accounts")
      .select("id", { count: "exact", head: true })
      .eq("id", accountId)
      .eq("user_id", user.id);

    if (fetchError) {
      console.error("Error fetching account before delete:", fetchError);
      return NextResponse.json(
        {
          message: "Error verifying account before deletion",
          error: fetchError.message,
        },
        { status: 500 }
      );
    }

    if (count === 0 || count === null) {
      return NextResponse.json(
        { message: "Account not found or not authorized for deletion" },
        { status: 404 }
      );
    }

    // Proceed with deletion
    const { error: deleteError } = await supabase
      .from("email_accounts")
      .delete()
      .eq("id", accountId)
      .eq("user_id", user.id); // Re-affirm user_id for safety

    if (deleteError) {
      console.error("Error deleting account:", deleteError);
      return NextResponse.json(
        { message: "Failed to delete account", error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Account deleted successfully" },
      { status: 200 } // Or 204 No Content, but 200 with message is also fine
    );
  } catch (error) {
    console.error("DELETE /api/email/accounts/[accountId] Error:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred during deletion" },
      { status: 500 }
    );
  }
}
