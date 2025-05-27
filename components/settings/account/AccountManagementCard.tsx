"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAppSelector } from "@/lib/store/hooks";
import { selectUserSettings } from "@/lib/store/features/settings/settingsSlice";
import Link from "next/link";
import { memo } from "react";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

function AccountManagementCard() {
  const { user } = useAppSelector(selectUserSettings);

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
        <CardContent className="space-y-6">
          <div>
            <p className="mb-4 text-sm text-muted-foreground">
              Click the button below to go to the account management page.
            </p>
            <Link href="/accounts" passHref>
              <Button data-tour-id="manage-accounts-button">
                Manage Email Accounts
              </Button>
            </Link>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Once you delete your account, there is no going back. Please be certain.
              </p>
            </div>
            <DeleteAccountDialog userEmail={user?.email} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default memo(AccountManagementCard);
