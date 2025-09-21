/**
 * backfill-i2v-thumbnails.js
 *
 * Migration script to backfill thumbnailUrl and thumbnailUrls for generated videos
 * by copying them from their source images via the I2V job records.
 *
 * Background:
 * - When a video is generated via I2V (image-to-video), we create an I2VJobEntity
 * - The jobId matches the generated video's mediaId
 * - The job.mediaId points to the source image
 * - This script copies thumbnailUrl and thumbnailUrls from source to generated video
 *
 * Logic:
 * 1. Query all video media using GSI8 (MEDIA_BY_TYPE_AND_CREATOR with type="video")
 * 2. For each video, find the corresponding I2V job using the video's mediaId as jobId
 * 3. If job exists, get the source image media using job.mediaId
 * 4. Copy thumbnailUrl and thumbnailUrls from source image to video
 *
 * Usage:
 *   node backfill-i2v-thumbnails.js --env=local [--dry-run]
 *   node backfill-i2v-thumbnails.js --env=stage [--dry-run]
 *   node backfill-i2v-thumbnails.js --env=prod [--dry-run]
 *
 * Options:
 *   --env=<environment>  Load env vars from .env.<environment> (or explicit path)
 *   --dry-run            Show changes without applying
 *
 * Required ENV:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION
 * - DYNAMODB_TABLE
 * - LOCAL_AWS_ENDPOINT (optional for local)
 */

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Better crash reporting
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

// CLI args
const isDryRun = process.argv.includes("--dry-run");
const envArg = process.argv.find((a) => a.startsWith("--env="));
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

console.log(`📋 Loading env from: ${envPath}`);
dotenv.config({ path: envPath });

// Validate required env vars
const requiredEnvVars = ["DYNAMODB_TABLE"];
const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingEnvVars.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
  process.exit(1);
}

// AWS SDK v3 setup
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = process.env.DYNAMODB_TABLE;
const isLocal = process.env.LOCAL_AWS_ENDPOINT ? true : false;

// AWS client config
const clientConfig = {};

if (isLocal) {
  clientConfig.endpoint = process.env.LOCAL_AWS_ENDPOINT;
  clientConfig.region = process.env.AWS_REGION || "us-east-1";
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  };
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

/**
 * Get all video media using GSI8 pagination
 */
async function getAllVideoMedia() {
  const allVideos = [];
  let lastEvaluatedKey = undefined;

  do {
    const queryParams = {
      TableName: TABLE_NAME,
      IndexName: "GSI8",
      KeyConditionExpression:
        "GSI8PK = :gsi8pk AND begins_with(GSI8SK, :gsi8sk)",
      ExpressionAttributeValues: {
        ":gsi8pk": "MEDIA_BY_TYPE_AND_CREATOR",
        ":gsi8sk": "video#",
      },
      Limit: 200,
      ScanIndexForward: false, // newest first
    };

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    try {
      const result = await docClient.send(new QueryCommand(queryParams));
      const videos = result.Items || [];
      allVideos.push(...videos);
      lastEvaluatedKey = result.LastEvaluatedKey;

      console.log(
        `📹 Found ${videos.length} videos in this batch (total: ${allVideos.length})`
      );
    } catch (error) {
      console.error("❌ Error querying video media:", error);
      throw error;
    }
  } while (lastEvaluatedKey);

  return allVideos;
}

/**
 * Get I2V job by job ID
 */
async function getI2VJob(jobId) {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `I2VJOB#${jobId}`,
          SK: "METADATA",
        },
      })
    );
    return result.Item || null;
  } catch (error) {
    console.error(`❌ Error getting I2V job ${jobId}:`, error);
    return null;
  }
}

/**
 * Get source media by media ID
 */
async function getSourceMedia(mediaId) {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `MEDIA#${mediaId}`,
          SK: "METADATA",
        },
      })
    );
    return result.Item || null;
  } catch (error) {
    console.error(`❌ Error getting source media ${mediaId}:`, error);
    return null;
  }
}

/**
 * Update video media with thumbnail information
 */
async function updateVideoThumbnails(
  videoMediaId,
  thumbnailUrl,
  thumbnailUrls
) {
  const updateParams = {
    TableName: TABLE_NAME,
    Key: {
      PK: `MEDIA#${videoMediaId}`,
      SK: "METADATA",
    },
    UpdateExpression: "SET updatedAt = :updatedAt",
    ExpressionAttributeValues: {
      ":updatedAt": new Date().toISOString(),
    },
  };

  // Build update expression dynamically
  const updates = [];
  if (thumbnailUrl) {
    updates.push("thumbnailUrl = :thumbnailUrl");
    updateParams.ExpressionAttributeValues[":thumbnailUrl"] = thumbnailUrl;
  }
  if (thumbnailUrls) {
    updates.push("thumbnailUrls = :thumbnailUrls");
    updateParams.ExpressionAttributeValues[":thumbnailUrls"] = thumbnailUrls;
  }

  if (updates.length > 0) {
    updateParams.UpdateExpression = `SET ${updates.join(
      ", "
    )}, updatedAt = :updatedAt`;
  }

  if (isDryRun) {
    console.log(`🔍 [DRY RUN] Would update video ${videoMediaId} with:`, {
      thumbnailUrl: thumbnailUrl || "(unchanged)",
      thumbnailUrls: thumbnailUrls || "(unchanged)",
    });
    return true;
  }

  try {
    await docClient.send(new UpdateCommand(updateParams));
    return true;
  } catch (error) {
    console.error(`❌ Error updating video ${videoMediaId}:`, error);
    return false;
  }
}

