"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  selectUserSettings, // Selects the whole settings state
} from "@/lib/store/features/settings/settingsSlice";
import { useAppSelector } from "@/lib/store/hooks";
import type { Category, CategoryAction } from "@/types/settings";
import { allCategories } from "@/types/settings"; // Import allCategories
import CategoryPreferenceCard from "./CategoryPreferenceCard";

// Correctly define RELEVANT_CATEGORIES
const RELEVANT_CATEGORIES: Category[] = allCategories.filter(
  (cat) => cat !== "uncategorizable"
);

interface EmailCategorySettingsProps {
  handlePreferenceChange: (
    category: Category,
    type: "action" | "digest",
    value: CategoryAction | boolean
  ) => void;
  handleWorkProfileChange: (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => void;
}

export default function EmailCategorySettings({
  handlePreferenceChange,
  handleWorkProfileChange,
}: EmailCategorySettingsProps) {
  const {
    category_preferences,
    work_profile_description,
    lastSavedCategory,
    status,
  } = useAppSelector(selectUserSettings);

  const isLoading = status === "loading";
  // Ensure category_preferences is always an object, even if initially empty from Redux state before fetch
  const currentCategoryPreferences = category_preferences || {};

  return (
    <section>
      <Card data-tour-id="category-settings-card">
        <CardHeader>
          <CardTitle>Email Category Settings</CardTitle>
          <CardDescription>
            Manage how emails from different categories are handled and whether
            you receive weekly digests. Changes are saved automatically.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoading &&
            Object.keys(currentCategoryPreferences).length === 0 && (
              <div className="text-center text-muted-foreground py-4">
                Loading category preferences...
              </div>
            )}
          {!isLoading &&
            RELEVANT_CATEGORIES.map((category) => {
              // Use currentCategoryPreferences which is guaranteed to be an object
              const currentPref = currentCategoryPreferences[category] || {
                action: "none",
                digest: false,
              };
              const tourId =
                category.toLowerCase() === "promotions"
                  ? "category-item-promotions"
                  : category.toLowerCase() === "work"
                  ? "work-category-card"
                  : undefined;
              return (
                <CategoryPreferenceCard
                  key={category}
                  category={category}
                  preference={currentPref}
                  workProfileDescription={work_profile_description} // This is fine, it's a single string
                  onPreferenceChange={handlePreferenceChange}
                  onWorkProfileChange={handleWorkProfileChange}
                  isLastSaved={lastSavedCategory === category}
                  tourId={tourId}
                />
              );
            })}
        </CardContent>
      </Card>
    </section>
  );
}
