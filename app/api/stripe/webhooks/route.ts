const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");
import { createNewSupabaseAdminClient } from "@/lib/auth/admin"; // Uncommented for DB updates
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  console.log("🔔 Webhook endpoint hit!");

  if (!webhookSecret) {
    console.error("⚠️ STRIPE_WEBHOOK_SECRET is not set.");
    return NextResponse.json(
      { error: "Webhook secret not configured." },
      { status: 500 }
    );
  }

  const supabaseAdmin = createNewSupabaseAdminClient();

  try {
    const rawBody = await request.text();
    console.log(`📝 Received webhook payload of length: ${rawBody.length}`);

    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      console.error("❌ No stripe-signature header found in request");
      return NextResponse.json(
        { error: "No stripe-signature header found." },
        { status: 400 }
      );
    }

    console.log(
      `🔑 Received Stripe signature: ${signature.substring(0, 10)}...`
    );

    try {
      const event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );

      // Successfully constructed event
      console.log(
        `✅ Stripe Webhook Success: ${event.id}, Type: ${event.type}`
      );
      console.log(
        `📋 Event data summary:`,
        JSON.stringify({
          type: event.type,
          object_id: event.data.object.id,
          api_version: event.api_version,
          created: new Date(event.created * 1000).toISOString(),
        })
      );

      // Handle the event
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          console.log("💰 Checkout session completed:", session.id);
          console.log(
            "📊 Session data:",
            JSON.stringify({
              customer: session.customer,
              subscription: session.subscription,
              metadata: session.metadata,
            })
          );

          // Get user ID and customer ID from the session
          const userId = session.metadata?.userId;
          const stripeCustomerId = session.customer;
          const subscriptionId = session.subscription;

          if (userId && stripeCustomerId && subscriptionId) {
            // Get subscription details to fetch price ID and period end
            try {
              // Use any to bypass TypeScript limitations with Stripe types
              const subscription = await stripe.subscriptions.retrieve(
                typeof subscriptionId === "string"
                  ? subscriptionId
                  : subscriptionId.id
              );

              console.log("🔄 Retrieved subscription:", subscription.id);

              // Convert UNIX timestamp to ISO string for the database
              const currentPeriodEnd = subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null;

              // Get the price ID from the subscription
              const priceId = subscription.items.data[0]?.price.id || null;

              console.log("💾 Updating user_settings for user:", userId);
              // Update the user's subscription details
              const { data, error } = await supabaseAdmin
                .from("user_settings")
                .update({
                  stripe_customer_id:
                    typeof stripeCustomerId === "string"
                      ? stripeCustomerId
                      : stripeCustomerId.id,
                  stripe_subscription_id:
                    typeof subscriptionId === "string"
                      ? subscriptionId
                      : subscriptionId.id,
                  stripe_price_id: priceId,
                  stripe_subscription_status: subscription.status,
                  stripe_current_period_end: currentPeriodEnd,
                })
                .eq("user_id", userId)
                .select();

              if (error) {
                console.error("❌ Supabase update error:", error);
              } else {
                console.log(
                  `✅ User ${userId} subscription updated successfully:`,
                  data
                );
              }
            } catch (error) {
              console.error(
                "❌ Error updating user after checkout completion:",
                error
              );
            }
          } else {
            console.warn("⚠️ Missing required data in checkout session:", {
              userId,
              customerId: stripeCustomerId,
              subscriptionId,
            });
          }
          break;
        }
        case "customer.subscription.created": {
          const subscription = event.data.object;
          console.log(
            "🆕 Subscription created:",
            subscription.id,
            "Status:",
            subscription.status
          );

          // Get the customer ID from the subscription
          const customerId = subscription.customer;
          if (typeof customerId === "string") {
            try {
              // Find the user by their stripe customer ID
              const { data: userData, error } = await supabaseAdmin
                .from("user_settings")
                .select("user_id")
                .eq("stripe_customer_id", customerId)
                .single();

              if (userData && userData.user_id) {
                // Get the price ID from the subscription
                const priceId = subscription.items.data[0]?.price.id || null;

                // Convert UNIX timestamp to ISO string
                const currentPeriodEnd = subscription.current_period_end
                  ? new Date(
                      subscription.current_period_end * 1000
                    ).toISOString()
                  : null;

                // Update the user's subscription details
                await supabaseAdmin
                  .from("user_settings")
                  .update({
                    stripe_subscription_id: subscription.id,
                    stripe_price_id: priceId,
                    stripe_subscription_status: subscription.status,
                    stripe_current_period_end: currentPeriodEnd,
                  })
                  .eq("user_id", userData.user_id);

                console.log(
                  `✅ User ${userData.user_id} subscription created and updated.`
                );
              } else {
                console.warn(
                  `⚠️ No user found with Stripe customer ID: ${customerId}`
                );
              }
            } catch (error) {
              console.error(
                "❌ Error updating user after subscription creation:",
                error
              );
            }
          }
          break;
        }
        case "customer.subscription.updated": {
          const subscription = event.data.object;
          console.log(
            "🔄 Subscription updated:",
            subscription.id,
            "Status:",
            subscription.status
          );

          // Get the customer ID from the subscription
          const customerId = subscription.customer;
          if (typeof customerId === "string") {
            try {
              // Find the user by their stripe customer ID
              const { data: userData, error } = await supabaseAdmin
                .from("user_settings")
                .select("user_id")
                .eq("stripe_customer_id", customerId)
                .single();

              if (userData && userData.user_id) {
                // Get the price ID from the subscription
                const priceId = subscription.items.data[0]?.price.id || null;

                // Convert UNIX timestamp to ISO string
                const currentPeriodEnd = subscription.current_period_end
                  ? new Date(
                      subscription.current_period_end * 1000
                    ).toISOString()
                  : null;

                // Update the user's subscription details
                await supabaseAdmin
                  .from("user_settings")
                  .update({
                    stripe_price_id: priceId,
                    stripe_subscription_status: subscription.status,
                    stripe_current_period_end: currentPeriodEnd,
                  })
                  .eq("user_id", userData.user_id);

                console.log(
                  `✅ User ${userData.user_id} subscription updated.`
                );
              } else {
                console.warn(
                  `⚠️ No user found with Stripe customer ID: ${customerId}`
                );
              }
            } catch (error) {
              console.error(
                "❌ Error updating user after subscription update:",
                error
              );
            }
          }
          break;
        }
        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          console.log(
            "❌ Subscription deleted:",
            subscription.id,
            "Status:",
            subscription.status
          );

          // Get the customer ID from the subscription
          const customerId = subscription.customer;
          if (typeof customerId === "string") {
            try {
              // Find the user by their stripe customer ID
              const { data: userData, error } = await supabaseAdmin
                .from("user_settings")
                .select("user_id")
                .eq("stripe_customer_id", customerId)
                .single();

              if (userData && userData.user_id) {
                // Update the user's subscription details to reflect cancellation
                await supabaseAdmin
                  .from("user_settings")
                  .update({
                    stripe_subscription_status: "canceled",
                    stripe_price_id: null,
                    stripe_current_period_end: null,
                  })
                  .eq("user_id", userData.user_id);

                console.log(
                  `✅ User ${userData.user_id} subscription canceled.`
                );
              } else {
                console.warn(
                  `⚠️ No user found with Stripe customer ID: ${customerId}`
                );
              }
            } catch (error) {
              console.error(
                "❌ Error updating user after subscription deletion:",
                error
              );
            }
          }
          break;
        }
        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          console.log("💵 Invoice payment succeeded:", invoice.id);

          // If it's for a subscription, ensure the subscription status is updated
          const subscriptionId = invoice.subscription;
          const customerId = invoice.customer;

          if (subscriptionId && typeof customerId === "string") {
            try {
              // Get the subscription details
              const subscription = await stripe.subscriptions.retrieve(
                subscriptionId
              );

              // Find the user by their Stripe customer ID
              const { data: userData, error } = await supabaseAdmin
                .from("user_settings")
                .select("user_id")
                .eq("stripe_customer_id", customerId)
                .single();

              if (userData && userData.user_id) {
                // Convert UNIX timestamp to ISO string
                const currentPeriodEnd = subscription.current_period_end
                  ? new Date(
                      subscription.current_period_end * 1000
                    ).toISOString()
                  : null;

                // Update the user's subscription details
                await supabaseAdmin
                  .from("user_settings")
                  .update({
                    stripe_subscription_status: subscription.status,
                    stripe_current_period_end: currentPeriodEnd,
                  })
                  .eq("user_id", userData.user_id);

                console.log(
                  `✅ User ${userData.user_id} subscription updated after successful payment.`
                );
              } else {
                console.warn(
                  `⚠️ No user found with Stripe customer ID: ${customerId}`
                );
              }
            } catch (error) {
              console.error(
                "❌ Error updating user after invoice payment success:",
                error
              );
            }
          }
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          console.log("❌ Invoice payment failed:", invoice.id);

          // Get the subscription ID and customer ID
          const subscriptionId = invoice.subscription;
          const customerId = invoice.customer;

          if (subscriptionId && typeof customerId === "string") {
            try {
              // Get the subscription details with updated status
              const subscription = await stripe.subscriptions.retrieve(
                subscriptionId
              );

              // Find the user by their Stripe customer ID
              const { data: userData, error } = await supabaseAdmin
                .from("user_settings")
                .select("user_id")
                .eq("stripe_customer_id", customerId)
                .single();

              if (userData && userData.user_id) {
                // Update the user's subscription status to reflect payment failure
                await supabaseAdmin
                  .from("user_settings")
                  .update({
                    stripe_subscription_status: subscription.status, // Could be 'past_due' or 'unpaid'
                  })
                  .eq("user_id", userData.user_id);

                console.log(
                  `✅ User ${userData.user_id} subscription marked as ${subscription.status} after payment failure.`
                );

                // TODO: Consider implementing notification to the user about payment failure
              } else {
                console.warn(
                  `⚠️ No user found with Stripe customer ID: ${customerId}`
                );
              }
            } catch (error) {
              console.error(
                "❌ Error updating user after invoice payment failure:",
                error
              );
            }
          }
          break;
        }
        // Add other event types your application needs to handle
        default:
          console.warn(`⚠️ Unhandled Stripe event type: ${event.type}`);
      }

      return NextResponse.json({ received: true });
    } catch (error: any) {
      console.error(`❌ Error constructing Stripe event: ${error.message}`);
      throw error; // Re-throw to be caught by outer try-catch
    }
  } catch (err: any) {
    console.error(`❌ Stripe Webhook Error: ${err.message}`);
    // It's important to return a 400 error for webhook signature verification failures
    // or other processing errors that Stripe should be aware of.
    if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: `Webhook processing error: ${err.message}` },
      { status: 500 }
    );
  }
}
