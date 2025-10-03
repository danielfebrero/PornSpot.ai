export interface DiscoverRecencyBoostConfig {
  maxAgeDays: number;
  multiplier: number;
}

export interface DiscoverFallbackWindowConfig {
  /** Number of days to add to the end of the time window when this fallback triggers */
  expandEndDays: number;
  /** Maximum age in days allowed for scoring when this fallback triggers */
  maxAgeInDays: number;
}

export interface DiscoverSelectionConfig {
  /** Target number of items to surface per day of data included in the window */
  itemsPerDayTarget: number;
  /** Minimum number of days the primary window should cover regardless of limit */
  minWindowDays: number;
  /** Additional fraction of the window added as overlap with the next page */
  overlapRatio: number;
  /** Maximum portion of the final response allotted to albums */
  albumMaxShare: number;
  /** Pattern used when interleaving results for the final response */
  mediaBiasPattern: ("media" | "album")[];
  /** Soft shuffling aggressiveness passed to diversification util */
  shuffleSoftness: number;
}

export interface DiscoverRandomizationConfig {
  /** Weight applied to the deterministic score component */
  scoreWeight: number;
  /** Weight applied to the random score component */
  randomWeight: number;
  /** Step added to the random seed on each fallback attempt to keep variety */
  seedStep: number;
}

export interface DiscoverScoringConfig {
  /** Default maximum age, in days, considered for popularity scoring */
  defaultMaxAgeInDays: number;
  /** Extra multiplier applied to popular videos to keep them visible */
  videoBoostMultiplier: number;
  /** Ordered list of recency boosts applied while < maxAgeDays */
  recencyBoosts: DiscoverRecencyBoostConfig[];
}

export interface DiscoverPaginationConfig {
  /** Maximum payload size accepted by the handler */
  maxLimit: number;
  /** Threshold below which we can keep fetch multiplier low */
  smallLimitThreshold: number;
  /** Fetch multiplier used for pages up to the small limit threshold */
  regularFetchMultiplier: number;
  /** Fetch multiplier used when requested limit is above the small limit threshold */
  largeFetchMultiplier: number;
}

export interface DiscoverDiversificationConfig {
  /** Number of times we can relax the per-user constraint when content is sparse */
  maxRelaxationSteps: number;
}

export interface DiscoverConfig {
  dayInMs: number;
  selection: DiscoverSelectionConfig;
  randomization: DiscoverRandomizationConfig;
  scoring: DiscoverScoringConfig;
  pagination: DiscoverPaginationConfig;
  diversification: DiscoverDiversificationConfig;
  fallbackWindows: DiscoverFallbackWindowConfig[];
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const BASE_DISCOVER_CONFIG: DiscoverConfig = {
  dayInMs: DAY_IN_MS,
  selection: {
    itemsPerDayTarget: 30,
    minWindowDays: 1,
    overlapRatio: 0.5,
    albumMaxShare: 0.4,
    mediaBiasPattern: ["media", "media", "album"],
    shuffleSoftness: 10,
  },
  randomization: {
    scoreWeight: 0.7,
    randomWeight: 0.3,
    seedStep: 0.173,
  },
  scoring: {
    defaultMaxAgeInDays: 30,
    videoBoostMultiplier: 1.25,
    recencyBoosts: [
      { maxAgeDays: 1, multiplier: 2.0 },
      { maxAgeDays: 3, multiplier: 1.5 },
      { maxAgeDays: 7, multiplier: 1.2 },
    ],
  },
  pagination: {
    maxLimit: 100,
    smallLimitThreshold: 40,
    regularFetchMultiplier: 2,
    largeFetchMultiplier: 3,
  },
  diversification: {
    maxRelaxationSteps: 5,
  },
  fallbackWindows: [
    { expandEndDays: 0, maxAgeInDays: 60 },
    { expandEndDays: 7, maxAgeInDays: 90 },
    { expandEndDays: 14, maxAgeInDays: 120 },
    { expandEndDays: 30, maxAgeInDays: 150 },
    { expandEndDays: 90, maxAgeInDays: 180 },
  ],
};

export const DISCOVER_CONFIG = BASE_DISCOVER_CONFIG;
