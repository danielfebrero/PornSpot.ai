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
  const { data: budgets = [] } = usePSCBudgetsQuery({ limit: 30 });

  const updateBudgetMutation = usePSCBudgetMutation();

  const [selectedDate, setSelectedDate] = useState("");
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [newBudgetValue, setNewBudgetValue] = useState<number>(0);

  // Set initial selected date when budgets load
  React.useEffect(() => {
    if (budgets.length > 0 && !selectedDate) {
      setSelectedDate(budgets[0].date);
    }
  }, [budgets, selectedDate]);

  const selectedBudget = budgets.find((b) => b.date === selectedDate);

  const handleEditBudget = (date: string, currentBudget: number) => {
    setEditingBudget(date);
    setNewBudgetValue(currentBudget);
  };

  const handleSaveBudget = async () => {
    if (!editingBudget) return;

    try {
      await updateBudgetMutation.mutateAsync({
        date: editingBudget,
        amount: newBudgetValue,
      });
      setEditingBudget(null);
    } catch (error) {
      console.error("Failed to update budget:", error);
    }
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
    if (percentage > 50) return "text-green-600";
    if (percentage > 20) return "text-yellow-600";
    return "text-red-600";
  };

  const navigateDate = (direction: "prev" | "next") => {
    const currentIndex = budgets.findIndex((b) => b.date === selectedDate);
    if (direction === "prev" && currentIndex < budgets.length - 1) {
      setSelectedDate(budgets[currentIndex + 1].date);
    } else if (direction === "next" && currentIndex > 0) {
      setSelectedDate(budgets[currentIndex - 1].date);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-blue-500" />
          <div>
            <h2 className="text-xl font-semibold">Daily Budget Management</h2>
            <p className="text-sm text-gray-600">
              Monitor and manage daily PSC budget allocation and rates
            </p>
          </div>
        </div>
      </div>

      {/* Date Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Select Date</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDate("prev")}
                disabled={
                  budgets.findIndex((b) => b.date === selectedDate) >=
                  budgets.length - 1
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDate("next")}
                disabled={
                  budgets.findIndex((b) => b.date === selectedDate) <= 0
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {budgets.slice(0, 10).map((budget) => (
              <Button
                key={budget.date}
                variant={selectedDate === budget.date ? "default" : "outline"}
                className="p-3 h-auto flex flex-col"
                onClick={() => setSelectedDate(budget.date)}
              >
                <span className="text-xs font-medium">
                  {new Date(budget.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
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
            ))}
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
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(selectedBudget.totalBudget)}
                    </div>
                    <div className="text-sm text-gray-600">Total Budget</div>
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
                    <div className="text-sm text-gray-600">Remaining</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(selectedBudget.distributedAmount)}
                    </div>
                    <div className="text-sm text-gray-600">Distributed</div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Activity:</span>
                    <span className="font-medium">
                      {selectedBudget.totalActivity}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Weighted Activity:</span>
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
              <p className="text-sm text-gray-600">
                PSC rewards per action for {formatDate(selectedBudget.date)}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(selectedBudget.currentRates).map(
                  ([action, rate]) => (
                    <div
                      key={action}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-gray-500" />
                        <span className="capitalize text-sm font-medium">
                          {action
                            .replace("Rate", "")
                            .replace(/([A-Z])/g, " $1")
                            .trim()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-green-600" />
                        <span className="font-mono text-sm">
                          {rate.toFixed(3)}
                        </span>
                        <span className="text-xs text-gray-500">PSC</span>
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
