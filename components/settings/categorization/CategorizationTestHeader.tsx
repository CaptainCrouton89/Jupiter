"use client";

import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MailCheckIcon } from "lucide-react";

interface CategorizationTestHeaderProps {
  selectedTestAccountEmail: string | null | undefined;
}

export default function CategorizationTestHeader({
  selectedTestAccountEmail,
}: CategorizationTestHeaderProps) {
  return (
    <CardHeader>
      <CardTitle className="flex items-center">
        <MailCheckIcon className="mr-2 h-5 w-5" /> Test Email Categorization
      </CardTitle>
      <CardDescription>
        See how the AI categorizes your 20 most recent emails from your
        {" " +
          (selectedTestAccountEmail
            ? `selected account (${selectedTestAccountEmail}).`
            : "chosen account.")}{" "}
        This helps you understand the categorization logic before customizing it
        further.
      </CardDescription>
    </CardHeader>
  );
}
