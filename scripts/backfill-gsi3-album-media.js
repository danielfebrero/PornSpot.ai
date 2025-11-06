/**
 * backfill-gsi3-album-media.js
 *
 * Backfill script to add GSI3 keys to AlbumMedia entities for efficient
 * querying of media within an album sorted by addedAt.
 *
 * Requirements:
 *   GSI3PK (AlbumMedia) = "ALBUM#<albumId>"
 *   GSI3SK (AlbumMedia) = "<addedAt>#<mediaId>"
 *
 * This allows efficient queries for all media in a specific album,
 * sorted by when they were added (descending for most recent first).
 *
 * Usage examples:
 *   node backfill-gsi3-album-media.js --env=local [--dry-run]
 *   node backfill-gsi3-album-media.js --env=stage --concurrency=75 --page-size=500
 *
 * CLI options:
 *   --env=<environment>   Load env vars from .env.<environment> (default: .env)
 *   --dry-run              Preview updates without writing to DynamoDB
 *   --concurrency=<num>    Parallel update concurrency (default 75)
 *   --page-size=<num>      Items fetched per scan (default 500)
 */

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

const isDryRun = process.argv.includes("--dry-run");

const envArg = process.argv.find((arg) => arg.startsWith("--env="));
let envFile = ".env";
if (envArg) {
  const envValue = envArg.split("=")[1];
  if (envValue && envValue.length > 0) {
    if (envValue.startsWith(".env")) {
      envFile = envValue;
    } else if (/^[\w.-]+$/.test(envValue)) {
      envFile = `.env.${envValue}`;
    } else {
      envFile = envValue;
    }
  }
}

const envPath = path.resolve(__dirname, envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`Loaded environment variables from ${envPath}`);
} else {
  const fallbackPath = path.resolve(__dirname, ".env");
  if (fs.existsSync(fallbackPath)) {
    dotenv.config({ path: fallbackPath });
    console.log(
      `Could not find ${envPath}, loaded default .env from script directory`
    );
  } else {
    console.warn(
      `Warning: Could not find env file ${envPath}. Proceeding with process.env as-is.`
    );
  }
}

