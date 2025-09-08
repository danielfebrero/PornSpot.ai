"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { Settings, Save, RotateCcw, AlertTriangle } from "lucide-react";
import {
  usePSCConfigQuery,
  usePSCConfigMutation,
  usePSCConfigResetMutation,
} from "@/hooks/queries/usePSCAdminQuery";
import { PSCSystemConfig } from "@/lib/api/admin-psc";

interface PSCConfigurationManagerProps {
  // No props needed - using hooks for data fetching
}

export function PSCConfigurationManager({}: PSCConfigurationManagerProps) {
  const { data: serverConfig, isLoading, error } = usePSCConfigQuery();

  const updateConfigMutation = usePSCConfigMutation();
  const resetConfigMutation = usePSCConfigResetMutation();

  const [config, setConfig] = useState<PSCSystemConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local config when server config changes
  React.useEffect(() => {
    if (serverConfig) {
      setConfig(serverConfig);
      setHasChanges(false);
    }
  }, [serverConfig]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-purple-500" />
            <div>
              <h2 className="text-xl font-semibold">System Configuration</h2>
              <p className="text-sm text-gray-600">
                Loading PornSpotCoin system settings...
              </p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              <span className="ml-3 text-muted-foreground">
                Loading configuration...
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-purple-500" />
            <div>
              <h2 className="text-xl font-semibold">System Configuration</h2>
              <p className="text-sm text-gray-600">
                Error loading PornSpotCoin system settings
              </p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center text-red-500">
              <AlertTriangle className="h-8 w-8 mr-3" />
              <span>Failed to load configuration. Please try again.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Don't render if config is not yet loaded
  if (!config) {
    return null;
  }

  const handleConfigChange = (field: keyof PSCSystemConfig, value: any) => {
    if (!config) return;

    setConfig((prev) => {
      if (!prev) return prev;
      const newConfig = { ...prev, [field]: value };
      setHasChanges(JSON.stringify(newConfig) !== JSON.stringify(serverConfig));
      return newConfig;
    });
  };

  const handleRateWeightChange = (
    action: keyof PSCSystemConfig["rateWeights"],
    value: number
  ) => {
    if (!config) return;

    setConfig((prev) => {
      if (!prev) return prev;
      const newConfig = {
        ...prev,
        rateWeights: { ...prev.rateWeights, [action]: value },
      };
      setHasChanges(JSON.stringify(newConfig) !== JSON.stringify(serverConfig));
      return newConfig;
    });
  };

  const handleSave = async () => {
    try {
      await updateConfigMutation.mutateAsync(config);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save configuration:", error);
    }
  };

  const handleReset = async () => {
    try {
      const resetConfig = await resetConfigMutation.mutateAsync();
      setConfig(resetConfig);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to reset configuration:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-purple-500" />
          <div>
            <h2 className="text-xl font-semibold">System Configuration</h2>
            <p className="text-sm text-gray-600">
              Manage PornSpotCoin system settings and reward rates
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetConfigMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateConfigMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateConfigMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Daily Budget Settings */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Budget Configuration</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dailyBudget">Daily Budget Amount (PSC)</Label>
              <Input
                id="dailyBudget"
                type="number"
                step="0.01"
                min="0"
                value={config.dailyBudgetAmount}
                onChange={(e) =>
                  handleConfigChange(
                    "dailyBudgetAmount",
                    parseFloat(e.target.value)
                  )
                }
              />
              <p className="text-xs text-gray-500">
                Total PSC available for distribution each day
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxPayout">Max Payout Per Action (PSC)</Label>
              <Input
                id="maxPayout"
                type="number"
                step="0.001"
                min="0"
                value={config.maxPayoutPerAction}
                onChange={(e) =>
                  handleConfigChange(
                    "maxPayoutPerAction",
                    parseFloat(e.target.value)
                  )
                }
              />
              <p className="text-xs text-gray-500">
                Maximum PSC that can be earned from a single action
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minPayout">Minimum Payout Amount (PSC)</Label>
            <Input
              id="minPayout"
              type="number"
              step="0.000000001"
              min="0"
              value={config.minimumPayoutAmount}
              onChange={(e) =>
                handleConfigChange(
                  "minimumPayoutAmount",
                  parseFloat(e.target.value)
                )
              }
            />
            <p className="text-xs text-gray-500">
              Minimum PSC amount required for a payout to be processed
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Feature Settings</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enableRewards" className="text-sm font-medium">
                  Enable Reward System
                </Label>
                <p className="text-xs text-gray-500">
                  Allow users to earn PSC from platform interactions
                </p>
              </div>
              <Switch
                checked={config.enableRewards}
                onCheckedChange={(checked) =>
                  handleConfigChange("enableRewards", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label
                  htmlFor="enableTransfers"
                  className="text-sm font-medium"
                >
                  Enable User-to-User Transfers
                </Label>
                <p className="text-xs text-gray-500">
                  Allow users to send PSC to other users
                </p>
              </div>
              <Switch
                checked={config.enableUserToUserTransfers}
                onCheckedChange={(checked) =>
                  handleConfigChange("enableUserToUserTransfers", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label
                  htmlFor="enableWithdrawals"
                  className="text-sm font-medium"
                >
                  Enable Withdrawals
                </Label>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  Allow users to withdraw PSC to external wallets
                </p>
              </div>
              <Switch
                checked={config.enableWithdrawals}
                onCheckedChange={(checked) =>
                  handleConfigChange("enableWithdrawals", checked)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Weights */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Reward Rate Weights</h3>
          <p className="text-sm text-gray-600">
            Multipliers used to calculate PSC rewards for different actions
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(config.rateWeights).map(([action, weight]) => (
              <div key={action} className="space-y-2">
                <Label htmlFor={`weight-${action}`} className="capitalize">
                  {action === "profileView" ? "Profile View" : action} Weight
                </Label>
                <Input
                  id={`weight-${action}`}
                  type="number"
                  step="0.1"
                  min="0"
                  value={weight}
                  onChange={(e) =>
                    handleRateWeightChange(
                      action as keyof PSCSystemConfig["rateWeights"],
                      parseFloat(e.target.value)
                    )
                  }
                />
                <p className="text-xs text-gray-500">
                  Higher values = higher PSC rewards
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
