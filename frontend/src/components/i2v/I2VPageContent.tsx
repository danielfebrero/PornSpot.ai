"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useLocaleRouter } from "@/lib/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Slider } from "@/components/ui/Slider";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { ContentCard } from "@/components/ui/ContentCard";
import { CreditsDisplay } from "@/components/i2v/CreditsDisplay";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useUserContext } from "@/contexts/UserContext";
import { useMediaById } from "@/hooks/queries/useMediaQuery";
import {
  Video,
  ArrowLeft,
  Play,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Crown,
  Sparkles,
} from "lucide-react";
import { isVideo } from "@/lib/utils";
import { I2VSettings } from "@/types";
import { generateApi } from "@/lib/api/generate";
import { useTranslations } from "next-intl";
import { usePermissions } from "@/contexts/PermissionsContext";
import { ApiUtil } from "@/lib/api-util";

export function I2VPageContent() {
  const searchParams = useSearchParams();
  const router = useLocaleRouter();
  const {
    user,
    spendI2VSeconds,
    loading: userLoading,
    refetch,
  } = useUserContext();
  const { redirectToLogin } = useAuthRedirect();
  const t = useTranslations("i2v.pageContent");
  const ts = useTranslations("i2v.settings");
  const { canCreatePrivateContent } = usePermissions();
  const canMakePrivate = canCreatePrivateContent();

  const mediaId = searchParams.get("mediaId");

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  // Use the media query hook instead of manual loading
  const {
    data: media,
    isLoading: loading,
    error: queryError,
  } = useMediaById(mediaId || "", !!mediaId);

  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Available credits derived from user context
  const availableCredits = useMemo(() => {
    if (!user) return 0;
    const purchased = user.i2vCreditsSecondsPurchased || 0;
    const fromPlan = user.i2vCreditsSecondsFromPlan || 0;
    return purchased + fromPlan;
  }, [user]);

  const [settings, setSettings] = useState<I2VSettings>({
    videoLength: 5,
    prompt: "",
    negativePrompt: "",
    seed: "",
    flowShift: 5.0,
    inferenceSteps: 30,
    cfgScale: 5.0,
    optimizePrompt: true,
    isPublic: true,
    enableLoras: true,
  });

  const updateSetting = useCallback(
    <K extends keyof I2VSettings>(key: K, value: I2VSettings[K]) => {
      setSettings((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const handleLorasToggle = useCallback((checked: boolean) => {
    setSettings((prev) => {
      const allowedWithLoras: I2VSettings["videoLength"][] = [5, 8];
      const nextVideoLength = checked
        ? allowedWithLoras.includes(prev.videoLength)
          ? prev.videoLength
          : 8
        : prev.videoLength;
      return {
        ...prev,
        enableLoras: checked,
        videoLength: nextVideoLength,
      };
    });
  }, []);

  const handleVisibilityChange = useCallback(
    (checked: boolean) => {
      updateSetting("isPublic", !checked);
    },
    [updateSetting]
  );

  const renderSettings = useMemo(() => {
    const allowedVideoLengths: I2VSettings["videoLength"][] =
      settings.enableLoras ? [5, 8] : [5, 10, 15, 20, 25, 30];
    const sliderMax =
      allowedVideoLengths[allowedVideoLengths.length - 1] ??
      settings.videoLength;
    const sliderStep = settings.enableLoras ? 3 : 5;

    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <SettingsIcon className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {ts("title")}
          </h3>
        </div>

        <div className="space-y-6">
          {/* Basic Settings */}
          <div>
            <Label
              htmlFor="videoLength"
              className="text-sm font-medium flex justify-between"
            >
              <span>{ts("videoLength")}</span>
              <span className="font-semibold">{settings.videoLength}s</span>
            </Label>
            <Slider
              value={[settings.videoLength]}
              onValueChange={(v) => {
                const rawValue = v[0];
                const nextValue = allowedVideoLengths.reduce(
                  (closest, current) =>
                    Math.abs(current - rawValue) < Math.abs(closest - rawValue)
                      ? current
                      : closest,
                  allowedVideoLengths[0]
                );
                updateSetting("videoLength", nextValue);
              }}
              min={allowedVideoLengths[0]}
              max={sliderMax}
              step={sliderStep}
              className="mt-2 w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              {allowedVideoLengths.map((v) => (
                <span key={v}>{v}s</span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {ts("loras.label")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ts("loras.description")}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {settings.enableLoras
                    ? ts("loras.enabled")
                    : ts("loras.disabled")}
                </p>
              </div>
              <Switch
                checked={settings.enableLoras}
                onCheckedChange={handleLorasToggle}
              />
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <div>
            <Button
              variant="ghost"
              onClick={() => setShowAdvancedSettings((s) => !s)}
              className="flex items-center gap-2 p-0 h-auto font-medium text-foreground hover:text-primary"
            >
              {showAdvancedSettings ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {ts("advanced.title")}
            </Button>
          </div>

          {/* Advanced Settings */}
          {showAdvancedSettings && (
            <div className="space-y-4">
              {/* Visibility */}
              <div>
                <Label htmlFor="visibility" className="text-sm font-medium">
                  Visibility
                </Label>
                <div className="mt-2 flex items-center justify-between rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2">
                    {settings.isPublic ? (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">
                      {settings.isPublic ? "Public" : "Private"}
                    </span>
                    {!canMakePrivate && !settings.isPublic && (
                      <Crown className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                  <Switch
                    checked={!settings.isPublic}
                    onCheckedChange={handleVisibilityChange}
                    disabled={!canMakePrivate}
                  />
                </div>
                {!canMakePrivate && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Private videos are a Pro feature
                  </p>
                )}
              </div>

              {/* Prompt */}
              <div>
                <Label htmlFor="prompt" className="text-sm font-medium">
                  {ts("advanced.prompt")}
                </Label>
                <Textarea
                  id="prompt"
                  value={settings.prompt}
                  onChange={(e) => updateSetting("prompt", e.target.value)}
                  placeholder={ts("advanced.promptPlaceholder")}
                  className="mt-1"
                  rows={3}
                />
              </div>

              {/* Prompt Optimization */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {ts("advanced.optimizePrompt")}
                </Label>
                <div className="mt-2 flex items-center justify-between rounded-lg border bg-card p-3">
                  <p className="text-sm text-muted-foreground mr-4">
                    {ts("advanced.optimizePromptHint")}
                  </p>
                  <Switch
                    checked={settings.optimizePrompt}
                    onCheckedChange={(checked) =>
                      updateSetting("optimizePrompt", checked)
                    }
                  />
                </div>
              </div>

              {/* Negative Prompt */}
              <div>
                <Label htmlFor="negativePrompt" className="text-sm font-medium">
                  {ts("advanced.negativePrompt")}
                </Label>
                <Textarea
                  id="negativePrompt"
                  value={settings.negativePrompt}
                  onChange={(e) =>
                    updateSetting("negativePrompt", e.target.value)
                  }
                  placeholder={ts("advanced.negativePromptPlaceholder")}
                  className="mt-1"
                  rows={2}
                />
              </div>

              {/* Seed */}
              <div>
                <Label htmlFor="seed" className="text-sm font-medium">
                  {ts("advanced.seed")}
                </Label>
                <Input
                  id="seed"
                  type="text"
                  value={settings.seed}
                  onChange={(e) => updateSetting("seed", e.target.value)}
                  placeholder={ts("advanced.seedPlaceholder")}
                  className="mt-1"
                />
              </div>

              {/* Flow Shift */}
              <div>
                <Label htmlFor="flowShift" className="text-sm font-medium">
                  {ts("advanced.flowShift")} {settings.flowShift}
                </Label>
                <Slider
                  value={[settings.flowShift]}
                  onValueChange={(v) => updateSetting("flowShift", v[0])}
                  min={1}
                  max={10}
                  step={0.1}
                  className="mt-1 w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>

              {/* Inference Steps */}
              <div>
                <Label htmlFor="inferenceSteps" className="text-sm font-medium">
                  {ts("advanced.inferenceSteps")} {settings.inferenceSteps}
                </Label>
                <Slider
                  value={[settings.inferenceSteps]}
                  onValueChange={(v) => updateSetting("inferenceSteps", v[0])}
                  min={20}
                  max={40}
                  step={1}
                  className="mt-1 w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>20</span>
                  <span>40</span>
                </div>
              </div>

              {/* CFG Scale */}
              <div>
                <Label htmlFor="cfgScale" className="text-sm font-medium">
                  {ts("advanced.cfgScale")} {settings.cfgScale}
                </Label>
                <Slider
                  value={[settings.cfgScale]}
                  onValueChange={(v) => updateSetting("cfgScale", v[0])}
                  min={1}
                  max={10}
                  step={0.1}
                  className="mt-1 w-full"
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
  }, [
    settings,
    showAdvancedSettings,
    updateSetting,
    ts,
    canMakePrivate,
    handleVisibilityChange,
    handleLorasToggle,
  ]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Check authentication
  useEffect(() => {
    if (!user && !loading && !userLoading) {
      redirectToLogin();
    }
  }, [user, loading, userLoading, redirectToLogin]);

  // Check for errors or invalid media type
  const error = useMemo(() => {
    if (!mediaId) {
      return t("errors.noMediaId");
    }
    if (queryError) {
      return t("errors.failedToLoadMedia");
    }
    if (media && isVideo(media)) {
      return t("errors.videoToVideoNotSupported");
    }
    return null;
  }, [mediaId, queryError, media, t]);

  const handleBuyCredits = useCallback(() => {
    // Navigate to pricing or credits purchase page
    router.push("/pricing");
  }, [router]);

  const handleGenerate = useCallback(async () => {
    if (!media || availableCredits < settings.videoLength || isGenerating)
      return;
    setSubmitError(null);
    // Deduct credits immediately (optimistic)
    if (spendI2VSeconds) {
      const ok = spendI2VSeconds(settings.videoLength);
      if (!ok) return; // insufficient credits race
    }
    setIsGenerating(true);
    try {
      const submitResp = await generateApi.submitI2VJob({
        ...settings,
        mediaId: media.id,
        // Private output is reserved for Pro plans only
        isPublic: canCreatePrivateContent() ? settings.isPublic : true,
      });
      // On successful job start, redirect to videos page
      if (submitResp) {
        router.push("/user/videos");
      }
    } catch (err) {
      console.error("Generation failed:", err);
      const message = ApiUtil.handleApiError(err);
      setSubmitError(message);
      // Refresh user to restore credits after failed submission (e.g., moderation)
      await refetch();
      setIsGenerating(false);
    }
  }, [
    media,
    availableCredits,
    settings,
    isGenerating,
    spendI2VSeconds,
    canCreatePrivateContent,
    router,
    refetch,
  ]);

  const canGenerate = useMemo(
    () => media && availableCredits >= settings.videoLength && !isGenerating,
    [media, availableCredits, settings.videoLength, isGenerating]
  );
  const creditsNeeded = useMemo(
    () => settings.videoLength,
    [settings.videoLength]
  );

  // Memoize ContentCard props to prevent re-rendering
  const contentCardProps = useMemo(
    () => ({
      canLike: false,
      canBookmark: false,
      canFullscreen: true,
      canAddToAlbum: false,
      canRemoveFromAlbum: false,
      canDownload: false,
      canDelete: false,
      canI2V: false,
      showCounts: false,
      showTags: false,
      disableHoverEffects: true,
      useAllAvailableSpace: true,
      aspectRatio: "auto" as const,
    }),
    []
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("status.loadingMedia")}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !media) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            {t("titles.error")}
          </h1>
          <p className="text-muted-foreground mb-6">
            {error || t("errors.mediaNotFound")}
          </p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("actions.goBack")}
          </Button>
        </div>
      </div>
    );
  }

  // Mobile View - Early Return
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-card border-b sticky top-0 z-10">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.back()}
                variant="ghost"
                size="sm"
                className="p-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                  <Video className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold text-foreground truncate">
                    {t("titles.convertToVideo")}
                  </h1>
                  <p className="text-sm text-muted-foreground truncate">
                    {t("descriptions.transformYourImage")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Source Image */}
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3">
              {t("titles.sourceImage")}
            </h2>
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
              {media && <ContentCard item={media} {...contentCardProps} />}
            </div>
          </div>

          {/* Credits Section */}
          <CreditsDisplay
            availableCredits={availableCredits}
            onBuyCredits={handleBuyCredits}
          />

          {/* Settings */}
          {renderSettings}

          {/* Generation Section */}
          <div className="bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-lg p-4 border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg">
                <Play className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {t("titles.generateVideo")}
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("credits.creditsNeeded")}
                </span>
                <span className="font-medium text-foreground">
                  {creditsNeeded}s
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("credits.availableCredits")}
                </span>
                <span
                  className={`font-medium ${
                    availableCredits >= creditsNeeded
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {availableCredits}s
                </span>
              </div>

              {availableCredits < creditsNeeded && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    {t("credits.insufficientCredits", {
                      needed: creditsNeeded - availableCredits,
                    })}
                  </p>
                </div>
              )}

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 whitespace-pre-line">
                    {submitError}
                  </p>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t("actions.generating")}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {t("actions.generateVideoWithDuration", {
                      duration: creditsNeeded,
                    })}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop View - Default Return
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          onClick={() => router.back()}
          variant="ghost"
          size="sm"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("actions.back")}
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <Video className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t("titles.convertImageToVideo")}
            </h1>
            <p className="text-muted-foreground">
              {t("descriptions.transformImageToVideo")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Image Preview */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {t("titles.sourceImage")}
            </h2>
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
              {media && <ContentCard item={media} {...contentCardProps} />}
            </div>
          </div>

          {/* Credits Section */}
          <CreditsDisplay
            availableCredits={availableCredits}
            onBuyCredits={handleBuyCredits}
          />
        </div>

        {/* Right Column - Settings and Generation */}
        <div className="space-y-6">
          {/* Settings */}
          {renderSettings}

          {/* Generation Section */}
          <div className="bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-lg p-6 border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg">
                <Play className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {t("titles.generateVideo")}
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("credits.creditsNeeded")}
                </span>
                <span className="font-medium text-foreground">
                  {creditsNeeded}s
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("credits.availableCredits")}
                </span>
                <span
                  className={`font-medium ${
                    availableCredits >= creditsNeeded
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {availableCredits}s
                </span>
              </div>

              {availableCredits < creditsNeeded && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    {t("credits.insufficientCredits", {
                      needed: creditsNeeded - availableCredits,
                    })}
                  </p>
                </div>
              )}

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 whitespace-pre-line">
                    {submitError}
                  </p>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t("actions.generating")}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {t("actions.generateVideoWithDuration", {
                      duration: creditsNeeded,
                    })}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
