import type {
  AlbumEntity,
  MediaEntity,
  UserEntity,
  CommentEntity,
} from "@shared";

export type MaybeUser =
  | (Pick<UserEntity, "username" | "firstName" | "email"> & {
      username?: string | null;
      firstName?: string | null;
      email?: string | null;
    })
  | null
  | undefined;

export type MaybeAlbum =
  | (Pick<AlbumEntity, "title" | "thumbnailUrls" | "coverImageUrl"> & {
      title?: string | null;
    })
  | null
  | undefined;

export type MaybeMedia =
  | (Pick<
      MediaEntity,
      | "metadata"
      | "originalFilename"
      | "filename"
      | "thumbnailUrls"
      | "thumbnailUrl"
      | "url"
      | "type"
    > & {
      metadata?: MediaEntity["metadata"] | null;
    })
  | null
  | undefined;

export type MaybeComment =
  | (Pick<CommentEntity, "content" | "targetType" | "targetId"> & {
      content?: string | null;
    })
  | null
  | undefined;

export const getUserDisplayName = (user?: MaybeUser): string => {
  return (
    user?.username?.trim() ||
    user?.firstName?.trim() ||
    user?.email?.trim() ||
    "Someone"
  );
};

export const getAlbumThumbnailUrl = (
  album?: MaybeAlbum
): string | undefined => {
  return (
    album?.thumbnailUrls?.medium?.trim() ||
    album?.thumbnailUrls?.large?.trim() ||
    album?.thumbnailUrls?.small?.trim() ||
    album?.coverImageUrl?.trim() ||
    undefined
  );
};

export const getMediaThumbnailUrl = (
  media?: MaybeMedia
): string | undefined => {
  return (
    media?.thumbnailUrls?.medium?.trim() ||
    media?.thumbnailUrls?.large?.trim() ||
    media?.thumbnailUrls?.small?.trim() ||
    media?.thumbnailUrl?.trim() ||
    media?.url?.trim() ||
    undefined
  );
};

export const getMediaTitle = (media?: MaybeMedia): string | undefined => {
  const metadataTitle =
    typeof media?.metadata === "object" && media?.metadata !== null
      ? (media.metadata as Record<string, unknown>)["title"]
      : undefined;

  const normalizedMetadataTitle =
    typeof metadataTitle === "string" && metadataTitle.trim().length > 0
      ? metadataTitle.trim()
      : undefined;

  const originalFilename =
    typeof media?.originalFilename === "string" &&
    media.originalFilename.trim().length > 0
      ? media.originalFilename.trim()
      : undefined;

  const filename =
    typeof media?.filename === "string" && media.filename.trim().length > 0
      ? media.filename.trim()
      : undefined;

  return normalizedMetadataTitle || originalFilename || filename || undefined;
};

export const getCommentSnippet = (
  comment?: MaybeComment,
  max: number = 200
): string | undefined => {
  if (!comment?.content) {
    return undefined;
  }

  const trimmed = comment.content.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }

  return `${trimmed.slice(0, max - 1)}…`;
};
