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

import { DISCOVER_CONFIG } from "./utils/discover-config";
import {
  buildTimeWindow,
  buildFallbackAttempts,
  scoreContentWithinWindow,
  calculateMinimumResultsForAttempt,
  diversifyCollectionsWithRelaxation,
  formatTimeWindowLabel,
  deriveContentTargets,
  cycleMediaBiasPattern,
  DiscoverTimeWindow,
} from "./utils/discover-logic";

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

interface DiscoverRequestParams {
  limit: number;
  tag?: string;
  sort?: string | null;
  maxPerUser: number;
  shuffleContent: boolean;
  randomSeed: number;
  cursorDepth: number;
  albumCursor?: Record<string, unknown>;
  mediaCursor?: Record<string, unknown>;
  rawAlbumCursor?: string;
  rawMediaCursor?: string;
  followingCursor?: string;
}

interface FinalizedItemsResult {
  items: (Album | Media)[];
  albumCount: number;
  mediaCount: number;
}

function parseDiscoverRequest(
  event: APIGatewayProxyEvent
): DiscoverRequestParams {
  const queryParams = event.queryStringParameters || {};
  const requestedLimit = parseInt(queryParams["limit"] ?? "20", 10);
  const limit = Math.max(
    1,
    Math.min(requestedLimit, DISCOVER_CONFIG.pagination.maxLimit)
  );

  const maxPerUser = Math.max(
    1,
    parseInt(queryParams["maxPerUser"] ?? "2", 10)
  );
  const sort = queryParams["sort"];
  const tag = queryParams["tag"] ?? undefined;

  const {
    albums: albumCursor,
    media: mediaCursor,
    cursorDepth,
  } = parseDiscoverCursors(queryParams);

  return {
    limit,
    tag,
    sort,
    maxPerUser,
    shuffleContent: true,
    randomSeed: Math.random(),
    cursorDepth,
    albumCursor,
    mediaCursor,
    rawAlbumCursor: queryParams["cursorAlbums"],
    rawMediaCursor: queryParams["cursorMedia"],
    followingCursor:
      queryParams["cursorAlbums"] ||
      queryParams["cursorMedia"] ||
      queryParams["cursor"],
  };
}

/**
 * Attach lightweight content previews to albums so the frontend can render cover media
 * without issuing additional round trips per album.
 */
async function enrichAlbumsWithPreview(albums: Album[]): Promise<Album[]> {
  return Promise.all(
    albums.map(async (album) => ({
      ...album,
      contentPreview:
        (await DynamoDBService.getContentPreviewForAlbum(album.id)) || null,
    }))
  );
}

/**
 * Interleave the highest scoring albums and media into a balanced feed, enrich albums
 * with previews, and optionally apply soft shuffling to avoid deterministic ordering.
 */
async function composeFinalItems(
  albums: Album[],
  media: Media[],
  limit: number,
  shouldShuffle: boolean,
  targets: { targetAlbumCount: number; targetMediaCount: number }
): Promise<FinalizedItemsResult> {
  const { targetAlbumCount, targetMediaCount } = targets;

  const trimmedAlbums = await enrichAlbumsWithPreview(
    albums.slice(0, targetAlbumCount)
  );
  const trimmedMedia = media.slice(0, targetMediaCount);

  const interleavePattern = cycleMediaBiasPattern(
    DISCOVER_CONFIG.selection.mediaBiasPattern
  );

  const finalItems: (Album | Media)[] = [];
  let albumIndex = 0;
  let mediaIndex = 0;

  while (
    finalItems.length < limit &&
    (albumIndex < trimmedAlbums.length || mediaIndex < trimmedMedia.length)
  ) {
    const nextType = interleavePattern.next().value;

    if (nextType === "media") {
      if (mediaIndex < trimmedMedia.length) {
        const mediaItem = trimmedMedia[mediaIndex]!;
        finalItems.push(mediaItem);
        mediaIndex += 1;
        continue;
      }
    } else if (nextType === "album") {
      if (albumIndex < trimmedAlbums.length) {
        const albumItem = trimmedAlbums[albumIndex]!;
        finalItems.push(albumItem);
        albumIndex += 1;
        continue;
      }
    }

    // Fallback when preferred type is unavailable: add from remaining collection
    if (mediaIndex < trimmedMedia.length) {
      const mediaItem = trimmedMedia[mediaIndex]!;
      finalItems.push(mediaItem);
      mediaIndex += 1;
      continue;
    }

    if (albumIndex < trimmedAlbums.length) {
      const albumItem = trimmedAlbums[albumIndex]!;
      finalItems.push(albumItem);
      albumIndex += 1;
    }
  }

  const orderedItems = shouldShuffle
    ? ContentDiversificationUtil.softRandomize(
        finalItems,
        DISCOVER_CONFIG.selection.shuffleSoftness
      )
    : finalItems;

  const albumCount = orderedItems.filter((item) => "mediaCount" in item).length;
  const mediaCount = orderedItems.length - albumCount;

  return {
    items: orderedItems,
    albumCount,
    mediaCount,
  };
}

