"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Eye, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GenerationProgressCard } from "@/components/ui/GenerationProgressCard";
import { ContentCard } from "@/components/ui/ContentCard";
import { Lightbox } from "@/components/ui/Lightbox";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import {
  useGenerationContext,
  DEFAULT_SETTINGS,
} from "@/contexts/GenerationContext";
import { useDevice } from "@/contexts/DeviceContext";
import { composeMediaUrl } from "@/lib/urlUtils";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/contexts/WebSocketContext";

export function RandomClient() {
  const t = useTranslations("generate");
  const { isMobileInterface } = useDevice();
  const { fetchConnectionId, isConnected } = useWebSocket();

  const {
    clearResults,
    generateImages,
    stopGeneration,
    uiState: {
      allGeneratedImages,
      deletedImageIds,
      showProgressCard,
      isGenerating,
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
      isRandomizingPrompt,
      isSelectingLoras,
    },
    setShowProgressCard,
    setDeletedImageIds,
    setAllGeneratedImages,
  } = useGenerationContext();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (generatedImages.length > 0) {
      setShowProgressCard(false);
    }
  }, [generatedImages, setShowProgressCard]);

  const filteredGeneratedImages = useMemo(
    () => generatedImages.filter((media) => !deletedImageIds.has(media.id)),
    [generatedImages, deletedImageIds]
  );

  const filteredAllGeneratedImages = useMemo(
    () => allGeneratedImages.filter((media) => !deletedImageIds.has(media.id)),
    [allGeneratedImages, deletedImageIds]
  );

  const latestImage = filteredGeneratedImages.at(-1) ?? null;

  const hasActiveQueueId = Boolean(queueStatus?.queueId);
  const isRandomizingPromptState = isGenerating && isRandomizingPrompt;
  const isSelectingLorasState = isGenerating && isSelectingLoras;
  const isInPreparingState =
    isGenerating &&
    !hasActiveQueueId &&
    !isRandomizingPromptState &&
    !isSelectingLorasState;
  const isInStopState = isGenerating && hasActiveQueueId;

  const handleGenerate = async () => {
    clearResults();
    setShowProgressCard(true);

    await generateImages({
      ...DEFAULT_SETTINGS,
      prompt: "",
      optimizePrompt: false,
      batchCount: 1,
      selectedLoras: [],
      loraStrengths: {},
    });
  };

  const handleStopGeneration = () => {
    stopGeneration();
  };

  const handleOptimisticDelete = (mediaId: string) => {
    setDeletedImageIds((prev) => new Set(prev).add(mediaId));
    setAllGeneratedImages((prev) =>
      prev.filter((media) => media.id !== mediaId)
    );
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

  const handleLightboxNext = () => {
    setLightboxIndex(
      Math.min(lightboxIndex + 1, filteredAllGeneratedImages.length - 1)
    );
  };

  const handleLightboxPrevious = () => {
    setLightboxIndex(Math.max(lightboxIndex - 1, 0));
  };

  useEffect(() => {
    if (!isConnected) return;
    fetchConnectionId();
  }, [fetchConnectionId, isConnected]);

  // Mobile view with fixed button at bottom
  if (isMobileInterface) {
    return (
      <div className="container mx-auto max-w-5xl py-8 px-4 pb-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {t("randomImageGenerator")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("randomGenerationsFree")}
          </p>
        </div>

        <div className="space-y-6">
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
          ) : latestImage ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between max-w-[450px] mx-auto">
                <h3 className="text-lg font-semibold">
                  {t("generatedImages")}
                </h3>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-muted-foreground">
                    {t("complete")}
                  </span>
                </div>
              </div>
              <div className="max-w-[450px] mx-auto">
                <ContentCard
                  item={latestImage}
                  aspectRatio="square"
                  canLike={true}
                  canBookmark={true}
                  canFullscreen={true}
                  canAddToAlbum={true}
                  canDownload={true}
                  canDelete={true}
                  mediaList={filteredGeneratedImages}
                  currentIndex={filteredGeneratedImages.length - 1}
                  onDelete={handleOptimisticDelete}
                />
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
                      {t("clickOnRandomize")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Generations */}
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
              <div className="grid grid-cols-4 gap-2">
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
        </div>

        {/* Fixed Generate Button at Bottom - Mobile */}
        <div className="fixed bottom-[61px] left-0 right-0 px-3 py-2 bg-background/95 backdrop-blur-lg border-t z-50">
          <Button
            onClick={isInStopState ? handleStopGeneration : handleGenerate}
            disabled={
              isInPreparingState ||
              isRandomizingPromptState ||
              isSelectingLorasState ||
              !isConnected
            }
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
            ) : isRandomizingPromptState ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t("randomizingPrompt")}</span>
              </div>
            ) : isSelectingLorasState ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t("selectingLoras")}</span>
              </div>
            ) : isInPreparingState ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t("preparingGeneration")}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5" />
                <span>{t("actions.randomize")}</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Desktop view with normal button positioning
  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
          {t("randomImageGenerator")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("randomGenerationsFree")}
        </p>
      </div>

      <div className="space-y-6">
        {/* Generate Button - Normal positioning for desktop */}
        <Button
          size="lg"
          onClick={isInStopState ? handleStopGeneration : handleGenerate}
          disabled={
            isInPreparingState ||
            isRandomizingPromptState ||
            isSelectingLorasState ||
            !isConnected
          }
          className={cn(
            "w-full h-16 text-lg font-semibold rounded-xl shadow-lg transition-all",
            isInStopState
              ? "bg-red-500 hover:bg-red-600"
              : "bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
          )}
        >
          {isInStopState ? (
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{t("stopGeneration")}</span>
            </div>
          ) : isRandomizingPromptState ? (
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{t("randomizingPrompt")}</span>
            </div>
          ) : isSelectingLorasState ? (
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{t("selectingLoras")}</span>
            </div>
          ) : isInPreparingState ? (
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{t("preparingGeneration")}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6" />
              <span>{t("actions.randomize")}</span>
            </div>
          )}
        </Button>

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
        ) : latestImage ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between max-w-[450px] mx-auto">
              <h3 className="text-lg font-semibold">{t("generatedImages")}</h3>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-muted-foreground">
                  {t("complete")}
                </span>
              </div>
            </div>
            <div className="max-w-[450px] mx-auto">
              <ContentCard
                item={latestImage}
                aspectRatio="square"
                canLike={true}
                canBookmark={true}
                canFullscreen={true}
                canAddToAlbum={true}
                canDownload={true}
                canDelete={true}
                mediaList={filteredGeneratedImages}
                currentIndex={filteredGeneratedImages.length - 1}
                onDelete={handleOptimisticDelete}
              />
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
                    {t("clickOnRandomize")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Generations */}
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
      </div>
    </div>
  );
}
