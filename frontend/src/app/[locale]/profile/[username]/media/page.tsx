"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImageIcon, Grid, List, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { Lightbox } from "@/components/ui/Lightbox";
import LocaleLink from "@/components/ui/LocaleLink";
import { cn } from "@/lib/utils";
import {
  useGetMinimalUser,
  usePublicProfile,
} from "@/hooks/queries/useUserQuery";
import { useUserMedia } from "@/hooks/queries/useMediaQuery";
import { usePrefetchInteractionStatus } from "@/hooks/queries/useInteractionsQuery";
import { Media } from "@/types";
import { useDevice } from "@/contexts/DeviceContext";
import Avatar from "@/components/ui/Avatar";

export default function UserMediaPage() {
  const params = useParams();
  const username = params.username as string;
  const t = useTranslations("profile.media");

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const { isMobile } = useDevice();

  // Fetch public profile data using TanStack Query
  const {
    data: profileData,
    isLoading: profileLoading,
    error: profileError,
  } = usePublicProfile(username);

  // Fetch user media with infinite scroll
  const {
    data: mediaData,
    isLoading: mediaLoading,
    error: mediaError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useUserMedia({ username, limit: 20 });

  const { data: userData } = useGetMinimalUser({ username });

  // Hook for bulk prefetching interaction status
  const { prefetch } = usePrefetchInteractionStatus();

  const user = profileData;

  // Flatten all pages of media data
  const media: Media[] = useMemo(() => {
    return mediaData?.pages.flatMap((page) => page.media) || [];
  }, [mediaData]);

  // Prefetch interaction status for all profile media (when media is available)
  useEffect(() => {
    if (media.length > 0) {
      const targets = media.map((mediaItem) => ({
        targetType: "media" as const,
        targetId: mediaItem.id,
      }));
      prefetch(targets);
    }
  }, [media, prefetch]);

  const loading = profileLoading || mediaLoading;
  const error = profileError || mediaError;

  const displayName = user?.username || username;
  const initials = displayName.slice(0, 2).toUpperCase();

  // Load more function for infinite scroll
  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // Lightbox handlers
  const handleLightboxClose = () => {
    setLightboxOpen(false);
  };

  const handleLightboxNext = () => {
    if (currentMediaIndex < media.length - 1) {
      setCurrentMediaIndex(currentMediaIndex + 1);
    }
  };

  const handleLightboxPrevious = () => {
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex(currentMediaIndex - 1);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto md:px-4 sm:px-6 lg:px-8 md:py-8">
          <div className="animate-pulse space-y-6">
            {/* Header skeleton */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-6 bg-muted rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            </div>

            {/* Media grid skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-xl border border-border overflow-hidden"
                >
                  <div className="aspect-square bg-muted"></div>
                  <div className="p-4">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {t("error.title")}
          </h2>
          <p className="text-muted-foreground mt-2">
            {error?.message || t("error.message")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto md:px-4 sm:px-6 lg:px-8 md:py-8">
        <div className="space-y-6">
          {/* Header */}
          <Card
            className="border-border/50 shadow-lg"
            hideBorder={isMobile}
            hideMargin={isMobile}
          >
            <CardHeader className={cn("pb-6", isMobile && "p-0")}>
              {isMobile ? (
                // Mobile layout - simplified design
                <div className="flex items-center gap-3">
                  <LocaleLink href={`/profile/${username}`}>
                    <Button variant="ghost" size="sm" className="p-2">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  </LocaleLink>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                    <h1 className="text-lg font-bold text-foreground">
                      {t("title", { username: displayName })}
                    </h1>
                  </div>
                </div>
              ) : (
                // Desktop layout - original horizontal design
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Back button */}
                    <LocaleLink href={`/profile/${username}`}>
                      <Button variant="ghost" size="sm" className="p-2">
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                    </LocaleLink>

                    {/* User avatar */}
                    <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-lg font-bold shadow-lg">
                      {userData ? (
                        <Avatar user={userData} size="medium" />
                      ) : (
                        initials
                      )}
                    </div>

                    <div>
                      <h1 className="text-2xl font-bold text-foreground">
                        {t("title", { username: displayName })}
                      </h1>
                      <p className="text-muted-foreground">
                        {media.length > 0
                          ? t("count", { count: media.length })
                          : t("noMediaYet")}
                      </p>
                    </div>
                  </div>

                  {/* View mode toggle - only on desktop */}
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardHeader>
          </Card>

          {/* Media Grid/List */}
          <VirtualizedGrid
            items={media}
            viewMode={viewMode}
            isLoading={loading}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={handleLoadMore}
            contentCardProps={{
              canLike: true,
              canBookmark: true,
              canFullscreen: true,
              showCounts: true,
            }}
            mediaList={media}
            emptyState={{
              icon: <ImageIcon className="w-16 h-16 text-muted-foreground" />,
              title: t("empty.title"),
              description: user
                ? t("empty.description", { username: displayName })
                : t("empty.unavailable"),
            }}
            loadingState={{
              skeletonCount: 12,
              loadingText: t("loading.loadingMore"),
              noMoreText: t("loading.noMore"),
            }}
            error={error ? String(error) : null}
            className={cn(isMobile && "px-0", !isMobile && "px-4")}
          />

          {/* Lightbox */}
          {lightboxOpen && media.length > 0 && (
            <Lightbox
              isOpen={lightboxOpen}
              onClose={handleLightboxClose}
              media={media}
              currentIndex={currentMediaIndex}
              onNext={handleLightboxNext}
              onPrevious={handleLightboxPrevious}
            />
          )}
        </div>
      </div>
    </div>
  );
}
