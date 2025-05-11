import { createClient } from "@/lib/auth/server";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

interface AttachmentInput {
  storage_path: string;
  filename: string;
  content_type: string;
  size: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { emailId, attachments } = (await request.json()) as {
      emailId: string;
      attachments: AttachmentInput[];
    };

    if (!emailId || !attachments || attachments.length === 0) {
      return NextResponse.json(
        { error: "Email ID and at least one attachment are required" },
        { status: 400 }
      );
    }

    const recordsToInsert = attachments.map((att) => ({
      id: uuidv4(),
      email_id: emailId,
      storage_path: att.storage_path,
      filename: att.filename,
      content_type: att.content_type,
      size: att.size,
      // account_id will be implicitly handled by RLS on emails table if we join,
      // but for direct insert into attachments, RLS relies on email_id linkage.
    }));

    const { data, error } = await supabase
      .from("attachments")
      .insert(recordsToInsert)
      .select();

    if (error) {
      console.error("Error associating attachments:", error);
      return NextResponse.json(
        { error: "Failed to associate attachments", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Attachments associated successfully",
      records: data,
    });
  } catch (error: any) {
    console.error("Error in associate attachments route:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error.message },
      { status: 500 }
    );
  }
}
