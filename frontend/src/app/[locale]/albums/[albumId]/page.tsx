import { notFound } from "next/navigation";
import { getAlbumById } from "@/lib/data";
import { composeAlbumCoverUrl } from "@/lib/urlUtils";
import { AlbumDetailClient } from "@/components/AlbumDetailClient";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { generateAlbumMetadata } from "@/lib/opengraph";
import {
  HydrationBoundary,
  dehydrate,
  QueryClient,
} from "@tanstack/react-query";
import { mediaApi } from "@/lib/api";

type AlbumDetailPageProps = {
  params: {
    locale: string;
    albumId: string;
  };
};

// Force dynamic rendering - no static generation
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: AlbumDetailPageProps): Promise<Metadata> {
  const { locale, albumId } = params;
  const { data: album, error } = await getAlbumById(albumId);

  // Get localized translations for fallback
  const tAlbum = await getTranslations({ locale, namespace: "album" });

  if (error || !album) {
    return {
      title: tAlbum("notFound"),
    };
  }

  return generateAlbumMetadata(locale, albumId, {
    title: album.title,
    tags: album.tags,
    coverImageUrl: album.coverImageUrl
      ? composeAlbumCoverUrl(album.coverImageUrl)
      : undefined,
  });
}

// NO generateStaticParams when using force-dynamic

export default async function AlbumDetailPage({
  params,
}: AlbumDetailPageProps) {
  const { albumId } = params;
  const albumResult = await getAlbumById(albumId);

  if (albumResult.error || !albumResult.data) {
    notFound();
  }

  const album = albumResult.data;

  // Prefetch first page of album media for SSG hydration (matches useAlbumMedia)
  const queryClient = new QueryClient();
  const limit = 20; // keep in sync with MediaGallery/useAlbumMedia default
  try {
    await queryClient.prefetchInfiniteQuery({
      queryKey: ["media", "album", albumId, { limit }],
      queryFn: async ({ pageParam }) =>
        mediaApi.getAlbumMedia(albumId, { limit, cursor: pageParam }),
      initialPageParam: undefined,
    });
  } catch (e) {
    // Non-blocking: if prefetch fails, client will fetch on mount
    console.error("Album media prefetch failed", e);
  }

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <AlbumDetailClient album={album} />
    </HydrationBoundary>
  );
}
