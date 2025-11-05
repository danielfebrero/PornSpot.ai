#!/usr/bin/env node
/**
 * backfill-video-lengths.js
 *
 * Script to estimate and backfill video duration metadata for existing media items.
 * Because historical I2V job entries expire after ~30 minutes (TTL), we cannot rely
 * on the job table to recover requested durations. Instead we approximate each
 * video's runtime using its stored file size and, when available, metadata about
 * extensions.
 *
 * Usage:
 *   node backfill-video-lengths.js --env=stage [--dry-run] [--limit=500] [--force]
 *
 * Options:
 *   --env=<name>        Load AWS/Dynamo config from .env.<name> (defaults to .env)
 *   --dry-run           Preview updates without writing to DynamoDB
 *   --limit=<number>    Only process the first <number> eligible videos
 *   --bytes-per-second  Override heuristic bytes-per-second baseline (defaults 920000)
 *   --force             Update all videos even if videoLengthSeconds already set
 *
 * Environment variables (loaded from the selected .env file):
 *   DYNAMODB_TABLE          Target single-table Dynamo table name
 *   AWS_REGION              Region (defaults to us-east-1 for local)
 *   AWS_ACCESS_KEY_ID       (required for remote)
 *   AWS_SECRET_ACCESS_KEY   (required for remote)
 *   LOCAL_AWS_ENDPOINT      Optional endpoint override for local Dynamo
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

// ---------- CLI argument helpers ----------
const argv = process.argv.slice(2);
const isDryRun = argv.includes("--dry-run");
const forceUpdate = argv.includes("--force");
const limitArg = argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
const envArg = argv.find((arg) => arg.startsWith("--env="));
const bytesPerSecondArg = argv.find((arg) =>
  arg.startsWith("--bytes-per-second=")
);
const heuristicBytesPerSecond = bytesPerSecondArg
  ? Number(bytesPerSecondArg.split("=")[1])
  : Number(process.env.BACKFILL_VIDEO_LENGTH_BYTES_PER_SECOND || 920000);

if (
  Number.isNaN(heuristicBytesPerSecond) ||
  !Number.isFinite(heuristicBytesPerSecond) ||
  heuristicBytesPerSecond <= 0
) {
  console.error(
    "❌ Invalid bytes-per-second heuristic. Provide a positive number via --bytes-per-second."
  );
  process.exit(1);
}

let envFile = ".env";
if (envArg) {
  const envValue = envArg.split("=")[1];
  if (envValue) {
    if (envValue.startsWith(".env")) envFile = envValue;
    else if (/^[\w.-]+$/.test(envValue)) envFile = `.env.${envValue}`;
    else envFile = envValue;
  }
}

const envPath = path.resolve(__dirname, envFile);
if (!fs.existsSync(envPath)) {
  console.error(`❌ Environment file not found: ${envPath}`);
  process.exit(1);
}

dotenv.config({ path: envPath });
console.log(`📋 Loaded environment from ${envPath}`);

const requiredEnvVars = ["DYNAMODB_TABLE"];
const missingEnv = requiredEnvVars.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingEnv.join(", ")}`
  );
  process.exit(1);
}

const TABLE_NAME = process.env.DYNAMODB_TABLE;
const sizeFallbackDurations = [5, 10, 15, 20, 25, 30]; // when LoRAs disabled, length is in 5s steps

// ---------- AWS client setup ----------
const clientConfig = {};
if (process.env.LOCAL_AWS_ENDPOINT) {
  clientConfig.endpoint = process.env.LOCAL_AWS_ENDPOINT;
  clientConfig.region = process.env.AWS_REGION || "us-east-1";
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  };
}

const dynamo = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(dynamo, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

// ---------- Utility helpers ----------
const computedLengths = new Map();

function getMediaId(media) {
  if (!media) return undefined;
  if (media.mediaId) return media.mediaId;
  if (media.id) return media.id;
  if (typeof media.PK === "string" && media.PK.includes("#")) {
    const [, extracted] = media.PK.split("#");
    if (extracted) return extracted;
  }
  return undefined;
}

function toNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseDurationString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const match = value.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) {
    return null;
  }
  return toNumber(match[1]);
}

function snapDuration(estimatedSeconds) {
  if (!Number.isFinite(estimatedSeconds) || estimatedSeconds <= 0) {
    return null;
  }
  const candidates = sizeFallbackDurations;
  let best = candidates[0];
  let bestDiff = Math.abs(candidates[0] - estimatedSeconds);
  for (const candidate of candidates) {
    const diff = Math.abs(candidate - estimatedSeconds);
    if (diff < bestDiff) {
      best = candidate;
      bestDiff = diff;
    }
  }
  return best;
}

function guessFromSize(media) {
  const sizeCandidates = [
    toNumber(media.size),
    toNumber(media?.metadata?.sizeBytes),
    toNumber(media?.metadata?.fileSizeBytes),
  ];
  const sizeBytes = sizeCandidates.find((value) => value && value > 0);
  if (!sizeBytes) {
    return null;
  }
  const estimatedSeconds = sizeBytes / heuristicBytesPerSecond;
  const snapped = snapDuration(estimatedSeconds);
  if (!snapped) {
    return null;
  }
  return {
    seconds: snapped,
    details: {
      estimatedSeconds,
      sizeBytes,
    },
    reason: "size-heuristic",
  };
}

function resolveExistingDuration(metadata, skipExisting = false) {
  if (!metadata || skipExisting) {
    return null;
  }
  const fromVideoLength = toNumber(metadata.videoLengthSeconds);
  if (fromVideoLength) {
    return {
      seconds: fromVideoLength,
      reason: "existing-videoLength",
    };
  }
  const fromDuration = parseDurationString(metadata.duration);
  if (fromDuration) {
    return {
      seconds: fromDuration,
      reason: "existing-duration-string",
    };
  }
  return null;
}

function resolveFromExtension(metadata) {
  if (!metadata) {
    return null;
  }
  const extensionSeconds = toNumber(metadata.extendedBySeconds);
  const baseMediaId = metadata.extendedFromMediaId;
  if (!extensionSeconds || !baseMediaId) {
    return null;
  }
  const baseSeconds = computedLengths.get(baseMediaId);
  if (!baseSeconds) {
    return null;
  }
  return {
    seconds: baseSeconds + extensionSeconds,
    reason: "extension-chain",
    details: {
      baseMediaId,
      baseSeconds,
      extensionSeconds,
    },
  };
}

function determineTargetSeconds(media, skipExisting = false) {
  const metadata = media.metadata || {};

  const existing = resolveExistingDuration(metadata, skipExisting);
  if (existing) {
    return existing;
  }

  const fromExtension = resolveFromExtension(metadata);
  if (fromExtension) {
    return fromExtension;
  }

  const heuristic = guessFromSize(media);
  if (heuristic) {
    return heuristic;
  }

  // Fallback to default 5 seconds if no better information
  return {
    seconds: 5,
    reason: "fallback-default",
  };
}

async function fetchAllVideos() {
  const results = [];
  let lastEvaluatedKey;
  do {
    const queryParams = {
      TableName: TABLE_NAME,
      IndexName: "GSI8",
      KeyConditionExpression: "GSI8PK = :pk AND begins_with(GSI8SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": "MEDIA_BY_TYPE_AND_CREATOR",
        ":skPrefix": "video#",
      },
      ScanIndexForward: true, // oldest first so extensions see their base durations
      Limit: 200,
    };
    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey;
    }
    const page = await docClient.send(new QueryCommand(queryParams));
    const items = page.Items || [];
    results.push(...items);
    lastEvaluatedKey = page.LastEvaluatedKey;
    console.log(
      `📹 Retrieved batch of ${items.length} videos (total so far: ${results.length})`
    );
    if (limit && results.length >= limit) {
      console.log("⏹️ Limit reached, stopping pagination");
      return results.slice(0, limit);
    }
  } while (lastEvaluatedKey);
  return results;
}

async function backfillVideo(media) {
  const { seconds, reason, details } = determineTargetSeconds(
    media,
    forceUpdate
  );
  if (!Number.isFinite(seconds) || seconds <= 0) {
    console.warn(`⚠️ Could not determine duration for media ${media.id}`);
    return { updated: false, skipped: true, reason: "unknown" };
  }

  const mediaId = getMediaId(media);
  if (!mediaId) {
    console.warn("⚠️  Skipping media with unknown id", media);
    return { updated: false, skipped: true, reason: "missing-id" };
  }

  computedLengths.set(mediaId, seconds);

  const metadata = media.metadata || {};
  const needsUpdate =
    forceUpdate ||
    toNumber(metadata.videoLengthSeconds) !== seconds ||
    !metadata.duration ||
    parseDurationString(metadata.duration) !== seconds ||
    metadata.videoLengthSource !== reason;

  if (!needsUpdate) {
    return { updated: false, skipped: true, reason: "already-set" };
  }

  if (isDryRun) {
    console.log(
      `💡 [dry-run] Would update media ${mediaId} → ${seconds}s (${reason})${
        forceUpdate ? " [FORCED]" : ""
      }`
    );
    return { updated: false, skipped: false, reason };
  }

  const updateExpression =
    "SET metadata.#videoLengthSeconds = :seconds, " +
    "metadata.#duration = :durationLabel, " +
    "metadata.#videoLengthSource = :source, " +
    "updatedAt = :updatedAt";

  const expressionAttributeNames = {
    "#videoLengthSeconds": "videoLengthSeconds",
    "#duration": "duration",
    "#videoLengthSource": "videoLengthSource",
  };

  const expressionAttributeValues = {
    ":seconds": seconds,
    ":durationLabel": `${seconds}s`,
    ":source": reason,
    ":updatedAt": new Date().toISOString(),
  };

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: media.PK, SK: media.SK },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
    console.log(
      `✅ Updated media ${mediaId}: ${seconds}s (${reason})` +
        (details && details.sizeBytes
          ? ` [size=${Math.round(details.sizeBytes / 1024)} KB]`
          : "")
    );
    return { updated: true, skipped: false, reason };
  } catch (error) {
    console.error(`❌ Failed to update media ${mediaId}:`, error);
    return { updated: false, skipped: false, reason: "error" };
  }
}

async function main() {
  console.log(
    `🚀 Starting video length backfill (dryRun=${isDryRun}, force=${forceUpdate})`
  );
  console.log(
    `ℹ️ Using heuristic bytes-per-second baseline: ${heuristicBytesPerSecond} B/s`
  );
  if (forceUpdate) {
    console.log(
      "⚠️  FORCE mode enabled - will update ALL videos regardless of existing values"
    );
  }

  const videos = await fetchAllVideos();
  console.log(`📦 Total videos fetched: ${videos.length}`);

  const stats = {
    processed: 0,
    updated: 0,
    skippedAlreadySet: 0,
    skippedUnknown: 0,
    errors: 0,
    reasons: new Map(),
  };

  for (const media of videos) {
    stats.processed += 1;
    const result = await backfillVideo(media);
    if (result.updated) {
      stats.updated += 1;
    }
    if (result.skipped && result.reason === "already-set") {
      stats.skippedAlreadySet += 1;
    } else if (result.skipped && result.reason === "unknown") {
      stats.skippedUnknown += 1;
    }
    if (result.reason === "error") {
      stats.errors += 1;
    }
    if (!stats.reasons.has(result.reason)) {
      stats.reasons.set(result.reason, 0);
    }
    stats.reasons.set(result.reason, stats.reasons.get(result.reason) + 1);
  }

  console.log("\n📊 Backfill summary");
  console.log(`   Processed:        ${stats.processed}`);
  console.log(`   Updated:          ${stats.updated}`);
  console.log(`   Already correct:  ${stats.skippedAlreadySet}`);
  console.log(`   Unknown skipped:  ${stats.skippedUnknown}`);
  console.log(`   Errors:           ${stats.errors}`);
  console.log("   Reasons:");
  for (const [reason, count] of stats.reasons.entries()) {
    console.log(`     - ${reason}: ${count}`);
  }

  console.log("✅ Backfill complete");
}

main().catch((error) => {
  console.error("❌ Fatal error during backfill", error);
  process.exit(1);
});
