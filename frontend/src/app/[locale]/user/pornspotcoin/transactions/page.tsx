"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import Head from "next/head";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Filter,
  Heart,
  Eye,
  MessageCircle,
  Bookmark,
  User,
  Loader2,
  Clock,
  ChevronDown,
  X,
} from "lucide-react";
import { usePSCTransactionHistoryInfinite } from "@/hooks/queries/usePSCQuery";
import { useDateUtils } from "@/hooks/useDateUtils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import LocaleLink from "@/components/ui/LocaleLink";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
  TransactionEntity,
  TransactionType,
  TransactionStatus,
} from "@/types/shared-types/pornspotcoin";

// Transaction icon mapping
const getTransactionIcon = (type: string) => {
  if (type.includes("like")) {
    return <Heart className="h-4 w-4 text-red-500" />;
  }
  if (type.includes("view")) {
    return <Eye className="h-4 w-4 text-blue-500" />;
  }
  if (type.includes("comment")) {
    return <MessageCircle className="h-4 w-4 text-green-500" />;
  }
  if (type.includes("bookmark")) {
    return <Bookmark className="h-4 w-4 text-yellow-500" />;
  }
  if (type.includes("profileView")) {
    return <User className="h-4 w-4 text-purple-500" />;
  }
  return <DollarSign className="h-4 w-4 text-muted-foreground" />;
};

