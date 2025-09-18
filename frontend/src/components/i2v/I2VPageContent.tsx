"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLocaleRouter } from "@/lib/navigation";
import { Button } from "@/components/ui/Button";
import { ContentCard } from "@/components/ui/ContentCard";
import { CreditsDisplay } from "@/components/i2v/CreditsDisplay";
import { I2VSettingsComponent } from "@/components/i2v/I2VSettings";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useUserContext } from "@/contexts/UserContext";
import { useMediaById } from "@/hooks/queries/useMediaQuery";
import { Video, ArrowLeft, Play } from "lucide-react";
import { isVideo } from "@/lib/utils";
import { I2VSettings, Media } from "@/types";
import { generateApi } from "@/lib/api/generate";
import { usePollI2VJob } from "@/hooks/queries/useGenerationQuery";

export function I2VPageContent() {
  const searchParams = useSearchParams();
  const router = useLocaleRouter();
  const { user } = useUserContext();
  const { redirectToLogin } = useAuthRedirect();

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
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  // Holds the generated video media once job completes
  const [generatedMedia, setGeneratedMedia] = useState<Media | null>(null);
  // Generation progress tracking
  const [generationMeta, setGenerationMeta] = useState<{
    eta: number; // estimated total seconds
    start: number; // ms timestamp
  } | null>(null);
  const [progressPct, setProgressPct] = useState(0); // 0..1
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Interval to update progress based on ETA
  useEffect(() => {
    if (!generationMeta) return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - generationMeta.start) / 1000;
      const pct = Math.min(0.99, elapsed / generationMeta.eta); // cap at 99% until completion
      setProgressPct(pct);
      setRemainingSeconds(Math.max(0, Math.ceil(generationMeta.eta - elapsed)));
    }, 500);
    return () => clearInterval(id);
  }, [generationMeta]);

  // Mock credits - in real app this would come from user context or API
  const [availableCredits] = useState(120); // 120 seconds available

  const [settings, setSettings] = useState<I2VSettings>({
    videoLength: 5,
    prompt: "",
    negativePrompt: "",
    seed: "",
    flowShift: 5.0,
    inferenceSteps: 30,
    cfgScale: 5.0,
    optimizePrompt: true,
  });

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
    if (!user && !loading) {
      redirectToLogin();
    }
  }, [user, loading, redirectToLogin]);

  // Check for errors or invalid media type
  const error = useMemo(() => {
    if (!mediaId) {
      return "No media ID provided";
    }
    if (queryError) {
      return "Failed to load media";
    }
    if (media && isVideo(media)) {
      return "Video-to-video conversion is not supported";
    }
    return null;
  }, [mediaId, queryError, media]);

  const handleBuyCredits = () => {
    // Navigate to pricing or credits purchase page
    router.push("/pricing");
  };

  const handleGenerate = async () => {
    if (!media || availableCredits < settings.videoLength || isGenerating)
      return;
    setIsGenerating(true);
    try {
      const submitResp = await generateApi.submitI2VJob({
        ...settings,
        mediaId: media.id,
        isPublic: true,
      });
      const { jobId, estimatedSeconds } = submitResp;
      setCurrentJobId(jobId);
      setGenerationMeta({ eta: estimatedSeconds, start: Date.now() });
      setProgressPct(0);
      setRemainingSeconds(estimatedSeconds);
      // Enable polling after ETA (schedule timer)
      setPollingEnabled(false);
      window.setTimeout(() => {
        setPollingEnabled(true);
      }, estimatedSeconds * 1000);
    } catch (err) {
      console.error("Generation failed:", err);
      alert("Failed to start video generation. Please try again.");
      setIsGenerating(false);
    }
  };

  // Use poll hook once enabled
  const { data: pollData } = usePollI2VJob(
    currentJobId || undefined,
    pollingEnabled
  );

  // React to poll completion
  useEffect(() => {
    if (!pollData) return;
    if ((pollData as any).status === "COMPLETED" && (pollData as any).media) {
      setGeneratedMedia((pollData as any).media as Media);
      setProgressPct(1);
      setGenerationMeta(null);
      setRemainingSeconds(0);
      setIsGenerating(false);
      setPollingEnabled(false);
    }
  }, [pollData]);

  const canGenerate =
    media && availableCredits >= settings.videoLength && !isGenerating;
  const creditsNeeded = settings.videoLength;

  // Mobile View Component
  const MobileView = () => (
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
                  Convert to Video
                </h1>
                <p className="text-sm text-muted-foreground truncate">
                  Transform your image
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
            Source Image
          </h2>
          <div className="aspect-square rounded-lg overflow-hidden bg-muted">
            <ContentCard
              item={media!}
              canLike={false}
              canBookmark={false}
              canFullscreen={true}
              canAddToAlbum={false}
              canRemoveFromAlbum={false}
              canDownload={false}
              canDelete={false}
              canI2V={false}
              showCounts={false}
              showTags={false}
              disableHoverEffects={true}
              useAllAvailableSpace={true}
              aspectRatio="auto"
            />
          </div>
        </div>

        {/* Generated output or placeholder */}
        {generatedMedia ? (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3 mt-6">
              Generated Video
            </h2>
            <div className="rounded-lg overflow-hidden bg-muted aspect-video">
              <ContentCard
                item={generatedMedia}
                canLike={true}
                canBookmark={true}
                canFullscreen={true}
                canAddToAlbum={true}
                canRemoveFromAlbum={false}
                canDownload={true}
                canDelete={false}
                canI2V={false}
                showCounts={true}
                showTags={true}
                disableHoverEffects={false}
                useAllAvailableSpace={true}
                aspectRatio="auto"
              />
            </div>
          </div>
        ) : isGenerating && generationMeta ? (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3 mt-6">
              Generating Video
            </h2>
            <div className="rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-border p-4 aspect-video flex flex-col justify-between">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" />
                <p className="text-sm text-muted-foreground flex-1 truncate">
                  Processing... {Math.round(progressPct * 100)}%
                </p>
              </div>
              <div className="mt-4">
                <div className="w-full h-2 rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                    style={{ width: `${Math.round(progressPct * 100)}%` }}
                  />
                </div>
                {remainingSeconds !== null && remainingSeconds > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ~{remainingSeconds}s remaining (estimated)
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Credits Section */}
        <CreditsDisplay
          availableCredits={availableCredits}
          onBuyCredits={handleBuyCredits}
        />

        {/* Settings */}
        <I2VSettingsComponent
          settings={settings}
          onSettingsChange={setSettings}
        />

        {/* Generation Section */}
        <div className="bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-lg p-4 border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg">
              <Play className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Generate Video
            </h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Credits needed:</span>
              <span className="font-medium text-foreground">
                {creditsNeeded}s
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available credits:</span>
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
                  You need {creditsNeeded - availableCredits} more seconds to
                  generate this video.
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
                  Generating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Generate Video ({creditsNeeded}s)
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Desktop View Component
  const DesktopView = () => (
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
          Back
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <Video className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Convert Image to Video
            </h1>
            <p className="text-muted-foreground">
              Transform your image into an animated video
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Image Preview */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Source Image
            </h2>
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
              <ContentCard
                item={media!}
                canLike={false}
                canBookmark={false}
                canFullscreen={true}
                canAddToAlbum={false}
                canRemoveFromAlbum={false}
                canDownload={false}
                canDelete={false}
                canI2V={false}
                showCounts={false}
                showTags={false}
                disableHoverEffects={true}
                useAllAvailableSpace={true}
                aspectRatio="auto"
              />
            </div>
          </div>

          {generatedMedia ? (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4 mt-2">
                Generated Video
              </h2>
              <div className="rounded-lg overflow-hidden bg-muted aspect-video">
                <ContentCard
                  item={generatedMedia}
                  canLike={true}
                  canBookmark={true}
                  canFullscreen={true}
                  canAddToAlbum={true}
                  canRemoveFromAlbum={false}
                  canDownload={true}
                  canDelete={false}
                  canI2V={false}
                  showCounts={true}
                  showTags={true}
                  disableHoverEffects={false}
                  useAllAvailableSpace={true}
                  aspectRatio="auto"
                />
              </div>
            </div>
          ) : isGenerating && generationMeta ? (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4 mt-2">
                Generating Video
              </h2>
              <div className="rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-border p-6 aspect-video flex flex-col justify-between">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-purple-500" />
                  <p className="text-sm text-muted-foreground flex-1">
                    Processing... {Math.round(progressPct * 100)}%
                  </p>
                </div>
                <div className="mt-6">
                  <div className="w-full h-3 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                      style={{ width: `${Math.round(progressPct * 100)}%` }}
                    />
                  </div>
                  {remainingSeconds !== null && remainingSeconds > 0 && (
                    <p className="text-xs text-muted-foreground mt-3">
                      ~{remainingSeconds}s remaining (estimated)
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Credits Section */}
          <CreditsDisplay
            availableCredits={availableCredits}
            onBuyCredits={handleBuyCredits}
          />
        </div>

        {/* Right Column - Settings and Generation */}
        <div className="space-y-6">
          {/* Settings */}
          <I2VSettingsComponent
            settings={settings}
            onSettingsChange={setSettings}
          />

          {/* Generation Section */}
          <div className="bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-lg p-6 border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg">
                <Play className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Generate Video
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Credits needed:</span>
                <span className="font-medium text-foreground">
                  {creditsNeeded}s
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Available credits:
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
                    You need {creditsNeeded - availableCredits} more seconds to
                    generate this video.
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
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Generate Video ({creditsNeeded}s)
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading media...</p>
        </div>
      </div>
    );
  }

  if (error || !media) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Error</h1>
          <p className="text-muted-foreground mb-6">
            {error || "Media not found"}
          </p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Main component return with mobile/desktop conditional rendering
  return isMobile ? <MobileView /> : <DesktopView />;
}
