"use client";

import OnboardingTutorial from "@/components/tutorial/OnboardingTutorial";
import { createClient } from "@/lib/auth/client";
import type { Database } from "@/lib/database.types";
import type { EmailAccount } from "@/types/email";
import {
  allCategories,
  type Category,
  type CategoryAction,
  type CategoryPreference,
  type CategoryPreferences,
} from "@/types/settings";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Step } from "react-joyride";
import { toast } from "sonner";

// Import new components
import AccountManagementCard from "@/components/settings/AccountManagementCard";
import CategorizationTestCard, {
  type CategorizationTestEmail,
} from "@/components/settings/CategorizationTestCard";
import EmailCategorySettings from "@/components/settings/EmailCategorySettings";
import UserSettingsHeader from "@/components/settings/UserSettingsHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const RELEVANT_CATEGORIES: Category[] = allCategories.filter(
  (cat) => cat !== "uncategorizable"
);

// Debounce delay in milliseconds
const SAVE_DEBOUNCE_DELAY = 1000;

export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];

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

  // Tutorial State
  const [runTutorial, setRunTutorial] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(true); // Assume completed until fetched

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
        .select(
          "id, category_preferences, default_account_id, tutorial_completed"
        )
        .eq("user_id", userId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError;
      }

      if (data) {
        setSettingsId(data.id);
        setDefaultAccountId(data.default_account_id);
        setTutorialCompleted(data.tutorial_completed === true);

        const prefs = data.category_preferences as CategoryPreferences | null;
        const initialPrefs: CategoryPreferences = {};
        RELEVANT_CATEGORIES.forEach((cat) => {
          initialPrefs[cat] = prefs?.[cat] ?? {
            action: "none",
            digest: false,
          };
        });
        setCategoryPreferences(initialPrefs);

        // Extract workProfileDescription from categoryPreferences.work
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
        setWorkProfileDescription(""); // Ensure it's reset if no data
        setTutorialCompleted(false);
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
      setWorkProfileDescription(""); // Ensure it's reset on error
      setTutorialCompleted(false);
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

  useEffect(() => {
    if (initialLoadComplete && !tutorialCompleted && !isLoading) {
      setRunTutorial(true);
    }
  }, [initialLoadComplete, tutorialCompleted, isLoading]);

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
        const completePrefsToSave = JSON.parse(
          JSON.stringify(prefsToSave)
        ) as CategoryPreferences;

        RELEVANT_CATEGORIES.forEach((cat) => {
          if (!completePrefsToSave[cat]) {
            completePrefsToSave[cat] = { action: "none", digest: false };
          }
        });

        // Ensure 'work' category exists and set its profileDescription
        if (!completePrefsToSave.work) {
          completePrefsToSave.work = { action: "none", digest: false };
        }
        completePrefsToSave.work.profileDescription = currentWorkProfileDesc;

        const payloadToSave = {
          category_preferences: completePrefsToSave as any, // Cast to any due to Supabase type
        };

        if (settingsId) {
          const { error: updateError } = await supabase
            .from("user_settings")
            .update(payloadToSave)
            .eq("id", settingsId);
          if (updateError) throw updateError;
        } else {
          const insertPayload: Database["public"]["Tables"]["user_settings"]["Insert"] =
            {
              user_id: user.id,
              category_preferences: completePrefsToSave as any, // Cast to any
            };
          const { data: insertedData, error: insertError } = await supabase
            .from("user_settings")
            .insert(insertPayload)
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
    category: Category,
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
    setLastChangedCategory(category);
  };

  const handleWorkProfileChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setWorkProfileDescription(event.target.value);
    setLastChangedCategory("work");
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

  const tutorialSteps: Step[] = [
    {
      target: "[data-tour-id='welcome-settings']",
      content:
        "Welcome to Jupiter Mail! This is your settings page, where you control how your email is managed.",
      placement: "center",
    },
    {
      target: "[data-tour-id='manage-accounts-button']",
      content:
        "First things first, let's connect your email account. Click here to go to the account management page.",
      disableBeacon: true,
    },
    // More steps will be added for the /accounts page and /accounts/connect page later
    // For now, we'll add steps for configuring settings after account connection (simulated)
    {
      target: "[data-tour-id='category-settings-card']",
      content:
        "Once your account is connected, you'll configure how Jupiter Mail handles different email categories right here.",
      disableBeacon: true,
    },
    {
      target: "[data-tour-id='category-item-promotions']", // Assuming 'promotions' is a likely first category
      content:
        "For each category, like 'Promotions', you can decide an action (e.g., Archive, Trash) and if you want it in your weekly digest.",
      disableBeacon: true,
    },
    {
      target: "[data-tour-id='work-category-card']",
      content:
        "For 'Work' emails, you can even provide a description of your work to help our AI categorize them more accurately!",
      disableBeacon: true,
    },
    {
      target: "[data-tour-id='test-categorization-card']",
      content:
        "Curious how our AI works? You can run a test to see how it categorizes your recent emails.",
      disableBeacon: true,
    },
    {
      target: "[data-tour-id='settings-header']", // A general target to signify end on this page
      content:
        "That's a quick overview of the settings page! Explore and customize to make Jupiter Mail work best for you.",
      placement: "bottom",
      disableBeacon: true,
    },
  ];

  return (
    <div
      className="container mx-auto py-10 px-4 md:px-0"
      data-tour-id="welcome-settings"
    >
      {initialLoadComplete && !isLoading && (
        <OnboardingTutorial
          run={runTutorial}
          steps={tutorialSteps}
          onTutorialEnd={() => {
            setRunTutorial(false);
            // No need to call API here, Joyride callback handles it
          }}
        />
      )}
      <UserSettingsHeader
        title="Settings"
        description="Manage your application preferences and connected accounts."
      />

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
        <AccountManagementCard />

        <EmailCategorySettings
          isLoading={isLoading && Object.keys(categoryPreferences).length === 0}
          categoryPreferences={categoryPreferences}
          workProfileDescription={workProfileDescription}
          lastSavedCategory={lastSavedCategory}
          handlePreferenceChange={handlePreferenceChange}
          handleWorkProfileChange={handleWorkProfileChange}
        />

        <CategorizationTestCard
          defaultAccountId={defaultAccountId}
          allUserEmailAccounts={allUserEmailAccounts}
          isLoadingAllAccounts={isLoadingAllAccounts}
          isLoadingSettings={isLoading}
          initialLoadComplete={initialLoadComplete}
          categorizationTest={categorizationTest}
          onRunTest={handleRunCategorizationTest}
        />
      </div>
    </div>
  );
}
