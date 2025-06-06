"use client";

import { memo } from "react";

interface UserSettingsHeaderProps {
  title: string;
  description: string;
}

const UserSettingsHeader = memo(function UserSettingsHeader({
  title,
  description,
}: UserSettingsHeaderProps) {
  return (
    <header className="mb-8" data-tour-id="settings-header">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </header>
  );
});

UserSettingsHeader.displayName = "UserSettingsHeader";

export default UserSettingsHeader;
