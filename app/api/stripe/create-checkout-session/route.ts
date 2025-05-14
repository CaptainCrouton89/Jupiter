import { createNewSupabaseAdminClient } from "@/lib/auth/admin"; // Use admin client for server-side updates
import { NextResponse } from "next/server";

const priceId = process.env.STRIPE_PRICE_ID || "";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Add debug logging for configuration
console.log(`Stripe configuration:`);
console.log(`- Price ID exists: ${!!priceId}`);
console.log(`- App URL configured: ${appUrl}`);
console.log(`- Webhook secret exists: ${!!webhookSecret}`);

export async function POST(request: Request) {
  try {
    console.log("Creating checkout session");
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");

    console.log(`Stripe key exists: ${!!process.env.STRIPE_SECRET_KEY}`);
    const { userId, userEmail } = await request.json();

    console.log(
      `Creating checkout for user ID: ${userId}, email: ${userEmail}`
    );

    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: { message: "User ID and email are required." } },
        { status: 400 }
      );
    }

    if (!priceId) {
      console.error("Stripe Price ID is not configured.");
      return NextResponse.json(
        {
          error: {
            message:
              "Subscription pricing is not configured. Please contact support.",
          },
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createNewSupabaseAdminClient();

    // Check if user already has a stripe_customer_id
    const { data: userSettings, error: settingsError } = await supabaseAdmin
      .from("user_settings")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (settingsError && settingsError.code !== "PGRST116") {
      // PGRST116: row not found, which is fine
      console.error(
        "Error fetching user settings for Stripe customer ID:",
        settingsError
      );
      throw settingsError;
    }

    let stripeCustomerId = userSettings?.stripe_customer_id;
    console.log(`Existing Stripe customer ID: ${stripeCustomerId || "None"}`);

    if (!stripeCustomerId) {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          userId: userId,
        },
      });
      stripeCustomerId = customer.id;
      console.log(`Created new Stripe customer: ${stripeCustomerId}`);

      // Save the new stripe_customer_id to user_settings
      const { error: updateError } = await supabaseAdmin
        .from("user_settings")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("user_id", userId);

      if (updateError) {
        console.error(
          "Error updating user_settings with Stripe customer ID:",
          updateError
        );
        // Not throwing here, as checkout can proceed, but needs monitoring
      } else {
        console.log(
          `Saved Stripe customer ID to user_settings for user: ${userId}`
        );
      }
    } else {
      console.log(`Using existing Stripe customer: ${stripeCustomerId}`);
      // Potentially update Stripe customer email if it has changed in our system
      // For simplicity, skipping this for now but important for production
    }

    // Create a Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/settings?success=true`,
      cancel_url: `${appUrl}/settings?cancel=true`,
      // Set detailed metadata for webhook processing
      metadata: {
        userId: userId,
        userEmail: userEmail,
        createdAt: new Date().toISOString(),
      },
    });

    if (!session.id) {
      throw new Error("Could not create Stripe Checkout session.");
    }

    console.log(`Created Stripe Checkout session: ${session.id}`);
    console.log(
      `Session details: ${JSON.stringify({
        customer: session.customer,
        url: session.url,
        metadata: session.metadata,
      })}`
    );

    // Return the session URL in a JSON response
    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error("Stripe create-checkout-session error:", error);
    return NextResponse.json(
      { error: { message: error.message || "Internal ServerError" } },
      { status: 500 }
    );
  }
}
