#!/usr/bin/env node

/**
 * Cleanup Generation Queue Script for pornspot.ai
 *
 * This script cleans up the generation queue by removing old, completed, failed, or timeout entries.
 *
 * Usage:
 *   node scripts/cleanup-generation-queue.js --env=prod --dry-run
 *   node scripts/cleanup-generation-queue.js --env=prod --confirm --older-than=7d
 *   node scripts/cleanup-generation-queue.js --env=prod --confirm --status=completed,failed,timeout
 *
 * Environment Options:
 *   --env=local     Clean from local database
 *   --env=dev       Clean from dev environment
 *   --env=staging   Clean from staging environment
 *   --env=prod      Clean from production database
 *
 * Cleanup Options:
 *   --older-than=Xd   Remove entries older than X days (default: 7d)
 *   --older-than=Xh   Remove entries older than X hours
 *   --status=list     Comma-separated list of statuses to clean (completed,failed,timeout)
 *                     Default: completed,failed,timeout (keeps pending,processing)
 *   --timeout-only    Only clean up timed out entries (uses service method)
 *   --all             Remove ALL queue entries (dangerous!)
 *
 * Safety Options:
 *   --dry-run         Preview what would be deleted without actually deleting
 *   --confirm         Actually perform the deletion (required for real deletion)
 *   --help, -h        Show this help message
 */

// CommonJS requires
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const readline = require("readline");

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

// Configuration defaults
let ENVIRONMENT = "local";
let DRY_RUN = false;
let CONFIRM = false;
let OLDER_THAN = "7d"; // Default: 7 days
let STATUSES = ["completed", "failed", "timeout"]; // Default statuses to clean
let TIMEOUT_ONLY = false;
let CLEANUP_ALL = false;
const BATCH_SIZE = 25; // DynamoDB batch write limit

// Parse command line arguments
function showHelp() {
  console.log(`
Generation Queue Cleanup Script

Usage:
  node scripts/cleanup-generation-queue.js --env=ENV [OPTIONS]

Environments:
  --env=local      Local development (LocalStack)
  --env=dev        Development environment
  --env=staging    Staging environment  
  --env=prod       Production environment

Cleanup Options:
  --older-than=7d     Remove entries older than 7 days (default)
  --older-than=24h    Remove entries older than 24 hours
  --status=list       Comma-separated statuses: completed,failed,timeout,pending,processing
  --timeout-only      Only cleanup timed out entries using service method
  --all               Remove ALL queue entries (DANGEROUS!)

Safety Options:
  --dry-run          Preview changes without deleting
  --confirm          Actually perform deletion (required)
  --help, -h         Show this help

Examples:
  # Preview cleanup of completed/failed/timeout entries older than 7 days
  node scripts/cleanup-generation-queue.js --env=prod --dry-run

  # Clean up completed entries older than 24 hours
  node scripts/cleanup-generation-queue.js --env=prod --confirm --older-than=24h --status=completed

  # Only cleanup timeout entries using built-in service method
  node scripts/cleanup-generation-queue.js --env=prod --confirm --timeout-only

  # DANGEROUS: Remove all queue entries
  node scripts/cleanup-generation-queue.js --env=prod --confirm --all
`);
}

const args = process.argv.slice(2);
for (const arg of args) {
  if (arg.startsWith("--env=")) {
    ENVIRONMENT = arg.split("=")[1];
  } else if (arg === "--dry-run") {
    DRY_RUN = true;
  } else if (arg === "--confirm") {
    CONFIRM = true;
  } else if (arg.startsWith("--older-than=")) {
    OLDER_THAN = arg.split("=")[1];
  } else if (arg.startsWith("--status=")) {
    STATUSES = arg
      .split("=")[1]
      .split(",")
      .map((s) => s.trim());
  } else if (arg === "--timeout-only") {
    TIMEOUT_ONLY = true;
  } else if (arg === "--all") {
    CLEANUP_ALL = true;
  } else if (arg === "--help" || arg === "-h") {
    showHelp();
    process.exit(0);
  }
}

// Validate environment
if (!["local", "dev", "staging", "prod"].includes(ENVIRONMENT)) {
  console.error(
    "❌ Error: Invalid environment. Must be: local, dev, staging, or prod"
  );
  process.exit(1);
}

