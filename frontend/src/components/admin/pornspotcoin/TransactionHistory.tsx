"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  History,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { usePSCTransactionsQuery } from "@/hooks/queries/usePSCAdminQuery";
import { PSCTransaction, TransactionFilters } from "@/lib/api/admin-psc";

interface TransactionHistoryProps {
  // No props needed - using hooks for data fetching
}

export function TransactionHistory({}: TransactionHistoryProps = {}) {
  const [filters, setFilters] = useState<TransactionFilters>({
    type: "all",
    status: "all",
    dateFrom: "",
    dateTo: "",
    userId: "",
    cursor: undefined,
    limit: 20,
  });

  const {
    data: transactionResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = usePSCTransactionsQuery(filters);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Extract transactions from the response
  const transactions = transactionResponse?.transactions || [];
  const pagination = transactionResponse?.pagination;

  const handleFilterChange = (
    key: keyof TransactionFilters,
    value: string | number
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value, cursor: undefined }));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      console.error("Failed to refresh transactions:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = async () => {
    // TODO: Implement export functionality
    console.log("Export functionality not yet implemented");
  };

  const formatAmount = (amount: number) => {
    const prefix = amount >= 0 ? "+" : "";
    return `${prefix}${amount.toFixed(3)} PSC`;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTypeIcon = (type: PSCTransaction["type"]) => {
    switch (type) {
      case "view":
      case "like":
      case "comment":
      case "bookmark":
      case "profileView":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "transfer":
        return <ExternalLink className="h-4 w-4 text-blue-500" />;
      case "withdrawal":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <RefreshCw className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: PSCTransaction["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-600 text-white">
            Completed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-600 text-white">
            Pending
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getTypeLabel = (type: PSCTransaction["type"]) => {
    switch (type) {
      case "profileView":
        return "Profile View";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">Loading transactions...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-red-600">
              Error loading transactions: {error?.message || "Unknown error"}
            </div>
            <div className="mt-4 text-center">
              <Button onClick={() => refetch()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-5 w-5 text-gray-500" />
          <div>
            <h2 className="text-xl font-semibold">Transaction History</h2>
            <p className="text-sm text-gray-600">
              View and analyze all PSC transactions
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={false}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <h3 className="text-lg font-semibold">Filters</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Transaction Type</label>
              <Select
                value={filters.type || "all"}
                onValueChange={(value) => handleFilterChange("type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="like">Like</SelectItem>
                  <SelectItem value="comment">Comment</SelectItem>
                  <SelectItem value="bookmark">Bookmark</SelectItem>
                  <SelectItem value="profileView">Profile View</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">User Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by username"
                  value={filters.userId}
                  onChange={(e) => handleFilterChange("userId", e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Results per page</label>
              <Select
                value={(filters.limit || 20).toString()}
                onValueChange={(value) =>
                  handleFilterChange("limit", parseInt(value))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Transactions ({transactions.length} shown)
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, cursor: undefined }))
                }
                disabled={!filters.cursor}
              >
                <ChevronLeft className="h-4 w-4" />
                First Page
              </Button>
              <span className="text-sm text-gray-600">
                {filters.cursor ? "Showing next page" : "Showing first page"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    cursor: pagination?.cursor || undefined,
                  }))
                }
                disabled={!pagination?.hasNext}
              >
                <ChevronRight className="h-4 w-4" />
                Next Page
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Amount</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction: PSCTransaction) => (
                  <tr
                    key={transaction.id}
                    className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(transaction.type)}
                        <span className="font-medium">
                          {getTypeLabel(transaction.type)}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="font-medium">{transaction.username}</div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.userId}
                      </div>
                    </td>
                    <td className="p-2">
                      <span
                        className={`font-mono ${
                          transaction.amount >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {formatAmount(transaction.amount)}
                      </span>
                    </td>
                    <td className="p-2">
                      {getStatusBadge(transaction.status)}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {formatDate(transaction.timestamp)}
                    </td>
                    <td className="p-2">
                      <div className="text-xs text-gray-500">
                        {transaction.metadata?.mediaId && (
                          <div>Media: {transaction.metadata.mediaId}</div>
                        )}
                        {transaction.metadata?.albumId && (
                          <div>Album: {transaction.metadata.albumId}</div>
                        )}
                        {transaction.metadata?.targetUserId && (
                          <div>To: {transaction.metadata.targetUserId}</div>
                        )}
                        {transaction.metadata?.withdrawalAddress && (
                          <div>
                            Addr:{" "}
                            {transaction.metadata.withdrawalAddress.slice(
                              0,
                              10
                            )}
                            ...
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {transactions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No transactions found matching your filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
