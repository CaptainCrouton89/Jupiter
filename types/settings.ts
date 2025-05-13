export type CategoryAction =
  | "none"
  | "mark_as_read"
  | "mark_as_spam"
  | "archive"
  | "trash";

export interface CategoryPreference {
  action: CategoryAction;
  digest: boolean;
}

export interface CategoryPreferences {
  [category: string]: CategoryPreference | undefined; // Allow for undefined if a category hasn't been set yet
}
