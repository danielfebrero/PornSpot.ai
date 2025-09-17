import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Settings, ChevronDown, ChevronRight } from "lucide-react";
import { I2VSettings } from "@/types";

interface I2VSettingsProps {
  settings: I2VSettings;
  onSettingsChange: (newSettings: I2VSettings) => void;
}

export function I2VSettingsComponent({
  settings,
  onSettingsChange,
}: I2VSettingsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateSetting = <K extends keyof I2VSettings>(
    key: K,
    value: I2VSettings[K]
  ) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          Video Generation Settings
        </h3>
      </div>

      <div className="space-y-6">
        {/* Basic Settings */}
        <div>
          <Label htmlFor="videoLength" className="text-sm font-medium">
            Video Length
          </Label>
          <Select
            value={settings.videoLength.toString()}
            onValueChange={(value) =>
              updateSetting("videoLength", parseInt(value) as 5 | 8 | 10 | 15)
            }
          >
            <option value="5">5 seconds</option>
            <option value="8">8 seconds</option>
            <option value="10">10 seconds</option>
            <option value="15">15 seconds</option>
          </Select>
        </div>

        {/* Advanced Settings Toggle */}
        <div>
          <Button
            variant="ghost"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 p-0 h-auto font-medium text-foreground hover:text-primary"
          >
            {showAdvanced ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Advanced Settings
          </Button>
        </div>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="space-y-4 pl-6 border-l-2 border-border">
            {/* Prompt */}
            <div>
              <Label htmlFor="prompt" className="text-sm font-medium">
                Prompt (Optional)
              </Label>
              <Textarea
                id="prompt"
                value={settings.prompt}
                onChange={(e) => updateSetting("prompt", e.target.value)}
                placeholder="Describe the video motion or style..."
                className="mt-1"
                rows={3}
              />
            </div>

            {/* Negative Prompt */}
            <div>
              <Label htmlFor="negativePrompt" className="text-sm font-medium">
                Negative Prompt (Optional)
              </Label>
              <Textarea
                id="negativePrompt"
                value={settings.negativePrompt}
                onChange={(e) =>
                  updateSetting("negativePrompt", e.target.value)
                }
                placeholder="What to avoid in the video..."
                className="mt-1"
                rows={2}
              />
            </div>

            {/* Seed */}
            <div>
              <Label htmlFor="seed" className="text-sm font-medium">
                Seed (Optional)
              </Label>
              <Input
                id="seed"
                type="text"
                value={settings.seed}
                onChange={(e) => updateSetting("seed", e.target.value)}
                placeholder="Random seed for reproducibility"
                className="mt-1"
              />
            </div>

            {/* Flow Shift */}
            <div>
              <Label htmlFor="flowShift" className="text-sm font-medium">
                Flow Shift: {settings.flowShift}
              </Label>
              <input
                id="flowShift"
                type="range"
                min="1"
                max="10"
                step="0.1"
                value={settings.flowShift}
                onChange={(e) =>
                  updateSetting("flowShift", parseFloat(e.target.value))
                }
                className="mt-1 w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            {/* Inference Steps */}
            <div>
              <Label htmlFor="inferenceSteps" className="text-sm font-medium">
                Inference Steps: {settings.inferenceSteps}
              </Label>
              <input
                id="inferenceSteps"
                type="range"
                min="20"
                max="40"
                step="1"
                value={settings.inferenceSteps}
                onChange={(e) =>
                  updateSetting("inferenceSteps", parseInt(e.target.value))
                }
                className="mt-1 w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>20</span>
                <span>40</span>
              </div>
            </div>

            {/* CFG Scale */}
            <div>
              <Label htmlFor="cfgScale" className="text-sm font-medium">
                CFG Scale: {settings.cfgScale}
              </Label>
              <input
                id="cfgScale"
                type="range"
                min="1"
                max="10"
                step="0.1"
                value={settings.cfgScale}
                onChange={(e) =>
                  updateSetting("cfgScale", parseFloat(e.target.value))
                }
                className="mt-1 w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span>
                <span>10</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
