"use client";

import { useRouter } from "next/navigation";
import {
  Share2,
  ArrowLeft,
  MessageCircle,
  Calendar,
  Download,
  Loader2,
  Heart,
  Bookmark,
  Eye,
  User,
} from "lucide-react";
import { Album } from "@/types";
import { Tag } from "@/components/ui/Tag";
import { ShareDropdown } from "@/components/ui/ShareDropdown";
import { Tooltip } from "@/components/ui/Tooltip";
import { ViewTracker } from "@/components/ui/ViewTracker";
import { MediaGallery } from "@/components/MediaGallery";
import { Comments } from "@/components/ui/Comments";
import LocaleLink from "@/components/ui/LocaleLink";
import {
  SectionErrorBoundary,
  MediaGalleryErrorBoundary,
  CommentsErrorBoundary,
} from "./ErrorBoundaries";
import { useUserContext } from "@/contexts/UserContext";
import { useTranslations } from "next-intl";
import { LikeButton } from "@/components/user/LikeButton";
import { BookmarkButton } from "@/components/user/BookmarkButton";
import { useDownloadAlbumZip } from "@/hooks/queries/useAlbumsQuery";
import { useCallback } from "react";
import Avatar from "./ui/Avatar";
import { useGetMinimalUser } from "@/hooks/queries/useUserQuery";
import { useDateUtils } from "@/hooks/useDateUtils";

interface AlbumDetailClientProps {
  album: Album;
}

export function AlbumDetailClient({ album }: AlbumDetailClientProps) {
  const router = useRouter();
  const { user } = useUserContext();
  const t = useTranslations("albumDetail");
  const downloadAlbumZip = useDownloadAlbumZip();
  const { data: albumCreator } = useGetMinimalUser({
    username: (album.metadata?.creatorUsername as string) || "",
  });
  const { formatRelativeTime } = useDateUtils();

  const handleDownloadAlbum = useCallback(async () => {
    try {
      await downloadAlbumZip.mutateAsync(album.id);
    } catch (error) {
      console.error("Failed to download album:", error);
    }
  }, [album.id, downloadAlbumZip]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ViewTracker
        targetType="album"
        targetId={album.id}
        initialViewCount={album.viewCount}
      />

      {/* Non-Sticky Header - Scrolls with content */}
      <header className="bg-background border-b border-border/40">
        <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
          {/* Back Button + Share */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("goBack")}
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:inline">Back</span>
            </button>

            <ShareDropdown
              trigger={({ toggle }: { toggle: () => void }) => (
                <button
                  onClick={toggle}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors"
                  aria-label={t("share")}
                >
                  <Share2 className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">
                    Share
                  </span>
                </button>
              )}
            >
              {({ close }: { close: () => void }) => (
                <>
                  <button
                    className="flex items-center w-full px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      close();
                    }}
                  >
                    {t("copyLink")}
                  </button>
                  <a
                    className="flex items-center w-full px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                    href={`https://www.reddit.com/submit?url=${encodeURIComponent(
                      window.location.href
                    )}&title=${encodeURIComponent(album.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={close}
                  >
                    Share to Reddit
                  </a>
                  <a
                    className="flex items-center w-full px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                    href={`https://x.com/intent/tweet?url=${encodeURIComponent(
                      window.location.href
                    )}&text=${encodeURIComponent(album.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={close}
                  >
                    Share to X
                  </a>
                </>
              )}
            </ShareDropdown>
          </div>

          {/* Album Title */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 break-words">
            {album.title}
          </h1>

          {/* Creator & Metadata */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm text-muted-foreground mb-4">
            {album.metadata?.creatorUsername && (
              <LocaleLink
                href={`/profile/${album.metadata.creatorUsername}`}
                className="flex items-center gap-2 hover:text-foreground transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
                  {albumCreator ? (
                    <Avatar user={albumCreator} size="small" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                <span className="font-medium break-all">
                  {String(album.metadata.creatorUsername)}
                </span>
              </LocaleLink>
            )}

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <time dateTime={album.createdAt} className="font-medium">
                {formatRelativeTime(album.createdAt)}
              </time>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 sm:gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              <span>{album.viewCount || 0} views</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="w-4 h-4" />
              <span>{album.likeCount || 0} likes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bookmark className="w-4 h-4" />
              <span>
                {album.mediaCount}{" "}
                {album.mediaCount === 1 ? t("item") : t("items")}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Action Bar - Only buttons are sticky */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-lg border-b border-border/40 shadow-sm">
        <div className="container mx-auto px-4 md:px-6 py-3">
          <div className="flex items-center gap-2 justify-end">
            {/* Like Button */}
            <LikeButton
              targetType="album"
              targetId={album.id}
              showCount={true}
              size="md"
              className="px-4 py-2 rounded-lg hover:bg-muted/60 transition-all"
            />

            {/* Bookmark Button */}
            <BookmarkButton
              targetType="album"
              targetId={album.id}
              size="md"
              className="px-4 py-2 rounded-lg hover:bg-muted/60 transition-all"
            />

            {/* Download Button */}
            <Tooltip content={t("downloadAlbum")} side="bottom">
              <button
                onClick={handleDownloadAlbum}
                disabled={downloadAlbumZip.isPending}
                className="px-4 py-2 rounded-lg hover:bg-muted/60 transition-all disabled:opacity-50 flex items-center gap-2"
                aria-label={t("downloadAlbum")}
              >
                {downloadAlbumZip.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="hidden sm:inline text-sm font-medium">
                  Download
                </span>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 md:p-6 lg:p-8">
        <div className="space-y-4">
          {album.tags && album.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {album.tags.map((tag, index) => (
                <LocaleLink
                  key={index}
                  href={`/?tag=${encodeURIComponent(tag)}`}
                >
                  <Tag
                    size="md"
                    className="hover:scale-105 transition-transform cursor-pointer bg-black/20 text-gray-500 border-gray-300/60 backdrop-blur-sm hover:bg-black/30 hover:text-gray-600 hover:border-gray-400/70"
                  >
                    {tag}
                  </Tag>
                </LocaleLink>
              ))}
            </div>
          )}

          <MediaGalleryErrorBoundary>
            <MediaGallery
              albumId={album.id}
              canRemoveFromAlbum={
                !!(album.createdBy && album.createdBy === user?.userId)
              }
              scrollRestorationKey="album-media-gallery"
            />
          </MediaGalleryErrorBoundary>

          {/* Comments Section */}
          <SectionErrorBoundary context="Album Comments">
            <div className="max-w-4xl mx-auto mt-8">
              <div className="bg-card rounded-lg border border-border/20 p-4 md:p-6">
                <div className="flex items-center gap-3 mb-6">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">
                    {t("comments")}
                  </h2>
                </div>
                <CommentsErrorBoundary>
                  <Comments
                    targetType="album"
                    targetId={album.id}
                    initialComments={album.comments}
                    currentUserId={user?.userId}
                  />
                </CommentsErrorBoundary>
              </div>
            </div>
          </SectionErrorBoundary>
        </div>
      </main>
    </div>
  );
}
