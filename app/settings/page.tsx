"use client";

import type { Database } from "@/lib/database.types";
import type {
  CategoryAction,
  CategoryPreference,
  CategoryPreferences,
} from "@/types/settings";
import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Link from "next/link"; // Import Link
import { redirect } from "next/navigation";

const RELEVANT_CATEGORIES = [
  "newsletter",
  "marketing",
  "receipt",
  "invoice",
  "finances",
  "code-related",
  "notification",
  "account-related",
  "personal",
] as const;

export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];

export default function SettingsPage() {
  const [supabase] = useState(() =>
    createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const [user, setUser] = useState<User | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [categoryPreferences, setCategoryPreferences] =
    useState<CategoryPreferences>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserSettings = useCallback(
    async (userId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from("user_settings")
          .select("id, category_preferences")
          .eq("user_id", userId)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          throw fetchError;
        }

        if (data) {
          setSettingsId(data.id);
          const prefs = data.category_preferences as CategoryPreferences | null;
          const initialPrefs: CategoryPreferences = {};
          RELEVANT_CATEGORIES.forEach((cat) => {
            initialPrefs[cat] = prefs?.[cat] ?? {
              action: "none",
              digest: false,
            };
          });
          setCategoryPreferences(initialPrefs);
        } else {
          const initialPrefs: CategoryPreferences = {};
          RELEVANT_CATEGORIES.forEach((cat) => {
            initialPrefs[cat] = { action: "none", digest: false };
          });
          setCategoryPreferences(initialPrefs);
        }
      } catch (e: any) {
        console.error("Error fetching user settings:", e);
        setError("Failed to load settings. Please try again.");
        const initialPrefs: CategoryPreferences = {};
        RELEVANT_CATEGORIES.forEach((cat) => {
          initialPrefs[cat] = { action: "none", digest: false };
        });
        setCategoryPreferences(initialPrefs);
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    const getUserAndSettings = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchUserSettings(session.user.id);
      } else {
        redirect("/login");
      }
    };
    getUserAndSettings();
  }, [supabase, fetchUserSettings]);

  const handlePreferenceChange = (
    category: (typeof RELEVANT_CATEGORIES)[number],
    type: "action" | "digest",
    value: CategoryAction | boolean
  ) => {
    setCategoryPreferences((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category] || { action: "none", digest: false }),
        [type]: value,
      } as CategoryPreference,
    }));
  };

  const handleSaveChanges = async () => {
    if (!user?.id) {
      setError("User not found. Please log in again.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const preferencesToSave: CategoryPreferences = {};
      RELEVANT_CATEGORIES.forEach((cat) => {
        preferencesToSave[cat] = categoryPreferences[cat] ?? {
          action: "none",
          digest: false,
        };
      });

      if (settingsId) {
        const { error: updateError } = await supabase
          .from("user_settings")
          .update({ category_preferences: preferencesToSave as any })
          .eq("id", settingsId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("user_settings")
          .insert({
            user_id: user.id,
            category_preferences: preferencesToSave as any,
          });
        if (insertError) throw insertError;
        const { data: newSettings } = await supabase
          .from("user_settings")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (newSettings) setSettingsId(newSettings.id);
      }
      alert("Settings saved successfully!");
    } catch (e: any) {
      console.error("Error saving user settings:", e);
      setError(
        "Failed to save settings. Please try again. Details: " + e.message
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !user) {
    // Ensure user is loaded before showing page, or if error, still show structure
    return <div className="container mx-auto py-8 text-center">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-0">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your application preferences and connected accounts.
        </p>
      </header>

      {error && (
        <Card className="mb-6 bg-destructive/10 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-10">
        {/* Account Management Section */}
        <section>
          <Card>
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
                <Button>Manage Email Accounts</Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        {/* Email Category Settings Section */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Email Category Settings</CardTitle>
              <CardDescription>
                Manage how emails from different categories are handled and
                whether you receive weekly digests.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading && Object.keys(categoryPreferences).length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                  Loading category preferences...
                </div>
              )}
              {!isLoading &&
                RELEVANT_CATEGORIES.map((category) => {
                  const currentPref = categoryPreferences[category] || {
                    action: "none",
                    digest: false,
                  };
                  return (
                    <Card key={category} className="shadow-none border">
                      <CardHeader className="pb-3">
                        <CardTitle className="capitalize text-lg">
                          {category.replace("-", " ")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium">
                            Action on new emails:
                          </Label>
                          <RadioGroup
                            value={currentPref.action}
                            onValueChange={(value) =>
                              handlePreferenceChange(
                                category,
                                "action",
                                value as CategoryAction
                              )
                            }
                            className="mt-2 flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="none"
                                id={`${category}-action-none`}
                              />
                              <Label
                                htmlFor={`${category}-action-none`}
                                className="font-normal text-sm"
                              >
                                None (Keep as unread)
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="mark_as_read"
                                id={`${category}-action-read`}
                              />
                              <Label
                                htmlFor={`${category}-action-read`}
                                className="font-normal text-sm"
                              >
                                Mark as Read
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="mark_as_spam"
                                id={`${category}-action-spam`}
                              />
                              <Label
                                htmlFor={`${category}-action-spam`}
                                className="font-normal text-sm"
                              >
                                Mark as Spam
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                          <Checkbox
                            id={`${category}-digest`}
                            checked={currentPref.digest}
                            onCheckedChange={(checked) =>
                              handlePreferenceChange(
                                category,
                                "digest",
                                !!checked
                              )
                            }
                          />
                          <Label
                            htmlFor={`${category}-digest`}
                            className="font-normal text-sm"
                          >
                            Receive weekly digest for this category
                          </Label>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </CardContent>
            <CardFooter className="mt-2 flex justify-end">
              <Button
                onClick={handleSaveChanges}
                disabled={isSaving || isLoading}
              >
                {isSaving
                  ? "Saving Category Settings..."
                  : "Save Category Settings"}
              </Button>
            </CardFooter>
          </Card>
        </section>
      </div>
    </div>
  );
}