/**
 * Process a single video media item
 */
async function processVideo(video) {
  const videoId = video.id;

  // Skip if video already has thumbnails
  if (video.thumbnailUrl && video.thumbnailUrls) {
    return { status: "skipped", reason: "already_has_thumbnails" };
  }

  // Try to find corresponding I2V job (jobId should match video mediaId)
  const job = await getI2VJob(videoId);
  if (!job) {
    return { status: "skipped", reason: "no_i2v_job_found" };
  }

  // Get source media from the job
  const sourceMedia = await getSourceMedia(job.mediaId);
  if (!sourceMedia) {
    return {
      status: "error",
      reason: "source_media_not_found",
      sourceMediaId: job.mediaId,
    };
  }

  // Check if source has thumbnails to copy
  if (!sourceMedia.thumbnailUrl && !sourceMedia.thumbnailUrls) {
    return { status: "skipped", reason: "source_has_no_thumbnails" };
  }

  // Update video with source thumbnails
  const success = await updateVideoThumbnails(
    videoId,
    sourceMedia.thumbnailUrl,
    sourceMedia.thumbnailUrls
  );

  if (success) {
    return {
      status: "updated",
      sourceMediaId: job.mediaId,
      copiedThumbnailUrl: !!sourceMedia.thumbnailUrl,
      copiedThumbnailUrls: !!sourceMedia.thumbnailUrls,
    };
  } else {
    return { status: "error", reason: "update_failed" };
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log("🚀 Starting I2V thumbnail backfill...");
  console.log(`📋 Table: ${TABLE_NAME}`);
  console.log(`🌍 Mode: ${isLocal ? "Local" : "AWS"}`);
  console.log(`🔍 Run: ${isDryRun ? "DRY RUN" : "LIVE UPDATE"}`);
  console.log("");

  // Statistics
  let stats = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    reasons: {},
  };

  try {
    // Step 1: Get all video media
    console.log("📹 Fetching all video media...");
    const videos = await getAllVideoMedia();
    stats.total = videos.length;

    if (videos.length === 0) {
      console.log("ℹ️ No video media found.");
      return;
    }

    console.log(`📹 Found ${videos.length} video media items to process`);
    console.log("");

    // Step 2: Process videos with concurrency control
    const CONCURRENCY = parseInt(
      process.env.I2V_BACKFILL_CONCURRENCY || "10",
      10
    );
    console.log(`⚡ Processing with concurrency: ${CONCURRENCY}`);

    // Process in batches to avoid overwhelming the database
    for (let i = 0; i < videos.length; i += CONCURRENCY) {
      const batch = videos.slice(i, i + CONCURRENCY);
      const batchPromises = batch.map(async (video, batchIndex) => {
        const globalIndex = i + batchIndex + 1;
        console.log(
          `🔄 [${globalIndex}/${videos.length}] Processing video: ${video.id}`
        );

        try {
          const result = await processVideo(video);

          // Update statistics
          if (result.status === "updated") {
            stats.updated++;
            console.log(
              `✅ [${globalIndex}/${videos.length}] Updated ${video.id} from source ${result.sourceMediaId}`
            );
          } else if (result.status === "skipped") {
            stats.skipped++;
            stats.reasons[result.reason] =
              (stats.reasons[result.reason] || 0) + 1;
            console.log(
              `⏭️ [${globalIndex}/${videos.length}] Skipped ${video.id}: ${result.reason}`
            );
          } else if (result.status === "error") {
            stats.errors++;
            stats.reasons[result.reason] =
              (stats.reasons[result.reason] || 0) + 1;
            console.log(
              `❌ [${globalIndex}/${videos.length}] Error ${video.id}: ${result.reason}`
            );
          }
        } catch (error) {
          stats.errors++;
          console.error(
            `❌ [${globalIndex}/${videos.length}] Unexpected error processing ${video.id}:`,
            error
          );
        }
      });

      // Wait for batch to complete
      await Promise.all(batchPromises);

      // Small delay between batches to be gentle on the database
      if (i + CONCURRENCY < videos.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error("❌ Fatal error during migration:", error);
    process.exit(1);
  }

  // Final statistics
  console.log("");
  console.log("📊 Migration Complete!");
  console.log("========================");
  console.log(`📹 Total videos processed: ${stats.total}`);
  console.log(`✅ Updated: ${stats.updated}`);
  console.log(`⏭️ Skipped: ${stats.skipped}`);
  console.log(`❌ Errors: ${stats.errors}`);

  if (Object.keys(stats.reasons).length > 0) {
    console.log("");
    console.log("📋 Breakdown by reason:");
    Object.entries(stats.reasons).forEach(([reason, count]) => {
      console.log(`   ${reason}: ${count}`);
    });
  }

  if (isDryRun) {
    console.log("");
    console.log("🔍 This was a DRY RUN - no changes were made.");
    console.log("💡 Run without --dry-run to apply changes.");
  }
}

// Execute main function
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
}
