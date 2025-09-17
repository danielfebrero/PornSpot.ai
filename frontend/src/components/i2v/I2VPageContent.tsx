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
import { I2VSettings } from "@/types";

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
    if (!media || availableCredits < settings.videoLength) {
      return;
    }

    setIsGenerating(true);
    try {
      // Placeholder - actual generation logic would go here
      console.log("Generating video with settings:", settings);
      console.log("For media:", media.id);

      // Simulate generation delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // In real implementation, this would call the generation API
      alert("Video generation started! You will be notified when it's ready.");
    } catch (err) {
      console.error("Generation failed:", err);
      alert("Failed to start video generation. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

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
