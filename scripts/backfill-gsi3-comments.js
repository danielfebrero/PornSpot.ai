/**
 * backfill-gsi3-comments.js
 *
 * Migration script to add GSI3 fields to existing Comment records.
 *
 * This script adds the required GSI3PK and GSI3SK fields to existing comment entities
 * to support efficient querying of comments by interaction type and date range for analytics.
 *
 * GSI3PK = "INTERACTION#comment"
 * GSI3SK = "{createdAt}"
 *
 * Usage:
 *   node backfill-gsi3-comments.js --env=local [--dry-run]
 *   node backfill-gsi3-comments.js --env=prod [--dry-run]
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
process.on("unhandledRejection", (reason) => {
  console.error(
    "UNHANDLED REJECTION:",
    reason,
    typeof reason === "object" ? JSON.stringify(reason, null, 2) : ""
  );
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

// Parse command line arguments
const isDryRun = process.argv.includes("--dry-run");
const envArg = process.argv.find((arg) => arg.startsWith("--env="));
let envFile = ".env";

if (envArg) {
  const env = envArg.split("=")[1];
  envFile = `.env.${env}`;
}

console.log(`🔧 Loading environment from: ${envFile}`);
console.log(`🔍 Dry run mode: ${isDryRun ? "ENABLED" : "DISABLED"}`);

// Load environment variables
const envPath = path.join(__dirname, envFile);
if (!fs.existsSync(envPath)) {
  console.error(`❌ Environment file not found: ${envPath}`);
  process.exit(1);
}

dotenv.config({ path: envPath });

// Validate required environment variables
const requiredEnvVars = ["DYNAMODB_TABLE"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const TABLE_NAME = process.env.DYNAMODB_TABLE;
console.log(`📋 Target table: ${TABLE_NAME}`);

// Import AWS SDK modules
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

// Configure AWS SDK
let clientConfig = {};

// Add credentials if not using IAM roles
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

// Configure for local development
if (process.env.LOCAL_AWS_ENDPOINT) {
  clientConfig.endpoint =
    process.env.LOCAL_AWS_ENDPOINT || "http://localhost:4566";
  clientConfig.region = "us-east-1";
  clientConfig.credentials = {
    accessKeyId: "test",
    secretAccessKey: "test",
  };
  console.log(`🔌 Using local endpoint: ${clientConfig.endpoint}`);
}

const dynamoDbClient = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

/**
 * Scan for Comment entities that need GSI3 fields
 */
async function scanComments() {
  console.log("🔍 Scanning for Comment entities...");

  const items = [];
  let lastEvaluatedKey;
  let scanCount = 0;

  do {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression:
        "EntityType = :entityType AND attribute_not_exists(GSI3PK)",
      ExpressionAttributeValues: {
        ":entityType": "Comment",
      },
      ProjectionExpression: "PK, SK, createdAt, EntityType, id, content",
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await docClient.send(new ScanCommand(params));

    if (result.Items) {
      items.push(...result.Items);
      scanCount += result.Items.length;
      console.log(`📊 Found ${scanCount} Comment items so far...`);
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(
    `✅ Scan complete. Found ${items.length} Comment items missing GSI3 fields.`
  );
  return items;
}

/**
 * Update a single Comment item with GSI3 fields
 */
async function updateComment(item) {
  const { PK, SK, createdAt, id } = item;

  if (!createdAt) {
    console.warn(`⚠️  Missing createdAt for comment: ${PK}#${SK}`);
    return false;
  }

  // For comments, GSI3PK is always "INTERACTION#comment"
  const gsi3PK = "INTERACTION#comment";
  const gsi3SK = createdAt;

  console.log(`📝 Updating comment ${id || PK}:`);
  console.log(`   GSI3PK: ${gsi3PK}`);
  console.log(`   GSI3SK: ${gsi3SK}`);

  if (isDryRun) {
    console.log("   🔍 DRY RUN - would update");
    return true;
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK, SK },
        UpdateExpression: "SET GSI3PK = :gsi3pk, GSI3SK = :gsi3sk",
        ExpressionAttributeValues: {
          ":gsi3pk": gsi3PK,
          ":gsi3sk": gsi3SK,
        },
        ConditionExpression: "attribute_exists(PK)",
      })
    );

    console.log("   ✅ Updated successfully");
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to update: ${error.message}`);
    return false;
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log("🚀 Starting GSI3 Comment backfill migration...");
  console.log("=".repeat(60));

  try {
    // Scan for items that need updating
    const items = await scanComments();

    if (items.length === 0) {
      console.log("🎉 No Comment items need GSI3 fields. Migration complete!");
      return;
    }

    console.log(`📋 Processing ${items.length} Comment items...`);
    console.log("=".repeat(60));

    // Process items in batches to avoid rate limiting
    const batchSize = 10;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      console.log(
        `\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          items.length / batchSize
        )} (${batch.length} items)`
      );

      // Process batch items in parallel
      const results = await Promise.all(
        batch.map((item) => updateComment(item))
      );

      results.forEach((success) => {
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      });

      // Small delay between batches to be nice to DynamoDB
      if (i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 MIGRATION SUMMARY:");
    console.log(`   Total items: ${items.length}`);
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ❌ Failed updates: ${errorCount}`);

    if (isDryRun) {
      console.log("\n🔍 This was a DRY RUN. No actual changes were made.");
      console.log("Run without --dry-run to apply the changes.");
    } else {
      console.log("\n🎉 Migration completed!");
    }
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
main().catch((error) => {
  console.error("💥 Unexpected error:", error);
  process.exit(1);
});
