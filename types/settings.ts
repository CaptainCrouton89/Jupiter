export type CategoryAction =
  | "none"
  | "mark_as_read"
  | "mark_as_spam"
  | "archive"
  | "trash";

export interface CategoryPreference {
  action: CategoryAction;
  digest: boolean;
  profileDescription?: string;
}

export interface CategoryPreferences {
  [category: string]: CategoryPreference | undefined; // Allow for undefined if a category hasn't been set yet
}

export type Category =
  | "newsletter"
  | "marketing"
  | "payments" // receipts, transactions
  | "finances" // bank statements, credit card statements, etc.
  | "personal"
  | "shipping-delivery" // order tracking, delivery updates
  | "system-alerts" // security alerts, login notifications
  | "system-updates" // maintenance, service updates
  | "account-related" // password resets, tos changes
  | "work" // custom
  | "email-verification" // email verification, two factor auth, etc.
  | "uncategorizable";

export const allCategories: Category[] = [
  "newsletter",
  "marketing",
  "payments",
  "finances",
  "personal",
  "shipping-delivery",
  "system-alerts",
  "system-updates",
  "account-related",
  "work",
  "email-verification",
  "uncategorizable",
];
