"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  Category,
  CategoryAction,
  CategoryPreferences,
} from "@/types/settings";
import { allCategories } from "@/types/settings"; // Import allCategories
import CategoryPreferenceCard from "./CategoryPreferenceCard";

// Correctly define RELEVANT_CATEGORIES
const RELEVANT_CATEGORIES: Category[] = allCategories.filter(
  (cat) => cat !== "uncategorizable"
);

interface EmailCategorySettingsProps {
  isLoading: boolean;
  categoryPreferences: CategoryPreferences;
  workProfileDescription: string;
  lastSavedCategory: string | null;
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
  isLoading,
  categoryPreferences,
  workProfileDescription,
  lastSavedCategory,
  handlePreferenceChange,
  handleWorkProfileChange,
}: EmailCategorySettingsProps) {
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
                  workProfileDescription={workProfileDescription}
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