// Validate statuses
const validStatuses = [
  "pending",
  "processing",
  "completed",
  "failed",
  "timeout",
];
for (const status of STATUSES) {
  if (!validStatuses.includes(status)) {
    console.error(
      `❌ Error: Invalid status '${status}'. Valid statuses: ${validStatuses.join(
        ", "
      )}`
    );
    process.exit(1);
  }
}

// Validate older-than format
const olderThanMatch = OLDER_THAN.match(/^(\d+)([hd])$/);
if (!olderThanMatch) {
  console.error(
    "❌ Error: Invalid --older-than format. Use format like '7d' or '24h'"
  );
  process.exit(1);
}

// For non-dry-run, require explicit confirmation
if (!DRY_RUN && !CONFIRM) {
  console.error("❌ Error: Must specify either --dry-run or --confirm");
  console.error("   Use --dry-run to preview changes");
  console.error("   Use --confirm to actually delete queue entries");
  process.exit(1);
}

// Parse --env=VALUE from process.argv for dotenv loading
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

// Resolve env file relative to current script directory
const envPath = path.resolve(__dirname, envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded environment variables from ${envPath}`);
} else {
  // fallback: try .env in script directory
  const fallbackPath = path.resolve(__dirname, ".env");
  if (fs.existsSync(fallbackPath)) {
    dotenv.config({ path: fallbackPath });
    console.log(
      `⚠️  Could not find ${envPath}, loaded default .env from script directory`
    );
  } else {
    console.warn(
      `⚠️  Warning: Could not find env file: ${envPath} or .env. Proceeding with process.env as-is.`
    );
  }
}

// AWS SDK (v3)
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  BatchWriteCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");

// Environment-specific configurations
const getClientConfig = (environment) => {
  if (environment === "local") {
    return {
      endpoint: process.env.LOCAL_AWS_ENDPOINT || "http://localhost:4566",
      region: "us-east-1",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    };
  }

  // For staging/prod, use default AWS credentials from environment/profile
  return {
    region: process.env.AWS_REGION || "us-east-1",
  };
};

const getTableName = (environment) => {
  if (process.env.DYNAMODB_TABLE) {
    return process.env.DYNAMODB_TABLE;
  }
  return `${environment}-pornspot-media`;
};

// Initialize clients
const clientConfig = getClientConfig(ENVIRONMENT);
const TABLE_NAME = getTableName(ENVIRONMENT);
const ddbClient = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(ddbClient);

console.log(`🎯 Target: ${ENVIRONMENT} environment`);
console.log(`📊 Table: ${TABLE_NAME}`);
console.log(`🏃 Mode: ${DRY_RUN ? "DRY RUN" : "LIVE DELETION"}`);

/**
 * Create readline interface for user confirmation
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask user for confirmation
 */
function askConfirmation(message) {
  return new Promise((resolve) => {
    const rl = createReadlineInterface();
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Calculate cutoff date based on older-than parameter
 */
function getCutoffDate() {
  const [, amount, unit] = olderThanMatch;
  const now = new Date();
  const amountNum = parseInt(amount);

  if (unit === "h") {
    return new Date(now.getTime() - amountNum * 60 * 60 * 1000);
  } else if (unit === "d") {
    return new Date(now.getTime() - amountNum * 24 * 60 * 60 * 1000);
  }

  throw new Error(`Invalid time unit: ${unit}`);
}

/**
 * Get all queue entries matching criteria
 */
async function getQueueEntriesToClean() {
  const cutoffDate = getCutoffDate();
  const cutoffISOString = cutoffDate.toISOString();

  console.log(`🔍 Finding queue entries to clean...`);
  console.log(
    `📅 Cutoff date: ${cutoffDate.toLocaleString()} (${cutoffISOString})`
  );
  console.log(`📋 Target statuses: ${STATUSES.join(", ")}`);

  const allEntriesToClean = [];

  if (CLEANUP_ALL) {
    // Get ALL queue entries - this is dangerous!
    console.log("⚠️  DANGER: Fetching ALL queue entries for deletion!");

    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(PK, :queuePrefix) AND SK = :entrySK",
        ExpressionAttributeValues: {
          ":queuePrefix": "QUEUE#",
          ":entrySK": "ENTRY",
        },
      })
    );

    return result.Items || [];
  }

  // Query by status using GSI1
  for (const status of STATUSES) {
    console.log(`🔍 Scanning status: ${status}`);

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :statusKey",
        FilterExpression: "createdAt < :cutoffDate",
        ExpressionAttributeValues: {
          ":statusKey": `QUEUE#STATUS#${status}`,
          ":cutoffDate": cutoffISOString,
        },
      })
    );

    if (result.Items && result.Items.length > 0) {
      console.log(
        `  Found ${result.Items.length} ${status} entries older than ${OLDER_THAN}`
      );
      allEntriesToClean.push(...result.Items);
    } else {
      console.log(`  No ${status} entries found older than ${OLDER_THAN}`);
    }
  }

  return allEntriesToClean;
}

