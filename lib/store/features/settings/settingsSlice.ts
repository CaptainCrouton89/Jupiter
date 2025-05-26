import { CategorizationTestEmail } from "@/components/settings/categorization/CategorizationTestCard";
import { createClient } from "@/lib/auth/client";
import { RELEVANT_CATEGORIES } from "@/lib/constants";
import type { Database } from "@/lib/database.types";
import type { EmailAccount } from "@/types/email";
import {
  type Category,
  type CategoryAction,
  type CategoryPreferences,
} from "@/types/settings";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "@supabase/supabase-js";

// This interface represents the structure of settings as fetched or saved,
// excluding slice-specific status fields or combined data like user object.
export interface UserSettingsRecord {
  id: string | null; // The ID of the user_settings record in the database
  category_preferences: CategoryPreferences;
  default_account_id: string | null;
  tutorial_completed: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | null;
  emails_since_reset: number;
  last_categorization_reset_at: string | null;
  work_profile_description: string;
}

export interface UserSettingsState {
  user: User | null;
  userId: string | null;
  settingsId: string | null; // ID of the user_settings record in DB for the current user

  category_preferences: CategoryPreferences;
  default_account_id: string | null;
  tutorial_completed: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | null;
  emails_since_reset: number;
  last_categorization_reset_at: string | null;
  work_profile_description: string;

  userEmailAccounts: EmailAccount[];
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
  lastSavedCategory: string | null;
  categorizationTest: {
    data: CategorizationTestEmail[] | null;
    isLoading: boolean;
    error: string | null;
    selectedAccountId: string | null;
  };
}

const initialCategoryPreferences: CategoryPreferences = {};
RELEVANT_CATEGORIES.forEach((cat) => {
  initialCategoryPreferences[cat] = { action: "none", digest: false };
});

const initialState: UserSettingsState = {
  user: null,
  userId: null,
  settingsId: null, // Correctly defined here now
  category_preferences: initialCategoryPreferences,
  default_account_id: null,
  tutorial_completed: true,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  stripe_price_id: null,
  stripe_subscription_status: null,
  stripe_current_period_end: null,
  emails_since_reset: 0,
  last_categorization_reset_at: null,
  work_profile_description: "",
  userEmailAccounts: [],
  status: "idle",
  error: null,
  lastSavedCategory: null,
  categorizationTest: {
    data: null,
    isLoading: false,
    error: null,
    selectedAccountId: null,
  },
};

