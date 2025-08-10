"use client";

import { AlbumGrid } from "./AlbumGrid";
import { useAlbums } from "@/hooks/queries/useAlbumsQuery";
import { Album } from "@/types";

interface DiscoverClientProps {
  initialAlbums: Album[];
  initialPagination: {
    hasNext: boolean;
    cursor: string | null;
  } | null;
  initialError: string | null;
}

export function DiscoverClient({
  initialAlbums,
  initialPagination,
  initialError,
}: DiscoverClientProps) {
  const {
    data: albumsData,
    isLoading: loading,
    error,
    fetchNextPage,
    hasNextPage,
  } = useAlbums({
    isPublic: true,
    limit: 12,
    initialData: {
      albums: initialAlbums,
      pagination: initialPagination || undefined,
    },
  });

  // Extract all albums from paginated data
  const albums = albumsData?.pages.flatMap((page) => page.albums) || [];

  // Use initial error if no albums were loaded initially
  const displayError =
    albums.length === 0 && initialError ? initialError : error?.message;

  const loadMore = () => {
    if (hasNextPage) {
      fetchNextPage();
    }
  };

  return (
    <AlbumGrid
      albums={albums}
      context="discover"
      loadMore={loadMore}
      loading={loading}
      hasMore={hasNextPage || false}
      error={displayError}
    />
  );
}
