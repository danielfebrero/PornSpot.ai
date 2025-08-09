"use client";

import { useRouter } from "next/navigation";
import { Share2, ArrowLeft, MessageCircle, User, Calendar } from "lucide-react";
import { Album } from "@/types";
import { Tag } from "@/components/ui/Tag";
import { ShareDropdown } from "@/components/ui/ShareDropdown";
import { Tooltip } from "@/components/ui/Tooltip";
import { ViewTracker } from "@/components/ui/ViewTracker";
import { MediaGallery } from "@/components/MediaGallery";
import { Comments } from "@/components/ui/Comments";
import { useUserProfile } from "@/hooks/queries/useUserQuery";
import LocaleLink from "@/components/ui/LocaleLink";
import { formatDistanceToNow } from "@/lib/dateUtils";
import {
  SectionErrorBoundary,
  MediaGalleryErrorBoundary,
  CommentsErrorBoundary,
} from "./ErrorBoundaries";

interface AlbumDetailClientProps {
  album: Album;
}

export function AlbumDetailClient({ album }: AlbumDetailClientProps) {
  const router = useRouter();
  const { data: userResponse } = useUserProfile();

  // Extract user from the API response structure
  const user = userResponse?.data?.user;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ViewTracker targetType="album" targetId={album.id} />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-sm border-border">
        <div className="flex items-center h-16 gap-4 md:px-4">
          <Tooltip content="Go Back" side="bottom">
            <button
              onClick={() => router.back()}
              className="p-2 transition-colors rounded-full hover:bg-muted"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Tooltip>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{album.title}</h1>
            {/* Album Metadata in Header */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
              {/* Creation Date */}
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDistanceToNow(album.createdAt)}</span>
              </div>

              {/* Creator Username */}
              {album.metadata?.creatorUsername && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <LocaleLink
                    href={`/profile/${album.metadata.creatorUsername}`}
                    className="hover:text-foreground transition-colors hover:underline"
                  >
                    {String(album.metadata.creatorUsername)}
                  </LocaleLink>
                </div>
              )}

              {/* Media Count */}
              <div className="flex items-center gap-1">
                <span>{album.mediaCount}</span>
                <span>{album.mediaCount === 1 ? "item" : "items"}</span>
              </div>
            </div>
          </div>
          <ShareDropdown
            trigger={({ toggle }: { toggle: () => void }) => (
              <Tooltip content="Share" side="bottom">
                <button
                  onClick={toggle}
                  className="p-2 transition-colors rounded-full hover:bg-muted"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </Tooltip>
            )}
          >
            {({ close }: { close: () => void }) => (
              <>
                <button
                  className="flex items-center w-full px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    close();
                  }}
                >
                  Copy link
                </button>
                <a
                  className="flex items-center w-full px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                  href={`https://www.reddit.com/submit?url=${encodeURIComponent(
                    window.location.href
                  )}&title=${encodeURIComponent(album.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                >
                  Reddit
                </a>
                <a
                  className="flex items-center w-full px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                  href={`https://x.com/intent/tweet?url=${encodeURIComponent(
                    window.location.href
                  )}&text=${encodeURIComponent(album.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                >
                  X (Twitter)
                </a>
              </>
            )}
          </ShareDropdown>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto md:p-6 lg:p-8">
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
            />
          </MediaGalleryErrorBoundary>

          {/* Comments Section */}
          <SectionErrorBoundary context="Album Comments">
            <div className="max-w-4xl mx-auto mt-8">
              <div className="bg-card rounded-lg border border-border/20 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Comments
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