// Async Thunks
export const fetchUserSettingsAndAccounts = createAsyncThunk(
  "settings/fetchUserSettingsAndAccounts",
  async (userId: string, { rejectWithValue }) => {
    try {
      const supabase = await createClient();
      const { data: settingsDataFromDb, error: settingsError } = await supabase
        .from("user_settings")
        .select(
          "id, category_preferences, default_account_id, tutorial_completed, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_subscription_status, stripe_current_period_end, emails_since_reset, last_categorization_reset_at"
        )
        .eq("user_id", userId)
        .single();

      if (settingsError && settingsError.code !== "PGRST116") {
        throw settingsError;
      }

      const { data: accountsData, error: accountsError } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (accountsError) {
        throw accountsError;
      }

      let fetchedSettings: UserSettingsRecord;
      let finalPrefs = { ...initialCategoryPreferences };
      let workDesc = "";

      if (settingsDataFromDb) {
        const prefs =
          settingsDataFromDb.category_preferences as CategoryPreferences | null;
        RELEVANT_CATEGORIES.forEach((cat) => {
          finalPrefs[cat] = prefs?.[cat] ?? { action: "none", digest: false };
        });
        if (finalPrefs.work && finalPrefs.work.profileDescription) {
          workDesc = finalPrefs.work.profileDescription;
        }
        fetchedSettings = {
          id: settingsDataFromDb.id,
          category_preferences: finalPrefs, // Populated preferences
          default_account_id: settingsDataFromDb.default_account_id,
          tutorial_completed: settingsDataFromDb.tutorial_completed === true,
          stripe_customer_id: settingsDataFromDb.stripe_customer_id,
          stripe_subscription_id: settingsDataFromDb.stripe_subscription_id,
          stripe_price_id: settingsDataFromDb.stripe_price_id,
          stripe_subscription_status:
            settingsDataFromDb.stripe_subscription_status,
          stripe_current_period_end:
            settingsDataFromDb.stripe_current_period_end,
          emails_since_reset: settingsDataFromDb.emails_since_reset || 0,
          last_categorization_reset_at:
            settingsDataFromDb.last_categorization_reset_at,
          work_profile_description: workDesc,
        };
      } else {
        fetchedSettings = {
          // Default values if no settings row exists
          id: null,
          category_preferences: initialCategoryPreferences, // Use initial here
          default_account_id: null,
          tutorial_completed: false,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          stripe_price_id: null,
          stripe_subscription_status: null,
          stripe_current_period_end: null,
          emails_since_reset: 0,
          last_categorization_reset_at: null,
          work_profile_description: "", // Empty default work description
        };
      }

      return { settings: fetchedSettings, accounts: accountsData || [] };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const saveCategoryPreferences = createAsyncThunk(
  "settings/saveCategoryPreferences",
  async (
    payload: {
      userId: string;
      currentSettingsId: string | null; // Use a different name to avoid conflict in scope
      preferences: CategoryPreferences;
      workProfileDescription: string;
    },
    { rejectWithValue }
  ) => {
    const { userId, currentSettingsId, preferences, workProfileDescription } =
      payload;
    try {
      const supabase = await createClient();
      const completePrefsToSave = JSON.parse(
        JSON.stringify(preferences)
      ) as CategoryPreferences;
      RELEVANT_CATEGORIES.forEach((cat) => {
        if (!completePrefsToSave[cat]) {
          completePrefsToSave[cat] = { action: "none", digest: false };
        }
      });
      if (!completePrefsToSave.work) {
        completePrefsToSave.work = { action: "none", digest: false };
      }
      completePrefsToSave.work.profileDescription = workProfileDescription;

      const dbPayload = { category_preferences: completePrefsToSave as any };

      let newSettingsId = currentSettingsId;
      if (currentSettingsId) {
        const { error: updateError } = await supabase
          .from("user_settings")
          .update(dbPayload)
          .eq("id", currentSettingsId);
        if (updateError) throw updateError;
      } else {
        const insertPayload: Database["public"]["Tables"]["user_settings"]["Insert"] =
          {
            user_id: userId,
            category_preferences: completePrefsToSave as any,
            // Ensure other non-nullable fields have defaults if creating new, or make them nullable in DB
            // For now, assuming category_preferences is the main part being set on initial save if others are optional
          };
        const { data: insertedData, error: insertError } = await supabase
          .from("user_settings")
          .insert(insertPayload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        if (insertedData) newSettingsId = insertedData.id;
      }
      return {
        preferences: completePrefsToSave,
        workProfileDescription,
        newSettingsIdIfCreated: newSettingsId,
      };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const markTutorialCompleted = createAsyncThunk(
  "settings/markTutorialCompleted",
  async (
    payload: { userId: string; currentSettingsId: string | null },
    { rejectWithValue }
  ) => {
    const { userId, currentSettingsId } = payload;
    try {
      const supabase = await createClient();
      const dbPayload = { tutorial_completed: true };
      let finalSettingsId = currentSettingsId;

      if (currentSettingsId) {
        await supabase
          .from("user_settings")
          .update(dbPayload)
          .eq("id", currentSettingsId);
      } else {
        const { data: newSetting, error: insertError } = await supabase
          .from("user_settings")
          .insert({ user_id: userId, ...dbPayload })
          .select("id")
          .single();
        if (insertError) throw insertError;
        if (newSetting) finalSettingsId = newSetting.id;
      }
      return {
        tutorialCompleted: true,
        newSettingsIdIfCreated: finalSettingsId,
      };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const performCategorizationTest = createAsyncThunk(
  "settings/performCategorizationTest",
  async (accountId: string, { rejectWithValue }) => {
    if (!accountId) {
      return rejectWithValue("Account ID is required for categorization test.");
    }
    try {
      const response = await fetch(
        `/api/email/test-categorization?accountId=${accountId}&limit=20`
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.error || "Failed to fetch categorization test results"
        );
      }
      return result.emails as CategorizationTestEmail[];
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.userId = action.payload?.id || null;
      if (!action.payload) {
        Object.assign(state, initialState);
        state.user = null; // Ensure user is explicitly nullified
        state.userId = null;
      }
    },
    setCategoryPreference: (
      state,
      action: PayloadAction<{
        category: Category;
        type: "action" | "digest";
        value: CategoryAction | boolean;
      }>
    ) => {
      const { category, type, value } = action.payload;
      if (!state.category_preferences[category]) {
        state.category_preferences[category] = {
          action: "none",
          digest: false,
        };
      }
      (state.category_preferences[category] as any)[type] = value;
      state.lastSavedCategory = category;
    },
    setWorkProfileDescription: (state, action: PayloadAction<string>) => {
      state.work_profile_description = action.payload;
      state.lastSavedCategory = "work";
    },
    clearLastSavedCategory: (state) => {
      state.lastSavedCategory = null;
    },
    setSelectedTestAccountId: (state, action: PayloadAction<string | null>) => {
      state.categorizationTest.selectedAccountId = action.payload;
    },
    resetSettingsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserSettingsAndAccounts.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchUserSettingsAndAccounts.fulfilled, (state, action) => {
        state.status = "succeeded";
        const { settings, accounts } = action.payload;
        state.settingsId = settings.id; // This should now be correct
        state.category_preferences = settings.category_preferences;
        state.default_account_id = settings.default_account_id;
        state.tutorial_completed = settings.tutorial_completed;
        state.stripe_customer_id = settings.stripe_customer_id;
        state.stripe_subscription_id = settings.stripe_subscription_id;
        state.stripe_price_id = settings.stripe_price_id;
        state.stripe_subscription_status = settings.stripe_subscription_status;
        state.stripe_current_period_end = settings.stripe_current_period_end;
        state.emails_since_reset = settings.emails_since_reset;
        state.last_categorization_reset_at =
          settings.last_categorization_reset_at;
        state.work_profile_description = settings.work_profile_description;
        state.userEmailAccounts = accounts;

        if (
          !state.categorizationTest.selectedAccountId &&
          accounts.length > 0
        ) {
          const defaultOrFirst = settings.default_account_id
            ? accounts.find((acc) => acc.id === settings.default_account_id)
            : accounts[0];
          if (defaultOrFirst) {
            state.categorizationTest.selectedAccountId = defaultOrFirst.id;
          }
        }
      })
      .addCase(fetchUserSettingsAndAccounts.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload as string;
      })
      .addCase(saveCategoryPreferences.fulfilled, (state, action) => {
        state.category_preferences = action.payload.preferences;
        state.work_profile_description = action.payload.workProfileDescription;
        if (action.payload.newSettingsIdIfCreated) {
          state.settingsId = action.payload.newSettingsIdIfCreated;
        }
      })
      .addCase(saveCategoryPreferences.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      .addCase(markTutorialCompleted.fulfilled, (state, action) => {
        state.tutorial_completed = action.payload.tutorialCompleted;
        if (action.payload.newSettingsIdIfCreated) {
          state.settingsId = action.payload.newSettingsIdIfCreated;
        }
      })
      .addCase(markTutorialCompleted.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      .addCase(performCategorizationTest.pending, (state) => {
        state.categorizationTest.isLoading = true;
        state.categorizationTest.error = null;
        state.categorizationTest.data = null;
      })
      .addCase(performCategorizationTest.fulfilled, (state, action) => {
        state.categorizationTest.isLoading = false;
        state.categorizationTest.data = action.payload;
      })
      .addCase(performCategorizationTest.rejected, (state, action) => {
        state.categorizationTest.isLoading = false;
        state.categorizationTest.error = action.payload as string;
      });
  },
});

export const {
  setUser,
  setCategoryPreference,
  setWorkProfileDescription,
  clearLastSavedCategory,
  setSelectedTestAccountId,
  resetSettingsError,
} = settingsSlice.actions;

export default settingsSlice.reducer;

export const selectUserSettings = (state: { settings: UserSettingsState }) =>
  state.settings;
export const selectCategoryPreferences = (state: {
  settings: UserSettingsState;
}) => state.settings.category_preferences;
export const selectUserEmailAccounts = (state: {
  settings: UserSettingsState;
}) => state.settings.userEmailAccounts;
