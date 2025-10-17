"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Slider } from "@/components/ui/Slider";
import { Switch } from "@/components/ui/Switch";
import { Lightbox } from "@/components/ui/Lightbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { ContentCard } from "@/components/ui/ContentCard";
import { GradientTextarea } from "@/components/ui/GradientTextarea";
import { MagicText, MagicTextHandle } from "@/components/ui/MagicText";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useGenerationContext } from "@/contexts/GenerationContext";
import { useDecrementUsageStats } from "@/hooks/queries/useGenerationQuery";
import {
  ImageIcon,
  Crown,
  Zap,
  Grid3X3,
  Lock,
  MinusCircle,
  Sparkles,
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,
  Settings2,
  Wand2,
  Layers,
  Eye,
  EyeOff,
  SlidersHorizontal,
  AlertCircle,
  Check,
  Plus,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
// import { useLocaleRouter } from "@/lib/navigation";
import { GenerationProgressCard } from "./ui/GenerationProgressCard";
import { composeMediaUrl } from "@/lib/urlUtils";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { useTranslations } from "next-intl";
import { getLoraModels } from "@/utils/loraModels";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type DeviceType = "mobile" | "tablet" | "desktop";

export function GenerateClient() {
  const magicTextRef = useRef<MagicTextHandle>(null);
  const loraListRef = useRef<HTMLDivElement>(null);
  const { fetchConnectionId, isConnected } = useWebSocket();
  const t = useTranslations("generate");
  // Refs for mobile section scrolling
  const sizeSectionRef = useRef<HTMLDivElement>(null);
  const batchSectionRef = useRef<HTMLDivElement>(null);
  const visibilitySectionRef = useRef<HTMLDivElement>(null);

  // Device detection state
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<"generate" | "results">(
    "generate"
  );
  // const [showMobileSettings, setShowMobileSettings] = useState(false);

  // Maintenance modal state
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);

  // Image sizes with translations
  const IMAGE_SIZES = [
    {
      value: "1024x1024",
      label: t("imageSizes.square"),
      width: 1024,
      height: 1024,
      icon: "⬜",
      ratio: "1:1",
    },
    {
      value: "1536x1024",
      label: t("imageSizes.landscape"),
      width: 1536,
      height: 1024,
      icon: "🖼️",
      ratio: "3:2",
    },
    {
      value: "1024x1536",
      label: t("imageSizes.portrait"),
      width: 1024,
      height: 1536,
      icon: "📱",
      ratio: "2:3",
    },
    {
      value: "1792x1024",
      label: t("imageSizes.wide"),
      width: 1792,
      height: 1024,
      icon: "🎬",
      ratio: "16:9",
    },
    {
      value: "1024x1792",
      label: t("imageSizes.tall"),
      width: 1024,
      height: 1792,
      icon: "🗼",
      ratio: "9:16",
    },
    {
      value: "custom",
      label: t("imageSizes.custom"),
      width: 1024,
      height: 1024,
      icon: "⚙️",
      ratio: "?",
    },
  ];

  // LoRA models with translated descriptions
  const LORA_MODELS = getLoraModels(t);

  // Hook for optimistic usage stats updates
  const decrementUsageStats = useDecrementUsageStats();

  // Use GenerationContext for all generation state and functionality
  const {
    settings,
    updateSettings,
    resetSettings,
    uiState: {
      allGeneratedImages,
      deletedImageIds,
      lightboxOpen,
      lightboxIndex,
      showMagicText,
      showProgressCard,
      optimizedPromptCache,
      originalPromptBeforeOptimization,
      isGenerating,
      isOptimizing,
    },
    setAllGeneratedImages,
    setDeletedImageIds,
    setLightboxOpen,
    setLightboxIndex,
    setShowMagicText,
    setShowProgressCard,
    setOptimizedPromptCache,
    setOriginalPromptBeforeOptimization,
    handleDeleteRecentMedia,
    toggleLora,
    updateLoraStrength,
    // handleLoraClickInAutoMode,
    queueStatus,
    generatedImages,
    error,
    progress,
    maxProgress,
    currentMessage,
    currentNode,
    nodeState,
    retryCount,
    isRetrying,
    workflowNodes,
    currentNodeIndex,
    optimizationStream,
    optimizationToken,
    generateImages,
    clearResults,
    stopGeneration,
  } = useGenerationContext();

  const {
    canGenerateImages,
    checkGenerationLimits,
    getCurrentPlan,
    canUseBulkGeneration,
    canUseLoRAModels,
    canUseNegativePrompt,
    canUseCustomSizes,
    canCreatePrivateContent,
    canUseCfgScale,
    canUseSeed,
    canUseSteps,
  } = useUserPermissions();

  // const router = useLocaleRouter();

  const { allowed, remaining } = checkGenerationLimits(settings.batchCount);
  const plan = getCurrentPlan();

  const canUseBulk = canUseBulkGeneration();
  const canUseLoras = canUseLoRAModels();
  const canUseNegativePrompts = canUseNegativePrompt();

  // Filter out deleted images
  const filteredGeneratedImages = generatedImages.filter(
    (image) => !deletedImageIds.has(image.id)
  );
  const filteredAllGeneratedImages = allGeneratedImages.filter(
    (image) => !deletedImageIds.has(image.id)
  );

  const hasActiveQueueId = Boolean(queueStatus?.queueId);

  // Button states
  const isInPreparingState =
    isOptimizing || (isGenerating && !hasActiveQueueId);
  const isInStopState = isGenerating && hasActiveQueueId;

  // Device detection with better breakpoints
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType("mobile");
      } else if (width < 1280) {
        setDeviceType("tablet");
      } else {
        setDeviceType("desktop");
      }
    };
    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  const updateLoraSelectionMode = (mode: "auto" | "manual") => {
    if (mode === "manual" && !canUseLoras) return;
    updateSettings("loraSelectionMode", mode);
  };

  const revertToOriginalPrompt = () => {
    if (
      originalPromptBeforeOptimization &&
      originalPromptBeforeOptimization !== settings.prompt
    ) {
      updateSettings("prompt", originalPromptBeforeOptimization);
      setOptimizedPromptCache("");
      setOriginalPromptBeforeOptimization("");
      setShowMagicText(false);
      if (magicTextRef.current) {
        magicTextRef.current.reset();
      }
    }
  };

  const handleResetMagicText = () => {
    if (magicTextRef.current) {
      magicTextRef.current.reset();
    }
  };

  const openThumbnailLightbox = (imageUrl: string) => {
    const index = filteredAllGeneratedImages.findIndex(
      (media) => media.url === imageUrl
    );
    if (index !== -1) {
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  const handleOptimisticDelete = (mediaId: string) => {
    setDeletedImageIds((prev) => new Set(prev).add(mediaId));
    setAllGeneratedImages((prev) =>
      prev.filter((media) => media.id !== mediaId)
    );
  };

  const handleLightboxNext = () => {
    setLightboxIndex(
      Math.min(lightboxIndex + 1, filteredAllGeneratedImages.length - 1)
    );
  };

  const handleLightboxPrevious = () => {
    setLightboxIndex(Math.max(lightboxIndex - 1, 0));
  };

  const handleResetAllSettings = () => {
    resetSettings();
    setExpandedSection(null);
    setShowAdvanced(false);
  };

  const handleGenerate = async () => {
    if (!canGenerateImages() || !allowed || !settings.prompt.trim()) return;

    decrementUsageStats(settings.batchCount || 1);
    setShowProgressCard(true);
    clearResults();

    if (settings.optimizePrompt && settings.prompt !== optimizedPromptCache) {
      setOriginalPromptBeforeOptimization(settings.prompt);
      handleResetMagicText();
      setShowMagicText(true);
      magicTextRef.current?.startStreaming();
    }

    if (settings.prompt === optimizedPromptCache) {
      await generateImages({ ...settings, optimizePrompt: false });
    } else {
      await generateImages(settings);
    }

    // Switch to results tab on mobile/tablet after generation starts
    if (deviceType !== "desktop") {
      setActiveTab("results");
    }
  };

  const handleStopGeneration = () => {
    stopGeneration();
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Handle LoRA toggle without scrolling
  const handleToggleLora = (loraId: string) => {
    const scrollPosition = loraListRef.current?.scrollTop;
    toggleLora(loraId);

    // Restore list scroll position after state update (desktop only has inner scroll)
    setTimeout(() => {
      if (loraListRef.current && scrollPosition !== undefined) {
        loraListRef.current.scrollTop = scrollPosition;
      }
    }, 0);
  };

  useEffect(() => {
    if (optimizationStream !== null) {
      // Cache the optimized prompt
      setOptimizedPromptCache(optimizationStream);

      // Update the settings immediately if magic text is not showing
      updateSettings("prompt", optimizationStream);
    }
  }, [optimizationStream, setOptimizedPromptCache, updateSettings]);

  // Auto-scroll opened parameter section into view on mobile/tablet
  useEffect(() => {
    if (deviceType === "desktop" || !expandedSection) return;
    const map: Record<string, React.RefObject<HTMLDivElement>> = {
      size: sizeSectionRef,
      batch: batchSectionRef,
      visibility: visibilitySectionRef,
    };
    const ref = map[expandedSection];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [expandedSection, deviceType]);

  useEffect(() => {
    if (
      isOptimizing &&
      optimizationStream &&
      showMagicText &&
      magicTextRef.current &&
      optimizationToken
    ) {
      magicTextRef.current.streamToken(optimizationToken, optimizationStream);
    }
  }, [optimizationStream, isOptimizing, showMagicText, optimizationToken]);

  useEffect(() => {
    if (generatedImages.length > 0) {
      setShowProgressCard(false);
    }
  }, [generatedImages, setShowProgressCard]);

  useEffect(() => {
    if (!isConnected) return;
    fetchConnectionId();
  }, [fetchConnectionId, isConnected]);

  useEffect(() => {
    if (!isOptimizing) setShowMagicText(false);
  }, [isOptimizing, setShowMagicText]);

  // Shared LoRA component with individual strength controls
  const LoRAModelsSection = ({ compact = false }: { compact?: boolean }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3
          className={cn(
            "font-medium flex items-center gap-2",
            compact ? "text-sm" : ""
          )}
        >
          <Wand2 className={compact ? "h-3 w-3" : "h-4 w-4"} />
          {t("loraModelsSection")}
        </h3>
        {!canUseLoras && <Crown className="h-3 w-3 text-amber-500" />}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => updateLoraSelectionMode("auto")}
          className={cn(
            "flex-1 py-2 px-3 text-sm rounded-lg border transition-all",
            settings.loraSelectionMode === "auto"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border"
          )}
        >
          {t("automatic")}
        </button>
        <button
          onClick={() => updateLoraSelectionMode("manual")}
          disabled={!canUseLoras}
          className={cn(
            "flex-1 py-2 px-3 text-sm rounded-lg border transition-all",
            settings.loraSelectionMode === "manual"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border",
            !canUseLoras && "opacity-50"
          )}
        >
          {t("manual")}
        </button>
      </div>

      {settings.loraSelectionMode === "manual" && canUseLoras && (
        <div
          ref={loraListRef}
          className={cn(
            "space-y-2",
            // Keep compact styling but avoid inner scrolling on mobile/tablet to prevent glitches
            compact && deviceType === "desktop" && "max-h-60 overflow-y-auto"
          )}
        >
          {LORA_MODELS.map((lora) => {
            const isSelected = settings.selectedLoras.includes(lora.id);
            const strength = settings.loraStrengths?.[lora.id];

            return (
              <div
                key={lora.id}
                className={cn(
                  "rounded-lg border transition-all",
                  isSelected
                    ? "bg-primary/10 border-primary"
                    : "bg-background border-border"
                )}
              >
                <button
                  onClick={() => handleToggleLora(lora.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{lora.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {lora.description}
                      </p>
                    </div>
                    {isSelected ? (
                      <Check className="h-4 w-4 text-primary ml-2 flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 border-2 border-border rounded ml-2 flex-shrink-0" />
                    )}
                  </div>
                </button>

                {/* Individual LoRA Strength Controls */}
                {isSelected && strength && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium">Strength</span>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // preserve list scroll position when switching mode
                            const pos = loraListRef.current?.scrollTop;
                            updateLoraStrength(lora.id, "auto");
                            setTimeout(() => {
                              if (
                                loraListRef.current &&
                                typeof pos === "number"
                              )
                                loraListRef.current.scrollTop = pos;
                            }, 0);
                          }}
                          className={cn(
                            "px-2 py-0.5 text-xs rounded transition-colors",
                            strength.mode === "auto"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          Auto
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const pos = loraListRef.current?.scrollTop;
                            updateLoraStrength(lora.id, "manual");
                            setTimeout(() => {
                              if (
                                loraListRef.current &&
                                typeof pos === "number"
                              )
                                loraListRef.current.scrollTop = pos;
                            }, 0);
                          }}
                          className={cn(
                            "px-2 py-0.5 text-xs rounded transition-colors",
                            strength.mode === "manual"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          Manual
                        </button>
                      </div>
                    </div>

                    {strength.mode === "manual" && (
                      <div className={cn("space-y-1")}>
                        <div className={cn("min-h-11 flex items-center")}>
                          <Slider
                            aria-label={`LoRA strength: ${lora.name}`}
                            value={[strength.value]}
                            onValueChange={(values) => {
                              updateLoraStrength(lora.id, "manual", values[0]);
                            }}
                            min={0}
                            max={1.5}
                            step={0.05}
                            className={cn("w-full")}
                          />
                        </div>
                        <div
                          className={cn(
                            "flex justify-between text-xs text-muted-foreground"
                          )}
                        >
                          <span>0.0</span>
                          <span className="font-medium">
                            {strength.value.toFixed(2)}
                          </span>
                          <span>1.5</span>
                        </div>
                      </div>
                    )}

                    {strength.mode === "auto" && (
                      <p className="text-xs text-muted-foreground text-center">
                        Strength will be optimized automatically
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!canUseLoras && settings.loraSelectionMode === "manual" && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {t("upgradeToProForLora")}
          </p>
        </div>
      )}
    </div>
  );

  // Mobile and Tablet View
  if (deviceType === "mobile" || deviceType === "tablet") {
    return (
      <div
        className="min-h-screen bg-background pb-32"
        onClick={() =>
          showMagicText && !isOptimizing && setShowMagicText(false)
        }
      >
        <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b shadow-sm">
          <div className="px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Wand2 className="h-3.5 w-3.5 text-white" />
                </div>
                <h1 className="font-bold text-base truncate">
                  {t("aiImageGenerator")}
                </h1>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {remaining !== "unlimited" && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] leading-none px-1.5 py-0.5"
                  >
                    {remaining}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="text-[10px] leading-none px-1.5 py-0.5"
                >
                  {plan}
                </Badge>
              </div>
            </div>
          </div>

          {/* Tabs - keep visible on results to allow navigating back */}
          {(filteredGeneratedImages.length > 0 ||
            showProgressCard ||
            activeTab === "results") && (
            <div className="flex border-t">
              <button
                onClick={() => setActiveTab("generate")}
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium transition-colors relative",
                  activeTab === "generate"
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                Generate
                {activeTab === "generate" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("results")}
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium transition-colors relative",
                  activeTab === "results"
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                Results
                {filteredGeneratedImages.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1.5 text-[10px] leading-none px-1 py-0.5"
                  >
                    {filteredGeneratedImages.length}
                  </Badge>
                )}
                {activeTab === "results" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === "generate" ? (
            <motion.div
              key="generate"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={cn(
                "space-y-4 pb-20",
                deviceType === "mobile" ? "px-4 py-4" : "px-6 py-6"
              )}
            >
              {/* Prompt Input Card with Gradient */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-sm">
                      {t("describeVision")}
                    </h2>
                    {settings.prompt && (
                      <button
                        onClick={() => {
                          updateSettings("prompt", "");
                          setOptimizedPromptCache("");
                          setOriginalPromptBeforeOptimization("");
                        }}
                        className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <GradientTextarea
                      placeholder={t("promptPlaceholder")}
                      value={settings.prompt}
                      onChange={(e) => {
                        updateSettings("prompt", e.target.value);
                        if (e.target.value !== optimizedPromptCache) {
                          setOptimizedPromptCache("");
                          setOriginalPromptBeforeOptimization("");
                        }
                      }}
                      className={cn(
                        "resize-none",
                        deviceType === "mobile"
                          ? "min-h-[100px] text-sm"
                          : "min-h-[120px] text-base"
                      )}
                    />
                    {showMagicText && (
                      <MagicText
                        originalText={
                          originalPromptBeforeOptimization || settings.prompt
                        }
                        ref={magicTextRef}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground hidden sm:block">
                      {t("descriptiveTip")}
                    </span>
                    <span
                      className={cn(
                        "font-medium ml-auto",
                        settings.prompt.length > 800
                          ? "text-amber-500"
                          : settings.prompt.length > 900
                          ? "text-red-500"
                          : "text-muted-foreground"
                      )}
                    >
                      {settings.prompt.length}/2000
                    </span>
                  </div>

                  {/* AI Optimize Toggle */}
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/10 to-purple-600/10 rounded-xl border">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">
                        {t("optimizePrompt")}
                      </span>
                    </div>
                    <Switch
                      checked={settings.optimizePrompt}
                      onCheckedChange={(checked) =>
                        updateSettings("optimizePrompt", checked)
                      }
                    />
                  </div>

                  {originalPromptBeforeOptimization &&
                    settings.prompt !== originalPromptBeforeOptimization && (
                      <button
                        onClick={revertToOriginalPrompt}
                        className="w-full p-2 text-xs text-primary bg-primary/10 rounded-lg flex items-center justify-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        {t("revertToOriginal")}
                      </button>
                    )}
                </CardContent>
              </Card>

              {/* Quick Settings Grid - Adjusted for mobile */}
              <div
                className={cn(
                  "grid gap-2",
                  deviceType === "mobile" ? "grid-cols-2" : "grid-cols-3"
                )}
              >
                {/* Image Size */}
                <button
                  onClick={() => toggleSection("size")}
                  className="bg-card rounded-lg border p-2.5 text-left flex flex-col"
                >
                  <div className="flex items-start justify-between mb-1">
                    <Grid3X3 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {!canUseCustomSizes() && (
                      <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    {t("imageSize")}
                  </p>
                  <p className="text-xs font-medium truncate">
                    {
                      IMAGE_SIZES.find((s) => s.value === settings.imageSize)
                        ?.label
                    }
                  </p>
                </button>

                {/* Batch Count */}
                <button
                  onClick={() => toggleSection("batch")}
                  className="bg-card rounded-lg border p-2.5 text-left flex flex-col"
                >
                  <div className="flex items-start justify-between mb-1">
                    <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {!canUseBulk && (
                      <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    {t("batchCount")}
                  </p>
                  <p className="text-xs font-medium">
                    {settings.batchCount} {t("images")}
                  </p>
                </button>

                {/* Visibility */}
                <button
                  onClick={() => toggleSection("visibility")}
                  className="bg-card rounded-lg border p-2.5 text-left flex flex-col"
                >
                  <div className="flex items-start justify-between mb-1">
                    {settings.isPublic ? (
                      <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    {!canCreatePrivateContent() && (
                      <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    {t("visibility")}
                  </p>
                  <p className="text-xs font-medium">
                    {settings.isPublic ? t("public") : t("private")}
                  </p>
                </button>

                {/* Advanced Settings */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={cn(
                    "bg-card rounded-lg border p-2.5 text-left flex flex-col",
                    deviceType === "tablet"
                      ? "col-span-3"
                      : deviceType === "mobile"
                      ? "col-span-2"
                      : ""
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        <p className="text-[10px] text-muted-foreground">
                          {t("advancedControls")}
                        </p>
                      </div>
                      <p className="text-xs font-medium">
                        {showAdvanced ? t("shown") : t("hidden")}
                      </p>
                    </div>
                    {showAdvanced ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleResetAllSettings}
                className="w-full h-9 flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("actions.resetParameters")}
              </Button>

              {/* Expandable Sections */}
              <AnimatePresence>
                {/* Size Selection */}
                {expandedSection === "size" && (
                  <motion.div
                    ref={sizeSectionRef}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden scroll-mt-24"
                  >
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <h3 className="font-medium flex items-center gap-2 text-sm">
                          <Grid3X3 className="h-4 w-4" />
                          {t("imageSize")}
                        </h3>
                        <div
                          className={cn(
                            "grid gap-2",
                            deviceType === "mobile"
                              ? "grid-cols-2"
                              : "grid-cols-3"
                          )}
                        >
                          {IMAGE_SIZES.map((size) => (
                            <button
                              key={size.value}
                              onClick={() => {
                                if (
                                  !canUseCustomSizes() &&
                                  size.value !== "1024x1024"
                                )
                                  return;
                                updateSettings("imageSize", size.value);
                                if (size.value !== "custom") {
                                  updateSettings("customWidth", size.width);
                                  updateSettings("customHeight", size.height);
                                  // close panel for predefined sizes only
                                  toggleSection("size");
                                }
                              }}
                              disabled={
                                !canUseCustomSizes() &&
                                size.value !== "1024x1024"
                              }
                              className={cn(
                                "p-2.5 rounded-lg border text-left transition-all",
                                settings.imageSize === size.value
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-border",
                                !canUseCustomSizes() &&
                                  size.value !== "1024x1024" &&
                                  "opacity-50"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-base">{size.icon}</span>
                                <div>
                                  <p className="text-xs font-medium">
                                    {size.label}
                                  </p>
                                  {size.value !== "custom" && (
                                    <p className="text-[10px] opacity-80">
                                      {size.ratio}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                        {settings.imageSize === "custom" &&
                          canUseCustomSizes() && (
                            <div className="grid grid-cols-2 gap-3 pt-2">
                              <div>
                                <label className="text-xs text-muted-foreground">
                                  {t("width")}
                                </label>
                                <Input
                                  type="number"
                                  min="512"
                                  max="2048"
                                  step="64"
                                  value={settings.customWidth}
                                  onChange={(e) =>
                                    updateSettings(
                                      "customWidth",
                                      parseInt(e.target.value) || 1024
                                    )
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">
                                  {t("height")}
                                </label>
                                <Input
                                  type="number"
                                  min="512"
                                  max="2048"
                                  step="64"
                                  value={settings.customHeight}
                                  onChange={(e) =>
                                    updateSettings(
                                      "customHeight",
                                      parseInt(e.target.value) || 1024
                                    )
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                          )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Batch Selection */}
                {expandedSection === "batch" && (
                  <motion.div
                    ref={batchSectionRef}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden scroll-mt-24"
                  >
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <h3 className="font-medium flex items-center gap-2 text-sm">
                          <Layers className="h-4 w-4" />
                          {t("batchCount")}
                        </h3>
                        <div className="grid grid-cols-4 gap-2">
                          {[1, 2, 4, 8].map((count) => (
                            <button
                              key={count}
                              onClick={() => {
                                if (canUseBulk || count === 1) {
                                  updateSettings("batchCount", count);
                                  toggleSection("batch");
                                }
                              }}
                              disabled={!canUseBulk && count > 1}
                              className={cn(
                                "py-2.5 rounded-lg border font-medium transition-all text-sm",
                                settings.batchCount === count
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-border",
                                !canUseBulk && count > 1 && "opacity-50"
                              )}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                        {!canUseBulk && (
                          <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                            <p className="text-[10px] text-amber-700 dark:text-amber-400">
                              {t("upgradeForBulk")}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Visibility Selection */}
                {expandedSection === "visibility" && (
                  <motion.div
                    ref={visibilitySectionRef}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden scroll-mt-24"
                  >
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <h3 className="font-medium flex items-center gap-2 text-sm">
                          <Lock className="h-4 w-4" />
                          {t("visibility")}
                        </h3>
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              updateSettings("isPublic", true);
                              toggleSection("visibility");
                            }}
                            className={cn(
                              "w-full p-2.5 rounded-lg border text-left transition-all",
                              settings.isPublic
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Eye className="h-4 w-4" />
                              <div>
                                <p className="font-medium text-sm">
                                  {t("public")}
                                </p>
                                <p className="text-[10px] opacity-80">
                                  {t("generatedImagesPublic")}
                                </p>
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              if (canCreatePrivateContent()) {
                                updateSettings("isPublic", false);
                                toggleSection("visibility");
                              }
                            }}
                            disabled={!canCreatePrivateContent()}
                            className={cn(
                              "w-full p-2.5 rounded-lg border text-left transition-all",
                              !settings.isPublic
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border",
                              !canCreatePrivateContent() && "opacity-50"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <EyeOff className="h-4 w-4" />
                                <div>
                                  <p className="font-medium text-sm">
                                    {t("private")}
                                  </p>
                                  <p className="text-[10px] opacity-80">
                                    {t("generatedImagesPrivate")}
                                  </p>
                                </div>
                              </div>
                              {!canCreatePrivateContent() && (
                                <Crown className="h-3 w-3 text-amber-500" />
                              )}
                            </div>
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Advanced Settings */}
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    {/* LoRA Models with Individual Strength Controls */}
                    <Card>
                      <CardContent className="p-4">
                        <LoRAModelsSection compact={true} />
                      </CardContent>
                    </Card>

                    {/* Other Advanced Settings */}
                    <div
                      className={cn(
                        "grid gap-2",
                        deviceType === "mobile" ? "grid-cols-2" : "grid-cols-3"
                      )}
                    >
                      {/* CFG Scale */}
                      <Card>
                        <CardContent className="p-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-medium">
                              {t("cfgScale")}
                            </span>
                            {!canUseCfgScale() && (
                              <Crown className="h-3 w-3 text-amber-500" />
                            )}
                          </div>
                          <Slider
                            value={[settings.cfgScale || 1]}
                            onValueChange={(value) =>
                              canUseCfgScale() &&
                              updateSettings("cfgScale", value[0].toFixed(1))
                            }
                            min={0.5}
                            max={5}
                            step={0.1}
                            className="mb-1"
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {settings.cfgScale || 1}
                          </span>
                        </CardContent>
                      </Card>

                      {/* Steps */}
                      <Card>
                        <CardContent className="p-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-medium">
                              {t("steps")}
                            </span>
                            {!canUseSteps() && (
                              <Crown className="h-3 w-3 text-amber-500" />
                            )}
                          </div>
                          <Slider
                            value={[settings.steps || 6]}
                            onValueChange={(value) =>
                              canUseSteps() && updateSettings("steps", value[0])
                            }
                            min={3}
                            max={20}
                            step={1}
                            className="mb-1"
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {settings.steps || 6}
                          </span>
                        </CardContent>
                      </Card>

                      {/* Seed */}
                      <Card
                        className={deviceType === "tablet" ? "" : "col-span-2"}
                      >
                        <CardContent className="p-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-medium">
                              {t("seed")}
                            </span>
                            {!canUseSeed() && (
                              <Crown className="h-3 w-3 text-amber-500" />
                            )}
                          </div>
                          <Input
                            type="number"
                            value={
                              settings.seed !== undefined ? settings.seed : ""
                            }
                            onChange={(e) =>
                              canUseSeed() &&
                              updateSettings(
                                "seed",
                                parseInt(e.target.value) || 0
                              )
                            }
                            disabled={!canUseSeed()}
                            placeholder="Random"
                            className="h-7 text-[10px]"
                          />
                        </CardContent>
                      </Card>
                    </div>

                    {/* Negative Prompt */}
                    <Card>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium flex items-center gap-1.5">
                            <MinusCircle className="h-3.5 w-3.5" />
                            {t("negativePrompt")}
                          </h3>
                          {!canUseNegativePrompts && (
                            <Crown className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                        <Textarea
                          placeholder={t("negativePromptPlaceholder")}
                          value={settings.negativePrompt}
                          disabled={!canUseNegativePrompts}
                          onChange={(e) =>
                            canUseNegativePrompts &&
                            updateSettings("negativePrompt", e.target.value)
                          }
                          className="min-h-[60px] text-xs resize-none"
                        />
                      </CardContent>
                    </Card>

                    {/* Reset Button */}
                    <Button
                      variant="outline"
                      onClick={handleResetAllSettings}
                      className="w-full h-9"
                      size="sm"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      {t("actions.resetParameters")}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recent Generations intentionally hidden on Generate tab for mobile/tablet */}
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={cn(
                "pb-20",
                deviceType === "mobile" ? "px-4 py-4" : "px-6 py-6"
              )}
            >
              {showProgressCard ? (
                <GenerationProgressCard
                  queueStatus={queueStatus}
                  progress={progress}
                  maxProgress={maxProgress}
                  currentMessage={currentMessage}
                  currentNode={currentNode}
                  nodeState={nodeState}
                  retryCount={retryCount}
                  isRetrying={isRetrying}
                  error={error}
                  workflowNodes={workflowNodes}
                  currentNodeIndex={currentNodeIndex}
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {filteredGeneratedImages.length} {t("imagesGenerated")}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs text-muted-foreground">
                        {t("generationComplete")}
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "grid gap-3",
                      filteredGeneratedImages.length === 1
                        ? "grid-cols-1"
                        : deviceType === "mobile"
                        ? "grid-cols-1"
                        : "grid-cols-2"
                    )}
                  >
                    {filteredGeneratedImages.map((image, index) => (
                      <ContentCard
                        key={index}
                        item={image}
                        aspectRatio="square"
                        canLike={true}
                        canBookmark={true}
                        canFullscreen={true}
                        canAddToAlbum={true}
                        canDownload={true}
                        canDelete={true}
                        mediaList={filteredGeneratedImages}
                        currentIndex={index}
                        onDelete={() => handleOptimisticDelete(image.id)}
                      />
                    ))}
                  </div>

                  {/* Recent Generations - Mobile/Tablet */}
                  {filteredAllGeneratedImages.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium flex items-center gap-2 text-sm">
                          <ImageIcon className="h-4 w-4" />
                          {t("recentGenerations")}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {filteredAllGeneratedImages.length}
                        </Badge>
                      </div>
                      <div
                        className={cn(
                          "grid gap-2",
                          deviceType === "mobile"
                            ? "grid-cols-4"
                            : "grid-cols-6"
                        )}
                      >
                        {filteredAllGeneratedImages.map((image, index) => (
                          <button
                            key={index}
                            onClick={() =>
                              openThumbnailLightbox(image.url || "")
                            }
                            className="group relative aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all hover:scale-105"
                          >
                            <img
                              src={composeMediaUrl(image.url)}
                              alt={`${t("previous")} ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-7 h-7 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                                  <Eye className="h-4 w-4 text-white" />
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fixed Generate Button - Higher z-index to stay above footer */}
        <div className="fixed bottom-[61px] left-0 right-0 px-3 py-2 bg-background/95 backdrop-blur-lg border-t z-50">
          {!allowed && !isGenerating && (
            <div className="mb-2 px-2 py-1 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-[10px] text-destructive text-center leading-tight">
                {t("generationLimitReached")}
              </p>
            </div>
          )}
          <Button
            onClick={isInStopState ? handleStopGeneration : handleGenerate}
            disabled={!allowed || !settings.prompt.trim() || isInPreparingState}
            className={cn(
              "w-full h-10 text-xs font-semibold rounded-lg shadow-lg",
              isInStopState
                ? "bg-red-500 hover:bg-red-600"
                : "bg-gradient-to-r from-primary to-purple-600"
            )}
          >
            {isInStopState ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t("stopGeneration")}</span>
              </div>
            ) : isInPreparingState ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t("preparingGeneration")}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5" />
                <span>
                  {settings.batchCount > 1
                    ? t("generateImages", { count: settings.batchCount })
                    : t("generateSingle")}
                </span>
              </div>
            )}
          </Button>
        </div>

        {/* Lightbox */}
        <Lightbox
          media={filteredAllGeneratedImages}
          currentIndex={lightboxIndex}
          isOpen={lightboxOpen}
          canDelete={true}
          onDelete={handleDeleteRecentMedia}
          onClose={() => setLightboxOpen(false)}
          onNext={handleLightboxNext}
          onPrevious={handleLightboxPrevious}
          onGoToIndex={(index) => setLightboxIndex(index)}
        />
      </div>
    );
  }

  // Desktop View
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5"
      onClick={() => showMagicText && !isOptimizing && setShowMagicText(false)}
    >
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {t("aiImageGenerator")}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t("transformImagination")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    plan === "pro"
                      ? "bg-green-500"
                      : plan === "unlimited"
                      ? "bg-blue-500"
                      : "bg-amber-500"
                  )}
                />
                {plan} {t("plan")}
              </div>
            </Badge>
            {remaining !== "unlimited" && (
              <Badge variant="secondary" className="px-3 py-1">
                {remaining} {t("generationsRemaining")}
              </Badge>
            )}
          </div>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Settings */}
          <div className="col-span-4 space-y-6">
            {/* Prompt Input */}
            <Card className="border-2">
              <CardHeader>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-primary" />
                  {t("describeVision")}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <GradientTextarea
                    placeholder={t("promptPlaceholder")}
                    value={settings.prompt}
                    onChange={(e) => {
                      updateSettings("prompt", e.target.value);
                      if (e.target.value !== optimizedPromptCache) {
                        setOptimizedPromptCache("");
                        setOriginalPromptBeforeOptimization("");
                      }
                    }}
                    className="min-h-[150px] text-base"
                  />
                  {showMagicText && (
                    <MagicText
                      originalText={
                        originalPromptBeforeOptimization || settings.prompt
                      }
                      ref={magicTextRef}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {settings.prompt && (
                      <button
                        onClick={() => {
                          updateSettings("prompt", "");
                          setOptimizedPromptCache("");
                          setOriginalPromptBeforeOptimization("");
                        }}
                        className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        {t("clear")}
                      </button>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      settings.prompt.length > 800
                        ? "text-amber-500"
                        : settings.prompt.length > 900
                        ? "text-red-500"
                        : "text-muted-foreground"
                    )}
                  >
                    {settings.prompt.length}/2000
                  </span>
                </div>

                {/* AI Optimize */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-purple-600/10 rounded-xl border">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">{t("optimizePrompt")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("enhanceWithAi")}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.optimizePrompt}
                    onCheckedChange={(checked) =>
                      updateSettings("optimizePrompt", checked)
                    }
                  />
                </div>

                {originalPromptBeforeOptimization &&
                  settings.prompt !== originalPromptBeforeOptimization && (
                    <Button
                      variant="outline"
                      onClick={revertToOriginalPrompt}
                      className="w-full"
                      size="sm"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {t("revertToOriginal")}
                    </Button>
                  )}
              </CardContent>
            </Card>

            {/* Quick Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    {t("quickSettings")}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetAllSettings}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    {t("reset")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Image Size */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("imageSize")}
                  </label>
                  <Select
                    value={settings.imageSize}
                    disabled={!canUseCustomSizes()}
                    onValueChange={(value) => {
                      if (!canUseCustomSizes() && value !== "1024x1024") return;
                      updateSettings("imageSize", value);
                      const size = IMAGE_SIZES.find((s) => s.value === value);
                      if (size && size.value !== "custom") {
                        updateSettings("customWidth", size.width);
                        updateSettings("customHeight", size.height);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMAGE_SIZES.map((size) => (
                        <SelectItem key={size.value} value={size.value}>
                          <div
                            className={cn(
                              "flex items-center gap-2",
                              !canUseCustomSizes() &&
                                size.value !== "1024x1024" &&
                                "opacity-50"
                            )}
                          >
                            <span>{size.icon}</span>
                            <span>{size.label}</span>
                            {size.value !== "custom" && (
                              <span className="text-xs text-muted-foreground">
                                ({size.ratio})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!canUseCustomSizes() && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      {t("proFeature")}
                    </p>
                  )}
                </div>

                {/* Batch Count */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("batchCount")}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 4, 8].map((count) => (
                      <Button
                        key={count}
                        variant={
                          settings.batchCount === count ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          (canUseBulk || count === 1) &&
                          updateSettings("batchCount", count)
                        }
                        disabled={
                          (!canUseBulk && count > 1) ||
                          !checkGenerationLimits(count).allowed
                        }
                      >
                        {count}
                      </Button>
                    ))}
                  </div>
                  {!canUseBulk && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      {t("bulkGenerationProFeature")}
                    </p>
                  )}
                </div>

                {/* Visibility */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("visibility")}
                  </label>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {settings.isPublic ? (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">
                        {settings.isPublic ? t("public") : t("private")}
                      </span>
                    </div>
                    <Switch
                      checked={!settings.isPublic}
                      onCheckedChange={(checked) =>
                        canCreatePrivateContent() &&
                        updateSettings("isPublic", !checked)
                      }
                      disabled={!canCreatePrivateContent()}
                    />
                  </div>
                  {!canCreatePrivateContent() && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      {t("privateContentProFeature")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Advanced Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    {t("advancedSettings")}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetAllSettings}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    {t("reset")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Parameters Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* CFG Scale */}
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      CFG Scale
                    </label>
                    <div className="space-y-2">
                      <Slider
                        value={[settings.cfgScale || 1]}
                        onValueChange={(value) =>
                          canUseCfgScale() &&
                          updateSettings("cfgScale", value[0].toFixed(1))
                        }
                        min={0.5}
                        max={5}
                        step={0.1}
                        className={cn(
                          !canUseCfgScale() && "pointer-events-none opacity-50"
                        )}
                      />
                      <div className="text-center text-xs text-muted-foreground">
                        {settings.cfgScale || 1}
                      </div>
                    </div>
                  </div>

                  {/* Steps */}
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      Steps
                    </label>
                    <div className="space-y-2">
                      <Slider
                        value={[settings.steps || 6]}
                        onValueChange={(value) =>
                          canUseSteps() && updateSettings("steps", value[0])
                        }
                        min={3}
                        max={20}
                        step={1}
                        className={cn(
                          !canUseSteps() && "pointer-events-none opacity-50"
                        )}
                      />
                      <div className="text-center text-xs text-muted-foreground">
                        {settings.steps || 6}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seed */}
                <div>
                  <label className="text-xs font-medium mb-1 block">
                    Seed (optional)
                  </label>
                  <Input
                    type="number"
                    value={settings.seed !== undefined ? settings.seed : ""}
                    onChange={(e) =>
                      canUseSeed() &&
                      updateSettings("seed", parseInt(e.target.value) || 0)
                    }
                    disabled={!canUseSeed()}
                    placeholder={t("randomSeed")}
                  />
                </div>

                {/* Negative Prompt */}
                <div>
                  <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                    <MinusCircle className="h-3 w-3" />
                    Negative Prompt
                    {!canUseNegativePrompts && (
                      <Crown className="h-3 w-3 text-amber-500" />
                    )}
                  </label>
                  <Textarea
                    placeholder={t("negativePromptPlaceholder")}
                    value={settings.negativePrompt}
                    disabled={!canUseNegativePrompts}
                    onChange={(e) =>
                      canUseNegativePrompts &&
                      updateSettings("negativePrompt", e.target.value)
                    }
                    className="min-h-[80px] text-sm"
                  />
                </div>

                {/* LoRA Models with Individual Strength Controls */}
                <LoRAModelsSection />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Results */}
          <div className="col-span-8">
            {/* Generate Button */}
            <Button
              onClick={isInStopState ? handleStopGeneration : handleGenerate}
              disabled={
                !allowed || !settings.prompt.trim() || isInPreparingState
              }
              className={cn(
                "w-full h-16 text-lg font-semibold rounded-xl shadow-lg mb-6 transition-all",
                isInStopState
                  ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                  : "bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              )}
            >
              {isInStopState ? (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t("stopGeneration")}</span>
                </div>
              ) : isInPreparingState ? (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t("preparingGeneration")}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Zap className="h-6 w-6" />
                  <span>
                    {settings.batchCount > 1
                      ? t("generateImages", { count: settings.batchCount })
                      : t("generateSingle")}
                  </span>
                </div>
              )}
            </Button>

            {!allowed && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {t("generationLimitReached")}
                </p>
              </div>
            )}

            {/* Results Area */}
            {showProgressCard ? (
              <GenerationProgressCard
                queueStatus={queueStatus}
                progress={progress}
                maxProgress={maxProgress}
                currentMessage={currentMessage}
                currentNode={currentNode}
                nodeState={nodeState}
                retryCount={retryCount}
                isRetrying={isRetrying}
                error={error}
                workflowNodes={workflowNodes}
                currentNodeIndex={currentNodeIndex}
              />
            ) : filteredGeneratedImages.length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {t("generatedImages")}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {filteredGeneratedImages.length}{" "}
                      {filteredGeneratedImages.length === 1
                        ? "image"
                        : "images"}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs text-muted-foreground">
                        {t("complete")}
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    "grid gap-4",
                    filteredGeneratedImages.length === 1
                      ? "grid-cols-1"
                      : filteredGeneratedImages.length === 2
                      ? "grid-cols-2"
                      : filteredGeneratedImages.length === 3
                      ? "grid-cols-3"
                      : "grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                  )}
                >
                  {filteredGeneratedImages.map((image, index) => (
                    <ContentCard
                      key={index}
                      item={image}
                      aspectRatio="square"
                      canLike={true}
                      canBookmark={true}
                      canFullscreen={true}
                      canAddToAlbum={true}
                      canDownload={true}
                      canDelete={true}
                      mediaList={filteredGeneratedImages}
                      currentIndex={index}
                      onDelete={handleOptimisticDelete}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <Card className="border-dashed border-2">
                <CardContent className="py-20">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-full flex items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-primary/60" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        {t("noImagesGenerated")}
                      </h3>
                      <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        {t("enterPromptToGenerate")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Generations - Desktop */}
            {filteredAllGeneratedImages.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      {t("recentGenerations")}
                    </h3>
                    <Badge variant="outline">
                      {filteredAllGeneratedImages.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2">
                    {filteredAllGeneratedImages.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => openThumbnailLightbox(image.url || "")}
                        className="group relative aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all hover:scale-105"
                      >
                        <img
                          src={composeMediaUrl(image.url)}
                          alt={`${t("previous")} ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                              <Eye className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Custom Size Modal for Desktop */}
        {settings.imageSize === "custom" && canUseCustomSizes() && (
          <>
            <div className="fixed inset-0 bg-black/40 z-40" />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <Card className="w-80 shadow-2xl border-2 no-spin-desktop">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">
                      {t("customDimensions")}
                    </h4>
                    <button
                      onClick={() => updateSettings("imageSize", "1024x1024")}
                      className="p-1 hover:bg-muted rounded-lg transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Width
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            updateSettings(
                              "customWidth",
                              Math.max(512, settings.customWidth - 64)
                            )
                          }
                          className="p-1 hover:bg-muted rounded"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <Input
                          type="number"
                          min="512"
                          max="2048"
                          step="64"
                          value={settings.customWidth}
                          onChange={(e) =>
                            updateSettings(
                              "customWidth",
                              parseInt(e.target.value) || 1024
                            )
                          }
                          className="h-9 text-center"
                        />
                        <button
                          onClick={() =>
                            updateSettings(
                              "customWidth",
                              Math.min(2048, settings.customWidth + 64)
                            )
                          }
                          className="p-1 hover:bg-muted rounded"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Height
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            updateSettings(
                              "customHeight",
                              Math.max(512, settings.customHeight - 64)
                            )
                          }
                          className="p-1 hover:bg-muted rounded"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <Input
                          type="number"
                          min="512"
                          max="2048"
                          step="64"
                          value={settings.customHeight}
                          onChange={(e) =>
                            updateSettings(
                              "customHeight",
                              parseInt(e.target.value) || 1024
                            )
                          }
                          className="h-9 text-center"
                        />
                        <button
                          onClick={() =>
                            updateSettings(
                              "customHeight",
                              Math.min(2048, settings.customHeight + 64)
                            )
                          }
                          className="p-1 hover:bg-muted rounded"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {t("aspectRatio")}:{" "}
                      {(settings.customWidth / settings.customHeight).toFixed(
                        2
                      )}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {settings.customWidth}×{settings.customHeight}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: t("square"), width: 1024, height: 1024 },
                      { label: "16:9", width: 1792, height: 1024 },
                      { label: "9:16", width: 1024, height: 1792 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          updateSettings("customWidth", preset.width);
                          updateSettings("customHeight", preset.height);
                        }}
                        className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Lightbox */}
        <Lightbox
          media={filteredAllGeneratedImages}
          currentIndex={lightboxIndex}
          isOpen={lightboxOpen}
          canDelete={true}
          onDelete={handleOptimisticDelete}
          onClose={() => setLightboxOpen(false)}
          onNext={handleLightboxNext}
          onPrevious={handleLightboxPrevious}
          onGoToIndex={(index) => setLightboxIndex(index)}
        />

        {/* Maintenance Modal */}
        <AlertDialog
          isOpen={showMaintenanceModal}
          onClose={() => setShowMaintenanceModal(false)}
          title={t("maintenanceModal.title")}
          message={t("maintenanceModal.message")}
          variant="warning"
        />
      </div>
    </div>
  );
}
