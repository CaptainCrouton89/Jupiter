"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type {
  Category,
  CategoryAction,
  CategoryPreference,
} from "@/types/settings";
import { CheckIcon } from "lucide-react";

interface CategoryPreferenceCardProps {
  category: Category;
  preference: CategoryPreference;
  workProfileDescription?: string;
  onPreferenceChange: (
    category: Category,
    type: "action" | "digest",
    value: CategoryAction | boolean
  ) => void;
  onWorkProfileChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isLastSaved: boolean;
  tourId?: string;
}

export default function CategoryPreferenceCard({
  category,
  preference,
  workProfileDescription,
  onPreferenceChange,
  onWorkProfileChange,
  isLastSaved,
  tourId,
}: CategoryPreferenceCardProps) {
  return (
    <Card className="shadow-none border relative" data-tour-id={tourId}>
      <CardHeader className="pb-3">
        <CardTitle className="capitalize text-lg">
          {category.replace("-", " ")}
        </CardTitle>
      </CardHeader>

      <div
        className={`absolute top-3 right-3 flex items-center space-x-1 text-sm text-green-600 transition-opacity duration-500 ease-in-out ${
          isLastSaved ? "opacity-100" : "opacity-0"
        }`}
      >
        <CheckIcon className="h-4 w-4" />
        <span>Saved</span>
      </div>

      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Action on new emails:</Label>
          <RadioGroup
            value={preference.action}
            onValueChange={(value) =>
              onPreferenceChange(category, "action", value as CategoryAction)
            }
            className="mt-2 flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="none" id={`${category}-action-none`} />
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
              <RadioGroupItem value="trash" id={`${category}-action-trash`} />
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
            checked={preference.digest}
            onCheckedChange={(checked) =>
              onPreferenceChange(category, "digest", !!checked)
            }
          />
          <Label htmlFor={`${category}-digest`} className="font-normal text-sm">
            Receive weekly digest for this category
          </Label>
        </div>

        {category === "work" && onWorkProfileChange && (
          <Accordion type="single" collapsible className="w-full mt-4">
            <AccordionItem value="advanced-work-settings">
              <AccordionTrigger>Advanced Work Settings</AccordionTrigger>
              <AccordionContent className="pt-2">
                <Label
                  htmlFor="work-profile-description"
                  className="text-sm font-medium"
                >
                  Describe your work and common work emails:
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Provide details about your profession, typical projects, types
                  of clients or colleagues you interact with, and common
                  subjects or keywords in your work-related emails. This helps
                  us improve categorization.
                </p>
                <Textarea
                  id="work-profile-description"
                  placeholder="e.g., Software Engineer at a startup. I get emails about project updates, code reviews, client feedback, and HR announcements..."
                  value={workProfileDescription}
                  onChange={onWorkProfileChange}
                  className="min-h-[100px]"
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
