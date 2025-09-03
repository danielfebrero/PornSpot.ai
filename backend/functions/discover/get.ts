/*
File objective: Aggregate and return diversified public content with time-weighted popularity:
- Recent content with popularity scoring
- Time decay for older content (popular content doesn't stay forever)
- Non-deterministic randomization for variety
Auth: Public endpoint; supports anonymous and authenticated users.
Special notes:
- Returns 2 main cursors for pagination (albums and media)
- Applies content diversification to avoid too much content from same user
- Returns only public content
- Mixes content types with time-weighted popularity scoring
- Adds randomization to prevent deterministic results
*/

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { PaginationUtil } from "@shared/utils/pagination";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { UserAuthUtil } from "@shared/utils/user-auth";
import { Album, DynamoDBService, Media } from "@shared";
import {
  DynamoDBDiscoverService,
  ContentDiversificationUtil,
} from "@shared/utils/dynamodb-discover";

interface DiscoverCursors {
  albums?: string | null;
  media?: string | null;
}

interface DiscoverContent {
  items: (Album | Media)[];
  cursors: DiscoverCursors;
  metadata: {
    totalItems: number;
    albumCount: number;
    mediaCount: number;
    diversificationApplied: boolean;
    timeWindow: string;
  };
}

/**
 * Calculate time-weighted popularity score
 * Newer content gets a boost, older content gets penalized
 * @param item Album or Media item
 * @param maxAgeInDays Maximum age to consider (older items get minimal score)
 * @returns Weighted popularity score
 */
function calculateTimeWeightedPopularity(
  item: Album | Media,
  maxAgeInDays: number = 30
): number {
  const now = Date.now();
  const createdAt = new Date(item.createdAt).getTime();
  const ageInMs = now - createdAt;
  const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
  const basePopularity = item.popularity || 0;

  // Calculate time decay factor (1.0 for new content, approaching 0 for old content)
  const timeFactor = Math.max(0, 1 - ageInDays / maxAgeInDays);

  // For very recent content (< 1 day), give extra boost
  const recencyBoost =
    ageInDays < 1 ? 2.0 : ageInDays < 3 ? 1.5 : ageInDays < 7 ? 1.2 : 1.0;

  // Calculate final score with time weighting
  return basePopularity * timeFactor * recencyBoost;
}

/**
 * Get time window parameters based on pagination depth
 * As users scroll, we fetch slightly older content
 */
function getTimeWindow(cursorDepth: number): {
  maxAgeInDays: number;
  windowStartDays: number;
  windowEndDays: number;
} {
  // Each "page" represents roughly 3-7 days of content
  const daysPerPage = 1;
  const windowStartDays = cursorDepth * daysPerPage;
  const windowEndDays = windowStartDays + daysPerPage * 2; // Overlap for better mixing

  return {
    maxAgeInDays: Math.max(30, windowEndDays), // At least 30 days for scoring
    windowStartDays,
    windowEndDays,
  };
}

/**
 * Parse cursor parameters from query string
 */
function parseDiscoverCursors(
  queryParams: { [key: string]: string | undefined } | null
): {
  albums?: Record<string, any>;
  media?: Record<string, any>;
  cursorDepth: number;
} {
  const params = queryParams || {};
  const cursors: any = {};
  let cursorDepth = 0;

  // Parse album cursor
  if (params["cursorAlbums"]) {
    try {
      cursors.albums = PaginationUtil.decodeCursor(params["cursorAlbums"]);
      // Extract depth from cursor if available
      if (cursors.albums?.depth) {
        cursorDepth = Math.max(cursorDepth, cursors.albums.depth);
        delete cursors.albums.depth;
      }
    } catch (error) {
      console.warn("Invalid cursorAlbums:", error);
    }
  }

  // Parse media cursor
  if (params["cursorMedia"]) {
    try {
      cursors.media = PaginationUtil.decodeCursor(params["cursorMedia"]);
      if (cursors.media?.depth) {
        cursorDepth = Math.max(cursorDepth, cursors.media.depth);
        delete cursors.media.depth;
      }
    } catch (error) {
      console.warn("Invalid cursorMedia:", error);
    }
  }

  // Parse explicit depth parameter if provided
  if (params["depth"]) {
    cursorDepth = parseInt(params["depth"]) || 0;
  }

  return { ...cursors, cursorDepth };
}

