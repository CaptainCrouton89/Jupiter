import { encrypt } from "@/lib/auth/encryption";
import { createClient } from "@/lib/auth/server";
import type { Database } from "@/lib/database.types";
import { emailConnectionSchema } from "@/lib/validations/email";
import { NextRequest, NextResponse } from "next/server";
// import { supabaseAdmin } from '@/lib/supabaseAdmin'; // Only if RLS becomes an issue for user client

// This type can be removed if EmailConnectionFormValues is directly used and mapped
// interface EmailAccountInsert extends Omit<EmailConnectionFormValues, 'password'> {
//   user_id: string;
//   password_encrypted: string;
// }

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsedBody = emailConnectionSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: parsedBody.error.format() },
        { status: 400 }
      );
    }

    const {
      emailAddress,
      password, // Plain text password from form
      imapServer,
      imapPort,
      smtpServer,
      smtpPort,
      security,
      accountName,
    } = parsedBody.data;

    const password_encrypted = encrypt(password);

    // Ensure this object matches the structure of Database['public']['Tables']['email_accounts']['Insert']
    // from your newly regenerated lib/database.types.ts
    const dbInsertData: Database["public"]["Tables"]["email_accounts"]["Insert"] =
      {
        username: accountName || emailAddress,
        user_id: user.id,
        email: emailAddress, // SQL column: email_address
        password_encrypted, // SQL column: password_encrypted
        imap_host: imapServer, // SQL column: imap_server
        imap_port: imapPort, // SQL column: imap_port
        smtp_host: smtpServer, // SQL column: smtp_server
        smtp_port: smtpPort, // SQL column: smtp_port
        // provider: 'custom', // Optional field, not in current form
      };

    const { data, error } = await supabase
      .from("email_accounts")
      .insert([dbInsertData])
      .select()
      .single();

    if (error) {
      console.error("Error saving email account:", error);
      if (error.code === "23505") {
        return NextResponse.json(
          { message: "This email account is already connected." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { message: "Failed to save email account", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Email account connected successfully!", data },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Save Account API Error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