/**
 * Parse cursor parameters from query string
 */
/**
 * Decode pagination cursors while preserving custom depth metadata that informs
 * how far back in time the consumer has paged through the discover feed.
 */
function parseDiscoverCursors(
  queryParams: { [key: string]: string | undefined } | null
): {
  albums?: Record<string, unknown>;
  media?: Record<string, unknown>;
  cursorDepth: number;
} {
  const params = queryParams || {};
  const cursors: {
    albums?: Record<string, unknown>;
    media?: Record<string, unknown>;
  } = {};
  let cursorDepth = 0;

  if (params["cursorAlbums"]) {
    try {
      const decoded = PaginationUtil.decodeCursor(
        params["cursorAlbums"]
      ) as Record<string, unknown>;
      const depthValue = decoded["depth"];
      if (typeof depthValue === "number") {
        cursorDepth = Math.max(cursorDepth, depthValue);
        delete decoded["depth"];
      }
      cursors.albums = decoded;
    } catch (error) {
      console.warn("Invalid cursorAlbums:", error);
    }
  }

  if (params["cursorMedia"]) {
    try {
      const decoded = PaginationUtil.decodeCursor(
        params["cursorMedia"]
      ) as Record<string, unknown>;
      const depthValue = decoded["depth"];
      if (typeof depthValue === "number") {
        cursorDepth = Math.max(cursorDepth, depthValue);
        delete decoded["depth"];
      }
      cursors.media = decoded;
    } catch (error) {
      console.warn("Invalid cursorMedia:", error);
    }
  }

  if (params["depth"]) {
    cursorDepth = parseInt(params["depth"], 10) || 0;
  }

  return {
    albums: cursors.albums,
    media: cursors.media,
    cursorDepth,
  };
}

/**
 * Entry point for the discover feed. Delegates to specialized flows depending on the
 * requested sort while keeping shared concerns (auth, logging, configuration) centralized.
 */
const handleGetDiscover = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const authResult = await UserAuthUtil.allowAnonymous(event);

  if (UserAuthUtil.isErrorResponse(authResult)) {
    return authResult;
  }

  const currentUserId = authResult.userId;

  if (currentUserId) {
    console.log("✅ Authenticated user:", currentUserId);
  } else {
    console.log("ℹ️ Anonymous user - proceeding with public content only");
  }

  const request = parseDiscoverRequest(event);

  console.log("[Discover API] Request params:", {
    limit: request.limit,
    maxPerUser: request.maxPerUser,
    cursorDepth: request.cursorDepth,
    randomSeed: request.randomSeed,
    tag: request.tag ?? "none",
    sort: request.sort ?? "default",
    itemsPerDayTarget: DISCOVER_CONFIG.selection.itemsPerDayTarget,
    hasCursors: {
      albums: !!request.albumCursor,
      media: !!request.mediaCursor,
    },
  });

  if (request.sort === "popular") {
    return handlePopularSort(event, request);
  }

  if (request.sort === "following") {
    return handleFollowingSort(event, request, currentUserId);
  }

  if (request.tag) {
    return handleTagDiscover(event, request);
  }

  const baseTimeWindow = buildTimeWindow(
    request.limit,
    request.cursorDepth,
    DISCOVER_CONFIG
  );

  console.log("[Discover API] Base time window:", baseTimeWindow);

  return handleDefaultDiscover({
    event,
    request,
    baseTimeWindow,
    currentUserId,
  });
};

/**
 * Serve a strictly popularity-ordered feed without diversification, used when users
 * explicitly request the "popular" sort option.
 */