const handleGetDiscover = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Extract user authentication with anonymous access allowed
  const authResult = await UserAuthUtil.allowAnonymous(event);

  // Handle error response from authentication (should not happen with allowAnonymous)
  if (UserAuthUtil.isErrorResponse(authResult)) {
    return authResult;
  }

  const currentUserId = authResult.userId; // Can be null for anonymous users

  if (currentUserId) {
    console.log("✅ Authenticated user:", currentUserId);
  } else {
    console.log("ℹ️ Anonymous user - proceeding with public content only");
  }

  // Parse query parameters
  const queryParams = event.queryStringParameters;
  const limit = Math.min(parseInt(queryParams?.["limit"] || "20"), 100);
  const tag = queryParams?.["tag"]; // Tag parameter for filtering
  const sort = queryParams?.["sort"]; // Sort parameter: "popular" or undefined for default

  // Parse cursors and determine pagination depth
  const {
    albums: albumsCursor,
    media: mediaCursor,
    cursorDepth,
  } = parseDiscoverCursors(queryParams);

  // Get time window based on pagination depth
  const timeWindow = getTimeWindow(cursorDepth);

  // Diversification parameters
  const maxPerUser = parseInt(queryParams?.["maxPerUser"] || "2");

  // Always add randomization for non-deterministic results
  const shuffleContent = true;

  // Add random seed to ensure different results on each request
  const randomSeed = Math.random();

  console.log("[Discover API] Request params:", {
    limit,
    maxPerUser,
    cursorDepth,
    timeWindow,
    randomSeed,
    tag, // Log the tag parameter
    sort, // Log the sort parameter
    hasCursors: {
      albums: !!albumsCursor,
      media: !!mediaCursor,
    },
  });

  // Handle sort=popular - use popularity-based queries instead of time-based
  if (sort === "popular") {
    console.log("[Discover API] Popular sorting requested");

    // For popular sorting, we want the most popular content without diversification
    // Fetch exactly what we need
    const [albumsResult, mediaResult] = await Promise.all([
      DynamoDBDiscoverService.queryPopularAlbumsViaGSI6(
        limit,
        albumsCursor,
        tag
      ),
      DynamoDBDiscoverService.queryPopularMediaViaGSI6(limit, mediaCursor, tag),
    ]);

    console.log("[Discover API] Popular results:", {
      albums: albumsResult.albums.length,
      media: mediaResult.media.length,
      tag: tag || "none",
    });

    // Add content preview for albums
    const albumsWithPreview = await Promise.all(
      albumsResult.albums.map(async (album) => ({
        ...album,
        contentPreview:
          (await DynamoDBService.getContentPreviewForAlbum(album.id)) || null,
      }))
    );

    // Combine albums and media, then sort by popularity score
    const combinedItems: (Album | Media)[] = [
      ...albumsWithPreview,
      ...mediaResult.media,
    ];

    // Sort by popularity score in descending order (highest popularity first)
    const sortedItems = combinedItems.sort((a, b) => {
      const aPopularity = a.popularity || 0;
      const bPopularity = b.popularity || 0;
      return bPopularity - aPopularity;
    });

    // Take only the requested limit
    const items = sortedItems.slice(0, limit);

    // Count types in final output
    const albumCount = albumsWithPreview.length;
    const mediaCount = mediaResult.media.length;

    // Build response for popular sorting
    const popularResponse: DiscoverContent = {
      items,
      cursors: {
        albums: PaginationUtil.encodeCursor(albumsResult.lastEvaluatedKey),
        media: PaginationUtil.encodeCursor(mediaResult.lastEvaluatedKey),
      },
      metadata: {
        totalItems: items.length,
        albumCount,
        mediaCount,
        diversificationApplied: false, // No diversification for popular sorting
        timeWindow: "popular",
      },
    };

    console.log("[Discover API] Popular response:", {
      totalItems: popularResponse.metadata.totalItems,
      albumCount: popularResponse.metadata.albumCount,
      mediaCount: popularResponse.metadata.mediaCount,
      sort: "popular",
      tag: tag || "none",
    });

    return ResponseUtil.success(event, popularResponse);
  }

  // Special handling for tag-based discovery
  if (tag) {
    console.log(`[Discover API] Tag-based discovery for tag: "${tag}"`);

    // For tag-based discovery, only return albums with the specified tag
    // Use DynamoDBService.listAlbumsByTag with isPublic=true for public content
    const tagBasedResult = await DynamoDBService.listAlbumsByTag(
      tag,
      limit,
      albumsCursor,
      true // Only public albums
    );

    // Add content preview for each album
    const albumsWithPreview = await Promise.all(
      tagBasedResult.albums.map(async (album) => ({
        ...album,
        contentPreview:
          (await DynamoDBService.getContentPreviewForAlbum(album.id)) || null,
      }))
    );

    // Build response for tag-based discovery
    const tagResponse: DiscoverContent = {
      items: albumsWithPreview,
      cursors: {
        albums: PaginationUtil.encodeCursor(tagBasedResult.lastEvaluatedKey),
        media: null, // No media cursor for tag-based discovery
      },
      metadata: {
        totalItems: albumsWithPreview.length,
        albumCount: albumsWithPreview.length,
        mediaCount: 0,
        diversificationApplied: false,
        timeWindow: `tag:${tag}`,
      },
    };

    console.log("[Discover API] Tag-based response:", {
      tag,
      totalItems: tagResponse.metadata.totalItems,
      albumCount: tagResponse.metadata.albumCount,
    });

    return ResponseUtil.success(event, tagResponse);
  }

  // Fetch larger batches to account for filtering and diversification
  const fetchLimit = limit * 3; // Fetch 3x to ensure enough content after filtering

  // Fetch recent content (we'll apply popularity scoring after)
  const [albumsResult, mediaResult] = await Promise.all([
    // Fetch recent public albums
    DynamoDBDiscoverService.queryPublicAlbumsViaGSI5(fetchLimit, albumsCursor),
    // Fetch recent public media
    DynamoDBDiscoverService.queryPublicMediaViaGSI5(fetchLimit, mediaCursor),
  ]);

  console.log("[Discover API] Raw results:", {
    albums: albumsResult.albums.length,
    media: mediaResult.media.length,
    albumsExhausted: albumsResult.albums.length === 0 && !!albumsCursor,
  });

  // Check if albums are exhausted (no more albums but we had a cursor)
  const albumsExhausted = albumsResult.albums.length === 0 && !!albumsCursor;
  let recycledAlbumsResult = null;

  // If albums are exhausted and we have very few albums, fetch from the beginning (recycle)
  if (albumsExhausted) {
    console.log("[Discover API] Albums exhausted, recycling from beginning");
    recycledAlbumsResult =
      await DynamoDBDiscoverService.queryPublicAlbumsViaGSI5(
        fetchLimit,
        undefined // No cursor to start from beginning
      );
    console.log(
      "[Discover API] Recycled albums:",
      recycledAlbumsResult.albums.length
    );
  }

  // If we still don't have enough content diversity, fetch additional media
  const totalAlbumCount =
    albumsResult.albums.length + (recycledAlbumsResult?.albums.length || 0);
  let additionalMediaResult = null;

  if (totalAlbumCount < limit * 0.2 && mediaResult.lastEvaluatedKey) {
    // We have less than 20% albums of the target limit, fetch more media
    console.log(
      "[Discover API] Insufficient albums, fetching additional media"
    );
    additionalMediaResult =
      await DynamoDBDiscoverService.queryPublicMediaViaGSI5(
        fetchLimit * 2, // Fetch even more media
        mediaResult.lastEvaluatedKey
      );
    console.log(
      "[Discover API] Additional media fetched:",
      additionalMediaResult.media.length
    );
  }

  // Combine all results
  const allAlbums = [
    ...albumsResult.albums,
    ...(recycledAlbumsResult?.albums || []),
  ];

  const allMedia = [
    ...mediaResult.media,
    ...(additionalMediaResult?.media || []),
  ];

  console.log("[Discover API] Combined results:", {
    albums: allAlbums.length,
    media: allMedia.length,
  });

  // Filter by time window and calculate time-weighted popularity
  const now = Date.now();
  const windowStartMs = now - timeWindow.windowEndDays * 24 * 60 * 60 * 1000;
  const windowEndMs = now - timeWindow.windowStartDays * 24 * 60 * 60 * 1000;

  // Filter and score albums (including recycled ones if any)
  const scoredAlbums = allAlbums
    .filter((album) => {
      const createdAt = new Date(album.createdAt).getTime();
      // For recycled albums, be more lenient with time window
      if (recycledAlbumsResult?.albums.includes(album)) {
        return true; // Include all recycled albums regardless of age
      }
      return createdAt >= windowStartMs && createdAt <= windowEndMs;
    })
    .map((album) => ({
      item: album,
      score: calculateTimeWeightedPopularity(album, timeWindow.maxAgeInDays),
      random: Math.random(), // Add random factor for shuffling
      isRecycled: recycledAlbumsResult?.albums.includes(album) || false,
    }));

  // Filter and score media (including additional media if any)
  const scoredMedia = allMedia
    .filter((media) => {
      const createdAt = new Date(media.createdAt).getTime();
      // For additional media fetched due to album shortage, be more lenient
      if (additionalMediaResult?.media.includes(media)) {
        return true; // Include all additional media
      }
      return createdAt >= windowStartMs && createdAt <= windowEndMs;
    })
    .map((media) => ({
      item: media,
      score: calculateTimeWeightedPopularity(media, timeWindow.maxAgeInDays),
      random: Math.random(),
      isAdditional: additionalMediaResult?.media.includes(media) || false,
    }));

  console.log("[Discover API] After time window filtering:", {
    albums: scoredAlbums.length,
    media: scoredMedia.length,
    timeWindow: `${timeWindow.windowStartDays}-${timeWindow.windowEndDays} days`,
  });

  // Sort by score with randomization
  // Mix score-based sorting with randomness to avoid being too deterministic
  const sortWithRandomness = <T extends { score: number; random: number }>(
    items: T[]
  ): T[] => {
    return items.sort((a, b) => {
      // 70% weight on score, 30% weight on randomness
      const scoreWeight = 0.7;
      const randomWeight = 0.3;

      const aValue = a.score * scoreWeight + a.random * 1000 * randomWeight;
      const bValue = b.score * scoreWeight + b.random * 1000 * randomWeight;

      return bValue - aValue; // Descending order
    });
  };

  const sortedAlbums = sortWithRandomness(scoredAlbums);
  const sortedMedia = sortWithRandomness(scoredMedia);

  // Extract just the items (remove scores)
  let albums = sortedAlbums.map((s) => s.item);
  let media = sortedMedia.map((s) => s.item);

  // Apply user diversification
  albums = ContentDiversificationUtil.diversifyByUser(albums, maxPerUser);
  media = ContentDiversificationUtil.diversifyByUser(media, maxPerUser);

  console.log("[Discover API] After diversification:", {
    albums: albums.length,
    media: media.length,
  });

  // Dynamic ratio based on available content
  // If albums are scarce, adjust ratio to favor media
  const availableAlbumRatio = Math.min(0.4, albums.length / limit);
  const targetAlbumCount = Math.floor(limit * availableAlbumRatio);
  const targetMediaCount = limit - targetAlbumCount;

  console.log("[Discover API] Dynamic content ratio:", {
    availableAlbums: albums.length,
    availableMedia: media.length,
    targetAlbumCount,
    targetMediaCount,
    albumRatio: ((targetAlbumCount / limit) * 100).toFixed(1) + "%",
    mediaRatio: ((targetMediaCount / limit) * 100).toFixed(1) + "%",
  });

  // Take only what we need
  const preFinalAlbums = albums.slice(0, targetAlbumCount).map(async (a) => ({
    ...a,
    contentPreview:
      (await DynamoDBService.getContentPreviewForAlbum(a.id)) || null,
  }));
  const finalAlbums = await Promise.all(preFinalAlbums);
  const finalMedia = media.slice(0, targetMediaCount);

  // Interleave albums and media for better content mix
  const items: (Album | Media)[] = [];
  let albumIndex = 0;
  let mediaIndex = 0;

  // Alternate between albums and media, with slight preference for media
  while (
    (albumIndex < finalAlbums.length || mediaIndex < finalMedia.length) &&
    items.length < limit
  ) {
    // Add 2 media for every 1 album (roughly)
    if (mediaIndex < finalMedia.length) {
      const mediaItem = finalMedia[mediaIndex];
      if (mediaItem) {
        items.push(mediaItem);
        mediaIndex++;
      }
    }
    if (mediaIndex < finalMedia.length && items.length < limit) {
      const mediaItem = finalMedia[mediaIndex];
      if (mediaItem) {
        items.push(mediaItem);
        mediaIndex++;
      }
    }
    if (albumIndex < finalAlbums.length && items.length < limit) {
      const albumItem = finalAlbums[albumIndex];
      if (albumItem) {
        items.push(albumItem);
        albumIndex++;
      }
    }
  }

  // Apply final shuffle with soft randomization
  const finalItems = shuffleContent
    ? ContentDiversificationUtil.softRandomize(items, 10)
    : items;

  // Count types in final output
  const albumCount = finalItems.filter((item) => "mediaCount" in item).length;
  const mediaCount = finalItems.filter(
    (item) => "url" in item && !("mediaCount" in item)
  ).length;

  // Prepare cursors for next page with depth information
  const nextDepth = cursorDepth + 1;

  // For albums cursor: if we recycled, use the recycled cursor; if exhausted, reset to null
  let albumsCursorWithDepth;
  if (recycledAlbumsResult) {
    // We recycled albums, use the recycled cursor for next page
    albumsCursorWithDepth = recycledAlbumsResult.lastEvaluatedKey
      ? {
          ...recycledAlbumsResult.lastEvaluatedKey,
          depth: 1,
        }
      : undefined;
  } else if (albumsResult.lastEvaluatedKey) {
    // Normal case, use the regular cursor
    albumsCursorWithDepth = {
      ...albumsResult.lastEvaluatedKey,
      depth: nextDepth,
    };
  } else {
    // No more albums and not recycled yet
    albumsCursorWithDepth = undefined;
  }

  // For media cursor: use additional media cursor if available, otherwise regular
  let mediaCursorWithDepth;
  if (additionalMediaResult?.lastEvaluatedKey) {
    mediaCursorWithDepth = {
      ...additionalMediaResult.lastEvaluatedKey,
      depth: nextDepth,
    };
  } else if (mediaResult.lastEvaluatedKey) {
    mediaCursorWithDepth = {
      ...mediaResult.lastEvaluatedKey,
      depth: nextDepth,
    };
  } else {
    mediaCursorWithDepth = undefined;
  }

  // Build response
  const response: DiscoverContent = {
    items: finalItems,
    cursors: {
      albums: PaginationUtil.encodeCursor(albumsCursorWithDepth),
      media: PaginationUtil.encodeCursor(mediaCursorWithDepth),
    },
    metadata: {
      totalItems: finalItems.length,
      albumCount,
      mediaCount,
      diversificationApplied: true,
      timeWindow: `${timeWindow.windowStartDays}-${timeWindow.windowEndDays} days ago`,
    },
  };

  console.log("[Discover API] Final response:", {
    totalItems: response.metadata.totalItems,
    albumCount: response.metadata.albumCount,
    mediaCount: response.metadata.mediaCount,
    timeWindow: response.metadata.timeWindow,
    nextDepth,
    albumsRecycled: !!recycledAlbumsResult,
    additionalMediaFetched: !!additionalMediaResult,
  });

  return ResponseUtil.success(event, response);
};

export const handler = LambdaHandlerUtil.withoutAuth(handleGetDiscover);
