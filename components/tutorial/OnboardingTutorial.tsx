"use client";

import React, { useEffect, useState } from "react";
import Joyride, { type CallBackProps, type Step, STATUS } from "react-joyride";

interface OnboardingTutorialProps {
  run: boolean;
  steps: Step[];
  onTutorialEnd: () => void;
}

const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({
  run,
  steps,
  onTutorialEnd,
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // Ensure Joyride only renders on the client
  }, []);

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status, lifecycle } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      try {
        const response = await fetch("/api/user/settings/complete-tutorial", {
          method: "POST",
        });
        if (!response.ok) {
          console.error("Failed to mark tutorial as completed in DB");
          // Optionally, fall back to localStorage or show an error to the user
        } else {
          console.log("Tutorial completion status saved to DB.");
        }
      } catch (error) {
        console.error("Error calling complete-tutorial API:", error);
      }
      onTutorialEnd();
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      // @ts-ignore TODO: Investigate type mismatch if persists with React 19
      callback={handleJoyrideCallback}
      styles={{
        options: {
          arrowColor: "#fff",
          backgroundColor: "#fff",
          overlayColor: "rgba(0, 0, 0, 0.6)",
          primaryColor: "#f97316", // Orange-600 from Tailwind
          textColor: "#334155", // Slate-700
          zIndex: 1000,
        },
        buttonClose: {
          display: "none", // Hide the default 'x' close button, rely on skip/done
        },
        buttonNext: {
          backgroundColor: "#f97316", // Orange-600
          fontSize: "14px",
          padding: "8px 12px",
        },
        buttonBack: {
          fontSize: "14px",
          padding: "8px 12px",
          color: "#f97316", // Orange-600
        },
        buttonSkip: {
          fontSize: "14px",
          padding: "8px 12px",
          color: "#64748b", // Slate-500
        },
      }}
    />
  );
};

export default OnboardingTutorial;
