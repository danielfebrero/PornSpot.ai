"use client";

import React, { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Slider } from "@/components/ui/Slider";
import { Switch } from "@/components/ui/Switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Lightbox } from "@/components/ui/Lightbox";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocaleRouter } from "@/lib/navigation";
import { GenerationProgressCard } from "./ui/GenerationProgressCard";
import { composeMediaUrl } from "@/lib/urlUtils";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useTranslations } from "next-intl";
import { getLoraModels } from "@/utils/loraModels";

export function GenerateClient() {
  const magicTextRef = useRef<MagicTextHandle>(null);
  const { fetchConnectionId, isConnected } = useWebSocket();
  const t = useTranslations("generate");

  // Image sizes with translations
  const IMAGE_SIZES = [
    {
      value: "1024x1024",
      label: t("imageSizes.square"),
      width: 1024,
      height: 1024,
    },
    {
      value: "1536x1024",
      label: t("imageSizes.landscape"),
      width: 1536,
      height: 1024,
    },
    {
      value: "1024x1536",
      label: t("imageSizes.portrait"),
      width: 1024,
      height: 1536,
    },
    {
      value: "1792x1024",
      label: t("imageSizes.wide"),
      width: 1792,
      height: 1024,
    },
    {
      value: "1024x1792",
      label: t("imageSizes.tall"),
      width: 1024,
      height: 1792,
    },
    {
      value: "custom",
      label: t("imageSizes.custom"),
      width: 1024,
      height: 1024,
    },
  ];

  // LoRA models with translated descriptions only
  const LORA_MODELS = getLoraModels(t);

  // Hook for optimistic usage stats updates
  const decrementUsageStats = useDecrementUsageStats();

  // Use GenerationContext for all generation state and functionality
  const {
    settings,
    updateSettings,
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
    handleLoraClickInAutoMode,
    // Generation state and methods (now in context)
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

  // Use the new generation context with WebSocket support
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

  const router = useLocaleRouter();

  const { allowed, remaining } = checkGenerationLimits(settings.batchCount);
  const plan = getCurrentPlan();

  const canUseBulk = canUseBulkGeneration();
  const canUseLoras = canUseLoRAModels();
  const canUseNegativePrompts = canUseNegativePrompt();

  // Filter out deleted images from the generated images
  const filteredGeneratedImages = generatedImages.filter(
    (image) => !deletedImageIds.has(image.id)
  );

  // Filter out deleted images from all generated images
  const filteredAllGeneratedImages = allGeneratedImages.filter(
    (image) => !deletedImageIds.has(image.id)
  );

  const updateLoraSelectionMode = (mode: "auto" | "manual") => {
    if (mode === "manual" && !canUseLoras) {
      // Non-Pro users cannot use manual mode
      return;
    }
    updateSettings("loraSelectionMode", mode);
  };

  // Revert to original prompt before optimization
  const revertToOriginalPrompt = () => {
    if (originalPromptBeforeOptimization) {
      updateSettings("prompt", originalPromptBeforeOptimization);
      // Clear the optimization cache since we're reverting
      setOptimizedPromptCache("");
      setOriginalPromptBeforeOptimization("");
    }
  };

  const handleResetMagicText = () => {
    if (magicTextRef.current) {
      magicTextRef.current.reset();
    }
  };

  // Open lightbox for thumbnail (from all generated images)
  const openThumbnailLightbox = (imageUrl: string) => {
    const index = filteredAllGeneratedImages.findIndex(
      (media) => media.url === imageUrl
    );
    if (index !== -1) {
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  // Handle optimistic deletion of generated images
  const handleOptimisticDelete = (mediaId: string) => {
    // Add the media ID to the deleted set for immediate UI update
    setDeletedImageIds((prev) => new Set(prev).add(mediaId));

    // Also remove from allGeneratedImages state
    setAllGeneratedImages((prev) =>
      prev.filter((media) => media.id !== mediaId)
    );
  };

  // Lightbox navigation handlers
  const handleLightboxNext = () => {
    setLightboxIndex(
      Math.min(lightboxIndex + 1, filteredAllGeneratedImages.length - 1)
    );
  };

  const handleLightboxPrevious = () => {
    setLightboxIndex(Math.max(lightboxIndex - 1, 0));
  };

  const handleGenerate = async () => {
    if (!canGenerateImages() || !allowed || !settings.prompt.trim()) return;

    // Optimistically decrement usage stats
    decrementUsageStats(settings.batchCount || 1);

    // Show progress card immediately on click
    setShowProgressCard(true);

    // Clear any previous results
    clearResults();

    // Handle magic text animation for optimization
    if (settings.optimizePrompt && settings.prompt !== optimizedPromptCache) {
      // Store the original prompt before optimization for potential reversion
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
    // Submit to generation queue - optimization will be handled by backend if enabled
  };

  const handleStopGeneration = () => {
    stopGeneration();
  };

  // Update prompt when optimized prompt is received from backend
  useEffect(() => {
    if (optimizationStream !== null) {
      // Cache the optimized prompt
      setOptimizedPromptCache(optimizationStream);

      // Update the settings immediately if magic text is not showing
      updateSettings("prompt", optimizationStream);
    }
  }, [optimizationStream, setOptimizedPromptCache, updateSettings]);

  // Handle optimization stream for real-time MagicText updates
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

  // Update allGeneratedImages when new images are generated and hide progress card
  useEffect(() => {
    if (generatedImages.length > 0) {
      setShowProgressCard(false); // Hide progress card when images are received
    }
  }, [generatedImages, setShowProgressCard]);

  useEffect(() => {
    if (!isConnected) return;
    fetchConnectionId();
  }, [fetchConnectionId, isConnected]);

  return (
    <div
      className="min-h-screen bg-background"
      onClick={() => showMagicText && !isOptimizing && setShowMagicText(false)}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Header */}
          {!showProgressCard && filteredGeneratedImages.length === 0 && (
            <div className="text-center space-y-6">
              <div className="relative inline-block">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary via-purple-500 to-primary rounded-full blur opacity-30 animate-pulse"></div>
                <div className="relative w-20 h-20 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center shadow-xl">
                  <Zap className="h-10 w-10 text-white" />
                </div>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {t("aiImageGenerator")}
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  {t("transformImagination")}
                </p>
              </div>

              <div className="flex items-center justify-center gap-4 mt-6">
                <div className="bg-card border border-border rounded-full px-4 py-2 shadow-sm">
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
                    ></div>
                    <span className="text-sm font-medium text-foreground capitalize">
                      {plan} Plan
                    </span>
                  </div>
                </div>

                {remaining !== "unlimited" && (
                  <div className="bg-muted/50 rounded-full px-4 py-2">
                    <span className="text-sm text-muted-foreground">
                      {remaining} {t("generationsRemaining")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Generation Results / Loading / Queue Status */}
          {(showProgressCard || filteredGeneratedImages.length > 0) && (
            <div className="text-center space-y-6">
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
              ) : filteredGeneratedImages.length === 1 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-foreground">
                      {t("generationComplete")}
                    </span>
                  </div>
                  <div className="w-full max-w-md mx-auto">
                    <ContentCard
                      item={filteredGeneratedImages[0]}
                      aspectRatio="square"
                      canLike={true}
                      canBookmark={true}
                      canFullscreen={true}
                      canAddToAlbum={true}
                      canDownload={true}
                      canDelete={true}
                      mediaList={filteredGeneratedImages}
                      currentIndex={0}
                      onDelete={() =>
                        handleOptimisticDelete(filteredGeneratedImages[0].id)
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-foreground">
                      {filteredGeneratedImages.length} {t("imagesGenerated")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
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
                </div>
              )}
            </div>
          )}

          {/* Main Prompt Input */}
          <div className="bg-card border border-border rounded-2xl shadow-lg p-6 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">
                {t("describeVision")}
              </h2>
              <p className="text-muted-foreground">
                {t("detailedDescriptionTip")}
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <GradientTextarea
                  placeholder={t("promptPlaceholder")}
                  value={settings.prompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    updateSettings("prompt", e.target.value);
                    setOptimizedPromptCache("");
                    setOriginalPromptBeforeOptimization("");
                  }}
                  className="w-full h-40 md:h-32 text-lg p-6 border-2 border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 resize-none transition-all"
                />

                {/* Magical overlay during optimization */}
                {showMagicText && (
                  <MagicText
                    originalText={
                      originalPromptBeforeOptimization || settings.prompt
                    }
                    ref={magicTextRef}
                  />
                )}
              </div>
              <div className="flex justify-between items-center">
                {settings.prompt.trim() ? (
                  <button
                    onClick={() => {
                      updateSettings("prompt", "");
                      setOptimizedPromptCache("");
                      setOriginalPromptBeforeOptimization("");
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors group"
                  >
                    <X className="h-3 w-3 group-hover:text-destructive" />
                    {t("deletePrompt")}
                  </button>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {t("descriptiveTip")}
                  </div>
                )}
                <div
                  className={cn(
                    "text-xs font-medium",
                    settings.prompt.length > 800
                      ? "text-amber-600 dark:text-amber-400"
                      : settings.prompt.length > 900
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                  )}
                >
                  {settings.prompt.length}/1000
                </div>
              </div>

              {/* Optimize Prompt Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground">
                      {t("optimizePrompt")}
                    </h4>
                  </div>
                </div>
                <Switch
                  checked={settings.optimizePrompt}
                  onCheckedChange={(checked) =>
                    updateSettings("optimizePrompt", checked)
                  }
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {/* Revert to Original Prompt Button */}
              {originalPromptBeforeOptimization && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>
                      {settings.prompt === originalPromptBeforeOptimization
                        ? t("viewingOriginalPrompt")
                        : t("promptOptimized")}
                    </span>
                  </div>
                  {settings.prompt !== originalPromptBeforeOptimization && (
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-3 w-3" />
                      <button
                        onClick={revertToOriginalPrompt}
                        className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                      >
                        {t("revertToOriginal")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Generate Button */}
          <div className="relative">
            <Button
              onClick={
                isGenerating || isOptimizing
                  ? handleStopGeneration
                  : handleGenerate
              }
              disabled={
                (!allowed || !settings.prompt.trim()) &&
                !isGenerating &&
                !isOptimizing
              }
              className={cn(
                "w-full h-16 text-lg font-semibold rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]",
                isGenerating || isOptimizing
                  ? "bg-gradient-to-r from-red-500/80 to-red-600/80 hover:from-red-500/90 hover:to-red-600/90"
                  : "bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              )}
              size="lg"
            >
              {isOptimizing ? (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Sparkles className="w-6 h-6 text-white animate-pulse" />
                    <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" />
                  </div>
                  <span>{t("stopOptimization")}</span>
                </div>
              ) : isGenerating ? (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{t("stopGeneration")}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Zap className="h-5 w-5" />
                  </div>
                  <span>
                    {settings.batchCount > 1
                      ? t("generateImages", { count: settings.batchCount })
                      : t("generateSingle")}{" "}
                    {settings.batchCount === 1 && t("image")}
                  </span>
                </div>
              )}
            </Button>

            {/* Status indicator */}
            {!allowed && (
              <div className="absolute inset-x-0 -bottom-8 flex justify-center">
                <div className="bg-destructive/10 text-destructive text-sm px-3 py-1 rounded-full">
                  {t("generationLimitReached")}
                </div>
              </div>
            )}
          </div>

          {/* Previously Generated Images */}
          {filteredAllGeneratedImages.length > 0 && (
            <div className="bg-card border border-border rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {t("recentGenerations")}
                </h3>
                <div className="text-sm text-muted-foreground">
                  {filteredAllGeneratedImages.length} {t("images")}
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {filteredAllGeneratedImages.slice(0, 10).map((image, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 group"
                    onClick={() => openThumbnailLightbox(image.url || "")}
                  >
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-border group-hover:border-primary transition-colors cursor-pointer shadow-md hover:shadow-lg">
                      <img
                        src={composeMediaUrl(image.url)}
                        alt={`${t("previous")} ${index + 1}`}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="w-6 h-6 bg-white/0 group-hover:bg-white/20 rounded-full flex items-center justify-center transition-all">
                          <ImageIcon className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advanced Features */}
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">
                {t("advancedControls")}
              </h2>
              <p className="text-muted-foreground">{t("fineTuneGeneration")}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Image Size */}
              <div
                className={cn(
                  "bg-card border border-border rounded-2xl shadow-lg p-6 transition-all",
                  !canUseCustomSizes() && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      canUseCustomSizes()
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Grid3X3 className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {t("imageSize")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("chooseDimensions")}
                    </p>
                  </div>
                  {!canUseCustomSizes() && (
                    <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                      <Crown className="h-3 w-3" />
                      <span className="text-xs font-medium">{t("pro")}</span>
                    </div>
                  )}
                </div>

                <Select
                  value={settings.imageSize}
                  disabled={!canUseCustomSizes()}
                  onValueChange={(value: string) => {
                    if (!canUseCustomSizes()) return;
                    updateSettings("imageSize", value);
                    const size = IMAGE_SIZES.find((s) => s.value === value);
                    if (size) {
                      updateSettings("customWidth", size.width);
                      updateSettings("customHeight", size.height);
                    }
                  }}
                >
                  <SelectTrigger className="h-12 border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {settings.imageSize === "custom" && canUseCustomSizes() && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block">
                        {t("width")}
                      </label>
                      <Input
                        type="number"
                        min="512"
                        max="2048"
                        step="64"
                        value={settings.customWidth}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateSettings(
                            "customWidth",
                            parseInt(e.target.value) || 1024
                          )
                        }
                        className="h-10 border-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block">
                        {t("height")}
                      </label>
                      <Input
                        type="number"
                        min="512"
                        max="2048"
                        step="64"
                        value={settings.customHeight}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateSettings(
                            "customHeight",
                            parseInt(e.target.value) || 1024
                          )
                        }
                        className="h-10 border-2"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Batch Count */}
              <div
                className={cn(
                  "bg-card border border-border rounded-2xl shadow-lg p-6 transition-all",
                  !canUseBulk && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      canUseBulk
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Zap className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {t("batchCount")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("generateMultiple")}
                    </p>
                  </div>
                  {!canUseBulk && (
                    <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                      <Crown className="h-3 w-3" />
                      <span className="text-xs font-medium">{t("pro")}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 4, 8].map((count) => (
                    <Button
                      key={count}
                      variant={
                        settings.batchCount === count ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() =>
                        canUseBulk && updateSettings("batchCount", count)
                      }
                      disabled={
                        !canUseBulk || !checkGenerationLimits(count).allowed
                      }
                      className="h-12 font-semibold"
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Visibility Toggle */}
              <div
                className={cn(
                  "bg-card border border-border rounded-2xl shadow-lg p-6 transition-all",
                  !canCreatePrivateContent() && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      canCreatePrivateContent()
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {t("visibility")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("publicOrPrivateContent")}
                    </p>
                  </div>
                  {!canCreatePrivateContent() && (
                    <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                      <Crown className="h-3 w-3" />
                      <span className="text-xs font-medium">{t("pro")}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {settings.isPublic ? t("public") : t("private")}
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={!settings.isPublic} // Switch is for "private" state
                    onCheckedChange={(checked) =>
                      canCreatePrivateContent() &&
                      updateSettings("isPublic", !checked)
                    }
                    disabled={!canCreatePrivateContent()}
                  />
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  {settings.isPublic
                    ? t("generatedImagesPublic")
                    : t("generatedImagesPrivate")}
                </p>
              </div>
            </div>

            {/* Advanced Generation Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* CFG Scale */}
              <div
                className={cn(
                  "bg-card border border-border rounded-2xl shadow-lg p-6 transition-all",
                  !canUseCfgScale() && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      canUseCfgScale()
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {t("cfgScale")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("promptAdherence")}
                    </p>
                  </div>
                  {!canUseCfgScale() && (
                    <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                      <Crown className="h-3 w-3" />
                      <span className="text-xs font-medium">{t("pro")}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div
                    className={cn(
                      !canUseCfgScale() && "pointer-events-none opacity-50"
                    )}
                  >
                    <Slider
                      value={[settings.cfgScale || 1]}
                      onValueChange={(value) =>
                        canUseCfgScale() &&
                        updateSettings("cfgScale", value[0].toFixed(1))
                      }
                      min={0.5}
                      max={5}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0.5</span>
                    <span className="font-medium text-foreground">
                      {settings.cfgScale || 1}
                    </span>
                    <span>5</span>
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div
                className={cn(
                  "bg-card border border-border rounded-2xl shadow-lg p-6 transition-all",
                  !canUseSteps() && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      canUseSteps()
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <RotateCcw className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {t("steps")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("inferenceSteps")}
                    </p>
                  </div>
                  {!canUseSteps() && (
                    <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                      <Crown className="h-3 w-3" />
                      <span className="text-xs font-medium">{t("pro")}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div
                    className={cn(
                      !canUseSteps() && "pointer-events-none opacity-50"
                    )}
                  >
                    <Slider
                      value={[settings.steps || 6]}
                      onValueChange={(value) =>
                        canUseSteps() && updateSettings("steps", value[0])
                      }
                      min={3}
                      max={20}
                      step={1}
                      className="w-full"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>3</span>
                    <span className="font-medium text-foreground">
                      {settings.steps || 6}
                    </span>
                    <span>20</span>
                  </div>
                </div>
              </div>

              {/* Seed */}
              <div
                className={cn(
                  "bg-card border border-border rounded-2xl shadow-lg p-6 transition-all",
                  !canUseSeed() && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      canUseSeed()
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Grid3X3 className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {t("seed")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("reproducibility")}
                    </p>
                  </div>
                  {!canUseSeed() && (
                    <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                      <Crown className="h-3 w-3" />
                      <span className="text-xs font-medium">{t("pro")}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Input
                    type="number"
                    value={settings.seed !== undefined ? settings.seed : -1}
                    onChange={(e) =>
                      canUseSeed() &&
                      updateSettings("seed", parseInt(e.target.value) || -1)
                    }
                    disabled={!canUseSeed()}
                    placeholder={t("randomSeedPlaceholder")}
                    min={-1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("useRandomSeed")}
                  </p>
                </div>
              </div>
            </div>

            {/* LoRA Models */}
            <div
              className={cn(
                "bg-card border border-border rounded-2xl shadow-lg p-6 transition-all",
                !canUseLoras && "opacity-50"
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                  <Crown className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    {t("loraModelsSection")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("enhanceYourStyle")}
                  </p>
                </div>
                {!canUseLoras && (
                  <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                    <Crown className="h-3 w-3" />
                    <span className="text-xs font-medium">{t("pro")}</span>
                  </div>
                )}
              </div>

              {/* Global LoRA Selection Mode Toggle */}
              <div className="mb-6 p-4 bg-muted/30 border border-border/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">
                      {t("loraSelection")}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {settings.loraSelectionMode === "auto"
                        ? t("automaticLoraDescription")
                        : t("manuallySelectLora")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateLoraSelectionMode("auto")}
                    className={cn(
                      "px-3 py-2 text-sm rounded-lg transition-colors font-medium",
                      settings.loraSelectionMode === "auto"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-background/80 border border-border"
                    )}
                  >
                    {t("automatic")}
                  </button>
                  <button
                    onClick={() => updateLoraSelectionMode("manual")}
                    disabled={!canUseLoras}
                    className={cn(
                      "px-3 py-2 text-sm rounded-lg transition-colors font-medium",
                      settings.loraSelectionMode === "manual"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-background/80 border border-border",
                      !canUseLoras &&
                        "opacity-50 cursor-not-allowed hover:bg-background"
                    )}
                  >
                    {t("manual")}
                    {!canUseLoras && <Crown className="h-3 w-3 ml-1 inline" />}
                  </button>
                </div>
              </div>

              {settings.loraSelectionMode === "manual" ? (
                <div className="grid gap-3">
                  {LORA_MODELS.map((lora) => {
                    const isSelected = settings.selectedLoras.includes(lora.id);
                    const strengthSettings = settings.loraStrengths[lora.id];

                    return (
                      <div
                        key={lora.id}
                        className={cn(
                          "border-2 rounded-xl transition-all",
                          isSelected && canUseLoras
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-border/80",
                          !canUseLoras && "opacity-50"
                        )}
                      >
                        {/* LoRA Header - Clickable to toggle selection */}
                        <div
                          className="p-4 cursor-pointer transition-all"
                          onClick={() => toggleLora(lora.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm text-foreground">
                                {lora.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {lora.description}
                              </div>
                            </div>
                            <div className="ml-3 relative">
                              {isSelected ? (
                                <div
                                  className={cn(
                                    "w-5 h-5 bg-primary rounded-full flex items-center justify-center",
                                    !canUseLoras && "opacity-50"
                                  )}
                                >
                                  <div className="w-2 h-2 bg-white rounded-full"></div>
                                </div>
                              ) : (
                                <div
                                  className={cn(
                                    "w-5 h-5 border-2 border-border rounded-full",
                                    !canUseLoras && "opacity-50"
                                  )}
                                ></div>
                              )}
                              {!canUseLoras && (
                                <div className="absolute -top-1 -right-1 bg-card rounded-full p-0.5">
                                  <Lock className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Strength Controls - Show when selected, disable when no permissions */}
                        {isSelected && strengthSettings && (
                          <div className="px-4 pb-4 border-t border-border/30">
                            <div className="pt-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-foreground">
                                  {t("strength")}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (canUseLoras) {
                                        updateLoraStrength(lora.id, "auto");
                                      }
                                    }}
                                    disabled={!canUseLoras}
                                    className={cn(
                                      "px-2 py-1 text-xs rounded-md transition-colors",
                                      strengthSettings.mode === "auto"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                                      !canUseLoras &&
                                        "opacity-50 cursor-not-allowed hover:bg-muted"
                                    )}
                                  >
                                    Auto
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (canUseLoras) {
                                        updateLoraStrength(lora.id, "manual");
                                      }
                                    }}
                                    disabled={!canUseLoras}
                                    className={cn(
                                      "px-2 py-1 text-xs rounded-md transition-colors",
                                      strengthSettings.mode === "manual"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                                      !canUseLoras &&
                                        "opacity-50 cursor-not-allowed hover:bg-muted"
                                    )}
                                  >
                                    Manual
                                  </button>
                                </div>
                              </div>

                              {strengthSettings.mode === "manual" && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                      {t("value")}:{" "}
                                      {strengthSettings.value.toFixed(2)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      0.0 - 1.5
                                    </span>
                                  </div>
                                  <div
                                    className={cn(
                                      !canUseLoras &&
                                        "opacity-50 pointer-events-none"
                                    )}
                                  >
                                    <Slider
                                      value={[strengthSettings.value]}
                                      onValueChange={(values) => {
                                        if (canUseLoras) {
                                          updateLoraStrength(
                                            lora.id,
                                            "manual",
                                            values[0]
                                          );
                                        }
                                      }}
                                      min={0}
                                      max={1.5}
                                      step={0.05}
                                      className="w-full"
                                    />
                                  </div>
                                </div>
                              )}

                              {strengthSettings.mode === "auto" && (
                                <div className="text-xs text-muted-foreground text-center py-1">
                                  {t("strengthAutoDescriptionComplete")}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Available LoRA Models Preview */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-medium text-foreground">
                        {t("availableLoraModels")}
                      </h5>
                      {!canUseLoras && (
                        <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                          <Crown className="h-3 w-3" />
                          <span className="text-xs font-medium">
                            {t("pro")}
                          </span>
                        </div>
                      )}
                    </div>
                    {canUseLoras && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {t("loraClickTip")}
                      </p>
                    )}
                    <div className="grid gap-2">
                      {LORA_MODELS.map((lora) => (
                        <div
                          key={lora.id}
                          className={cn(
                            "p-3 border border-border rounded-lg transition-all",
                            !canUseLoras
                              ? "bg-muted/30 cursor-not-allowed"
                              : "hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                          )}
                          onClick={() => handleLoraClickInAutoMode(lora.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-medium text-sm text-foreground">
                                  {lora.name}
                                </div>
                                {!canUseLoras && (
                                  <Lock className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {lora.description}
                              </div>
                            </div>
                            <div className="ml-3">
                              <div
                                className={cn(
                                  "w-4 h-4 border-2 border-border rounded-full",
                                  !canUseLoras && "opacity-50"
                                )}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {!canUseLoras && (
                      <div className="text-center pt-3">
                        <p className="text-xs text-muted-foreground mb-3">
                          {t("upgradeToSelectLoraModels")}
                        </p>
                        <Button
                          onClick={() => router.push("/pricing")}
                          size="sm"
                          className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                        >
                          <Crown className="h-3 w-3 mr-1" />
                          {t("upgradeToPro")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {settings.loraSelectionMode === "manual" &&
                settings.selectedLoras.length > 0 && (
                  <div
                    className={cn(
                      "mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2",
                      !canUseLoras && "opacity-50"
                    )}
                  >
                    <p className="text-xs text-primary font-medium text-center">
                      {settings.selectedLoras.length} LoRA
                      {settings.selectedLoras.length !== 1 ? "s" : ""}{" "}
                      {t("selected")}
                      {!canUseLoras && ` ${t("proFeature")}`}
                    </p>
                    <div className="grid gap-1">
                      {settings.selectedLoras.map((loraId) => {
                        const lora = LORA_MODELS.find((l) => l.id === loraId);
                        const strength = settings.loraStrengths[loraId];
                        if (!lora || !strength) return null;

                        return (
                          <div
                            key={loraId}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-primary/80">{lora.name}</span>
                            <span className="text-primary/60">
                              {strength.mode === "auto"
                                ? t("auto")
                                : `${strength.value.toFixed(2)}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>

            {/* Negative Prompt */}
            <div
              className={cn(
                "bg-card border border-border rounded-2xl shadow-lg p-6 transition-all",
                !canUseNegativePrompts && "opacity-50"
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    canUseNegativePrompts
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <MinusCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    {t("negativePrompt")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("whatToAvoid")}
                  </p>
                </div>
                {!canUseNegativePrompts && (
                  <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                    <Crown className="h-3 w-3" />
                    <span className="text-xs font-medium">{t("pro")}</span>
                  </div>
                )}
              </div>

              <Textarea
                placeholder={t("negativePromptPlaceholder")}
                value={settings.negativePrompt}
                disabled={!canUseNegativePrompts}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  if (!canUseNegativePrompts) return;
                  updateSettings("negativePrompt", e.target.value);
                }}
                className={cn(
                  "w-full h-24 text-base p-4 border-2 border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 resize-none transition-all bg-background",
                  !canUseNegativePrompts && "cursor-not-allowed"
                )}
              />
            </div>
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
          />
        </div>
      </div>
    </div>
  );
}