// Transaction status badge
const getStatusBadge = (status: TransactionStatus) => {
  switch (status) {
    case "completed":
      return (
        <Badge
          variant="default"
          className="bg-green-100 text-green-800 border-green-200"
        >
          Completed
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="text-yellow-800 border-yellow-300">
          Pending
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "cancelled":
      return <Badge variant="secondary">Cancelled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

// Filter options
const transactionTypes: TransactionType[] = [
  "reward_view",
  "reward_like",
  "reward_comment",
  "reward_bookmark",
  "reward_profile_view",
];

const transactionStatuses: TransactionStatus[] = [
  "completed",
  "pending",
  "failed",
  "cancelled",
];

// Transaction item component
interface TransactionItemProps {
  transaction: TransactionEntity;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => {
  const { formatRelativeTime } = useDateUtils();

  return (
    <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        {/* Icon */}
        <div className="flex-shrink-0 p-2 bg-muted rounded-full">
          {getTransactionIcon(transaction.transactionType)}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="font-medium text-sm truncate">
              {transaction.description}
            </div>
            {getStatusBadge(transaction.status)}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span title={new Date(transaction.createdAt).toLocaleString()}>
                {formatRelativeTime(new Date(transaction.createdAt))}
              </span>
            </div>

            {transaction.metadata?.targetType &&
              transaction.metadata?.targetId && (
                <div className="flex items-center gap-1">
                  <span className="capitalize">
                    {transaction.metadata.targetType}
                  </span>
                  {transaction.metadata.targetId && (
                    <span className="text-muted-foreground">
                      #{transaction.metadata.targetId.slice(-8)}
                    </span>
                  )}
                </div>
              )}
          </div>
        </div>

        {/* Amount */}
        <div className="flex-shrink-0 text-right">
          <div
            className={`font-bold text-sm ${
              transaction.status === "completed"
                ? "text-green-600"
                : transaction.status === "failed"
                ? "text-red-600"
                : "text-muted-foreground"
            }`}
          >
            {transaction.status === "completed" && "+"}
            {transaction.amount.toFixed(4)} PSC
          </div>
          {transaction.metadata?.rate && (
            <div className="text-xs text-muted-foreground">
              Rate: {transaction.metadata.rate.toFixed(4)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Filters component
interface FiltersState {
  transactionType?: TransactionType;
  status?: TransactionStatus;
  dateFrom?: string;
  dateTo?: string;
}

interface FiltersProps {
  filters: FiltersState;
  onFilterChange: (filters: FiltersState) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const Filters: React.FC<FiltersProps> = ({
  filters,
  onFilterChange,
  isOpen,
  onToggle,
}) => {
  const clearFilters = () => {
    onFilterChange({});
  };

  const hasActiveFilters = Object.values(filters).some((value) => value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1">
              {Object.values(filters).filter(Boolean).length}
            </Badge>
          )}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {isOpen && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Transaction Type */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Transaction Type
                </label>
                <select
                  value={filters.transactionType || ""}
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      transactionType: e.target.value
                        ? (e.target.value as TransactionType)
                        : undefined,
                    })
                  }
                  className="w-full p-2 border border-border rounded-md bg-background text-sm"
                >
                  <option value="">All Types</option>
                  {transactionTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.replace("reward_", "").replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <select
                  value={filters.status || ""}
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      status: e.target.value
                        ? (e.target.value as TransactionStatus)
                        : undefined,
                    })
                  }
                  className="w-full p-2 border border-border rounded-md bg-background text-sm"
                >
                  <option value="">All Statuses</option>
                  {transactionStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  From Date
                </label>
                <input
                  type="date"
                  value={filters.dateFrom || ""}
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      dateFrom: e.target.value || undefined,
                    })
                  }
                  className="w-full p-2 border border-border rounded-md bg-background text-sm"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  To Date
                </label>
                <input
                  type="date"
                  value={filters.dateTo || ""}
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      dateTo: e.target.value || undefined,
                    })
                  }
                  className="w-full p-2 border border-border rounded-md bg-background text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Loading skeleton for transactions
const TransactionSkeleton = () => (
  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
    <div className="flex items-center gap-4 flex-1">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="text-right space-y-1">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  </div>
);

// Main transactions page component
export default function TransactionsPage() {
  const t = useTranslations("pornspotcoin.transactions");
  const [filters, setFilters] = useState<FiltersState>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Fetch transactions with filters
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePSCTransactionHistoryInfinite({
    limit: 20,
    ...filters,
  });

  // Flatten all transactions from all pages
  const transactions = useMemo(() => {
    return data?.pages.flatMap((page) => page.transactions || []) || [];
  }, [data]);

  // Load more trigger using intersection observer
  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver({
    enabled: hasNextPage && !isFetchingNextPage,
  });

  // Fetch next page when intersection is detected
  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const completed = transactions.filter((t) => t.status === "completed");
    const totalEarned = completed.reduce((sum, t) => sum + t.amount, 0);
    const avgAmount = completed.length > 0 ? totalEarned / completed.length : 0;

    return {
      totalTransactions: transactions.length,
      totalEarned,
      avgAmount,
      completedCount: completed.length,
    };
  }, [transactions]);

  if (isError) {
    return (
      <>
        <Head>
          <title>{t("meta.title")}</title>
          <meta name="description" content={t("meta.description")} />
        </Head>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              Error loading transactions: {error?.message || "Unknown error"}
            </div>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{t("meta.title")}</title>
        <meta name="description" content={t("meta.description")} />
      </Head>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <LocaleLink href="/user/pornspotcoin">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to PornSpotCoin
            </Button>
          </LocaleLink>
          <div>
            <h1 className="text-2xl font-bold">Transaction History</h1>
            <p className="text-muted-foreground">
              View all your PornSpotCoin transactions and earnings
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <div>
                  <div className="text-sm text-muted-foreground">
                    Total Earned
                  </div>
                  <div className="font-bold text-green-600">
                    {summaryStats.totalEarned.toFixed(4)} PSC
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="text-sm text-muted-foreground">
                    Total Transactions
                  </div>
                  <div className="font-bold">
                    {summaryStats.totalTransactions}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-purple-500" />
                <div>
                  <div className="text-sm text-muted-foreground">
                    Avg Per Transaction
                  </div>
                  <div className="font-bold">
                    {summaryStats.avgAmount.toFixed(4)} PSC
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-orange-500" />
                <div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                  <div className="font-bold text-green-600">
                    {summaryStats.completedCount}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Filters
          filters={filters}
          onFilterChange={setFilters}
          isOpen={filtersOpen}
          onToggle={() => setFiltersOpen(!filtersOpen)}
        />

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">
              Transactions ({summaryStats.totalTransactions})
            </h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TransactionSkeleton key={i} />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    No transactions found
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {Object.values(filters).some(Boolean)
                      ? "Try adjusting your filters to see more transactions."
                      : "Start engaging with content to earn PornSpotCoin!"}
                  </p>
                  {Object.values(filters).some(Boolean) && (
                    <Button variant="outline" onClick={() => setFilters({})}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {transactions.map((transaction) => (
                    <TransactionItem
                      key={transaction.transactionId}
                      transaction={transaction}
                    />
                  ))}

                  {/* Load more trigger */}
                  {hasNextPage && (
                    <div ref={loadMoreRef} className="p-4 text-center">
                      {isFetchingNextPage ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading more transactions...
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => fetchNextPage()}
                          disabled={!hasNextPage}
                        >
                          Load More
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