/**
 * Cleanup using the GenerationQueueService timeout cleanup method
 */
async function cleanupTimeoutEntriesOnly() {
  console.log(
    "🔧 Using GenerationQueueService.cleanupTimeoutEntries() method..."
  );

  // We need to create a GenerationQueueService instance
  // Since we can't directly import TypeScript, we'll implement the timeout cleanup logic here
  const now = new Date().toISOString();
  let timeoutCount = 0;

  // Find processing entries that have timed out
  console.log("🔍 Finding timed out processing entries...");
  const processingResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :statusKey",
      FilterExpression: "timeoutAt < :now",
      ExpressionAttributeValues: {
        ":statusKey": "QUEUE#STATUS#processing",
        ":now": now,
      },
    })
  );

  if (processingResult.Items && processingResult.Items.length > 0) {
    console.log(
      `  Found ${processingResult.Items.length} timed out processing entries`
    );
    timeoutCount += processingResult.Items.length;

    if (!DRY_RUN) {
      for (const item of processingResult.Items) {
        // Update status to timeout instead of deleting
        await docClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
            UpdateExpression:
              "SET #status = :status, errorMessage = :errorMessage, updatedAt = :now, GSI1PK = :gsi1pk",
            ExpressionAttributeNames: {
              "#status": "status",
            },
            ExpressionAttributeValues: {
              ":status": "timeout",
              ":errorMessage": "Generation request timed out",
              ":now": now,
              ":gsi1pk": "QUEUE#STATUS#timeout",
            },
          })
        );
      }
    }
  }

  // Find pending entries that have timed out
  console.log("🔍 Finding timed out pending entries...");
  const pendingResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :statusKey",
      FilterExpression: "timeoutAt < :now",
      ExpressionAttributeValues: {
        ":statusKey": "QUEUE#STATUS#pending",
        ":now": now,
      },
    })
  );

  if (pendingResult.Items && pendingResult.Items.length > 0) {
    console.log(
      `  Found ${pendingResult.Items.length} timed out pending entries`
    );
    timeoutCount += pendingResult.Items.length;

    if (!DRY_RUN) {
      for (const item of pendingResult.Items) {
        // Update status to timeout instead of deleting
        await docClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
            UpdateExpression:
              "SET #status = :status, errorMessage = :errorMessage, updatedAt = :now, GSI1PK = :gsi1pk",
            ExpressionAttributeNames: {
              "#status": "status",
            },
            ExpressionAttributeValues: {
              ":status": "timeout",
              ":errorMessage":
                "Generation request timed out while waiting in queue",
              ":now": now,
              ":gsi1pk": "QUEUE#STATUS#timeout",
            },
          })
        );
      }
    }
  }

  return timeoutCount;
}

/**
 * Delete queue entries in batches
 */
