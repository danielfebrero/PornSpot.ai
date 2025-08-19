"use client";

import { useMemo, useState } from "react";
import { useLocaleRouter } from "@/lib/navigation";
import { MediaManager } from "@/components/admin/MediaManager";
import {
  useAdminAlbum,
  useUpdateAdminAlbum,
} from "@/hooks/queries/useAdminAlbumsQuery";
import { useAlbumMedia } from "@/hooks/queries/useMediaQuery";

interface MediaManagementPageProps {
  params: {
    albumId: string;
  };
}

export default function MediaManagementPage({
  params,
}: MediaManagementPageProps) {
  const router = useLocaleRouter();
  const { data: album, isLoading: albumLoading } = useAdminAlbum(
    params.albumId
  );
  const { data: mediaData, isLoading: mediaLoading } = useAlbumMedia({
    albumId: params.albumId,
  });
  const updateAlbumMutation = useUpdateAdminAlbum();
  const [error, setError] = useState<string | null>(null);

  const loading = albumLoading || mediaLoading;

  // Extract all media from paginated data
  const allMedia = useMemo(() => {
    return mediaData?.pages.flatMap((page) => page.media || []) || [];
  }, [mediaData]);

  const handleBack = () => {
    router.push("/admin/albums");
  };

  const handleCoverSelect = async (coverUrl: string | undefined) => {
    if (!album) return;

    setError(null);
    try {
      const updateData: { coverImageUrl?: string } = {};
      if (coverUrl) {
        updateData.coverImageUrl = coverUrl;
      }

      await updateAlbumMutation.mutateAsync({
        albumId: album.id,
        updates: updateData,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update cover image"
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Back Button Skeleton */}
        <div className="flex items-center gap-4">
          <div className="h-6 w-32 bg-muted/50 rounded animate-pulse"></div>
        </div>

        {/* Header Skeleton */}
        <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl p-6 border border-admin-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-muted/50 rounded-lg animate-pulse"></div>
              <div>
                <div className="h-6 bg-muted/50 rounded w-40 mb-2 animate-pulse"></div>
                <div className="h-4 bg-muted/50 rounded w-60 animate-pulse"></div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="h-9 w-24 bg-muted/50 rounded animate-pulse"></div>
              <div className="h-9 w-32 bg-muted/50 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Media Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 overflow-hidden">
                <div className="aspect-square bg-muted/50"></div>
                <div className="p-2">
                  <div className="h-3 bg-muted/50 rounded w-3/4 mb-1"></div>
                  <div className="h-3 bg-muted/50 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="flex items-center text-admin-primary hover:text-admin-primary/80 transition-colors font-medium"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back to Albums
          </button>
        </div>
        <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl p-6 border border-admin-primary/20">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-admin-primary to-admin-secondary rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Manage Media</h1>
          </div>
          <p className="text-muted-foreground">Upload and manage album media</p>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-destructive mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-destructive font-medium">
              {error || "Album not found"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={handleBack}
          className="flex items-center text-admin-primary hover:text-admin-primary/80 transition-colors font-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          Back to Albums
        </button>
      </div>

      <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl p-4 sm:p-6 border border-admin-primary/20">
        {/* Mobile Layout */}
        <div className="block sm:hidden space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-admin-primary to-admin-secondary rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                Manage Media
              </h1>
              <p className="text-sm text-muted-foreground line-clamp-1">
                &quot;{album.title}&quot;
              </p>
            </div>
          </div>

          {/* Mobile Stats - Compact Grid */}
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center justify-between py-2 px-3 bg-card/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-admin-secondary rounded-full"></div>
                <span className="text-muted-foreground">Media Count:</span>
              </div>
              <span className="font-semibold text-foreground">
                {album.mediaCount} items
              </span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-card/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    album.isPublic ? "bg-admin-success" : "bg-muted-foreground"
                  }`}
                ></div>
                <span className="text-muted-foreground">Status:</span>
              </div>
              <span
                className={`font-semibold ${
                  album.isPublic
                    ? "text-admin-success"
                    : "text-muted-foreground"
                }`}
              >
                {album.isPublic ? "Public" : "Private"}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:block">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-admin-primary to-admin-secondary rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Manage Media
              </h1>
              <p className="text-muted-foreground">
                Upload and manage media for &quot;{album.title}&quot;
              </p>
            </div>
          </div>

          {/* Desktop Stats - Horizontal Layout */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-admin-primary rounded-full"></div>
              <span className="text-muted-foreground">Album ID:</span>
              <span className="font-mono text-foreground">{album.id}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-admin-secondary rounded-full"></div>
              <span className="text-muted-foreground">Media Count:</span>
              <span className="font-semibold text-foreground">
                {album.mediaCount} items
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  album.isPublic ? "bg-admin-success" : "bg-muted-foreground"
                }`}
              ></div>
              <span className="text-muted-foreground">Status:</span>
              <span
                className={`font-semibold ${
                  album.isPublic
                    ? "text-admin-success"
                    : "text-muted-foreground"
                }`}
              >
                {album.isPublic ? "Public" : "Private"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <MediaManager
        albumId={params.albumId}
        albumTitle={album.title}
        media={allMedia}
        onMediaChange={() => {
          // TanStack Query will automatically refetch when mutations complete
          // No manual refetch needed
        }}
        currentCoverUrl={album.coverImageUrl}
        onCoverSelect={handleCoverSelect}
        coverUpdateLoading={updateAlbumMutation.isPending}
      />
    </div>
  );
}
