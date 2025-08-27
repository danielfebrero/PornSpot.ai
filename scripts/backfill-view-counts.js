#!/usr/bin/env node
/**
 * backfill-view-counts.js
 *
 * Backfill script for ViewCount entities
 * This script calculates and creates ViewCount entities for weekly and monthly periods
 * by summing all media views, album views, and profile views since launch
 *
 * Usage:
 *   node backfill-view-counts.js --env=local [--dry-run]
 *   node backfill-view-counts.js --env=prod [--dry-run]
 *
 * Options:
 *   --env=<environment>    Load environment variables from .env.<environment>
 *   --dry-run             Show what would be updated without making changes
 *
 * ENV variables required:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION
 * - DYNAMODB_TABLE (name of the table)
 * - LOCAL_AWS_ENDPOINT (for local development)
 */

// CommonJS requires
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Global error handlers for debugging
process.on("unhandledRejection", function (reason) {
  console.error(
    "UNHANDLED REJECTION:",
    reason,
    typeof reason === "object" ? JSON.stringify(reason, null, 2) : ""
  );
  process.exit(1);
});
process.on("uncaughtException", function (err) {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

// Parse command line arguments
const isDryRun = process.argv.includes("--dry-run");
const envArg = process.argv.find(function (arg) {
  return arg.startsWith("--env=");
});
let envFile = ".env";
if (envArg) {
  const envName = envArg.split("=")[1];
  envFile = `.env.${envName}`;
}

// Load environment variables
const envPath = path.resolve(__dirname, envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded environment from ${envFile}`);
} else {
  console.warn(`⚠️ Environment file ${envFile} not found, using default .env`);
  dotenv.config();
}

// AWS SDK requires (for local compatibility)
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");

const isLocal = process.env["AWS_SAM_LOCAL"] === "true";

const clientConfig = {};

if (isLocal) {
  clientConfig.endpoint = "http://pornspot-local-aws:4566";
  clientConfig.region = "us-east-1";
  clientConfig.credentials = {
    accessKeyId: "test",
    secretAccessKey: "test",
  };
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env["DYNAMODB_TABLE"];

/**
 * Calculate total view counts from all media, albums, and user profiles
 */
async function calculateTotalViewCounts() {
  console.log("🔍 Calculating total view counts from all sources...");

  let totalMediaViews = 0;
  let totalAlbumViews = 0;
  let totalProfileViews = 0;

  // Get all media views using GSI4 (MEDIA index)
  console.log("📊 Querying media entities for view counts...");
  let lastKey;
  do {
    const mediaResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI4",
        KeyConditionExpression: "GSI4PK = :pk",
        ExpressionAttributeValues: {
          ":pk": "MEDIA",
        },
        ProjectionExpression: "viewCount",
        ExclusiveStartKey: lastKey,
      })
    );

    if (mediaResult.Items) {
      for (const item of mediaResult.Items) {
        totalMediaViews += item["viewCount"] || 0;
      }
    }

    lastKey = mediaResult.LastEvaluatedKey;
    console.log(`📈 Media views so far: ${totalMediaViews}`);
  } while (lastKey);

  // Get all album views using GSI1 (ALBUM index)
  console.log("📊 Querying album entities for view counts...");
  lastKey = undefined;
  do {
    const albumResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": "ALBUM",
        },
        ProjectionExpression: "viewCount",
        ExclusiveStartKey: lastKey,
      })
    );

    if (albumResult.Items) {
      for (const item of albumResult.Items) {
        totalAlbumViews += item["viewCount"] || 0;
      }
    }

    lastKey = albumResult.LastEvaluatedKey;
    console.log(`📈 Album views so far: ${totalAlbumViews}`);
  } while (lastKey);

  // Get all profile views using GSI1 (USER_EMAIL index)
  console.log("📊 Querying user entities for profile view counts...");
  lastKey = undefined;
  do {
    const userResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": "USER_EMAIL",
        },
        ProjectionExpression: "profileInsights.totalProfileViews",
        ExclusiveStartKey: lastKey,
      })
    );

    if (userResult.Items) {
      for (const item of userResult.Items) {
        const profileViews =
          item["profileInsights"] &&
          item["profileInsights"]["totalProfileViews"]
            ? item["profileInsights"]["totalProfileViews"]
            : 0;
        totalProfileViews += profileViews;
      }
    }

    lastKey = userResult.LastEvaluatedKey;
    console.log(`📈 Profile views so far: ${totalProfileViews}`);
  } while (lastKey);

  const total = totalMediaViews + totalAlbumViews + totalProfileViews;

  console.log(`✅ Total view counts calculated:`);
  console.log(`   📺 Media views: ${totalMediaViews}`);
  console.log(`   📁 Album views: ${totalAlbumViews}`);
  console.log(`   👤 Profile views: ${totalProfileViews}`);
  console.log(`   🎯 TOTAL VIEWS: ${total}`);

  return {
    totalMediaViews,
    totalAlbumViews,
    totalProfileViews,
    total,
  };
}

/**
 * Create ViewCount entities for a specific period
 */
async function createViewCountEntity(granularity, timestamp, viewCounts) {
  const now = new Date();

  const entity = {
    PK: `VIEW_COUNT#${granularity}`,
    SK: timestamp,
    EntityType: "ViewCount",
    granularity,
    timestamp,
    totalViews: viewCounts.total,
    newViews: viewCounts.total, // For backfill, newViews = totalViews
    mediaViews: viewCounts.totalMediaViews,
    albumViews: viewCounts.totalAlbumViews,
    profileViews: viewCounts.totalProfileViews,
    createdAt: now.toISOString(),
    lastUpdated: now.toISOString(),
    isBackfilled: true, // Flag to indicate this was backfilled
  };

  if (isDryRun) {
    console.log(
      `🔍 DRY RUN: Would create ${granularity} ViewCount entity for ${timestamp}`
    );
    console.log("   Entity data:", JSON.stringify(entity, null, 2));
    return;
  }

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: entity,
        ConditionExpression: "attribute_not_exists(PK)", // Only create if doesn't exist
      })
    );

    console.log(`✅ Created ${granularity} ViewCount entity for ${timestamp}`);
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      console.log(
        `⚠️  ${granularity} ViewCount entity already exists for ${timestamp}`
      );
    } else {
      console.error(
        `❌ Failed to create ${granularity} ViewCount entity:`,
        error
      );
      throw error;
    }
  }
}