async function deleteQueueEntries(entries) {
  if (entries.length === 0) {
    console.log("✅ No entries to delete");
    return 0;
  }

  console.log(
    `🗑️  Deleting ${entries.length} queue entries in batches of ${BATCH_SIZE}...`
  );

  let deletedCount = 0;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);

    if (DRY_RUN) {
      console.log(
        `  [DRY RUN] Would delete batch ${Math.floor(i / BATCH_SIZE) + 1}: ${
          batch.length
        } entries`
      );
      deletedCount += batch.length;
      continue;
    }

    const deleteRequests = batch.map((entry) => ({
      DeleteRequest: {
        Key: {
          PK: entry.PK,
          SK: entry.SK,
        },
      },
    }));

    try {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: deleteRequests,
          },
        })
      );

      deletedCount += batch.length;
      console.log(
        `  ✅ Deleted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${
          batch.length
        } entries`
      );

      // Small delay to avoid throttling
      if (i + BATCH_SIZE < entries.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(
        `  ❌ Failed to delete batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
        error
      );
      throw error;
    }
  }

  return deletedCount;
}

/**
 * Display summary of entries to be cleaned
 */
function displaySummary(entries) {
  if (entries.length === 0) {
    console.log("✅ No queue entries found matching criteria");
    return;
  }

  console.log(`\n📊 Summary of ${entries.length} queue entries to clean:`);

  // Group by status
  const statusCounts = {};
  const oldestEntry = { createdAt: new Date().toISOString() };
  const newestEntry = { createdAt: "1970-01-01T00:00:00.000Z" };

  entries.forEach((entry) => {
    const status = entry.status || "unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (entry.createdAt < oldestEntry.createdAt) {
      oldestEntry.createdAt = entry.createdAt;
      oldestEntry.queueId = entry.queueId;
    }
    if (entry.createdAt > newestEntry.createdAt) {
      newestEntry.createdAt = entry.createdAt;
      newestEntry.queueId = entry.queueId;
    }
  });

  console.log("\n📋 By Status:");
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count} entries`);
  });

  console.log(`\n📅 Date Range:`);
  console.log(
    `  Oldest: ${new Date(oldestEntry.createdAt).toLocaleString()} (${
      oldestEntry.queueId
    })`
  );
  console.log(
    `  Newest: ${new Date(newestEntry.createdAt).toLocaleString()} (${
      newestEntry.queueId
    })`
  );

  // Show a few example entries
  console.log(`\n🔍 Example entries (first 3):`);
  entries.slice(0, 3).forEach((entry, i) => {
    const age = Math.round(
      (new Date() - new Date(entry.createdAt)) / (1000 * 60 * 60)
    );
    console.log(
      `  ${i + 1}. ${entry.queueId} - ${
        entry.status
      } - ${age}h old - "${entry.prompt?.substring(0, 50)}..."`
    );
  });
}

/**
 * Main cleanup function
 */
async function main() {
  try {
    console.log("🧹 Starting generation queue cleanup...\n");

    // Special case: timeout-only cleanup
    if (TIMEOUT_ONLY) {
      const timeoutCount = await cleanupTimeoutEntriesOnly();

      if (timeoutCount === 0) {
        console.log("✅ No timed out entries found");
      } else {
        const action = DRY_RUN ? "Would mark" : "Marked";
        console.log(`✅ ${action} ${timeoutCount} entries as timed out`);
      }

      return;
    }

    // Get entries to clean
    const entriesToClean = await getQueueEntriesToClean();

    // Display summary
    displaySummary(entriesToClean);

    if (entriesToClean.length === 0) {
      return;
    }

    // Safety confirmation for production
    if (ENVIRONMENT === "prod" && !DRY_RUN) {
      console.log(
        `\n⚠️  WARNING: About to delete ${entriesToClean.length} queue entries from PRODUCTION!`
      );
      const confirmed = await askConfirmation(
        "Are you absolutely sure you want to proceed?"
      );
      if (!confirmed) {
        console.log("❌ Operation cancelled by user");
        return;
      }
    }

    // Additional confirmation for cleanup-all
    if (CLEANUP_ALL && !DRY_RUN) {
      console.log(
        `\n🚨 DANGER: About to delete ALL queue entries! This will clear the entire generation queue!`
      );
      const confirmed = await askConfirmation(
        "Type 'YES' to confirm this destructive operation"
      );
      if (!confirmed) {
        console.log("❌ Operation cancelled by user");
        return;
      }
    }

    // Perform deletion
    const deletedCount = await deleteQueueEntries(entriesToClean);

    const action = DRY_RUN ? "Would delete" : "Successfully deleted";
    console.log(`\n✅ ${action} ${deletedCount} queue entries`);

    if (DRY_RUN) {
      console.log(
        "\n💡 This was a dry run. Use --confirm to actually delete the entries."
      );
    }
  } catch (error) {
    console.error("\n❌ Error during queue cleanup:", error);
    process.exit(1);
  }
}

// Run the script
main();
