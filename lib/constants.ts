import { allCategories } from "@/types/settings";

import { Category } from "@/types/settings";

export const RELEVANT_CATEGORIES: Category[] = allCategories.filter(
  (cat) => cat !== "uncategorizable"
);
