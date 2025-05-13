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
  account_id: string;
  message_id: string | null;
  category: string;
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
    getEmails: builder.query<
      PaginatedEmailsResponse,
      {
        page?: number;
        filters?: string[];
        search?: string;
        folderType?: string;
      } // Added folderType to QueryArg type
    >({
      query: ({
        page = 1,
        filters = [],
        search = "",
        folderType = "inbox",
      } = {}) => {
        // Default folderType to "inbox"
        // Sanitize and use folderType directly in the path
        const folderPathName = (folderType || "inbox").toLowerCase();
        const basePath = `email/${folderPathName}`;

        let queryString = `${basePath}?page=${page}&limit=${EMAILS_PER_PAGE}`;
        if (filters.length > 0) {
          queryString += `&filters=${filters.join(",")}`;
        }
        if (search) {
          queryString += `&search=${encodeURIComponent(search)}`;
        }
        // folderType is now part of the path, so it's not needed as a query parameter.
        return queryString;
      },
      providesTags: (
        result,
        error,
        { page, filters, search, folderType } // Adjusted to use destructured args, added folderType
      ) =>
        result
          ? [
              ...result.emails.map(({ id }) => ({
                type: "Email" as const,
                id,
              })),
              {
                type: "Email",
                id: "LIST",
                page,
                filters: filters?.join(","),
                search,
                folderType, // Tag with folderType
              },
            ]
          : [
              {
                type: "Email",
                id: "LIST",
                page,
                filters: filters?.join(","),
                search,
                folderType, // Tag with folderType
              },
            ],
    }),
    // We can add more endpoints here later, e.g., getEmailById, updateEmail, etc.
  }),
});

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useGetEmailsQuery, useLazyGetEmailsQuery } = emailsApi;
