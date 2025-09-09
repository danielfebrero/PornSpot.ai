"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useDocumentHeadAndMeta } from "@/hooks/useDocumentHeadAndMeta";
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
const getStatusBadge = (status: TransactionStatus, t: any) => {
  switch (status) {
    case "completed":
      return (
        <Badge
          variant="default"
          className="bg-green-100 text-green-800 border-green-200"
        >
          {t("status.completed")}
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="text-yellow-800 border-yellow-300">
          {t("status.pending")}
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">{t("status.failed")}</Badge>;
    case "cancelled":
      return <Badge variant="secondary">{t("status.cancelled")}</Badge>;
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
  t: any;
}

const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  t,
}) => {
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
            {getStatusBadge(transaction.status, t)}
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
              {t("list.rate")} {transaction.metadata.rate.toFixed(4)}
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
  onFilterChange: (_filters: FiltersState) => void;
  isOpen: boolean;
  onToggle: () => void;
  t: any;
}

const Filters: React.FC<FiltersProps> = ({
  filters,
  onFilterChange,
  isOpen,
  onToggle,
  t,
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
          {t("filters.title")}
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
            {t("filters.clear")}
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
                  {t("filters.transactionType")}
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
                  <option value="">{t("filters.allTypes")}</option>
                  {transactionTypes.map((type) => (
                    <option key={type} value={type}>
                      {t(`types.${type}`)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("filters.status")}
                </label>
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
                  <option value="">{t("filters.allStatuses")}</option>
                  {transactionStatuses.map((status) => (
                    <option key={status} value={status}>
                      {t(`status.${status}`)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("filters.fromDate")}
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
                  {t("filters.toDate")}
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

  // Set document title and meta description
  useDocumentHeadAndMeta(t("meta.title"), t("meta.description"));

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
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              {t("page.errorLoading")}{" "}
              {error?.message || t("page.unknownError")}
            </div>
            <Button onClick={() => window.location.reload()}>
              {t("page.tryAgain")}
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <LocaleLink href="/user/pornspotcoin">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("page.backToPornSpotCoin")}
            </Button>
          </LocaleLink>
          <div>
            <h1 className="text-2xl font-bold">{t("page.title")}</h1>
            <p className="text-muted-foreground">{t("page.description")}</p>
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
                    {t("summary.totalEarned")}
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
                    {t("summary.totalTransactions")}
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
                    {t("summary.avgPerTransaction")}
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
                  <div className="text-sm text-muted-foreground">
                    {t("summary.completed")}
                  </div>
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
          t={t}
        />

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">
              {t("list.transactionsCount", {
                count: summaryStats.totalTransactions,
              })}
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
                    {t("list.noTransactionsFound")}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {Object.values(filters).some(Boolean)
                      ? t("list.noTransactionsWithFilters")
                      : t("list.noTransactionsGeneral")}
                  </p>
                  {Object.values(filters).some(Boolean) && (
                    <Button variant="outline" onClick={() => setFilters({})}>
                      {t("list.clearFilters")}
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {transactions.map((transaction) => (
                    <TransactionItem
                      key={transaction.transactionId}
                      transaction={transaction}
                      t={t}
                    />
                  ))}

                  {/* Load more trigger */}
                  {hasNextPage && (
                    <div ref={loadMoreRef} className="p-4 text-center">
                      {isFetchingNextPage ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("page.loadingMore")}
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => fetchNextPage()}
                          disabled={!hasNextPage}
                        >
                          {t("page.loadMore")}
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
