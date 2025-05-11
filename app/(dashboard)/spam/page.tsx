"use client"; // Add use client for hooks

import { Badge } from "@/components/ui/badge"; // Added Badge for category
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
  Search as SearchIcon,
  ShieldAlert,
  Star,
} from "lucide-react"; // Added Mail, Loader2 and AlertTriangle
import { useRouter } from "next/navigation"; // Added useRouter
import { useCallback, useEffect, useState } from "react"; // Added useEffect, useState, and useCallback
import { useInView } from "react-intersection-observer"; // Import useInView

// Helper function to determine badge class names based on category
const getCategoryBadgeClassName = (category: string | undefined): string => {
  if (!category)
    return "border-transparent bg-muted text-muted-foreground hover:bg-muted/80"; // Default for undefined

  switch (category.toLowerCase()) {
    case "newsletter":
      return "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200/80 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900/70";
    case "marketing":
      return "border-transparent bg-purple-100 text-purple-800 hover:bg-purple-200/80 dark:bg-purple-900/50 dark:text-purple-300 dark:hover:bg-purple-900/70";
    case "receipt":
      return "border-transparent bg-green-100 text-green-800 hover:bg-green-200/80 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900/70";
    case "invoice":
      return "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200/80 dark:bg-yellow-900/50 dark:text-yellow-300 dark:hover:bg-yellow-900/70";
    case "finances":
      return "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-200/80 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900/70";
    case "code-related":
      return "border-transparent bg-slate-200 text-slate-800 hover:bg-slate-300/80 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-700/80";
    case "notification":
      return "border-transparent bg-sky-100 text-sky-800 hover:bg-sky-200/80 dark:bg-sky-900/50 dark:text-sky-300 dark:hover:bg-sky-900/70";
    case "account-related":
      return "border-transparent bg-orange-100 text-orange-800 hover:bg-orange-200/80 dark:bg-orange-900/50 dark:text-orange-300 dark:hover:bg-orange-900/70";
    case "personal":
      return "border-transparent bg-pink-100 text-pink-800 hover:bg-pink-200/80 dark:bg-pink-900/50 dark:text-pink-300 dark:hover:bg-pink-900/70";
    case "email-verification":
      return "border-transparent bg-teal-100 text-teal-800 hover:bg-teal-200/80 dark:bg-teal-900/50 dark:text-teal-300 dark:hover:bg-teal-900/70";
    case "uncategorizable":
    default:
      return "border-transparent bg-gray-200 text-gray-700 hover:bg-gray-300/80 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-700/80";
  }
};

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

export default function SpamPage() {
  // Changed component name
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
    folderType: "spam", // Pass folderType: "spam"
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
        <p className="mt-4 text-lg text-muted-foreground">Loading spam...</p>
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
          Error loading spam
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
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-7 w-7 text-destructive" />{" "}
          {/* Icon for Spam */}
          <h1 className="text-2xl font-bold">Spam</h1> {/* Changed title */}
        </div>
        <div className="flex items-center gap-2">
          {/* Removed Compose button for spam folder */}
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
          {/* Consider "Delete All" or "Empty Spam" functionality here */}
          <Button variant="destructive" size="sm" disabled>
            Empty Spam
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search spam..." // Changed placeholder
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

      {/* Filters might not be as relevant for spam, or could be different */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm text-muted-foreground mr-2">Filter by:</span>
        {[
          // Example: Filters for spam might be different
          { id: "potential_phishing", label: "Potential Phishing" },
          { id: "bulk_sender", label: "Bulk Senders" },
        ].map((filter) => (
          <Button
            key={filter.id}
            variant={
              activeFilters.includes(filter.id) ? "secondary" : "outline"
            }
            size="sm"
            onClick={() => handleFilterToggle(filter.id)}
          >
            {filter.label}
          </Button>
        ))}
        {activeFilters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleFilterToggle("clear_all")} // Special ID to clear all
          >
            Clear Filters
          </Button>
        )}
      </div>

      {allDisplayedEmails.length === 0 && !isFetchingCurrentPage ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <p className="text-xl font-semibold text-muted-foreground">
            No spam here!
          </p>
          <p className="text-sm text-muted-foreground">
            Your spam folder is currently empty.
          </p>
        </div>
      ) : (
        <div className="flex-grow overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px] hidden sm:table-cell">
                  {" "}
                  {/* Star/Important */}{" "}
                </TableHead>
                <TableHead className="w-[150px] sm:w-[200px]">From</TableHead>
                <TableHead>Subject & Preview</TableHead>
                <TableHead className="w-[100px] text-right hidden md:table-cell">
                  Category
                </TableHead>
                <TableHead className="w-[100px] text-right hidden md:table-cell">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allDisplayedEmails.map((email) => (
                <TableRow
                  key={email.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50",
                    email.read ? "" : "font-semibold bg-primary/5"
                  )}
                  onClick={() => router.push(`/spam/${email.id}`)} // Navigate to spam message
                >
                  <TableCell className="hidden sm:table-cell">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        email.starred
                          ? "text-yellow-400 hover:text-yellow-500"
                          : "text-muted-foreground hover:text-accent-foreground"
                      )}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent row click
                        // Add star/unstar spam logic here
                        console.log("Toggle star for spam:", email.id);
                      }}
                    >
                      <Star className="h-5 w-5" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="truncate">
                      {email.from_name || email.from_email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="truncate max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-2xl">
                        {email.subject}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl">
                        {email.preview}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    {email.category && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          getCategoryBadgeClassName(email.category)
                        )}
                      >
                        {email.category.replace(/-/g, " ")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    {formatDate(email.received_at)}
                  </TableCell>
                </TableRow>
              ))}
              {isFetchingCurrentPage && hasMore && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground mt-1">
                      Loading more spam...
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* Infinite scroll trigger */}
          {hasMore && !isFetchingCurrentPage && (
            <div ref={loadMoreRef} className="h-1 w-full" />
          )}
        </div>
      )}

      {!isFetchingCurrentPage && !hasMore && allDisplayedEmails.length > 0 && (
        <p className="text-center text-sm text-muted-foreground mt-4 py-2">
          You've reached the end of your spam. Total: {totalEmails}
        </p>
      )}
    </div>
  );
}
