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
import { FollowingFeedService } from "@shared/utils/dynamodb-following-feed";

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

interface TimeWindowConfig {
  maxAgeInDays: number;
  windowStartDays: number;
  windowEndDays: number;
}

interface ScoreContentResult {
  albums: Array<{ item: Album; combinedScore: number }>;
  media: Array<{ item: Media; combinedScore: number }>;
}

interface ScoreContentArgs {
  albums: Album[];
  media: Media[];
  timeWindow: TimeWindowConfig | null;
  now: number;
  randomSeed: number;
  scoreWeight: number;
  randomScale: number;
  videoScoreBoostMultiplier: number;
  recycledAlbumIdSet?: Set<string> | null;
  additionalMediaIdSet?: Set<string> | null;
  defaultMaxAgeInDays: number;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_DIVERSIFICATION_RELAXATION = 5;

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

function createSeededRandom(seed: number): () => number {
  let state = Math.floor((seed % 1) * 2147483646) + 1;

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/**
 * Get time window parameters based on pagination depth
 * As users scroll, we fetch slightly older content
 */
function getTimeWindow(cursorDepth: number): TimeWindowConfig {
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

function scoreContentWithinWindow({
  albums,
  media,
  timeWindow,
  now,
  randomSeed,
  scoreWeight,
  randomScale,
  videoScoreBoostMultiplier,
  recycledAlbumIdSet,
  additionalMediaIdSet,
  defaultMaxAgeInDays,
}: ScoreContentArgs): ScoreContentResult {
  const seededRandom = createSeededRandom(randomSeed);
  const windowStartMs = timeWindow
    ? now - timeWindow.windowEndDays * DAY_IN_MS
    : undefined;
  const windowEndMs = timeWindow
    ? now - timeWindow.windowStartDays * DAY_IN_MS
    : undefined;
  const maxAgeInDays = timeWindow?.maxAgeInDays ?? defaultMaxAgeInDays;

  const scoredAlbums: Array<{ item: Album; combinedScore: number }> = [];
  for (const album of albums) {
    const createdAt = new Date(album.createdAt).getTime();
    const isRecycled = recycledAlbumIdSet?.has(album.id) ?? false;

    if (
      timeWindow &&
      !isRecycled &&
      windowStartMs !== undefined &&
      windowEndMs !== undefined &&
      (createdAt < windowStartMs || createdAt > windowEndMs)
    ) {
      continue;
    }

    const baseScore = calculateTimeWeightedPopularity(album, maxAgeInDays);
    const combinedScore =
      baseScore * scoreWeight + seededRandom() * randomScale;

    scoredAlbums.push({
      item: album,
      combinedScore,
    });
  }

  const scoredMedia: Array<{ item: Media; combinedScore: number }> = [];
  for (const mediaItem of media) {
    const createdAt = new Date(mediaItem.createdAt).getTime();
    const isAdditional = additionalMediaIdSet?.has(mediaItem.id) ?? false;

    if (
      timeWindow &&
      !isAdditional &&
      windowStartMs !== undefined &&
      windowEndMs !== undefined &&
      (createdAt < windowStartMs || createdAt > windowEndMs)
    ) {
      continue;
    }

    const baseScore =
      calculateTimeWeightedPopularity(mediaItem, maxAgeInDays) *
      (mediaItem.type === "video" ? videoScoreBoostMultiplier : 1);
    const combinedScore =
      baseScore * scoreWeight + seededRandom() * randomScale;

    scoredMedia.push({
      item: mediaItem,
      combinedScore,
    });
  }

  return { albums: scoredAlbums, media: scoredMedia };
}

function formatTimeWindowLabel(
  timeWindow: TimeWindowConfig | null,
  fallbackApplied: boolean
): string {
  if (!timeWindow) {
    return fallbackApplied ? "all-time (fallback)" : "all-time";
  }

  const baseLabel = `${timeWindow.windowStartDays}-${timeWindow.windowEndDays} days ago`;
  return fallbackApplied ? `${baseLabel} (fallback)` : baseLabel;
}

function calculateMinimumResultsForAttempt(
  limit: number,
  attemptIndex: number
): number {
  if (attemptIndex === 0) {
    return limit;
  }

  if (attemptIndex === 1) {
    return Math.max(1, Math.ceil(limit * 0.8));
  }

  if (attemptIndex === 2) {
    return Math.max(1, Math.ceil(limit * 0.6));
  }

  return Math.max(1, Math.ceil(limit * 0.4));
}

function diversifyCollectionsWithRelaxation(
  albums: Album[],
  media: Media[],
  baseMaxPerUser: number,
  maxRelaxation: number,
  minCombinedTarget: number
): {
  albums: Album[];
  media: Media[];
  appliedMaxPerUser: number;
  combinedCount: number;
} {
  let appliedMaxPerUser = Math.max(1, baseMaxPerUser);
  let diversifiedAlbums = ContentDiversificationUtil.diversifyByUser(
    albums,
    appliedMaxPerUser
  );
  let diversifiedMedia = ContentDiversificationUtil.diversifyByUser(
    media,
    appliedMaxPerUser
  );

  let combinedCount = diversifiedAlbums.length + diversifiedMedia.length;

  while (
    combinedCount < minCombinedTarget &&
    appliedMaxPerUser < Math.max(1, baseMaxPerUser) + maxRelaxation
  ) {
    appliedMaxPerUser += 1;
    diversifiedAlbums = ContentDiversificationUtil.diversifyByUser(
      albums,
      appliedMaxPerUser
    );
    diversifiedMedia = ContentDiversificationUtil.diversifyByUser(
      media,
      appliedMaxPerUser
    );
    combinedCount = diversifiedAlbums.length + diversifiedMedia.length;
  }

  return {
    albums: diversifiedAlbums,
    media: diversifiedMedia,
    appliedMaxPerUser,
    combinedCount,
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
  const SCORE_WEIGHT = 0.7;
  const RANDOM_WEIGHT = 0.3;
  const RANDOM_SCALE = RANDOM_WEIGHT * 1000;

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

  // Handle sort=following - use following feed aggregation strategy
  if (sort === "following") {
    console.log("[Discover API] Following feed sorting requested");

    // Following feed requires authentication
    if (!currentUserId) {
      console.log("❌ Following feed requires authentication");
      return ResponseUtil.unauthorized(
        event,
        "Following feed requires authentication"
      );
    }

    // For following feed, we use a single cursor combining both albums and media
    // Parse the cursor from either cursorAlbums or cursorMedia (they should be the same for following)
    const followingCursor =
      queryParams?.["cursorAlbums"] ||
      queryParams?.["cursorMedia"] ||
      queryParams?.["cursor"];

    try {
      const followingResult = await FollowingFeedService.generateFollowingFeed(
        currentUserId,
        limit,
        followingCursor
      );

      // Build response for following feed
      const followingResponse: DiscoverContent = {
        items: followingResult.items,
        cursors: {
          albums: followingResult.cursor, // Use same cursor for both
          media: followingResult.cursor,
        },
        metadata: {
          totalItems: followingResult.metadata.totalItems,
          albumCount: followingResult.metadata.albumCount,
          mediaCount: followingResult.metadata.mediaCount,
          diversificationApplied: false, // No additional diversification needed
          timeWindow: followingResult.metadata.timeWindow,
        },
      };

      console.log("[Discover API] Following feed response:", {
        totalItems: followingResponse.metadata.totalItems,
        albumCount: followingResponse.metadata.albumCount,
        mediaCount: followingResponse.metadata.mediaCount,
        followedUsersProcessed: followingResult.metadata.followedUsersProcessed,
        sort: "following",
      });

      return ResponseUtil.success(event, followingResponse);
    } catch (error) {
      console.error("❌ Error generating following feed:", error);
      return ResponseUtil.error(
        event,
        error instanceof Error
          ? error.message
          : "Failed to generate following feed"
      );
    }
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
      tagBasedResult.albums
        .filter((a) => a.mediaCount > 0)
        .map(async (album) => ({
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
  const fetchMultiplier = limit <= 40 ? 2 : 3;
  const fetchLimit = limit * fetchMultiplier;

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
    fetchLimit,
    fetchMultiplier,
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

  // Filter by time window and calculate time-weighted popularity with fallbacks
  const now = Date.now();
  const recycledAlbumIdSet =
    recycledAlbumsResult && recycledAlbumsResult.albums.length > 0
      ? new Set(recycledAlbumsResult.albums.map((album) => album.id))
      : null;
  const additionalMediaIdSet =
    additionalMediaResult && additionalMediaResult.media.length > 0
      ? new Set(additionalMediaResult.media.map((mediaItem) => mediaItem.id))
      : null;

  const VIDEO_SCORE_BOOST_MULTIPLIER = 1.25;
  const fallbackAttempts: Array<{
    window: TimeWindowConfig | null;
    defaultMaxAgeInDays: number;
  }> = [
    { window: timeWindow, defaultMaxAgeInDays: timeWindow.maxAgeInDays },
    {
      window: {
        windowStartDays: 0,
        windowEndDays: Math.max(timeWindow.windowEndDays, 7),
        maxAgeInDays: Math.max(timeWindow.maxAgeInDays, 60),
      },
      defaultMaxAgeInDays: Math.max(timeWindow.maxAgeInDays, 60),
    },
    {
      window: {
        windowStartDays: 0,
        windowEndDays: Math.max(timeWindow.windowEndDays, 14),
        maxAgeInDays: Math.max(timeWindow.maxAgeInDays, 90),
      },
      defaultMaxAgeInDays: Math.max(timeWindow.maxAgeInDays, 90),
    },
    {
      window: {
        windowStartDays: 0,
        windowEndDays: Math.max(timeWindow.windowEndDays, 30),
        maxAgeInDays: Math.max(timeWindow.maxAgeInDays, 120),
      },
      defaultMaxAgeInDays: Math.max(timeWindow.maxAgeInDays, 120),
    },
    {
      window: {
        windowStartDays: 0,
        windowEndDays: Math.max(timeWindow.windowEndDays, 90),
        maxAgeInDays: Math.max(timeWindow.maxAgeInDays, 180),
      },
      defaultMaxAgeInDays: Math.max(timeWindow.maxAgeInDays, 180),
    },
    { window: null, defaultMaxAgeInDays: 365 },
  ];

  let selectedScoredAlbums: Array<{ item: Album; combinedScore: number }> = [];
  let selectedScoredMedia: Array<{ item: Media; combinedScore: number }> = [];
  let finalDiversifiedAlbums: Album[] = [];
  let finalDiversifiedMedia: Media[] = [];
  let appliedMaxPerUserForWindow = maxPerUser;
  let effectiveTimeWindowLabel = formatTimeWindowLabel(timeWindow, false);

  for (const [attemptIndex, attempt] of fallbackAttempts.entries()) {
    const attemptSeed = (randomSeed + attemptIndex * 0.173) % 1;

    const scored = scoreContentWithinWindow({
      albums: allAlbums,
      media: allMedia,
      timeWindow: attempt.window,
      now,
      randomSeed: attemptSeed,
      scoreWeight: SCORE_WEIGHT,
      randomScale: RANDOM_SCALE,
      videoScoreBoostMultiplier: VIDEO_SCORE_BOOST_MULTIPLIER,
      recycledAlbumIdSet,
      additionalMediaIdSet,
      defaultMaxAgeInDays: attempt.defaultMaxAgeInDays,
    });

    const sortedAlbums = [...scored.albums].sort(
      (a, b) => b.combinedScore - a.combinedScore
    );
    const sortedMedia = [...scored.media].sort(
      (a, b) => b.combinedScore - a.combinedScore
    );

    const candidateAlbums = sortedAlbums.map((entry) => entry.item);
    const candidateMedia = sortedMedia.map((entry) => entry.item);

    const minCombinedTarget = calculateMinimumResultsForAttempt(
      limit,
      attemptIndex
    );

    const diversificationResult = diversifyCollectionsWithRelaxation(
      candidateAlbums,
      candidateMedia,
      maxPerUser,
      MAX_DIVERSIFICATION_RELAXATION,
      minCombinedTarget
    );

    const fallbackApplied =
      attemptIndex > 0 &&
      (attempt.window === null ||
        attempt.window.windowStartDays !== timeWindow.windowStartDays ||
        attempt.window.windowEndDays !== timeWindow.windowEndDays);

    const shouldAcceptAttempt =
      diversificationResult.combinedCount >= minCombinedTarget ||
      attemptIndex === fallbackAttempts.length - 1;

    if (shouldAcceptAttempt) {
      selectedScoredAlbums = sortedAlbums;
      selectedScoredMedia = sortedMedia;
      finalDiversifiedAlbums = diversificationResult.albums;
      finalDiversifiedMedia = diversificationResult.media;
      appliedMaxPerUserForWindow = diversificationResult.appliedMaxPerUser;
      effectiveTimeWindowLabel = formatTimeWindowLabel(
        attempt.window,
        fallbackApplied
      );

      if (fallbackApplied) {
        console.log(
          "[Discover API] Expanded time window due to sparse content",
          {
            appliedWindow: effectiveTimeWindowLabel,
            totalItems: diversificationResult.combinedCount,
            attemptIndex,
          }
        );
      }

      if (diversificationResult.appliedMaxPerUser > maxPerUser) {
        console.log("[Discover API] Relaxed maxPerUser constraint", {
          baseMaxPerUser: maxPerUser,
          appliedMaxPerUser: diversificationResult.appliedMaxPerUser,
          attemptIndex,
          combinedCount: diversificationResult.combinedCount,
        });
      }

      break;
    }

    console.log("[Discover API] Insufficient content for time window attempt", {
      attemptIndex,
      timeWindow: formatTimeWindowLabel(attempt.window, fallbackApplied),
      combinedCount: diversificationResult.combinedCount,
      minCombinedTarget,
      appliedMaxPerUser: diversificationResult.appliedMaxPerUser,
    });
  }

  console.log("[Discover API] After time window filtering:", {
    availableAlbums: selectedScoredAlbums.length,
    availableMedia: selectedScoredMedia.length,
    diversifiedAlbums: finalDiversifiedAlbums.length,
    diversifiedMedia: finalDiversifiedMedia.length,
    timeWindow: effectiveTimeWindowLabel,
    maxPerUserApplied: appliedMaxPerUserForWindow,
  });

  const albums = finalDiversifiedAlbums;
  const media = finalDiversifiedMedia;

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
      timeWindow: effectiveTimeWindowLabel,
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
