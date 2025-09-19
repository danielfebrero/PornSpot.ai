/**
 * backfill-gsi8-media-type.js
 *
 * Migration script to backfill `type`, `GSI8PK`, and `GSI8SK` for Media records.
 *
 * - type is derived from `mimeType` (image/* -> "image", video/* -> "video")
 * - GSI8PK = "MEDIA_BY_TYPE_AND_CREATOR"
 * - GSI8SK = "<type>#<createdBy>#<createdAt>#<mediaId>"
 *
 * Usage:
 *   node backfill-gsi8-media-type.js --env=local [--dry-run]
 *   node backfill-gsi8-media-type.js --env=stage [--dry-run]
 *   node backfill-gsi8-media-type.js --env=prod [--dry-run]
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
  ScanCommand,
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

function deriveTypeFromMime(mimeType) {
  if (!mimeType || typeof mimeType !== "string") return undefined;
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return undefined;
}

function expectedGsi8Sk({ type, createdBy, createdAt, mediaId }) {
  return `${type}#${createdBy}#${createdAt}#${mediaId}`;
}

async function main() {
  console.log("🚀 Starting backfill for Media type + GSI8...");
  console.log(`📋 Table: ${TABLE_NAME}`);
  console.log(`🌍 Mode: ${isLocal ? "Local" : "AWS"}`);
  console.log(`🔍 Run: ${isDryRun ? "DRY RUN" : "LIVE UPDATE"}`);
  console.log("");

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let lastEvaluatedKey = undefined;

  do {
    let scanResult;
    try {
      scanResult = await docClient.send(
        new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: "begins_with(PK, :media) AND SK = :sk",
          ExpressionAttributeValues: {
            ":media": "MEDIA#",
            ":sk": "METADATA",
          },
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 50,
        })
      );
    } catch (err) {
      console.error("❌ Scan error:", err);
      break;
    }

    const items = scanResult.Items || [];
    for (const item of items) {
      try {
        const mediaId = item.id || (item.PK || "").split("#")[1] || "";
        const createdBy = item.createdBy;
        const createdAt = item.createdAt;
        const mimeType = item.mimeType;

        if (!createdBy || !createdAt || !mediaId) {
          console.warn(
            `⚠️  Skipping media missing required fields (id:${mediaId}, createdBy:${createdBy}, createdAt:${createdAt})`
          );
          skipped++;
          continue;
        }

        const derivedType = deriveTypeFromMime(mimeType);
        if (!derivedType) {
          console.warn(
            `⚠️  Skipping media ${mediaId} - cannot derive type from mimeType: ${mimeType}`
          );
          skipped++;
          continue;
        }

        const needsType = item.type !== derivedType;
        const needsGsi8Pk = item.GSI8PK !== "MEDIA_BY_TYPE_AND_CREATOR";
        const desiredSk = expectedGsi8Sk({
          type: derivedType,
          createdBy,
          createdAt,
          mediaId,
        });
        const needsGsi8Sk = item.GSI8SK !== desiredSk;

        if (!needsType && !needsGsi8Pk && !needsGsi8Sk) {
          skipped++;
          continue;
        }

        const updates = [];
        const names = {};
        const values = {};

        if (needsType) {
          updates.push("#type = :type");
          names["#type"] = "type";
          values[":type"] = derivedType;
        }
        if (needsGsi8Pk) {
          updates.push("GSI8PK = :gsi8pk");
          values[":gsi8pk"] = "MEDIA_BY_TYPE_AND_CREATOR";
        }
        if (needsGsi8Sk) {
          updates.push("GSI8SK = :gsi8sk");
          values[":gsi8sk"] = desiredSk;
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
              ...(Object.keys(names).length > 0 && {
                ExpressionAttributeNames: names,
              }),
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
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
    if (lastEvaluatedKey) console.log("📄 Processed batch, continuing...");
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
