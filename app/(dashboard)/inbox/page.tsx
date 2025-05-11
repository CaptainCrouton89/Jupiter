"use client"; // Add use client for hooks

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Added Input for search
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InboxEmail } from "@/lib/store/features/api/emailsApi";
import { useGetEmailsQuery } from "@/lib/store/features/api/emailsApi"; // Import RTK Query hook
import { cn } from "@/lib/utils"; // Import cn for class names
import {
  AlertTriangle,
  Loader2,
  Mail,
  Search as SearchIcon,
  Star,
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
    // refetch // We can use this for pull-to-refresh if needed later
  } = useGetEmailsQuery({
    page: currentPageToFetch,
    filters: activeFilters,
    search: debouncedSearchQuery,
  }); // Modified to pass search query

  // Accumulate emails and manage overall status
  useEffect(() => {
    if (latestPageData?.emails) {
      if (currentPageToFetch === 1) {
        setAllDisplayedEmails(latestPageData.emails);
      } else {
        setAllDisplayedEmails((prevEmails) => {
          // Basic de-duplication in case of overlapping fetches or re-fetches
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
    latestPageData?.hasNextPage ?? (currentPageToFetch === 1 ? true : false); // Optimistic hasMore for initial state
  const totalEmails = latestPageData?.totalEmails || allDisplayedEmails.length; // Use total from API if available

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
      // When filters change, reset to page 1 and clear existing emails
      setCurrentPageToFetch(1);
      setAllDisplayedEmails([]);
      setShowFullPageError(false);
      return newFilters;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setActiveFilters([]); // Reset filters
    setAllDisplayedEmails([]); // Clear displayed emails
    setCurrentPageToFetch(1); // Reset to fetch page 1
    setShowFullPageError(false); // Clear any full page error
    // RTK Query will automatically refetch for page 1 due to arg change if cache is stale
    // or use its cache if data for page 1 is considered fresh.
    // To force it, we might need to use `refetch()` from `useGetEmailsQuery(1)` if we stored it.
  }, []);

  // Main loading state: for the very first load of page 1 when no emails are shown
  const showPrimaryLoader =
    isLoadingInitialPage &&
    currentPageToFetch === 1 &&
    allDisplayedEmails.length === 0 &&
    !debouncedSearchQuery; // Don't show primary loader if searching initially

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
              // When search query changes, reset to page 1 and clear existing emails
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

      {allDisplayedEmails.length === 0 &&
      !isFetchingCurrentPage &&
      !isLoadingInitialPage ? (
        <div className="flex flex-col items-center justify-center h-full border rounded-md p-8">
          <Mail className="h-16 w-16 text-muted-foreground/50" />
          <p className="mt-4 text-xl font-semibold">It's quiet in here</p>
          <p className="mt-2 text-muted-foreground">
            No emails in your inbox yet.
          </p>
        </div>
      ) : (
        <div className="rounded-md border flex-grow overflow-y-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"></TableHead>
                {/* Checkbox/Select */}
                <TableHead className="w-[30px]"></TableHead>
                {/* Star */}
                <TableHead className="w-[25%]">From</TableHead>
                <TableHead>Subject</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allDisplayedEmails.map((email, index) => (
                <TableRow
                  key={email.id}
                  ref={
                    index === allDisplayedEmails.length - 5 ? loadMoreRef : null
                  }
                  tabIndex={0}
                  role="row"
                  aria-selected={false}
                  aria-label={`Email from ${
                    email.from_name || email.from_email
                  }, Subject: ${
                    email.subject || "(No Subject)"
                  }, Received: ${formatDate(email.received_at)}`}
                  className={`cursor-pointer ${
                    !email.read
                      ? "font-medium bg-muted/30 hover:bg-muted/40"
                      : "hover:bg-muted/20"
                  }`}
                  onClick={() => router.push(`/inbox/${email.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/inbox/${email.id}`);
                    }
                  }}
                >
                  <TableCell className="px-2" role="gridcell">
                    <div className="flex items-center justify-center h-4 w-4 rounded border"></div>
                  </TableCell>
                  <TableCell className="px-2" role="gridcell">
                    <Star
                      className={`h-4 w-4 ${
                        email.starred
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground hover:text-yellow-500"
                      }`}
                      aria-hidden="true"
                    />
                  </TableCell>
                  <TableCell
                    role="gridcell"
                    className="overflow-hidden break-words whitespace-normal min-w-0"
                  >
                    {email.from_name || email.from_email}
                  </TableCell>
                  <TableCell role="gridcell">
                    <div className="flex flex-col overflow-hidden">
                      <span
                        className={cn(
                          !email.read && "font-semibold",
                          "block truncate"
                        )}
                        title={email.subject || "(No Subject)"}
                      >
                        {email.subject || "(No Subject)"}
                      </span>
                      <span
                        className="text-muted-foreground text-sm block truncate max-w-[350px] sm:max-w-[450px] md:max-w-[600px] lg:max-w-[700px]"
                        title={email.preview || "(No preview available)"}
                      >
                        {email.preview || "(No preview available)"}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {isFetchingCurrentPage && currentPageToFetch > 1 && (
        <div className="flex justify-center items-center py-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading more emails...</p>
        </div>
      )}
      {!hasMore && allDisplayedEmails.length > 0 && !isFetchingCurrentPage && (
        <div className="text-center py-4 text-muted-foreground">
          <p>All emails loaded.</p>
        </div>
      )}
    </div>
  );
}