async function handlePopularSort(
  event: APIGatewayProxyEvent,
  request: DiscoverRequestParams
): Promise<APIGatewayProxyResult> {
  console.log("[Discover API] Popular sorting requested");

  const [albumsResult, mediaResult] = await Promise.all([
    DynamoDBDiscoverService.queryPopularAlbumsViaGSI6(
      request.limit,
      request.albumCursor,
      request.tag
    ),
    DynamoDBDiscoverService.queryPopularMediaViaGSI6(
      request.limit,
      request.mediaCursor,
      request.tag
    ),
  ]);

  console.log("[Discover API] Popular results:", {
    albums: albumsResult.albums.length,
    media: mediaResult.media.length,
    tag: request.tag ?? "none",
  });

  const albumsWithPreview = await enrichAlbumsWithPreview(albumsResult.albums);

  const sortedItems = [...albumsWithPreview, ...mediaResult.media]
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, request.limit);

  const response: DiscoverContent = {
    items: sortedItems,
    cursors: {
      albums: PaginationUtil.encodeCursor(albumsResult.lastEvaluatedKey),
      media: PaginationUtil.encodeCursor(mediaResult.lastEvaluatedKey),
    },
    metadata: {
      totalItems: sortedItems.length,
      albumCount: albumsWithPreview.length,
      mediaCount: mediaResult.media.length,
      diversificationApplied: false,
      timeWindow: "popular",
    },
  };

  console.log("[Discover API] Popular response:", {
    totalItems: response.metadata.totalItems,
    albumCount: response.metadata.albumCount,
    mediaCount: response.metadata.mediaCount,
    tag: request.tag ?? "none",
  });

  return ResponseUtil.success(event, response);
}

/**
 * Build the personalized following feed, requiring authentication and reusing the
 * dedicated FollowingFeedService aggregation.
 */