/**
 * Calculate date ranges for backfill (website launched 2 days ago)
 */
function calculateDateRanges() {
  const now = new Date();
  const launchDate = new Date(now);
  launchDate.setDate(launchDate.getDate() - 2); // 2 days ago

  // Current week (Monday to Sunday)
  const currentWeek = new Date(now);
  const dayOfWeek = currentWeek.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days since Monday
  currentWeek.setDate(currentWeek.getDate() - daysToMonday);
  currentWeek.setHours(0, 0, 0, 0);

  // Current month
  const currentMonth = new Date(now);
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);

  return {
    currentWeek: currentWeek.toISOString(),
    currentMonth: currentMonth.toISOString(),
    launchDate,
  };
}

/**
 * Main backfill function
 */
async function backfillViewCounts() {
  console.log("🚀 Starting ViewCount backfill process...");

  try {
    // Calculate date ranges
    const dateRanges = calculateDateRanges();
    const currentWeek = dateRanges.currentWeek;
    const currentMonth = dateRanges.currentMonth;
    const launchDate = dateRanges.launchDate;

    console.log(`📅 Launch date: ${launchDate.toLocaleDateString()}`);
    console.log(
      `📅 Current week start: ${new Date(currentWeek).toLocaleDateString()}`
    );
    console.log(
      `📅 Current month start: ${new Date(currentMonth).toLocaleDateString()}`
    );

    // Calculate total view counts
    if (isDryRun) {
      console.log("🔍 DRY RUN: Would calculate view counts from:");
      console.log("   • Media entities via GSI4 (MEDIA)");
      console.log("   • Album entities via GSI1 (ALBUM)");
      console.log("   • User entities via GSI1 (USER_EMAIL)");
      console.log("   Skipping actual calculation in dry-run mode.");

      // Mock data for dry run
      const viewCounts = {
        totalMediaViews: 1000,
        totalAlbumViews: 500,
        totalProfileViews: 250,
        total: 1750,
      };

      // Create weekly ViewCount entity
      console.log("\n📊 Creating weekly ViewCount entity...");
      await createViewCountEntity("weekly", currentWeek, viewCounts);

      // Create monthly ViewCount entity
      console.log("\n📊 Creating monthly ViewCount entity...");
      await createViewCountEntity("monthly", currentMonth, viewCounts);

      console.log("\n🎉 ViewCount backfill (DRY RUN) completed successfully!");
      console.log("\n📋 Summary:");
      console.log(
        `   • Weekly entity would be created for: ${new Date(
          currentWeek
        ).toLocaleDateString()}`
      );
      console.log(
        `   • Monthly entity would be created for: ${new Date(
          currentMonth
        ).toLocaleDateString()}`
      );
      console.log(
        `   • Total views would be backfilled: ${viewCounts.total} (mock data)`
      );

      return;
    }

    const viewCounts = await calculateTotalViewCounts();

    // Create weekly ViewCount entity
    console.log("\n📊 Creating weekly ViewCount entity...");
    await createViewCountEntity("weekly", currentWeek, viewCounts);

    // Create monthly ViewCount entity
    console.log("\n📊 Creating monthly ViewCount entity...");
    await createViewCountEntity("monthly", currentMonth, viewCounts);

    console.log("\n🎉 ViewCount backfill completed successfully!");
    console.log("\n📋 Summary:");
    console.log(
      `   • Weekly entity created for: ${new Date(
        currentWeek
      ).toLocaleDateString()}`
    );
    console.log(
      `   • Monthly entity created for: ${new Date(
        currentMonth
      ).toLocaleDateString()}`
    );
    console.log(`   • Total views backfilled: ${viewCounts.total}`);
  } catch (error) {
    console.error("❌ ViewCount backfill failed:", error);
    process.exit(1);
  }
}

/**
 * Check if required environment variables are set
 */
function validateEnvironment() {
  if (!TABLE_NAME) {
    console.error("❌ DYNAMODB_TABLE environment variable is required");
    process.exit(1);
  }

  console.log(`✅ Environment validated`);
  console.log(`   • Table: ${TABLE_NAME}`);
  console.log(`   • Local mode: ${isLocal}`);
  console.log(`   • Dry run: ${isDryRun}`);
}

// Main execution
if (require.main === module) {
  console.log("📊 ViewCount Backfill Script");
  console.log("===========================\n");

  validateEnvironment();
  backfillViewCounts().catch(function (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
}

module.exports = { backfillViewCounts, calculateTotalViewCounts };
