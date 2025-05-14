"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  ExternalLink,
  Info,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface SubscriptionManagementCardProps {
  userId: string;
  userEmail: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeSubscriptionStatus: string | null;
  stripeCurrentPeriodEnd: string | null;
  isLoading: boolean;
}

export default function SubscriptionManagementCard({
  userId,
  userEmail,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
  stripeSubscriptionStatus,
  stripeCurrentPeriodEnd,
  isLoading: initialIsLoading,
}: SubscriptionManagementCardProps) {
  const router = useRouter();
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.get("success")) {
      toast.success("Checkout successful! Your subscription is active.");
      // Clean up the URL query parameters
      router.replace(window.location.pathname, undefined);
    }
    if (queryParams.get("cancel")) {
      toast.info("Checkout canceled. Your subscription was not started.");
      // Clean up the URL query parameters
      router.replace(window.location.pathname, undefined);
    }
  }, [router]);

  const handleUpgradeSubscription = async () => {
    setIsProcessingCheckout(true);
    try {
      let response;
      if (stripeSubscriptionStatus !== "active") {
        response = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId, userEmail }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error?.message || "Failed to create checkout session."
          );
        }

        const data = await response.json();
        if (data.url) {
          toast.success("Redirecting to Stripe checkout...");
          window.location.href = data.url;
        } else {
          throw new Error("Checkout session URL not found.");
        }
      } else if (stripeSubscriptionStatus === "active") {
        response = await fetch("/api/stripe/create-customer-portal-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ customerId: stripeCustomerId }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error?.message ||
              "Failed to create customer portal session."
          );
        }
        const portalData = await response.json();
        if (portalData.url) {
          toast.success("Redirecting to manage your subscription...");
          window.location.href = portalData.url;
        } else {
          throw new Error("Customer portal URL not found.");
        }
      }
    } catch (error: any) {
      console.error("Subscription management error:", error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const renderSubscriptionStatus = () => {
    if (initialIsLoading) {
      return (
        <p className="text-sm text-muted-foreground">
          Loading subscription status...
        </p>
      );
    }

    if (stripeSubscriptionStatus === "active" && stripeCurrentPeriodEnd) {
      return (
        <div className="flex items-center space-x-2 text-green-600">
          <CheckCircle className="h-5 w-5" />
          <p>
            Active until:{" "}
            {format(new Date(stripeCurrentPeriodEnd), "MMMM d, yyyy")}
          </p>
        </div>
      );
    } else if (stripeSubscriptionStatus === "active") {
      return (
        <div className="flex items-center space-x-2 text-green-600">
          <CheckCircle className="h-5 w-5" />
          <p>Active</p>
        </div>
      );
    }
    if (
      stripeSubscriptionStatus &&
      stripeSubscriptionStatus !== "active" &&
      stripeSubscriptionStatus !== "canceled"
    ) {
      return (
        <div className="flex items-center space-x-2 text-yellow-600">
          <AlertTriangle className="h-5 w-5" />
          <p>Status: {stripeSubscriptionStatus}</p>
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-2 text-muted-foreground">
        <Info className="h-5 w-5" />
        <p>No active subscription.</p>
      </div>
    );
  };

  return (
    <Card data-tour-id="subscription-management-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-6 w-6" />
            <CardTitle>Subscription</CardTitle>
          </div>
        </div>
        <CardDescription>
          Manage your Jupiter Mail subscription plan and billing details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border rounded-md bg-muted/20">
          {renderSubscriptionStatus()}
        </div>

        <Button
          onClick={handleUpgradeSubscription}
          className="w-full sm:w-auto"
          disabled={isProcessingCheckout || initialIsLoading}
        >
          {isProcessingCheckout ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {stripeSubscriptionStatus === "active"
            ? "Manage Subscription"
            : "Upgrade to Pro"}
          {stripeSubscriptionStatus === "active" && !isProcessingCheckout && (
            <ExternalLink className="ml-2 h-4 w-4" />
          )}
        </Button>

        {stripeSubscriptionStatus === "active" && stripePriceId && (
          <p className="text-xs text-muted-foreground">
            Currently subscribed to plan: {stripePriceId}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
