"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/auth/client";
import type { Database } from "@/lib/database.types";
import {
  getCategoryColor,
  getTextColorForBackground,
} from "@/lib/email/categoryColors";
import type { EmailAccount } from "@/types/email";
import {
  allCategories,
  type Category,
  type CategoryAction,
  type CategoryPreference,
  type CategoryPreferences,
} from "@/types/settings";
import type { User } from "@supabase/supabase-js";
import {
  AlertTriangleIcon,
  CheckIcon,
  InfoIcon,
  Loader2Icon,
  MailCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const RELEVANT_CATEGORIES: Category[] = allCategories.filter(
  (cat) => cat !== "uncategorizable"
);

// Debounce delay in milliseconds
const SAVE_DEBOUNCE_DELAY = 1000;

export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];

// Define the structure for test results
interface CategorizationTestEmail {
  uid: number;
  messageId: string | null;
  subject: string | null;
  from: { name: string | null; address: string | null } | null;
  date: string | null; // ISO string
  category: Category;
  bodyTextSnippet: string | null;
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [categoryPreferences, setCategoryPreferences] =
    useState<CategoryPreferences>({});
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null);
  const [workProfileDescription, setWorkProfileDescription] =
    useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [lastChangedCategory, setLastChangedCategory] = useState<string | null>(
    null
  );
  const [lastSavedCategory, setLastSavedCategory] = useState<string | null>(
    null
  );
  const confirmationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State for all user email accounts (if no default is set)
  const [allUserEmailAccounts, setAllUserEmailAccounts] = useState<
    EmailAccount[] | null
  >(null);
  const [isLoadingAllAccounts, setIsLoadingAllAccounts] = useState(false);

  // State for categorization test
  const [categorizationTest, setCategorizationTest] = useState<{
    data: CategorizationTestEmail[] | null;
    isLoading: boolean;
    error: string | null;
  }>({
    data: null,
    isLoading: false,
    error: null,
  });

  const fetchUserSettings = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = await createClient();
      const { data, error: fetchError } = await supabase
        .from("user_settings")
        .select("id, category_preferences, default_account_id")
        .eq("user_id", userId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError;
      }

      if (data) {
        setSettingsId(data.id);
        setDefaultAccountId(data.default_account_id);
        const prefs = data.category_preferences as CategoryPreferences | null;
        const initialPrefs: CategoryPreferences = {};
        RELEVANT_CATEGORIES.forEach((cat) => {
          initialPrefs[cat] = prefs?.[cat] ?? {
            action: "none",
            digest: false,
          };
        });
        setCategoryPreferences(initialPrefs);
        if (initialPrefs.work && initialPrefs.work.profileDescription) {
          setWorkProfileDescription(initialPrefs.work.profileDescription);
        } else {
          setWorkProfileDescription("");
        }
      } else {
        const initialPrefs: CategoryPreferences = {};
        RELEVANT_CATEGORIES.forEach((cat) => {
          initialPrefs[cat] = { action: "none", digest: false };
        });
        setCategoryPreferences(initialPrefs);
        setDefaultAccountId(null);
        setWorkProfileDescription("");
      }
    } catch (e: any) {
      console.error("Error fetching user settings:", e);
      setError("Failed to load settings. Please try again.");
      const initialPrefs: CategoryPreferences = {};
      RELEVANT_CATEGORIES.forEach((cat) => {
        initialPrefs[cat] = { action: "none", digest: false };
      });
      setCategoryPreferences(initialPrefs);
      setDefaultAccountId(null);
      setWorkProfileDescription("");
    } finally {
      setIsLoading(false);
      setInitialLoadComplete(true);
    }
  }, []);

  // Function to fetch all email accounts for the user
  const fetchUserEmailAccounts = useCallback(async (userId: string) => {
    setIsLoadingAllAccounts(true);
    try {
      const supabase = await createClient();
      const { data, error: accountsError } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (accountsError) {
        throw accountsError;
      }
      setAllUserEmailAccounts(data || []);
    } catch (e: any) {
      console.error("Error fetching all user email accounts:", e);
      // Set error for categorization test or a general error display
      setCategorizationTest((prev) => ({
        ...prev,
        error:
          "Could not load email accounts to determine a fallback for testing.",
      }));
      setAllUserEmailAccounts([]); // Ensure it's an empty array on error
    } finally {
      setIsLoadingAllAccounts(false);
    }
  }, []);

  useEffect(() => {
    const getUserAndSettings = async () => {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchUserSettings(session.user.id);
        // After fetching user settings, if no defaultAccountId is set, fetch all accounts
        // We need to access the state *after* fetchUserSettings has updated it.
        // This requires a change in how defaultAccountId is checked or passed.
      } else {
        redirect("/login");
      }
    };
    getUserAndSettings();
  }, [fetchUserSettings]);

  // New useEffect to fetch all accounts if defaultAccountId is not set after initial load
  useEffect(() => {
    if (
      initialLoadComplete &&
      user &&
      defaultAccountId === null &&
      !isLoading
    ) {
      fetchUserEmailAccounts(user.id);
    }
  }, [
    initialLoadComplete,
    user,
    defaultAccountId,
    fetchUserEmailAccounts,
    isLoading,
  ]);

  const savePreferences = useCallback(
    async (
      prefsToSave: CategoryPreferences,
      currentWorkProfileDesc: string
    ) => {
      const supabase = await createClient();
      if (!user?.id) {
        setError("User not found. Cannot save settings.");
        return;
      }
      setError(null);

      try {
        const completePrefsToSave: CategoryPreferences = JSON.parse(
          JSON.stringify(prefsToSave)
        );
        RELEVANT_CATEGORIES.forEach((cat) => {
          if (!completePrefsToSave[cat]) {
            completePrefsToSave[cat] = { action: "none", digest: false };
          }
        });

        if (!completePrefsToSave.work) {
          completePrefsToSave.work = { action: "none", digest: false };
        }
        completePrefsToSave.work.profileDescription = currentWorkProfileDesc;

        if (settingsId) {
          const { error: updateError } = await supabase
            .from("user_settings")
            .update({
              category_preferences: completePrefsToSave as any,
            })
            .eq("id", settingsId);
          if (updateError) throw updateError;
        } else {
          const { data: insertedData, error: insertError } = await supabase
            .from("user_settings")
            .insert({
              user_id: user.id,
              category_preferences: completePrefsToSave as any,
            })
            .select("id")
            .single();

          if (insertError) throw insertError;

          if (insertedData) {
            setSettingsId(insertedData.id);
          } else {
            console.warn("Inserted settings but did not receive ID back.");
          }
        }

        // Success indication is now handled by text on the page
        // and the per-card indicator
        // Trigger visual confirmation for the last changed category
        setLastSavedCategory(lastChangedCategory);
        if (confirmationTimeoutRef.current) {
          clearTimeout(confirmationTimeoutRef.current); // Clear previous timeout
        }
        confirmationTimeoutRef.current = setTimeout(() => {
          setLastSavedCategory(null); // Clear the indicator
        }, 3000); // Hide after 3 seconds
      } catch (e: any) {
        console.error("Error auto-saving user settings:", e);
        setError(
          "Failed to automatically save settings. Please check your connection and try making a change again. Details: " +
            e.message
        );
      }
    },
    [user, settingsId, lastChangedCategory]
  );

  useEffect(() => {
    if (
      !initialLoadComplete ||
      !user ||
      isLoading ||
      (Object.keys(categoryPreferences).length === 0 &&
        workProfileDescription === "")
    ) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      savePreferences(categoryPreferences, workProfileDescription);
    }, SAVE_DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    categoryPreferences,
    workProfileDescription,
    savePreferences,
    initialLoadComplete,
    user,
    isLoading,
  ]);

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
    setLastChangedCategory(category); // Track the last category changed
  };

  const handleWorkProfileChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setWorkProfileDescription(event.target.value);
    setLastChangedCategory("work"); // Also consider this a change to 'work' for save indicator
  };

  // Handler for running the categorization test
  const handleRunCategorizationTest = async () => {
    let accountIdToUse = defaultAccountId;

    if (
      !accountIdToUse &&
      allUserEmailAccounts &&
      allUserEmailAccounts.length > 0
    ) {
      accountIdToUse = allUserEmailAccounts[0].id;
      toast.info(
        `No default account set. Using first registered account: ${allUserEmailAccounts[0].email} for the test.`
      );
    }

    if (!accountIdToUse) {
      setCategorizationTest({
        data: null,
        isLoading: false,
        error:
          isLoadingAllAccounts || (isLoading && !initialLoadComplete)
            ? "Loading account information..."
            : "No email accounts found. Please add an account to use this feature.",
      });
      if (!isLoadingAllAccounts && !(isLoading && !initialLoadComplete)) {
        toast.error("No email accounts available to test.");
      }
      return;
    }

    setCategorizationTest({ data: null, isLoading: true, error: null });

    try {
      const response = await fetch(
        `/api/email/test-categorization?accountId=${accountIdToUse}&limit=20`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to fetch categorization test results"
        );
      }
      setCategorizationTest({
        data: result.emails as CategorizationTestEmail[],
        isLoading: false,
        error: null,
      });
      if (result.emails && result.emails.length > 0) {
        toast.success(
          `Successfully categorized ${result.emails.length} emails.`
        );
      } else {
        toast.info("No emails found or categorized in the test run.");
      }
    } catch (err: any) {
      console.error("Error running categorization test:", err);
      setCategorizationTest({
        data: null,
        isLoading: false,
        error: err.message || "An unexpected error occurred.",
      });
      toast.error(err.message || "Failed to run categorization test.");
    }
  };

  if (isLoading && !user) {
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
                whether you receive weekly digests. Changes are saved
                automatically.
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
                    <Card
                      key={category}
                      className="shadow-none border relative"
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="capitalize text-lg">
                          {category.replace("-", " ")}
                        </CardTitle>
                      </CardHeader>

                      {/* Save Confirmation Indicator (per card) */}
                      <div
                        className={`absolute top-3 right-3 flex items-center space-x-1 text-sm text-green-600 transition-opacity duration-500 ease-in-out ${
                          lastSavedCategory === category
                            ? "opacity-100"
                            : "opacity-0"
                        }`}
                      >
                        <CheckIcon className="h-4 w-4" />
                        <span>Saved</span>
                      </div>

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
                                value="archive"
                                id={`${category}-action-archive`}
                              />
                              <Label
                                htmlFor={`${category}-action-archive`}
                                className="font-normal text-sm"
                              >
                                Archive
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="trash"
                                id={`${category}-action-trash`}
                              />
                              <Label
                                htmlFor={`${category}-action-trash`}
                                className="font-normal text-sm"
                              >
                                Trash
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

                        {/* Advanced settings for "work" category */}
                        {category === "work" && (
                          <Accordion
                            type="single"
                            collapsible
                            className="w-full mt-4"
                          >
                            <AccordionItem value="advanced-work-settings">
                              <AccordionTrigger>
                                Advanced Work Settings
                              </AccordionTrigger>
                              <AccordionContent className="pt-2">
                                <Label
                                  htmlFor="work-profile-description"
                                  className="text-sm font-medium"
                                >
                                  Describe your work and common work emails:
                                </Label>
                                <p className="text-xs text-muted-foreground mb-2">
                                  Provide details about your profession, typical
                                  projects, types of clients or colleagues you
                                  interact with, and common subjects or keywords
                                  in your work-related emails. This helps us
                                  improve categorization.
                                </p>
                                <Textarea
                                  id="work-profile-description"
                                  placeholder="e.g., Software Engineer at a startup. I get emails about project updates, code reviews, client feedback, and HR announcements..."
                                  value={workProfileDescription}
                                  onChange={handleWorkProfileChange}
                                  className="min-h-[100px]"
                                />
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </CardContent>
          </Card>
        </section>

        {/* Categorization Test Section */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MailCheckIcon className="mr-2 h-5 w-5" /> Test Email
                Categorization
              </CardTitle>
              <CardDescription>
                See how the AI categorizes your 20 most recent emails from your
                {defaultAccountId
                  ? " default account. "
                  : allUserEmailAccounts && allUserEmailAccounts.length > 0
                  ? ` first registered account (${allUserEmailAccounts[0].email}). `
                  : " account. "}
                This helps you understand the categorization logic before
                customizing it further.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!defaultAccountId &&
                !isLoadingAllAccounts &&
                (!allUserEmailAccounts || allUserEmailAccounts.length === 0) &&
                !isLoading && (
                  <div className="flex items-center p-4 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md">
                    <InfoIcon className="mr-2 h-5 w-5 flex-shrink-0" />
                    <p>
                      No email accounts found. Please add an email account via
                      the{" "}
                      <Link
                        href="/accounts"
                        className="font-medium underline hover:text-yellow-800"
                      >
                        Account Management
                      </Link>{" "}
                      section to use this feature.
                    </p>
                  </div>
                )}
              {isLoadingAllAccounts && !defaultAccountId && (
                <div className="flex items-center p-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md">
                  <Loader2Icon className="mr-2 h-5 w-5 flex-shrink-0 animate-spin" />
                  <p>Checking for available email accounts...</p>
                </div>
              )}
              <Button
                onClick={handleRunCategorizationTest}
                disabled={
                  categorizationTest.isLoading ||
                  isLoadingAllAccounts ||
                  (!defaultAccountId &&
                    (!allUserEmailAccounts ||
                      allUserEmailAccounts.length === 0)) ||
                  (isLoading && !initialLoadComplete) // Disable if main settings are still loading
                }
                className="w-full sm:w-auto"
              >
                {categorizationTest.isLoading ||
                isLoadingAllAccounts ||
                (isLoading && !initialLoadComplete && !defaultAccountId) ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    {categorizationTest.isLoading
                      ? "Running Test..."
                      : "Loading Accounts..."}
                  </>
                ) : (
                  "Run Categorization Test"
                )}
              </Button>

              {categorizationTest.error && (
                <div className="flex items-center p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                  <AlertTriangleIcon className="mr-2 h-5 w-5 flex-shrink-0" />
                  <p>{categorizationTest.error}</p>
                </div>
              )}

              {categorizationTest.data &&
                categorizationTest.data.length === 0 &&
                !categorizationTest.isLoading && (
                  <div className="flex items-center p-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md">
                    <InfoIcon className="mr-2 h-5 w-5 flex-shrink-0" />
                    <p>
                      No emails were found or categorized in your default
                      account for this test.
                    </p>
                  </div>
                )}

              {categorizationTest.data &&
                categorizationTest.data.length > 0 && (
                  <Accordion type="single" collapsible className="w-full">
                    {categorizationTest.data.map((email, index) => (
                      <AccordionItem
                        value={`email-${index}`}
                        key={email.messageId || index}
                      >
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex justify-between items-center w-full pr-2">
                            <div className="truncate text-left">
                              <p className="font-medium truncate">
                                {email.subject || "(No Subject)"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                From:{" "}
                                {email.from?.name ||
                                  email.from?.address ||
                                  "Unknown"}
                              </p>
                            </div>
                            <span
                              className="ml-4 px-3 py-1.5 text-xs font-semibold rounded-full flex-shrink-0 transition-colors duration-200"
                              style={{
                                backgroundColor: getCategoryColor(
                                  email.category
                                ),
                                color: getTextColorForBackground(
                                  getCategoryColor(email.category)
                                ),
                              }}
                            >
                              {email.category
                                .replace("-", " ")
                                .replace(/\\b\\w/g, (l) => l.toUpperCase())}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground p-4">
                          <p className="mb-2">
                            <strong>Date:</strong>{" "}
                            {email.date
                              ? new Date(email.date).toLocaleString()
                              : "N/A"}
                          </p>
                          <p className="mb-1 font-medium">Body Snippet:</p>
                          <p className="whitespace-pre-line bg-gray-50 p-3 rounded-md max-h-48 overflow-y-auto">
                            {email.bodyTextSnippet ||
                              "(No body text available)"}
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
