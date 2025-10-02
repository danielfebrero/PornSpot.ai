/**
 * backfill-gsi5-visibility.js
 *
 * Backfill script to ensure Album and Media entities have the correct GSI5 keys.
 *
 * Requirements:
 *   GSI5PK (Album) = "ALBUM"
 *   GSI5SK (Album) = "<isPublic>#<createdAt>"
 *   GSI5PK (Media) = "MEDIA"
 *   GSI5SK (Media) = "<isPublic>#<createdAt>"
 *
 * Usage examples:
 *   node backfill-gsi5-visibility.js --env=local [--dry-run]
 *   node backfill-gsi5-visibility.js --env=stage --concurrency=50
 *
 * CLI options:
 *   --env=<environment>   Load env vars from .env.<environment> (default: .env)
 *   --dry-run              Preview updates without writing to DynamoDB
 *   --concurrency=<num>    Parallel update concurrency (default 25)
 *   --page-size=<num>      Items fetched per query (default 250)
 *   --skip-albums          Skip album processing
 *   --skip-media           Skip media processing
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
const shouldSkipAlbums = process.argv.includes("--skip-albums");
const shouldSkipMedia = process.argv.includes("--skip-media");

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
      process.env.GSI5_BACKFILL_CONCURRENCY ||
      "25",
    10
  )
);
const PAGE_SIZE = Math.max(
  1,
  parseInt(
    pageSizeArg?.split("=")[1] || process.env.GSI5_BACKFILL_PAGE_SIZE || "250",
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

async function processCollection({
  entityName,
  indexName,
  indexPartitionKey,
  partitionValue,
  desiredGsi5Pk,
}) {
  console.log("");
  console.log(`▶️  Processing ${entityName} (GSI5PK=${desiredGsi5Pk})`);

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
        IndexName: indexName,
        KeyConditionExpression: `${indexPartitionKey} = :partition`,
        ExpressionAttributeValues: {
          ":partition": partitionValue,
          ":metadata": "METADATA",
        },
        FilterExpression: "SK = :metadata",
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: PAGE_SIZE,
      };

      queryResult = await docClient.send(new QueryCommand(queryInput));
    } catch (error) {
      console.error(`❌ Query error while fetching ${entityName}:`, error);
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
          const id = item.id || (pk ? pk.split("#")[1] : "");
          const normalizedIsPublic = normalizeIsPublic(item.isPublic);
          const createdAt = item.createdAt;

          if (!pk || !sk || !normalizedIsPublic || !createdAt) {
            missingFields++;
            return;
          }

          const expectedGsi5Sk = `${normalizedIsPublic}#${createdAt}`;
          const needsSk = item.GSI5SK !== expectedGsi5Sk;
          const needsPk = item.GSI5PK !== desiredGsi5Pk;

          if (!needsSk && !needsPk) {
            skipped++;
            return;
          }

          const updateExpressions = [];
          const values = {};

          if (needsPk) {
            updateExpressions.push("GSI5PK = :gsi5pk");
            values[":gsi5pk"] = desiredGsi5Pk;
          }

          if (needsSk) {
            updateExpressions.push("GSI5SK = :gsi5sk");
            values[":gsi5sk"] = expectedGsi5Sk;
          }

          if (updateExpressions.length === 0) {
            skipped++;
            return;
          }

          if (isDryRun) {
            updated++;
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
            console.error(`❌ Failed to update ${entityName} ${id}:`, error);
          }
        })
      );
    }

    lastEvaluatedKey = queryResult.LastEvaluatedKey;

    if (lastEvaluatedKey) {
      console.log(
        `... processed ${scanned} ${entityName} items so far (updated: ${updated}, skipped: ${skipped}, missing: ${missingFields})`
      );
    }
  } while (lastEvaluatedKey);

  console.log("");
  console.log(
    `✅ ${entityName} updates: ${updated}${isDryRun ? " (dry-run)" : ""}`
  );
  console.log(`⏭️  ${entityName} skipped: ${skipped}`);
  console.log(`⚠️  ${entityName} missing data: ${missingFields}`);
  console.log(`❌ ${entityName} errors: ${errors}`);

  return { updated, skipped, missingFields, errors };
}

async function main() {
  console.log("🚀 Starting GSI5 backfill for albums and media");
  console.log(`📋 Table: ${TABLE_NAME}`);
  console.log(`🌍 Mode: ${isLocal ? "Local" : "AWS"}`);
  console.log(`🔍 Run: ${isDryRun ? "DRY RUN" : "LIVE UPDATE"}`);
  console.log(`⚙️  Concurrency: ${CONCURRENCY}, Page size: ${PAGE_SIZE}`);

  const results = [];

  if (!shouldSkipAlbums) {
    results.push(
      await processCollection({
        entityName: "albums",
        indexName: "GSI1",
        indexPartitionKey: "GSI1PK",
        partitionValue: "ALBUM",
        desiredGsi5Pk: "ALBUM",
      })
    );
  } else {
    console.log("⏭️  Skipping albums as requested");
  }

  if (!shouldSkipMedia) {
    results.push(
      await processCollection({
        entityName: "media",
        indexName: "GSI4",
        indexPartitionKey: "GSI4PK",
        partitionValue: "MEDIA",
        desiredGsi5Pk: "MEDIA",
      })
    );
  } else {
    console.log("⏭️  Skipping media as requested");
  }

  console.log("");
  console.log("🏁 Backfill run complete");
  const totals = results.reduce(
    (acc, res) => {
      acc.updated += res.updated;
      acc.skipped += res.skipped;
      acc.missing += res.missingFields;
      acc.errors += res.errors;
      return acc;
    },
    { updated: 0, skipped: 0, missing: 0, errors: 0 }
  );

  console.log(`   Updated: ${totals.updated}${isDryRun ? " (dry-run)" : ""}`);
  console.log(`   Skipped: ${totals.skipped}`);
  console.log(`   Missing: ${totals.missing}`);
  console.log(`   Errors: ${totals.errors}`);

  if (isDryRun) {
    console.log("");
    console.log("🔄 Re-run without --dry-run to apply updates");
  }
}

main().catch((error) => {
  console.error("💥 Backfill failed:", error);
  process.exit(1);
});
