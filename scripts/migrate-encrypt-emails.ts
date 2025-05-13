import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { encrypt } from "../lib/auth/encryption";
import { Database } from "../lib/database.types";

// Load environment variables
dotenv.config();

// Check if encryption key is available
if (!process.env.ENCRYPTION_KEY) {
  console.error("Error: ENCRYPTION_KEY environment variable is not set");
  process.exit(1);
}

// Supabase connection details from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: Supabase URL or service role key is missing");
  process.exit(1);
}

async function migrateEmails() {
  // Initialize Supabase with service role for admin access
  const supabase = createClient<Database>(
    supabaseUrl as string,
    supabaseServiceKey as string
  );

  console.log("Starting email content encryption migration...");

  // Function to check if string might be encrypted
  // This is a basic check - encrypted strings with our method start with hex-encoded IV
  function isLikelyEncrypted(str: string | null): boolean {
    if (!str) return false;
    // Our encryption prepends a 16-byte IV (32 hex chars) and a 16-byte authTag (32 hex chars)
    // So encrypted strings are at least 64 chars and only contain hex chars at the beginning
    return str.length >= 64 && /^[0-9a-f]{64}/i.test(str);
  }

  // Count total emails
  const { count: totalEmails, error: countError } = await supabase
    .from("emails")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("Error counting emails:", countError);
    process.exit(1);
  }

  console.log(`Found ${totalEmails} total emails to process.`);

  // Set batch size for processing
  const batchSize = 100;
  let processed = 0;
  let updated = 0;
  let errored = 0;

  // Process in batches to avoid memory issues
  for (let offset = 0; offset < (totalEmails || 0); offset += batchSize) {
    console.log(`Processing batch starting at offset ${offset}...`);

    // Fetch a batch of emails
    const { data: emails, error: fetchError } = await supabase
      .from("emails")
      .select("id, body_html, body_text")
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      console.error(`Error fetching emails at offset ${offset}:`, fetchError);
      errored += batchSize;
      continue;
    }

    if (!emails || emails.length === 0) {
      console.log(`No emails found at offset ${offset}, skipping.`);
      continue;
    }

    // Process each email in the batch
    for (const email of emails) {
      try {
        let needsUpdate = false;
        const updates: Database["public"]["Tables"]["emails"]["Update"] = {};

        // Check and encrypt HTML content if needed
        if (email.body_html && !isLikelyEncrypted(email.body_html)) {
          updates.body_html = encrypt(email.body_html);
          needsUpdate = true;
        }

        // Check and encrypt text content if needed
        if (email.body_text && !isLikelyEncrypted(email.body_text)) {
          updates.body_text = encrypt(email.body_text);
          needsUpdate = true;
        }

        // Update the email if changes needed
        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from("emails")
            .update(updates)
            .eq("id", email.id);

          if (updateError) {
            console.error(`Error updating email ${email.id}:`, updateError);
            errored++;
          } else {
            updated++;
          }
        }

        processed++;

        // Log progress periodically
        if (processed % 100 === 0 || processed === totalEmails) {
          console.log(
            `Progress: ${processed}/${totalEmails} (${Math.round(
              (processed / (totalEmails || 1)) * 100
            )}%)`
          );
          console.log(`Updated: ${updated}, Errors: ${errored}`);
        }
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
        errored++;
      }
    }
  }

  console.log("==== Migration Complete ====");
  console.log(`Total emails processed: ${processed}`);
  console.log(`Emails updated: ${updated}`);
  console.log(`Errors: ${errored}`);
}

// Run the migration
migrateEmails()
  .then(() => {
    console.log("Encryption migration completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
