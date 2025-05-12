"use client"; // Add use client for hooks

import { EmailTable } from "@/components/email/EmailTable"; // Import the new EmailTable component
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Added Input for search
import type { InboxEmail } from "@/lib/store/features/api/emailsApi";
import { useGetEmailsQuery } from "@/lib/store/features/api/emailsApi"; // Import RTK Query hook
import {
  AlertTriangle,
  Loader2,
  Search as SearchIcon,
  ShieldAlert,
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
  const router = useRouter();
  const [currentPageToFetch, setCurrentPageToFetch] = useState(1);
  const [allDisplayedEmails, setAllDisplayedEmails] = useState<InboxEmail[]>(
    []
  );
  const [showFullPageError, setShowFullPageError] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const {
    data: latestPageData,
    isLoading: isLoadingInitialPage,
    isFetching: isFetchingCurrentPage,
    isError: isErrorCurrentPage,
    error: currentError,
  } = useGetEmailsQuery({
    page: currentPageToFetch,
    filters: activeFilters,
    search: debouncedSearchQuery,
    folderType: "spam",
  });

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
      setShowFullPageError(false);
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
      let newFilters: string[];
      if (filterId === "clear_all") {
        newFilters = [];
      } else {
        newFilters = prevFilters.includes(filterId)
          ? prevFilters.filter((f) => f !== filterId)
          : [...prevFilters, filterId];
      }
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
    console.log("Toggle star for SPAM email:", emailId);
    // Implement actual star toggle mutation here,
    // it might be different for spam (e.g., mark as not spam and star)
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
          <ShieldAlert className="h-7 w-7 text-destructive" />
          <h1 className="text-2xl font-bold">Spam</h1>
        </div>
        <div className="flex items-center gap-2">
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
            placeholder="Search spam..."
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
            onClick={() => handleFilterToggle("clear_all")}
          >
            Clear Filters
          </Button>
        )}
      </div>

      <EmailTable
        emails={allDisplayedEmails}
        isLoading={isFetchingCurrentPage}
        hasMore={hasMore}
        loadMoreRef={loadMoreRef}
        folderType="spam"
        onStarToggle={handleStarToggle} // Pass the new handler
      />
    </div>
  );
}
