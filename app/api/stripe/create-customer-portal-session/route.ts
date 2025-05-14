import { NextResponse } from "next/server";
import Stripe from "stripe";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(request: Request) {
  try {
    console.log("Creating customer portal session");
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error("Stripe secret key is not configured.");
      return NextResponse.json(
        {
          error: {
            message:
              "Billing features are not configured. Please contact support.",
          },
        },
        { status: 500 }
      );
    }
    const stripe = new Stripe(stripeSecretKey);

    const { customerId } = await request.json();
    console.log(`Creating portal session for customer ID: ${customerId}`);

    if (!customerId) {
      return NextResponse.json(
        { error: { message: "Stripe Customer ID is required." } },
        { status: 400 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings`, // User will be returned to settings page
    });

    if (!portalSession.url) {
      throw new Error("Could not create Stripe Customer Portal session.");
    }

    console.log(`Created Stripe Customer Portal session: ${portalSession.id}`);
    console.log(
      `Portal session details: ${JSON.stringify({
        id: portalSession.id,
        url: portalSession.url,
        return_url: portalSession.return_url,
      })}`
    );

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error("Stripe create-customer-portal-session error:", error);
    return NextResponse.json(
      { error: { message: error.message || "Internal Server Error" } },
      { status: 500 }
    );
  }
}