async function handleFollowingSort(
  event: APIGatewayProxyEvent,
  request: DiscoverRequestParams,
  currentUserId: string | null
): Promise<APIGatewayProxyResult> {
  console.log("[Discover API] Following feed sorting requested");

  if (!currentUserId) {
    console.log("❌ Following feed requires authentication");
    return ResponseUtil.unauthorized(
      event,
      "Following feed requires authentication"
    );
  }

  try {
    const followingResult = await FollowingFeedService.generateFollowingFeed(
      currentUserId,
      request.limit,
      request.followingCursor
    );

    const response: DiscoverContent = {
      items: followingResult.items,
      cursors: {
        albums: followingResult.cursor,
        media: followingResult.cursor,
      },
      metadata: {
        totalItems: followingResult.metadata.totalItems,
        albumCount: followingResult.metadata.albumCount,
        mediaCount: followingResult.metadata.mediaCount,
        diversificationApplied: false,
        timeWindow: followingResult.metadata.timeWindow,
      },
    };

    console.log("[Discover API] Following feed response:", {
      totalItems: response.metadata.totalItems,
      albumCount: response.metadata.albumCount,
      mediaCount: response.metadata.mediaCount,
      followedUsersProcessed: followingResult.metadata.followedUsersProcessed,
    });

    return ResponseUtil.success(event, response);
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

/**
 * Provide tag-scoped discovery results, focusing exclusively on public albums that
 * contain media and enriching them with previews for quick client rendering.
 */
async function handleTagDiscover(
  event: APIGatewayProxyEvent,
  request: DiscoverRequestParams
): Promise<APIGatewayProxyResult> {
  if (!request.tag) {
    return ResponseUtil.success(event, {
      items: [],
      cursors: { albums: null, media: null },
      metadata: {
        totalItems: 0,
        albumCount: 0,
        mediaCount: 0,
        diversificationApplied: false,
        timeWindow: "tag",
      },
    });
  }

  console.log(`[Discover API] Tag-based discovery for tag: "${request.tag}"`);

  const tagBasedResult = await DynamoDBService.listAlbumsByTag(
    request.tag,
    request.limit,
    request.albumCursor,
    true
  );

  const filteredAlbums = tagBasedResult.albums.filter(
    (album) => album.mediaCount > 0
  );

  const albumsWithPreview = await enrichAlbumsWithPreview(filteredAlbums);

  const response: DiscoverContent = {
    items: albumsWithPreview,
    cursors: {
      albums: PaginationUtil.encodeCursor(tagBasedResult.lastEvaluatedKey),
      media: null,
    },
    metadata: {
      totalItems: albumsWithPreview.length,
      albumCount: albumsWithPreview.length,
      mediaCount: 0,
      diversificationApplied: false,
      timeWindow: `tag:${request.tag}`,
    },
  };

  console.log("[Discover API] Tag-based response:", {
    tag: request.tag,
    totalItems: response.metadata.totalItems,
    albumCount: response.metadata.albumCount,
  });

  return ResponseUtil.success(event, response);
}

interface DefaultDiscoverArgs {
  event: APIGatewayProxyEvent;
  request: DiscoverRequestParams;
  baseTimeWindow: DiscoverTimeWindow;
  currentUserId: string | null;
}

/**
 * Default discover strategy that balances recency, popularity, and diversification.
 * It progressively widens the time window when content is sparse while respecting
 * configuration-driven targets such as items-per-day and per-user limits.
 */
async function handleDefaultDiscover({
  event,
  request,
  baseTimeWindow,
  currentUserId,
}: DefaultDiscoverArgs): Promise<APIGatewayProxyResult> {
  console.log("[Discover API] Default discover execution context:", {
    user: currentUserId ?? "anonymous",
    baseTimeWindow,
  });

  const fetchMultiplier =
    request.limit <= DISCOVER_CONFIG.pagination.smallLimitThreshold
      ? DISCOVER_CONFIG.pagination.regularFetchMultiplier
      : DISCOVER_CONFIG.pagination.largeFetchMultiplier;
  const fetchLimit = request.limit * fetchMultiplier;

  const [albumsResult, mediaResult] = await Promise.all([
    DynamoDBDiscoverService.queryPublicAlbumsViaGSI5(
      fetchLimit,
      request.albumCursor
    ),
    DynamoDBDiscoverService.queryPublicMediaViaGSI5(
      fetchLimit,
      request.mediaCursor
    ),
  ]);

  console.log("[Discover API] Raw results:", {
    albums: albumsResult.albums.length,
    media: mediaResult.media.length,
    albumsExhausted: albumsResult.albums.length === 0 && !!request.albumCursor,
    fetchLimit,
    fetchMultiplier,
  });

  const albumsExhausted =
    albumsResult.albums.length === 0 && !!request.albumCursor;

  let recycledAlbumsResult: Awaited<
    ReturnType<typeof DynamoDBDiscoverService.queryPublicAlbumsViaGSI5>
  > | null = null;

  if (albumsExhausted) {
    console.log("[Discover API] Albums exhausted, recycling from beginning");
    recycledAlbumsResult =
      await DynamoDBDiscoverService.queryPublicAlbumsViaGSI5(
        fetchLimit,
        undefined
      );
    console.log(
      "[Discover API] Recycled albums:",
      recycledAlbumsResult.albums.length
    );
  }

  const totalAlbumCount =
    albumsResult.albums.length + (recycledAlbumsResult?.albums.length ?? 0);

  let additionalMediaResult: Awaited<
    ReturnType<typeof DynamoDBDiscoverService.queryPublicMediaViaGSI5>
  > | null = null;

  if (totalAlbumCount < request.limit * 0.2 && mediaResult.lastEvaluatedKey) {
    console.log(
      "[Discover API] Insufficient albums, fetching additional media"
    );
    additionalMediaResult =
      await DynamoDBDiscoverService.queryPublicMediaViaGSI5(
        fetchLimit * 2,
        mediaResult.lastEvaluatedKey
      );
    console.log(
      "[Discover API] Additional media fetched:",
      additionalMediaResult.media.length
    );
  }

  const allAlbums = [
    ...albumsResult.albums,
    ...(recycledAlbumsResult?.albums ?? []),
  ];
  const allMedia = [
    ...mediaResult.media,
    ...(additionalMediaResult?.media ?? []),
  ];

  console.log("[Discover API] Combined results:", {
    albums: allAlbums.length,
    media: allMedia.length,
  });

  const now = Date.now();
  const recycledAlbumIdSet = recycledAlbumsResult
    ? new Set(recycledAlbumsResult.albums.map((album) => album.id))
    : null;
  const additionalMediaIdSet = additionalMediaResult
    ? new Set(additionalMediaResult.media.map((mediaItem) => mediaItem.id))
    : null;

  const fallbackAttempts = buildFallbackAttempts(
    baseTimeWindow,
    DISCOVER_CONFIG
  );

  const scoreWeight = DISCOVER_CONFIG.randomization.scoreWeight;
  const randomScale = DISCOVER_CONFIG.randomization.randomWeight * 1000;
  const seedStep = DISCOVER_CONFIG.randomization.seedStep;
  const videoBoost = DISCOVER_CONFIG.scoring.videoBoostMultiplier;

  let finalAlbums: Album[] = [];
  let finalMedia: Media[] = [];
  let appliedMaxPerUser = request.maxPerUser;
  let effectiveTimeWindowLabel = formatTimeWindowLabel(baseTimeWindow, false);
  let lastScoredAlbumsCount = 0;
  let lastScoredMediaCount = 0;

  for (const [attemptIndex, attempt] of fallbackAttempts.entries()) {
    // Each attempt widens the temporal window or falls back to all-time, giving
    // preference to recent content but guaranteeing we eventually return results.
    const attemptSeed = (request.randomSeed + attemptIndex * seedStep) % 1;

    const scored = scoreContentWithinWindow({
      albums: allAlbums,
      media: allMedia,
      timeWindow: attempt.window,
      now,
      randomSeed: attemptSeed,
      scoreWeight,
      randomScale,
      videoScoreBoostMultiplier: videoBoost,
      recycledAlbumIdSet,
      additionalMediaIdSet,
      defaultMaxAgeInDays: attempt.defaultMaxAgeInDays,
      config: DISCOVER_CONFIG,
    });

    lastScoredAlbumsCount = scored.albums.length;
    lastScoredMediaCount = scored.media.length;

    const candidateAlbums = scored.albums
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .map((entry) => entry.item);
    const candidateMedia = scored.media
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .map((entry) => entry.item);

    const minCombinedTarget = calculateMinimumResultsForAttempt(
      request.limit,
      attemptIndex
    );

    const diversificationResult = diversifyCollectionsWithRelaxation(
      candidateAlbums,
      candidateMedia,
      request.maxPerUser,
      DISCOVER_CONFIG,
      minCombinedTarget
    );

    const fallbackLabel = formatTimeWindowLabel(
      attempt.window,
      attemptIndex > 0
    );

    const shouldAccept =
      diversificationResult.combinedCount >= minCombinedTarget ||
      attemptIndex === fallbackAttempts.length - 1;

    if (shouldAccept) {
      finalAlbums = diversificationResult.albums;
      finalMedia = diversificationResult.media;
      appliedMaxPerUser = diversificationResult.appliedMaxPerUser;
      effectiveTimeWindowLabel = fallbackLabel;

      if (attemptIndex > 0) {
        console.log(
          "[Discover API] Expanded time window due to sparse content",
          {
            appliedWindow: fallbackLabel,
            attemptIndex,
            combinedCount: diversificationResult.combinedCount,
          }
        );
      }

      if (diversificationResult.appliedMaxPerUser > request.maxPerUser) {
        console.log("[Discover API] Relaxed maxPerUser constraint", {
          baseMaxPerUser: request.maxPerUser,
          appliedMaxPerUser: diversificationResult.appliedMaxPerUser,
          attemptIndex,
        });
      }

      break;
    }

    console.log("[Discover API] Insufficient content for time window attempt", {
      attemptIndex,
      timeWindow: fallbackLabel,
      combinedCount: diversificationResult.combinedCount,
      minCombinedTarget,
      appliedMaxPerUser: diversificationResult.appliedMaxPerUser,
    });
  }

  console.log("[Discover API] After time window filtering:", {
    availableAlbums: lastScoredAlbumsCount,
    availableMedia: lastScoredMediaCount,
    diversifiedAlbums: finalAlbums.length,
    diversifiedMedia: finalMedia.length,
    timeWindow: effectiveTimeWindowLabel,
    maxPerUserApplied: appliedMaxPerUser,
  });

  const targets = deriveContentTargets(
    finalAlbums.length,
    request.limit,
    DISCOVER_CONFIG
  );

  console.log("[Discover API] Dynamic content ratio:", {
    availableAlbums: finalAlbums.length,
    availableMedia: finalMedia.length,
    targetAlbumCount: targets.targetAlbumCount,
    targetMediaCount: targets.targetMediaCount,
    albumRatio:
      ((targets.targetAlbumCount / request.limit) * 100).toFixed(1) + "%",
    mediaRatio:
      ((targets.targetMediaCount / request.limit) * 100).toFixed(1) + "%",
  });

  const finalized = await composeFinalItems(
    finalAlbums,
    finalMedia,
    request.limit,
    request.shuffleContent,
    targets
  );

  const nextDepth = request.cursorDepth + 1;

  let albumsCursorWithDepth: Record<string, unknown> | undefined;
  if (recycledAlbumsResult?.lastEvaluatedKey) {
    albumsCursorWithDepth = {
      ...recycledAlbumsResult.lastEvaluatedKey,
      depth: 1,
    };
  } else if (albumsResult.lastEvaluatedKey) {
    albumsCursorWithDepth = {
      ...albumsResult.lastEvaluatedKey,
      depth: nextDepth,
    };
  }

  let mediaCursorWithDepth: Record<string, unknown> | undefined;
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
  }

  const response: DiscoverContent = {
    items: finalized.items,
    cursors: {
      albums: PaginationUtil.encodeCursor(albumsCursorWithDepth),
      media: PaginationUtil.encodeCursor(mediaCursorWithDepth),
    },
    metadata: {
      totalItems: finalized.items.length,
      albumCount: finalized.albumCount,
      mediaCount: finalized.mediaCount,
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
}

export const handler = LambdaHandlerUtil.withoutAuth(handleGetDiscover);
