import { configureStore } from "@reduxjs/toolkit";
// import emailReducer from "./features/emails/emailsSlice"; // Old slice, can be removed if RTK Query handles all
import { emailsApi } from "./features/api/emailsApi"; // Import the new API slice
import settingsReducer from "./features/settings/settingsSlice"; // Import the new settings reducer

export const store = configureStore({
  reducer: {
    [emailsApi.reducerPath]: emailsApi.reducer, // Add the API slice reducer
    settings: settingsReducer, // Add the settings reducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(emailsApi.middleware),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
