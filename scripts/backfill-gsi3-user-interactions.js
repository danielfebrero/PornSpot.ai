/**
 * backfill-gsi3-user-interactions.js
 *
 * Migration script to add GSI3 fields to existing UserInteraction records.
 *
 * This script adds the required GSI3PK and GSI3SK fields to existing user interactions
 * to support efficient querying of interactions by type and date range for analytics.
 *
 * GSI3PK = "INTERACTION#{interactionType}"
 * GSI3SK = "{createdAt}"
 *
 * Usage:
 *   node backfill-gsi3-user-interactions.js --env=local [--dry-run]
 *   node backfill-gsi3-user-interactions.js --env=prod [--dry-run]
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
  const envName = envArg.split("=")[1];
  envFile = `.env.${envName}`;
  console.log(`🔧 Using environment file: ${envFile}`);
}

// Load environment variables
const envPath = path.join(__dirname, envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded environment from ${envFile}`);
} else {
  console.warn(`⚠️  Environment file ${envFile} not found, using process.env`);
}

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  UpdateCommand,
  BatchWriteCommand 
} = require("@aws-sdk/lib-dynamodb");

// Environment configuration
const TABLE_NAME = process.env.DYNAMODB_TABLE;
const isLocal = process.env.AWS_SAM_LOCAL === "true" || envFile.includes("local");

if (!TABLE_NAME) {
  console.error("❌ DYNAMODB_TABLE environment variable is required");
  process.exit(1);
}

console.log(`🗄️  Table: ${TABLE_NAME}`);
console.log(`🌍 Environment: ${isLocal ? "Local" : "AWS"}`);
console.log(`🔍 Mode: ${isDryRun ? "DRY RUN" : "LIVE UPDATE"}`);

// DynamoDB client setup
const clientConfig = {};
if (isLocal) {
  clientConfig.endpoint = process.env.LOCAL_AWS_ENDPOINT || "http://localhost:4566";
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
 * Extract interaction type from SK
 * SK format: "INTERACTION#{interactionType}#{targetId}" or "COMMENT_INTERACTION#{interactionType}#{targetId}"
 */
function extractInteractionType(sk) {
  if (sk.startsWith("COMMENT_INTERACTION#")) {
    const parts = sk.split("#");
    return parts[1]; // interactionType
  } else if (sk.startsWith("INTERACTION#")) {
    const parts = sk.split("#");
    return parts[1]; // interactionType
  }
  return null;
}

/**
 * Scan for UserInteraction entities that need GSI3 fields
 */
async function scanUserInteractions() {
  console.log("🔍 Scanning for UserInteraction entities...");
  
  const items = [];
  let lastEvaluatedKey;
  let scanCount = 0;
  
  do {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: "EntityType = :entityType AND attribute_not_exists(GSI3PK)",
      ExpressionAttributeValues: {
        ":entityType": "UserInteraction"
      },
      ProjectionExpression: "PK, SK, interactionType, createdAt, EntityType"
    };
    
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }
    
    const result = await docClient.send(new ScanCommand(params));
    
    if (result.Items) {
      items.push(...result.Items);
      scanCount += result.Items.length;
      console.log(`📊 Found ${scanCount} UserInteraction items so far...`);
    }
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`✅ Scan complete. Found ${items.length} UserInteraction items missing GSI3 fields.`);
  return items;
}

/**
 * Update a single UserInteraction item with GSI3 fields
 */
async function updateUserInteraction(item) {
  const { PK, SK, interactionType, createdAt } = item;
  
  // Extract interaction type from SK if not available in item
  const effectiveInteractionType = interactionType || extractInteractionType(SK);
  
  if (!effectiveInteractionType) {
    console.warn(`⚠️  Could not determine interaction type for item: ${PK}#${SK}`);
    return false;
  }
  
  if (!createdAt) {
    console.warn(`⚠️  Missing createdAt for item: ${PK}#${SK}`);
    return false;
  }
  
  const gsi3PK = `INTERACTION#${effectiveInteractionType}`;
  const gsi3SK = createdAt;
  
  console.log(`📝 Updating ${PK}#${SK}:`);
  console.log(`   GSI3PK: ${gsi3PK}`);
  console.log(`   GSI3SK: ${gsi3SK}`);
  
  if (isDryRun) {
    console.log("   🔍 DRY RUN - would update");
    return true;
  }
  
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK, SK },
      UpdateExpression: "SET GSI3PK = :gsi3pk, GSI3SK = :gsi3sk",
      ExpressionAttributeValues: {
        ":gsi3pk": gsi3PK,
        ":gsi3sk": gsi3SK
      },
      ConditionExpression: "attribute_exists(PK)"
    }));
    
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
  console.log("🚀 Starting GSI3 UserInteraction backfill migration...");
  console.log("=" .repeat(60));
  
  try {
    // Scan for items that need updating
    const items = await scanUserInteractions();
    
    if (items.length === 0) {
      console.log("🎉 No UserInteraction items need GSI3 fields. Migration complete!");
      return;
    }
    
    console.log(`📋 Processing ${items.length} UserInteraction items...`);
    console.log("=" .repeat(60));
    
    // Process items in batches to avoid rate limiting
    const batchSize = 10;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)} (${batch.length} items)`);
      
      // Process batch items in parallel
      const results = await Promise.all(
        batch.map(item => updateUserInteraction(item))
      );
      
      results.forEach(success => {
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      });
      
      // Small delay between batches to be nice to DynamoDB
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log("\n" + "=" .repeat(60));
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
main().catch(error => {
  console.error("💥 Unexpected error:", error);
  process.exit(1);
});
