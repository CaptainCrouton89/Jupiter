"use client"; // Add use client for hooks

import { EmailTable } from "@/components/email/EmailTable"; // Import the new EmailTable component
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Added Input for search
import type { InboxEmail } from "@/lib/store/features/api/emailsApi";
import { useGetEmailsQuery } from "@/lib/store/features/api/emailsApi"; // Import RTK Query hook
import {
  AlertTriangle,
  Loader2,
  Mail,
  Search as SearchIcon,
} from "lucide-react"; // Added Mail, Loader2 and AlertTriangle
import { useRouter } from "next/navigation"; // Added useRouter
import { useCallback, useEffect, useState } from "react"; // Added useEffect, useState, and useCallback
import { useInView } from "react-intersection-observer"; // Import useInView

// Custom hook for debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

const OBSERVER_THRESHOLD_OFFSET = "-200px"; // How far from the bottom to trigger load (e.g., height of a few items)

export default function InboxPage() {
  const router = useRouter();
  const [currentPageToFetch, setCurrentPageToFetch] = useState(1);
  const [allDisplayedEmails, setAllDisplayedEmails] = useState<InboxEmail[]>(
    []
  );
  const [showFullPageError, setShowFullPageError] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(""); // Added state for search query
  const debouncedSearchQuery = useDebounce(searchQuery, 500); // Debounce search query (500ms)

  // Fetch data for the currentPageToFetch
  const {
    data: latestPageData, // Data for the current page being fetched
    isLoading: isLoadingInitialPage, // True only when fetching page 1 and no data yet
    isFetching: isFetchingCurrentPage, // True when any page is fetching
    isError: isErrorCurrentPage,
    error: currentError,
  } = useGetEmailsQuery({
    page: currentPageToFetch,
    filters: activeFilters,
    search: debouncedSearchQuery,
  });

  // Accumulate emails and manage overall status
  useEffect(() => {
    if (latestPageData?.emails) {
      if (currentPageToFetch === 1) {
        setAllDisplayedEmails(latestPageData.emails);
      } else {
        setAllDisplayedEmails((prevEmails) => {
          const newEmails = latestPageData.emails.filter(
            (ne) => !prevEmails.some((pe) => pe.id === ne.id)
          );
          return [...prevEmails, ...newEmails];
        });
      }
      setShowFullPageError(false); // Clear full page error if data is received
    }
  }, [latestPageData, currentPageToFetch]);

  useEffect(() => {
    if (isErrorCurrentPage && allDisplayedEmails.length === 0) {
      setShowFullPageError(true);
    }
  }, [isErrorCurrentPage, allDisplayedEmails]);

  const hasMore =
    latestPageData?.hasNextPage ?? (currentPageToFetch === 1 ? true : false);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: `0px 0px ${OBSERVER_THRESHOLD_OFFSET} 0px`,
  });

  useEffect(() => {
    if (inView && hasMore && !isFetchingCurrentPage) {
      setCurrentPageToFetch((prevPage) => prevPage + 1);
    }
  }, [inView, hasMore, isFetchingCurrentPage]);

  const handleFilterToggle = useCallback((filterId: string) => {
    setActiveFilters((prevFilters) => {
      const newFilters = prevFilters.includes(filterId)
        ? prevFilters.filter((f) => f !== filterId)
        : [...prevFilters, filterId];
      setCurrentPageToFetch(1);
      setAllDisplayedEmails([]);
      setShowFullPageError(false);
      return newFilters;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setActiveFilters([]);
    setAllDisplayedEmails([]);
    setCurrentPageToFetch(1);
    setShowFullPageError(false);
  }, []);

  const handleStarToggle = useCallback((emailId: string) => {
    // Placeholder for star toggle logic
    console.log("Toggle star for email:", emailId);
    // Implement actual star toggle mutation here
    setAllDisplayedEmails((prevEmails) =>
      prevEmails.map((email) =>
        email.id === emailId ? { ...email, starred: !email.starred } : email
      )
    );
  }, []);

  const showPrimaryLoader =
    isLoadingInitialPage &&
    currentPageToFetch === 1 &&
    allDisplayedEmails.length === 0 &&
    !debouncedSearchQuery;

  if (showPrimaryLoader) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading emails...</p>
      </div>
    );
  }

  if (showFullPageError) {
    const errorMessage =
      (currentError as any)?.data?.error ||
      (currentError as any)?.message ||
      "An unexpected error occurred.";
    return (
      <div className="flex flex-col h-full items-center justify-center p-8">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-lg font-semibold text-destructive">
          Error loading emails
        </p>
        <p className="mt-2 text-center text-muted-foreground">{errorMessage}</p>
        <Button onClick={handleRefresh} variant="outline" className="mt-6">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/compose")}
          >
            <Mail className="mr-2 h-4 w-4" />
            Compose
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetchingCurrentPage && currentPageToFetch === 1}
          >
            {isFetchingCurrentPage && currentPageToFetch === 1 ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Refresh
          </Button>
          <Button variant="outline" size="sm" disabled>
            Archive
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search emails..."
            className="pl-10 w-full"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPageToFetch(1);
              setAllDisplayedEmails([]);
              setShowFullPageError(false);
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm text-muted-foreground mr-2">Filter by:</span>
        {[
          { id: "unread", label: "Unread" },
          { id: "starred", label: "Starred" },
          { id: "attachments", label: "With Attachments" },
        ].map((filter) => (
          <Button
            key={filter.id}
            variant={
              activeFilters.includes(filter.id) ? "secondary" : "outline"
            }
            size="sm"
            onClick={() => handleFilterToggle(filter.id)}
            className="text-xs px-2 py-1 h-auto sm:text-sm sm:px-3 sm:py-1.5"
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <EmailTable
        emails={allDisplayedEmails}
        isLoading={isFetchingCurrentPage} // Pass isFetchingCurrentPage for loading more indicator
        hasMore={hasMore}
        loadMoreRef={loadMoreRef}
        folderType="inbox"
        onStarToggle={handleStarToggle}
      />
    </div>
  );
}
