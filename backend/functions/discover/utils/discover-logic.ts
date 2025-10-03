import { Album, Media } from "@shared";
import { ContentDiversificationUtil } from "@shared/utils/dynamodb-discover";

import { DISCOVER_CONFIG, DiscoverConfig } from "./discover-config";

export interface DiscoverTimeWindow {
  windowStartDays: number;
  windowEndDays: number;
  maxAgeInDays: number;
}

export interface ScoreContentResult {
  albums: Array<{ item: Album; combinedScore: number }>;
  media: Array<{ item: Media; combinedScore: number }>;
}

export interface ScoreContentArgs {
  albums: Album[];
  media: Media[];
  timeWindow: DiscoverTimeWindow | null;
  now: number;
  randomSeed: number;
  scoreWeight: number;
  randomScale: number;
  videoScoreBoostMultiplier: number;
  recycledAlbumIdSet?: Set<string> | null;
  additionalMediaIdSet?: Set<string> | null;
  defaultMaxAgeInDays: number;
  config?: DiscoverConfig;
}

export interface DiversifiedCollectionsResult {
  albums: Album[];
  media: Media[];
  appliedMaxPerUser: number;
  combinedCount: number;
}

const DEFAULT_CONFIG = DISCOVER_CONFIG;

export function createSeededRandom(seed: number): () => number {
  let state = Math.floor((seed % 1) * 2147483646) + 1;

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function selectRecencyBoostMultiplier(
  ageInDays: number,
  config: DiscoverConfig
): number {
  for (const boost of config.scoring.recencyBoosts) {
    if (ageInDays <= boost.maxAgeDays) {
      return boost.multiplier;
    }
  }

  return 1;
}

export function calculateTimeWeightedPopularity(
  item: Album | Media,
  maxAgeInDays: number,
  now: number,
  config: DiscoverConfig = DEFAULT_CONFIG
): number {
  const createdAt = new Date(item.createdAt).getTime();
  const ageInMs = now - createdAt;
  const ageInDays = ageInMs / config.dayInMs;
  const basePopularity = item.popularity || 0;

  if (ageInDays <= 0) {
    return basePopularity * selectRecencyBoostMultiplier(0, config);
  }

  const timeFactor = Math.max(0, 1 - ageInDays / Math.max(maxAgeInDays, 1));
  const recencyBoost = selectRecencyBoostMultiplier(ageInDays, config);

  return basePopularity * timeFactor * recencyBoost;
}

export function buildTimeWindow(
  limit: number,
  cursorDepth: number,
  config: DiscoverConfig = DEFAULT_CONFIG
): DiscoverTimeWindow {
  const { itemsPerDayTarget, minWindowDays, overlapRatio } = config.selection;

  const estimatedWindow = Math.max(
    minWindowDays,
    Math.ceil(limit / Math.max(itemsPerDayTarget, 1))
  );

  const windowLength = Math.max(minWindowDays, estimatedWindow);
  const overlapDays = Math.max(1, Math.floor(windowLength * overlapRatio));
  const stride = Math.max(1, windowLength - overlapDays);
  const windowStartDays = cursorDepth * stride;
  const windowEndDays = windowStartDays + windowLength;
  const maxAgeInDays = Math.max(
    windowEndDays,
    config.scoring.defaultMaxAgeInDays
  );

  return {
    windowStartDays,
    windowEndDays,
    maxAgeInDays,
  };
}

export interface TimeWindowAttempt {
  window: DiscoverTimeWindow | null;
  defaultMaxAgeInDays: number;
}

export function buildFallbackAttempts(
  baseWindow: DiscoverTimeWindow,
  config: DiscoverConfig = DEFAULT_CONFIG
): TimeWindowAttempt[] {
  const attempts: TimeWindowAttempt[] = [
    { window: baseWindow, defaultMaxAgeInDays: baseWindow.maxAgeInDays },
  ];

  let expandedEndDays = baseWindow.windowEndDays;
  let expandedMaxAge = baseWindow.maxAgeInDays;

  for (const fallback of config.fallbackWindows) {
    expandedEndDays = Math.max(
      expandedEndDays,
      baseWindow.windowEndDays + fallback.expandEndDays
    );
    expandedMaxAge = Math.max(expandedMaxAge, fallback.maxAgeInDays);

    attempts.push({
      window: {
        windowStartDays: 0,
        windowEndDays: expandedEndDays,
        maxAgeInDays: expandedMaxAge,
      },
      defaultMaxAgeInDays: expandedMaxAge,
    });
  }

  const lastFallbackAge =
    config.fallbackWindows[config.fallbackWindows.length - 1]?.maxAgeInDays ||
    baseWindow.maxAgeInDays;

  attempts.push({ window: null, defaultMaxAgeInDays: lastFallbackAge });

  return attempts;
}

export function scoreContentWithinWindow({
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
  config = DEFAULT_CONFIG,
}: ScoreContentArgs): ScoreContentResult {
  const seededRandom = createSeededRandom(randomSeed);
  const windowStartMs = timeWindow
    ? now - timeWindow.windowEndDays * config.dayInMs
    : undefined;
  const windowEndMs = timeWindow
    ? now - timeWindow.windowStartDays * config.dayInMs
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

    const baseScore = calculateTimeWeightedPopularity(
      album,
      maxAgeInDays,
      now,
      config
    );
    const combinedScore =
      baseScore * scoreWeight + seededRandom() * randomScale;

    scoredAlbums.push({ item: album, combinedScore });
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
      calculateTimeWeightedPopularity(mediaItem, maxAgeInDays, now, config) *
      (mediaItem.type === "video" ? videoScoreBoostMultiplier : 1);
    const combinedScore =
      baseScore * scoreWeight + seededRandom() * randomScale;

    scoredMedia.push({ item: mediaItem, combinedScore });
  }

  return { albums: scoredAlbums, media: scoredMedia };
}

export function calculateMinimumResultsForAttempt(
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

export function diversifyCollectionsWithRelaxation(
  albums: Album[],
  media: Media[],
  baseMaxPerUser: number,
  config: DiscoverConfig = DEFAULT_CONFIG,
  minCombinedTarget?: number
): DiversifiedCollectionsResult {
  const maxRelaxation = config.diversification.maxRelaxationSteps;
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
    minCombinedTarget !== undefined &&
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

export function formatTimeWindowLabel(
  timeWindow: DiscoverTimeWindow | null,
  fallbackApplied: boolean
): string {
  if (!timeWindow) {
    return fallbackApplied ? "all-time (fallback)" : "all-time";
  }

  const baseLabel = `${timeWindow.windowStartDays}-${timeWindow.windowEndDays} days ago`;
  return fallbackApplied ? `${baseLabel} (fallback)` : baseLabel;
}

export function deriveContentTargets(
  availableAlbums: number,
  limit: number,
  config: DiscoverConfig = DEFAULT_CONFIG
): { targetAlbumCount: number; targetMediaCount: number } {
  const albumRatio = Math.min(
    config.selection.albumMaxShare,
    availableAlbums / Math.max(limit, 1)
  );
  const targetAlbumCount = Math.floor(limit * albumRatio);
  const targetMediaCount = limit - targetAlbumCount;

  return { targetAlbumCount, targetMediaCount };
}

export function* cycleMediaBiasPattern(
  pattern: ("media" | "album")[]
): Generator<"media" | "album", never> {
  if (pattern.length === 0) {
    throw new Error("Media bias pattern cannot be empty");
  }

  let index = 0;
  while (true) {
    const value = pattern[index % pattern.length]!;
    index += 1;
    yield value;
  }
}
