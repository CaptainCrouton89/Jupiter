import { Category } from "@/types/settings";

// Define accent colors for categories
export const CATEGORY_ACCENT_COLORS: Record<Category, string> = {
  newsletter: "#6989d0", // Softer Blue
  marketing: "#f0c76e", // Muted Yellow-Orange
  payments: "#6bbd8b", // Softer Green
  finances: "#a48cb8", // Softer Purple
  "shipping-delivery": "#ff9f7a", // Soft Orange for shipping/delivery
  "system-alerts": "#ff7a7a", // Soft Red for security alerts
  "system-updates": "#7a8899", // Lighter Slate Grey for system updates
  "account-related": "#7ab3e8", // Softer Dodger Blue
  personal: "#7ec2bb", // Softer Teal/Turquoise
  "email-verification": "#82caaf", // Unique, soft teal-green
  work: "#7ac5c1", // Muted Teal
  uncategorizable: "#b0bec5", // Neutral Grey for uncategorized
};

/**
 * Returns a hex color code for a given category.
 * Falls back to a default color if the category is not found.
 * @param category The category string (e.g., "newsletter", "notification")
 * @returns Hex color code string
 */
export function getCategoryColor(category?: Category | string | null): string {
  if (!category) {
    return CATEGORY_ACCENT_COLORS.uncategorizable;
  }
  return CATEGORY_ACCENT_COLORS[category as Category];
}

// Helper function to adjust brightness of a hex color
// This can be used to generate text colors that contrast well with the background
// (e.g. light text on dark bg, dark text on light bg)
export function adjustColorBrightness(hex: string, percent: number): string {
  let r = parseInt(hex.substring(1, 3), 16);
  let g = parseInt(hex.substring(3, 5), 16);
  let b = parseInt(hex.substring(5, 7), 16);

  r = Math.min(255, Math.max(0, Math.round(r * (1 + percent / 100))));
  g = Math.min(255, Math.max(0, Math.round(g * (1 + percent / 100))));
  b = Math.min(255, Math.max(0, Math.round(b * (1 + percent / 100))));

  const rr = r.toString(16).padStart(2, "0");
  const gg = g.toString(16).padStart(2, "0");
  const bb = b.toString(16).padStart(2, "0");

  return `#${rr}${gg}${bb}`;
}

/**
 * Determines if a color is light or dark.
 * Used to decide if text on this color should be light or dark.
 * @param hexColor Hex color string
 * @returns true if light, false if dark
 */
function isColorLight(hexColor: string): boolean {
  const r = parseInt(hexColor.substring(1, 3), 16);
  const g = parseInt(hexColor.substring(3, 5), 16);
  const b = parseInt(hexColor.substring(5, 7), 16);
  // Formula for perceived brightness (from WCAG)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150; // Threshold can be adjusted (128 is often used)
}

/**
 * Gets an appropriate text color (black or white) for a given background color.
 * @param backgroundColorHex Hex color string for the background
 * @returns "#000000" (black) or "#FFFFFF" (white)
 */
export function getTextColorForBackground(backgroundColorHex: string): string {
  if (!backgroundColorHex) {
    // For default greyish background, a darker text is better.
    return "#1f2937"; // Dark Gray
  }
  return isColorLight(backgroundColorHex) ? "#1f2937" : "#FFFFFF"; // Dark Gray for light BG, White for dark BG
}

// Add a specific color for "email-verification" and "uncategorizable" if they are distinct.
// Done in the CATEGORY_ACCENT_COLORS object.
