import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// Define the structure of the email data expected by the frontend
// This was previously in emailsSlice.ts
export interface InboxEmail {
  id: string;
  from_name: string | null;
  from_email: string;
  subject: string | null;
  preview: string | null;
  received_at: string;
  read: boolean;
  starred: boolean;
  has_attachments: boolean;
  account_id: string;
  message_id: string | null;
}

export interface PaginatedEmailsResponse {
  emails: InboxEmail[];
  totalEmails: number;
  hasNextPage: boolean;
  currentPage: number;
}

const EMAILS_PER_PAGE = 100;

// Define a service using a base URL and expected endpoints
export const emailsApi = createApi({
  reducerPath: "emailsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/" }), // Base URL for all API requests
  tagTypes: ["Email"], // For cache invalidation
  endpoints: (builder) => ({
    getEmails: builder.query<PaginatedEmailsResponse, number>({
      // ResultType, QueryArg (page number)
      query: (page = 1) => `email/inbox?page=${page}&limit=${EMAILS_PER_PAGE}`,
      providesTags: (result, error, page) =>
        result
          ? [
              ...result.emails.map(({ id }) => ({
                type: "Email" as const,
                id,
              })),
              { type: "Email", id: "LIST", page }, // Tag the list with the page number
            ]
          : [{ type: "Email", id: "LIST", page }],
      // No serializeQueryArgs or merge needed here for this strategy.
      // RTK Query will cache based on the `page` argument automatically.
    }),
    // We can add more endpoints here later, e.g., getEmailById, updateEmail, etc.
  }),
});

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useGetEmailsQuery, useLazyGetEmailsQuery } = emailsApi;
