/**
 * backfill-gsi8-albums-visibility-updated.js
 *
 * Backfill script to populate GSI8PK and GSI8SK for Album entities.
 *
 * GSI8 Index Purpose: Track visibility changes and updates for albums
 * Requirements:
 *   GSI8PK (Album) = "VISIBILITY_UPDATED"
 *   GSI8SK (Album) = "{isPublic}#{updatedAt}#{albumId}"
 *
 * This enables queries like:
 * - Get all recently updated albums by visibility status
 * - Track public/private album updates chronologically
 * - Monitor album visibility changes over time
 *
 * Usage examples:
 *   node backfill-gsi8-albums-visibility-updated.js --env=local [--dry-run]
 *   node backfill-gsi8-albums-visibility-updated.js --env=stage --concurrency=50
 *   node backfill-gsi8-albums-visibility-updated.js --env=prod --dry-run
 *
 * CLI options:
 *   --env=<environment>   Load env vars from .env.<environment> (default: .env)
 *   --dry-run              Preview updates without writing to DynamoDB
 *   --concurrency=<num>    Parallel update concurrency (default 25)
 *   --page-size=<num>      Items fetched per query (default 250)
 */

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Fail fast on unhandled errors
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

const isDryRun = process.argv.includes("--dry-run");

// Parse environment argument
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

// Parse CLI arguments for concurrency and page size
const concurrencyArg = process.argv.find((arg) =>
  arg.startsWith("--concurrency=")
);
const pageSizeArg = process.argv.find((arg) => arg.startsWith("--page-size="));
const CONCURRENCY = Math.max(
  1,
  parseInt(
    concurrencyArg?.split("=")[1] ||
      process.env.GSI8_BACKFILL_CONCURRENCY ||
      "25",
    10
  )
);
const PAGE_SIZE = Math.max(
  1,
  parseInt(
    pageSizeArg?.split("=")[1] || process.env.GSI8_BACKFILL_PAGE_SIZE || "250",
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
} else {
  clientConfig.region = process.env["AWS_REGION"] || "us-east-1";
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * Normalize isPublic value to "true" or "false" string
 */
function normalizeIsPublic(value) {
  if (value === undefined || value === null) return null;
  if (value === "true" || value === "false") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === "1" || value === 1) return "true";
  if (value === "0" || value === 0) return "false";
  const lowered = String(value).toLowerCase();
  if (lowered === "true") return "true";
  if (lowered === "false") return "false";
  return null;
}

/**
 * Process all album entities and backfill GSI8PK and GSI8SK
 */
async function processAlbums() {
  console.log("");
  console.log(`▶️  Processing Albums (GSI8PK=VISIBILITY_UPDATED)`);

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
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :partition",
        ExpressionAttributeValues: {
          ":partition": "ALBUM",
          ":metadata": "METADATA",
        },
        FilterExpression: "SK = :metadata",
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: PAGE_SIZE,
      };

      queryResult = await docClient.send(new QueryCommand(queryInput));
    } catch (error) {
      console.error(`❌ Query error while fetching albums:`, error);
      break;
    }

    const items = queryResult.Items || [];
    scanned += items.length;

    // Process in batches for concurrency control
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const slice = items.slice(i, i + CONCURRENCY);
      await Promise.all(
        slice.map(async (item) => {
          const pk = item.PK;
          const sk = item.SK;
          const albumId = item.id || (pk ? pk.split("#")[1] : "");
          const normalizedIsPublic = normalizeIsPublic(item.isPublic);
          const updatedAt = item.updatedAt;

          // Validate required fields
          if (!pk || !sk || !normalizedIsPublic || !updatedAt || !albumId) {
            missingFields++;
            if (!normalizedIsPublic) {
              console.warn(
                `⚠️  Album ${albumId} missing or invalid isPublic field`
              );
            }
            if (!updatedAt) {
              console.warn(`⚠️  Album ${albumId} missing updatedAt field`);
            }
            return;
          }

          // Calculate expected GSI8 values
          const expectedGsi8Pk = "VISIBILITY_UPDATED";
          const expectedGsi8Sk = `${normalizedIsPublic}#${updatedAt}#${albumId}`;

          // Check if update is needed
          const needsPk = item.GSI8PK !== expectedGsi8Pk;
          const needsSk = item.GSI8SK !== expectedGsi8Sk;

          if (!needsPk && !needsSk) {
            skipped++;
            return;
          }

          // Build update expression
          const updateExpressions = [];
          const values = {};

          if (needsPk) {
            updateExpressions.push("GSI8PK = :gsi8pk");
            values[":gsi8pk"] = expectedGsi8Pk;
          }

          if (needsSk) {
            updateExpressions.push("GSI8SK = :gsi8sk");
            values[":gsi8sk"] = expectedGsi8Sk;
          }

          if (updateExpressions.length === 0) {
            skipped++;
            return;
          }

          // Dry run mode - just count
          if (isDryRun) {
            updated++;
            if (updated <= 5) {
              console.log(
                `  [DRY RUN] Would update album ${albumId}: GSI8SK=${expectedGsi8Sk}`
              );
            }
            return;
          }

          // Perform the update
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

            // Log first few updates for verification
            if (updated <= 5) {
              console.log(
                `  ✅ Updated album ${albumId}: GSI8SK=${expectedGsi8Sk}`
              );
            }
          } catch (error) {
            errors++;
            console.error(`❌ Failed to update album ${albumId}:`, error);
          }
        })
      );
    }

    lastEvaluatedKey = queryResult.LastEvaluatedKey;

    if (lastEvaluatedKey) {
      console.log(
        `... processed ${scanned} album items so far (updated: ${updated}, skipped: ${skipped}, missing: ${missingFields})`
      );
    }
  } while (lastEvaluatedKey);

  console.log("");
  console.log(`✅ Albums updated: ${updated}${isDryRun ? " (dry-run)" : ""}`);
  console.log(`⏭️  Albums skipped: ${skipped}`);
  console.log(`⚠️  Albums missing data: ${missingFields}`);
  console.log(`❌ Albums errors: ${errors}`);

  return { updated, skipped, missingFields, errors };
}

async function main() {
  console.log("🚀 Starting GSI8 backfill for album visibility updates");
  console.log(`📋 Table: ${TABLE_NAME}`);
  console.log(`🌍 Mode: ${isLocal ? "Local" : "AWS"}`);
  console.log(`🔍 Run: ${isDryRun ? "DRY RUN" : "LIVE UPDATE"}`);
  console.log(`⚙️  Concurrency: ${CONCURRENCY}, Page size: ${PAGE_SIZE}`);

  const result = await processAlbums();

  console.log("");
  console.log("🏁 Backfill run complete");
  console.log(`   Updated: ${result.updated}${isDryRun ? " (dry-run)" : ""}`);
  console.log(`   Skipped: ${result.skipped}`);
  console.log(`   Missing: ${result.missingFields}`);
  console.log(`   Errors: ${result.errors}`);

  if (isDryRun) {
    console.log("");
    console.log("🔄 Re-run without --dry-run to apply updates");
  }

  if (result.errors > 0) {
    console.log("");
    console.log("⚠️  Some errors occurred during backfill. Review logs above.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("💥 Backfill failed:", error);
  process.exit(1);
});
