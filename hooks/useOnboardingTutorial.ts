"use client";

import { useCallback, useEffect, useState } from "react";
import type { Step } from "react-joyride";

export const tutorialSteps: Step[] = [
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
  {
    target: "[data-tour-id='category-settings-card']",
    content:
      "Once your account is connected, you'll configure how Jupiter Mail handles different email categories right here.",
    disableBeacon: true,
  },
  {
    target: "[data-tour-id='category-item-promotions']",
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
    target: "[data-tour-id='settings-header']",
    content:
      "That's a quick overview of the settings page! Explore and customize to make Jupiter Mail work best for you.",
    placement: "bottom",
    disableBeacon: true,
  },
];

interface UseOnboardingTutorialProps {
  initialTutorialCompleted: boolean;
  onTutorialComplete: () => Promise<void>;
  initialLoadComplete: boolean;
  isLoadingSettings: boolean;
}

export function useOnboardingTutorial({
  initialTutorialCompleted,
  onTutorialComplete,
  initialLoadComplete,
  isLoadingSettings,
}: UseOnboardingTutorialProps) {
  const [runTutorial, setRunTutorial] = useState(false);

  useEffect(() => {
    if (
      initialLoadComplete &&
      !initialTutorialCompleted &&
      !isLoadingSettings
    ) {
      setRunTutorial(true);
    }
  }, [initialLoadComplete, initialTutorialCompleted, isLoadingSettings]);

  const handleTutorialEnd = useCallback(async () => {
    setRunTutorial(false);
    await onTutorialComplete();
  }, [onTutorialComplete]);

  return {
    runTutorial,
    tutorialSteps,
    handleTutorialEnd,
  };
}
