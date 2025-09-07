"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Edit,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  usePSCBudgetsQuery,
  usePSCBudgetMutation,
} from "@/hooks/queries/usePSCAdminQuery";

interface DailyBudgetManagerProps {
  // No props needed - using hooks for data fetching
}

export function DailyBudgetManager({}: DailyBudgetManagerProps) {
  // Helper function to format date as YYYY-MM-DD
  const formatDateForAPI = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Helper function to get date range (10 days before and after today)
  const getInitialDateRange = () => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 10);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 10);
    
    return {
      startDate: formatDateForAPI(startDate),
      endDate: formatDateForAPI(endDate),
    };
  };

  const [dateRange, setDateRange] = useState(getInitialDateRange());
  const { data: budgets = [] } = usePSCBudgetsQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    limit: 50, // Increase limit to handle expanded range
  });

  const updateBudgetMutation = usePSCBudgetMutation();

  const [selectedDate, setSelectedDate] = useState(formatDateForAPI(new Date())); // Default to today
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [newBudgetValue, setNewBudgetValue] = useState<number>(0);

  // Find today's budget or closest available date when budgets load
  React.useEffect(() => {
    if (budgets.length > 0) {
      const today = formatDateForAPI(new Date());
      const todayBudget = budgets.find(b => b.date === today);
      
      if (todayBudget) {
        setSelectedDate(today);
      } else {
        // If today's budget doesn't exist, find the closest available date
        const sortedBudgets = [...budgets].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const todayTime = new Date(today).getTime();
        
        let closestBudget = sortedBudgets[0];
        let minDiff = Math.abs(new Date(closestBudget.date).getTime() - todayTime);
        
        for (const budget of sortedBudgets) {
          const diff = Math.abs(new Date(budget.date).getTime() - todayTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestBudget = budget;
          }
        }
        
        setSelectedDate(closestBudget.date);
      }
    }
  }, [budgets]);

  // Handle navigation to new date ranges
  const [pendingNavigation, setPendingNavigation] = React.useState<{direction: "prev" | "next"} | null>(null);
  
  React.useEffect(() => {
    if (pendingNavigation && budgets.length > 0) {
      if (pendingNavigation.direction === "prev") {
        // Navigate to the earliest available date after loading previous days
        setSelectedDate(budgets[0].date);
      } else if (pendingNavigation.direction === "next") {
        // Navigate to the latest available date after loading future days
        setSelectedDate(budgets[budgets.length - 1].date);
      }
      setPendingNavigation(null);
    }
  }, [budgets, pendingNavigation]);

  const selectedBudget = budgets.find((b) => b.date === selectedDate);

  const handleEditBudget = (date: string, currentBudget: number) => {
    setEditingBudget(date);
    setNewBudgetValue(currentBudget);
  };

  const handleSaveBudget = () => {
    if (!editingBudget) return;

    // Optimistically close edit mode immediately
    setEditingBudget(null);

    // Trigger the mutation which will handle optimistic updates
    updateBudgetMutation.mutate(
      {
        date: editingBudget,
        amount: newBudgetValue,
      },
      {
        onError: (error) => {
          console.error("Failed to update budget:", error);
          // Re-open edit mode on error
          setEditingBudget(editingBudget);
          setNewBudgetValue(newBudgetValue);
        },
      }
    );
  };

  const handleCancelEdit = () => {
    setEditingBudget(null);
    setNewBudgetValue(0);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(3)} PSC`;
  };

  const getStatusColor = (remaining: number, total: number) => {
    const percentage = (remaining / total) * 100;
    if (percentage > 50) return "text-green-500 dark:text-green-400";
    if (percentage > 20) return "text-yellow-500 dark:text-yellow-400";
    return "text-red-500 dark:text-red-400";
  };

  const navigateDate = (direction: "prev" | "next") => {
    const currentIndex = budgets.findIndex((b) => b.date === selectedDate);
    
    if (direction === "prev") {
      if (currentIndex > 0) {
        // Navigate to previous available date
        setSelectedDate(budgets[currentIndex - 1].date);
      } else if (budgets.length > 0) {
        // We're at the beginning of the list, load 10 more previous days
        const earliestDate = new Date(budgets[0].date);
        const newStartDate = new Date(earliestDate);
        newStartDate.setDate(earliestDate.getDate() - 10);
        
        setPendingNavigation({ direction: "prev" });
        setDateRange({
          startDate: formatDateForAPI(newStartDate),
          endDate: dateRange.endDate,
        });
      }
    } else if (direction === "next") {
      if (currentIndex < budgets.length - 1) {
        // Navigate to next available date
        setSelectedDate(budgets[currentIndex + 1].date);
      } else if (budgets.length > 0) {
        // We're at the end of the list, load 10 more future days
        const latestDate = new Date(budgets[budgets.length - 1].date);
        const newEndDate = new Date(latestDate);
        newEndDate.setDate(latestDate.getDate() + 10);
        
        setPendingNavigation({ direction: "next" });
        setDateRange({
          startDate: dateRange.startDate,
          endDate: formatDateForAPI(newEndDate),
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-blue-500 dark:text-blue-400" />
          <div>
            <h2 className="text-xl font-semibold">Daily Budget Management</h2>
            <p className="text-sm text-muted-foreground">
              Monitor and manage daily PSC budget allocation and rates
            </p>
          </div>
        </div>
      </div>

      {/* Date Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Select Date</h3>
              <p className="text-xs text-muted-foreground">
                Showing {budgets.length} days ({budgets[0]?.date} to {budgets[budgets.length - 1]?.date})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = formatDateForAPI(new Date());
                  const todayBudget = budgets.find(b => b.date === today);
                  if (todayBudget) {
                    setSelectedDate(today);
                  } else {
                    // Reset to initial range centered on today
                    setDateRange(getInitialDateRange());
                  }
                }}
                className="text-xs"
                title="Go to today"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDate("prev")}
                disabled={budgets.length === 0}
                title="Load previous days"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDate("next")}
                disabled={budgets.length === 0}
                title="Load next days"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 max-h-48 overflow-y-auto">
            {budgets.map((budget) => {
              const isToday = budget.date === formatDateForAPI(new Date());
              return (
                <Button
                  key={budget.date}
                  variant={selectedDate === budget.date ? "default" : "outline"}
                  className={`p-3 h-auto flex flex-col transition-all hover:bg-muted/70 ${
                    selectedDate === budget.date 
                      ? "ring-2 ring-primary/20 bg-primary hover:bg-primary/90" 
                      : "hover:border-primary/50"
                  } ${isToday ? "border-blue-500 dark:border-blue-400" : ""}`}
                  onClick={() => setSelectedDate(budget.date)}
                >
                  <span className={`text-xs font-medium ${isToday ? "text-blue-600 dark:text-blue-400" : ""}`}>
                    {new Date(budget.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {isToday && <span className="ml-1">📅</span>}
                  </span>
                  <span
                    className={`text-xs ${getStatusColor(
                      budget.remainingBudget,
                      budget.totalBudget
                    )}`}
                  >
                    {formatCurrency(budget.remainingBudget)} left
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Details */}
      {selectedBudget && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Budget Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Budget for {formatDate(selectedBudget.date)}
                </h3>
                {editingBudget === selectedBudget.date ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveBudget}
                      disabled={updateBudgetMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={updateBudgetMutation.isPending}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleEditBudget(
                        selectedBudget.date,
                        selectedBudget.totalBudget
                      )
                    }
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingBudget === selectedBudget.date ? (
                <div className="space-y-2">
                  <Label htmlFor="budgetEdit">Total Budget (PSC)</Label>
                  <Input
                    id="budgetEdit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newBudgetValue}
                    onChange={(e) =>
                      setNewBudgetValue(parseFloat(e.target.value))
                    }
                    placeholder="Enter new budget amount"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-500 dark:text-blue-400">
                      {formatCurrency(selectedBudget.totalBudget)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Budget</div>
                  </div>
                  <div className="text-center">
                    <div
                      className={`text-2xl font-bold ${getStatusColor(
                        selectedBudget.remainingBudget,
                        selectedBudget.totalBudget
                      )}`}
                    >
                      {formatCurrency(selectedBudget.remainingBudget)}
                    </div>
                    <div className="text-sm text-muted-foreground">Remaining</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500 dark:text-green-400">
                      {formatCurrency(selectedBudget.distributedAmount)}
                    </div>
                    <div className="text-sm text-muted-foreground">Distributed</div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Activity:</span>
                    <span className="font-medium">
                      {selectedBudget.totalActivity}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weighted Activity:</span>
                    <span className="font-medium">
                      {selectedBudget.weightedActivity}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Rates */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Current Reward Rates</h3>
              <p className="text-sm text-muted-foreground">
                PSC rewards per action for {formatDate(selectedBudget.date)}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(selectedBudget.currentRates).map(
                  ([action, rate]) => (
                    <div
                      key={action}
                      className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors border border-border/50"
                    >
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize text-sm font-medium">
                          {action
                            .replace("Rate", "")
                            .replace(/([A-Z])/g, " $1")
                            .trim()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-green-500 dark:text-green-400" />
                        <span className="font-mono text-sm font-semibold">
                          {rate.toFixed(3)}
                        </span>
                        <span className="text-xs text-muted-foreground">PSC</span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
