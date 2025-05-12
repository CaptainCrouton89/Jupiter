import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your application and account settings.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>
              Manage your connected email accounts, profile information, and
              other account-specific settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings/accounts">
              <Button variant="outline" className="w-full justify-between">
                <span>
                  <Users className="inline-block mr-2 h-5 w-5" />
                  Connected Accounts
                </span>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Placeholder for other settings categories */}
        {/*
        <Card>
          <CardHeader>
            <CardTitle>Application Settings</CardTitle>
            <CardDescription>
              Configure application-wide preferences such as theme,
              notifications, and more.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              (Application settings will go here)
            </p>
          </CardContent>
        </Card>
        */}
      </div>
    </div>
  );
}
