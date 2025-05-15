"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { memo } from "react";

function AccountManagementCard() {
  return (
    <section>
      <Card data-tour-id="account-management-card">
        <CardHeader>
          <CardTitle>Account Management</CardTitle>
          <CardDescription>
            Manage your connected email accounts, add new ones, or remove
            existing connections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Click the button below to go to the account management page.
          </p>
          <Link href="/accounts" passHref>
            <Button data-tour-id="manage-accounts-button">
              Manage Email Accounts
            </Button>
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}

export default memo(AccountManagementCard);