const concurrencyArg = process.argv.find((arg) =>
  arg.startsWith("--concurrency=")
);
const pageSizeArg = process.argv.find((arg) => arg.startsWith("--page-size="));
const CONCURRENCY = Math.max(
  1,
  parseInt(
    concurrencyArg?.split("=")[1] ||
      process.env.GSI3_BACKFILL_CONCURRENCY ||
      "75",
    10
  )
);
const PAGE_SIZE = Math.max(
  1,
  parseInt(
    pageSizeArg?.split("=")[1] || process.env.GSI3_BACKFILL_PAGE_SIZE || "500",
    10
  )
);

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = process.env["DYNAMODB_TABLE"];
if (!TABLE_NAME) {
  console.error("Error: DYNAMODB_TABLE environment variable is required.");
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
  console.log(`Using local AWS endpoint: ${clientConfig.endpoint}`);
} else {
  clientConfig.region = process.env["AWS_REGION"] || "us-east-1";
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * Extract albumId from PK: "ALBUM#<albumId>"
 */
function extractAlbumId(item) {
  if (item.albumId) return item.albumId;
  if (item.PK && item.PK.startsWith("ALBUM#")) {
    return item.PK.split("#")[1];
  }
  return null;
}

/**
 * Extract mediaId from SK: "MEDIA#<mediaId>"
 */
function extractMediaId(item) {
  if (item.mediaId) return item.mediaId;
  if (item.SK && item.SK.startsWith("MEDIA#")) {
    return item.SK.split("#")[1];
  }
  return null;
}

async function processAlbumMediaRelationships() {
  console.log("\n▶️  Processing AlbumMedia relationships for GSI3 backfill");

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let missingFields = 0;
  let lastEvaluatedKey;
  let scanned = 0;

  do {
    let queryResult;
    try {
      const queryInput = {
        TableName: TABLE_NAME,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :gsi2pk",
        ExpressionAttributeValues: {
          ":gsi2pk": "ALBUM_MEDIA_BY_DATE",
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: PAGE_SIZE,
        ProjectionExpression:
          "PK, SK, albumId, mediaId, addedAt, GSI3PK, GSI3SK",
      };

      queryResult = await docClient.send(new QueryCommand(queryInput));
    } catch (error) {
      console.error(
        "❌ Query error while fetching AlbumMedia relationships:",
        error
      );
      break;
    }

    const items = queryResult.Items || [];
    scanned += items.length;

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const slice = items.slice(i, i + CONCURRENCY);
      await Promise.all(
        slice.map(async (item) => {
          const pk = item.PK;
          const sk = item.SK;
          const albumId = extractAlbumId(item);
          const mediaId = extractMediaId(item);
          const addedAt = item.addedAt;

          // Validate required fields
          if (!pk || !sk || !albumId || !mediaId || !addedAt) {
            missingFields++;
            console.log(
              `⚠️  Missing fields for item: PK=${pk}, SK=${sk}, albumId=${albumId}, mediaId=${mediaId}, addedAt=${addedAt}`
            );
            return;
          }

          const expectedGsi3Pk = `ALBUM#${albumId}`;
          const expectedGsi3Sk = `${addedAt}#${mediaId}`;

          const needsPk = item.GSI3PK !== expectedGsi3Pk;
          const needsSk = item.GSI3SK !== expectedGsi3Sk;

          if (!needsPk && !needsSk) {
            skipped++;
            return;
          }

          if (isDryRun) {
            console.log(
              `🔍 [DRY RUN] Would update: albumId=${albumId}, mediaId=${mediaId}`
            );
            console.log(
              `   GSI3PK: ${item.GSI3PK || "(none)"} → ${expectedGsi3Pk}`
            );
            console.log(
              `   GSI3SK: ${item.GSI3SK || "(none)"} → ${expectedGsi3Sk}`
            );
            updated++;
            return;
          }

          const updateExpressions = [];
          const values = {};

          if (needsPk) {
            updateExpressions.push("GSI3PK = :gsi3pk");
            values[":gsi3pk"] = expectedGsi3Pk;
          }

          if (needsSk) {
            updateExpressions.push("GSI3SK = :gsi3sk");
            values[":gsi3sk"] = expectedGsi3Sk;
          }

          if (updateExpressions.length === 0) {
            skipped++;
            return;
          }

          try {
            await docClient.send(
              new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { PK: pk, SK: sk },
                UpdateExpression: `SET ${updateExpressions.join(", ")}`,
                ExpressionAttributeValues: values,
                ConditionExpression: "attribute_exists(PK)",
              })
            );
            updated++;
          } catch (error) {
            errors++;
            console.error(
              `❌ Failed to update AlbumMedia (albumId: ${albumId}, mediaId: ${mediaId}):`,
              error.message
            );
          }
        })
      );
    }

    lastEvaluatedKey = queryResult.LastEvaluatedKey;

    if (lastEvaluatedKey) {
      console.log(
        `... processed ${scanned} relationships so far (updated: ${updated}, skipped: ${skipped}, missing: ${missingFields})`
      );
    }
  } while (lastEvaluatedKey);

  console.log("");
  console.log(
    `✅ AlbumMedia updates: ${updated}${isDryRun ? " (dry-run)" : ""}`
  );
  console.log(`⏭️  AlbumMedia skipped: ${skipped}`);
  console.log(`⚠️  AlbumMedia missing data: ${missingFields}`);
  console.log(`❌ AlbumMedia errors: ${errors}`);

  return { updated, skipped, missingFields, errors };
}

async function main() {
  console.log("🚀 Starting GSI3 backfill for AlbumMedia relationships");
  console.log(`📋 Table: ${TABLE_NAME}`);
  console.log(`🌍 Mode: ${isLocal ? "Local" : "AWS"}`);
  console.log(`🔍 Run: ${isDryRun ? "DRY RUN" : "LIVE UPDATE"}`);
  console.log(`⚙️  Concurrency: ${CONCURRENCY}, Page size: ${PAGE_SIZE}`);

  const results = await processAlbumMediaRelationships();

  console.log("");
  console.log("🏁 Backfill run complete");
  console.log(`   Updated: ${results.updated}${isDryRun ? " (dry-run)" : ""}`);
  console.log(`   Skipped: ${results.skipped}`);
  console.log(`   Missing: ${results.missingFields}`);
  console.log(`   Errors: ${results.errors}`);

  if (isDryRun) {
    console.log("");
    console.log("🔄 Re-run without --dry-run to apply updates");
  }
}

main().catch((error) => {
  console.error("💥 Backfill failed:", error);
  process.exit(1);
});
