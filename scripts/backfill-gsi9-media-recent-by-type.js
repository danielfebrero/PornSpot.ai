/**
 * backfill-gsi9-media-recent-by-type.js
 *
 * Migration script to backfill `GSI9PK` and `GSI9SK` for Media records.
 *
 * - GSI9PK = "RECENT_MEDIA_BY_TYPE"
 * - GSI9SK = "<type>#<createdAt>#<mediaId>"
 *
 * This index enables efficient querying of all media by type, sorted by creation date.
 *
 * Usage:
 *   node backfill-gsi9-media-recent-by-type.js --env=local [--dry-run]
 *   node backfill-gsi9-media-recent-by-type.js --env=stage [--dry-run]
 *   node backfill-gsi9-media-recent-by-type.js --env=prod [--dry-run]
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

// Load env
const envPath = path.resolve(__dirname, envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`Loaded env from ${envPath}`);
} else if (fs.existsSync(path.resolve(__dirname, ".env"))) {
  dotenv.config({ path: path.resolve(__dirname, ".env") });
  console.log(`Loaded default .env from scripts directory`);
} else {
  console.warn(`Warning: Env file not found (${envPath}). Using process.env.`);
}

// AWS SDK v3
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = process.env["DYNAMODB_TABLE"];
if (!TABLE_NAME) {
  console.error("Error: DYNAMODB_TABLE env var is required");
  process.exit(1);
}

const isLocal = !!process.env["LOCAL_AWS_ENDPOINT"];
const clientConfig = {};
if (isLocal) {
  clientConfig.endpoint = process.env["LOCAL_AWS_ENDPOINT"];
  clientConfig.region = process.env["AWS_REGION"] || "us-east-1";
  clientConfig.credentials = {
    accessKeyId: process.env["AWS_ACCESS_KEY_ID"] || "test",
    secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] || "test",
  };
} else {
  clientConfig.region = process.env["AWS_REGION"] || "us-east-1";
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client);

function expectedGsi9Sk({ type, createdAt, mediaId }) {
  return `${type}#${createdAt}#${mediaId}`;
}

async function main() {
  console.log("🚀 Starting backfill for Media GSI9...");
  console.log(`📋 Table: ${TABLE_NAME}`);
  console.log(`🌍 Mode: ${isLocal ? "Local" : "AWS"}`);
  console.log(`🔍 Run: ${isDryRun ? "DRY RUN" : "LIVE UPDATE"}`);
  console.log("");

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let lastEvaluatedKey = undefined;
  const PAGE_SIZE = 1000; // Increased for faster processing; ensure <1MB total per query based on item sizes
  const CONCURRENCY = parseInt(
    process.env.GSI9_BACKFILL_CONCURRENCY || "200",
    10
  ); // Higher default for speed; adjust via env if throttling occurs

  do {
    let scanResult;
    try {
      // Use GSI4 to iterate media chronologically: GSI4PK = "MEDIA", GSI4SK = "{createdAt}#{mediaId}"
      scanResult = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI4",
          KeyConditionExpression: "GSI4PK = :pk",
          ExpressionAttributeValues: { ":pk": "MEDIA" },
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: PAGE_SIZE,
          ScanIndexForward: true, // oldest → newest; order doesn't matter for backfill
        })
      );
    } catch (err) {
      console.error("❌ Query error:", err);
      break;
    }

    const items = scanResult.Items || [];
    // Process updates in parallel with high concurrency
    const processItem = async (item) => {
      try {
        const mediaId = item.id || (item.PK || "").split("#")[1] || "";
        const createdAt = item.createdAt;
        const type = item.type;

        if (!type || !createdAt || !mediaId) {
          console.warn(
            `⚠️  Skipping media missing required fields (id:${mediaId}, type:${type}, createdAt:${createdAt})`
          );
          skipped++;
          return;
        }

        const needsGsi9Pk = item.GSI9PK !== "RECENT_MEDIA_BY_TYPE";
        const desiredSk = expectedGsi9Sk({
          type,
          createdAt,
          mediaId,
        });
        const needsGsi9Sk = item.GSI9SK !== desiredSk;

        if (!needsGsi9Pk && !needsGsi9Sk) {
          skipped++;
          return;
        }

        const updates = [];
        const values = {};

        if (needsGsi9Pk) {
          updates.push("GSI9PK = :gsi9pk");
          values[":gsi9pk"] = "RECENT_MEDIA_BY_TYPE";
        }
        if (needsGsi9Sk) {
          updates.push("GSI9SK = :gsi9sk");
          values[":gsi9sk"] = desiredSk;
        }

        console.log(
          `📝 ${
            isDryRun ? "Would update" : "Updating"
          } media ${mediaId}: ${updates.join(", ")}`
        );

        if (!isDryRun) {
          await docClient.send(
            new UpdateCommand({
              TableName: TABLE_NAME,
              Key: { PK: item.PK, SK: item.SK },
              UpdateExpression: `SET ${updates.join(", ")}`,
              ExpressionAttributeValues: values,
              ConditionExpression: "attribute_exists(PK)",
            })
          );
        }

        updated++;
      } catch (err) {
        console.error(`❌ Error processing media ${item.id}:`, err);
        errors++;
      }
    };

    // Chunk into concurrent slices
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const slice = items.slice(i, i + CONCURRENCY);
      await Promise.all(slice.map((it) => processItem(it)));
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
    if (lastEvaluatedKey) console.log("📄 Processed page, continuing...");
  } while (lastEvaluatedKey);

  console.log("");
  console.log("🏁 Backfill complete");
  console.log(`✅ ${isDryRun ? "Would update" : "Updated"}: ${updated}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  if (isDryRun) console.log("🔄 Run without --dry-run to apply changes.");
}

main().catch((err) => {
  console.error("💥 Script failed:", err);
  process.exit(1);
});
