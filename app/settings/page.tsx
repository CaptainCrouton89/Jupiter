"use client";

import {
  AccountManagementCard,
  EmailCategorySettings,
  SubscriptionManagementCard,
  UserSettingsHeader,
} from "@/components/settings";
import OnboardingTutorial from "@/components/tutorial/OnboardingTutorial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  clearLastSavedCategory,
  fetchUserSettingsAndAccounts,
  markTutorialCompleted,
  performCategorizationTest,
  resetSettingsError,
  saveCategoryPreferences,
  selectUserSettings,
  setCategoryPreference,
  setSelectedTestAccountId,
  setUser,
  setWorkProfileDescription,
} from "@/lib/store/features/settings/settingsSlice";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";

import CategorizationTestCard from "@/components/settings/categorization/CategorizationTestCard";
import { useOnboardingTutorial } from "@/hooks/useOnboardingTutorial";
import { createClient } from "@/lib/auth/client";
import { store } from "@/lib/store/store";
import type { Category, CategoryAction } from "@/types/settings";
import { redirect } from "next/navigation";

const SAVE_DEBOUNCE_DELAY = 1000;

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const {
    user,
    userId,
    settingsId,
    category_preferences,
    work_profile_description,
    status: settingsStatus,
    error: settingsError,
    lastSavedCategory,
    tutorial_completed,
  } = useAppSelector(selectUserSettings);

  const initialLoadComplete =
    settingsStatus === "succeeded" || settingsStatus === "failed";
  const isLoadingSettings = settingsStatus === "loading";

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const confirmationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const getUserAndInitialSettings = async () => {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        dispatch(setUser(session.user));
        if (session.user.id && settingsStatus === "idle") {
          dispatch(fetchUserSettingsAndAccounts(session.user.id));
        }
      } else {
        redirect("/login");
      }
    };
    getUserAndInitialSettings();
  }, [dispatch, settingsStatus]);

  const handleMarkTutorialCompleted = useCallback(async () => {
    if (userId) {
      dispatch(
        markTutorialCompleted({ userId, currentSettingsId: settingsId })
      );
    }
  }, [dispatch, userId, settingsId]);

  const { runTutorial, tutorialSteps, handleTutorialEnd } =
    useOnboardingTutorial({
      initialTutorialCompleted: tutorial_completed,
      onTutorialComplete: handleMarkTutorialCompleted,
      initialLoadComplete: initialLoadComplete,
      isLoadingSettings: isLoadingSettings,
    });

  const handlePreferenceChange = (
    category: Category,
    type: "action" | "digest",
    value: CategoryAction | boolean
  ) => {
    dispatch(setCategoryPreference({ category, type, value }));
  };

  const handleWorkProfileChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    dispatch(setWorkProfileDescription(event.target.value));
  };

  useEffect(() => {
    if (
      !initialLoadComplete ||
      isLoadingSettings ||
      !userId ||
      !lastSavedCategory
    ) {
      return;
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (userId) {
        dispatch(
          saveCategoryPreferences({
            userId,
            currentSettingsId: settingsId,
            preferences: category_preferences,
            workProfileDescription: work_profile_description,
          })
        );
      }
    }, SAVE_DEBOUNCE_DELAY);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [
    category_preferences,
    work_profile_description,
    dispatch,
    userId,
    settingsId,
    initialLoadComplete,
    isLoadingSettings,
    lastSavedCategory,
  ]);

  useEffect(() => {
    if (lastSavedCategory) {
      if (confirmationTimeoutRef.current)
        clearTimeout(confirmationTimeoutRef.current);
      confirmationTimeoutRef.current = setTimeout(
        () => dispatch(clearLastSavedCategory()),
        3000
      );
      return () => {
        if (confirmationTimeoutRef.current)
          clearTimeout(confirmationTimeoutRef.current);
      };
    }
  }, [lastSavedCategory, dispatch]);

  const handleRunCategorizationTest = () => {
    const selectedAccountId = selectUserSettings(store.getState())
      .categorizationTest.selectedAccountId;
    if (selectedAccountId) {
      dispatch(performCategorizationTest(selectedAccountId));
    } else {
      toast.error("Please select an email account to run the test.");
    }
  };

  const handleSelectTestAccount = (accountId: string | null) => {
    dispatch(setSelectedTestAccountId(accountId));
  };

  useEffect(() => {
    return () => {
      if (settingsError) dispatch(resetSettingsError());
    };
  }, [dispatch, settingsError]);

  if (isLoadingSettings && !initialLoadComplete && !user) {
    return <div className="container mx-auto py-8 text-center">Loading...</div>;
  }

  return (
    <div
      className="container mx-auto py-10 px-4 md:px-0"
      data-tour-id="welcome-settings"
    >
      {initialLoadComplete && !isLoadingSettings && (
        <OnboardingTutorial
          run={runTutorial}
          steps={tutorialSteps}
          onTutorialEnd={handleTutorialEnd}
        />
      )}
      <UserSettingsHeader
        title="Home"
        description="Manage your application preferences and connected accounts."
        data-tour-id="settings-header"
      />

      {settingsError && (
        <Card className="mb-6 bg-destructive/10 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{settingsError}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-10">
        <AccountManagementCard />
        <SubscriptionManagementCard />
        <EmailCategorySettings
          handlePreferenceChange={handlePreferenceChange}
          handleWorkProfileChange={handleWorkProfileChange}
        />
        <CategorizationTestCard
          onRunTest={handleRunCategorizationTest}
          onSelectTestAccount={handleSelectTestAccount}
        />
      </div>
    </div>
  );
}
