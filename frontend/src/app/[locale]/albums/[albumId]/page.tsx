import { notFound } from "next/navigation";
import { getAlbumById } from "@/lib/data";
import { composeAlbumCoverUrl } from "@/lib/urlUtils";
import { AlbumDetailClient } from "@/components/AlbumDetailClient";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { generateAlbumMetadata } from "@/lib/opengraph";
import { Lock } from "lucide-react";
import {
  HydrationBoundary,
  dehydrate,
  QueryClient,
} from "@tanstack/react-query";
import { mediaApi } from "@/lib/api";

type AlbumDetailPageProps = {
  params: Promise<{
    locale: string;
    albumId: string;
  }>;
};

// Force dynamic rendering - no static generation
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: AlbumDetailPageProps): Promise<Metadata> {
  const { locale, albumId } = await params;
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
  const { albumId, locale } = await params;
  const albumResult = await getAlbumById(albumId);

  if (albumResult.error) {
    if (albumResult.error === "Content is private") {
      const tCommon = await getTranslations({
        locale,
        namespace: "common",
      });

      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Lock className="h-7 w-7 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-semibold">
              {tCommon("errors.contentPrivate")}
            </h1>
            <p className="text-muted-foreground">
              {tCommon("errors.contentPrivateDescription")}
            </p>
          </div>
        </div>
      );
    }

    notFound();
  }

  if (!albumResult.data) {
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
