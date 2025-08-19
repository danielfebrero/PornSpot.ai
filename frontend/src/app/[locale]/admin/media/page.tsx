"use client";

import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { Image as ImageIcon } from "lucide-react";
import { useAdminMediaData } from "@/hooks/queries/useAdminMediaQuery";

export default function AdminMediaPage() {
  const {
    media,
    isLoading: loading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useAdminMediaData({ limit: 20 });

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-500 mb-4">
            Erreur lors du chargement des médias
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {error instanceof Error ? error.message : "Erreur inconnue"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestion des Médias
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {loading ? "Chargement..." : `${media.length} média(s) trouvé(s)`}
          </p>
        </div>
      </div>

      {/* Media Grid */}
      {loading && media.length === 0 ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Chargement des médias...
            </p>
          </div>
        </div>
      ) : media.length === 0 ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Aucun média trouvé
            </p>
          </div>
        </div>
      ) : (
        <VirtualizedGrid
          items={media}
          className="min-h-[600px]"
          viewMode="grid"
          gridColumns={{
            mobile: 2,
            sm: 3,
            md: 4,
            lg: 5,
            xl: 6,
          }}
          aspectRatio="square"
          contentCardProps={{
            canLike: false,
            canBookmark: false,
            canFullscreen: true,
            canAddToAlbum: false,
            canDownload: true,
            canDelete: false,
            showCounts: true,
            showTags: false,
            preferredThumbnailSize: "medium",
          }}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={fetchNextPage}
        />
      )}
    </div>
  );
}
