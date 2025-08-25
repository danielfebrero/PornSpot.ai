#!/usr/bin/env node

/**
 * Delete All DynamoDB Items Script for pornspot.ai
 *
 * This script deletes ALL items from the DynamoDB table.
 * WARNING: This is a destructive operation that cannot be undone.
 * It will remove ALL users, albums, media, comments, and any other data.
 *
 * Usage:
 *   node scripts/delete-all-dynamodb-items.js --env=prod --dry-run
 *   node scripts/delete-all-dynamodb-items.js --env=prod --confirm
 *   node scripts/delete-all-dynamodb-items.js --env=prod --confirm --backup
 *
 * Environment Options:
 *   --env=local     Delete from local database
 *   --env=dev       Delete from dev environment
 *   --env=staging   Delete from staging environment
 *   --env=prod      Delete from production database
 *
 * Options:
 *   --dry-run       Preview what would be deleted without actually deleting
 *   --confirm       Actually perform the deletion (required for real deletion)
 *   --backup        Create a backup before deletion (recommended for production)
 *   --help, -h      Show this help message
 *
 * Safety Features:
 *   - Requires explicit --confirm flag for actual deletion
 *   - Supports dry-run mode to preview operations
 *   - Optional backup before deletion
 *   - Progress tracking and error handling
 *   - Batch processing to avoid timeouts
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

// Configuration
let AWS_REGION = process.env.AWS_REGION || "us-east-1";
let ENVIRONMENT = "local";
let DRY_RUN = false;
let CONFIRM = false;
let CREATE_BACKUP = false;
const BATCH_SIZE = 25; // DynamoDB batch write limit
const SCAN_LIMIT = 100; // Items to scan at once

// Parse command line arguments
const args = process.argv.slice(2);
for (const arg of args) {
  if (arg.startsWith("--env=")) {
    ENVIRONMENT = arg.split("=")[1];
  } else if (arg === "--dry-run") {
    DRY_RUN = true;
  } else if (arg === "--confirm") {
    CONFIRM = true;
  } else if (arg === "--backup") {
    CREATE_BACKUP = true;
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

// For non-dry-run, require explicit confirmation
if (!DRY_RUN && !CONFIRM) {
  console.error("❌ Error: Must specify either --dry-run or --confirm");
  console.error("   Use --dry-run to preview changes");
  console.error("   Use --confirm to actually delete all items");
  process.exit(1);
}

// Environment-specific configurations
const getClientConfig = (environment) => {
  if (environment === "local") {
    return {
      endpoint: "http://localhost:4566",
      region: "us-east-1",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    };
  }

  // For staging/prod, use default AWS credentials from environment/profile
  return {
    region: AWS_REGION,
  };
};

const getTableName = (environment) => {
  return `${environment}-pornspot-media`;
};

// Initialize clients
const clientConfig = getClientConfig(ENVIRONMENT);
const TABLE_NAME = getTableName(ENVIRONMENT);
const ddbClient = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Colors for output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function showHelp() {
  console.log(`
${colors.bright}Delete All DynamoDB Items Script${colors.reset}

${colors.yellow}WARNING: This script will delete ALL data from the DynamoDB table!${colors.reset}

${colors.bright}Usage:${colors.reset}
  node scripts/delete-all-dynamodb-items.js [options]

${colors.bright}Environment Options:${colors.reset}
  --env=local     Delete from local database
  --env=dev       Delete from dev environment  
  --env=staging   Delete from staging environment
  --env=prod      Delete from production database

${colors.bright}Options:${colors.reset}
  --dry-run       Preview what would be deleted (safe, no changes made)
  --confirm       Actually perform the deletion (DESTRUCTIVE!)
  --backup        Create backup before deletion (recommended for production)
  --help, -h      Show this help message

${colors.bright}Examples:${colors.reset}
  # Preview what would be deleted from production
  node scripts/delete-all-dynamodb-items.js --env=prod --dry-run

  # Delete all items from local environment
  node scripts/delete-all-dynamodb-items.js --env=local --confirm

  # Delete all items from production with backup
  node scripts/delete-all-dynamodb-items.js --env=prod --confirm --backup

${colors.red}DANGER ZONE:${colors.reset}
  ${colors.red}--env=prod --confirm${colors.reset} will permanently delete ALL production data!
  Always use ${colors.green}--backup${colors.reset} with production operations.
`);
}

// Statistics tracking
const stats = {
  totalItems: 0,
  deletedItems: 0,
  failedItems: 0,
  batches: 0,
  startTime: Date.now(),
};

// Backup functionality
async function createBackup() {
  if (!CREATE_BACKUP) return null;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(__dirname, "..", "backups", "dynamodb");
  const backupFile = path.join(
    backupDir,
    `${ENVIRONMENT}-full-backup-${timestamp}.json`
  );

  log(`📦 Creating backup: ${backupFile}`, colors.blue);

  // Ensure backup directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const allItems = [];
  let lastEvaluatedKey = undefined;

  do {
    const scanParams = {
      TableName: TABLE_NAME,
      Limit: SCAN_LIMIT,
    };

    if (lastEvaluatedKey) {
      scanParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    try {
      const result = await docClient.send(new ScanCommand(scanParams));
      if (result.Items) {
        allItems.push(...result.Items);
      }
      lastEvaluatedKey = result.LastEvaluatedKey;

      process.stdout.write(`\r📦 Backing up items: ${allItems.length}`);
    } catch (error) {
      log(`\n❌ Error during backup: ${error.message}`, colors.red);
      throw error;
    }
  } while (lastEvaluatedKey);

  // Write backup to file
  fs.writeFileSync(backupFile, JSON.stringify(allItems, null, 2));
  log(
    `\n✅ Backup created: ${allItems.length} items saved to ${backupFile}`,
    colors.green
  );

  return backupFile;
}

// Get confirmation from user for production
async function getProductionConfirmation() {
  if (ENVIRONMENT !== "prod" || DRY_RUN) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    log(
      `\n${colors.red}🚨 PRODUCTION DELETION WARNING 🚨${colors.reset}`,
      colors.bright
    );
    log(
      `You are about to delete ALL items from: ${colors.yellow}${TABLE_NAME}${colors.reset}`,
      colors.red
    );
    log(
      `Environment: ${colors.yellow}${ENVIRONMENT}${colors.reset}`,
      colors.red
    );
    log(
      `This operation is ${colors.red}IRREVERSIBLE${colors.reset} and will destroy ALL data!`,
      colors.red
    );

    if (CREATE_BACKUP) {
      log(`✅ Backup will be created before deletion`, colors.green);
    } else {
      log(`⚠️  No backup will be created`, colors.yellow);
    }

    rl.question(
      `\nType "DELETE ALL PRODUCTION DATA" to confirm: `,
      (answer) => {
        rl.close();
        resolve(answer === "DELETE ALL PRODUCTION DATA");
      }
    );
  });
}

// Count items by type for reporting
function analyzeItems(items) {
  const types = {};

  items.forEach((item) => {
    const pk = item.PK || "UNKNOWN";
    const type = pk.split("#")[0] || "UNKNOWN";
    types[type] = (types[type] || 0) + 1;
  });

  return types;
}

// Delete items in batches
async function deleteItemsBatch(items) {
  if (items.length === 0) return { deleted: 0, failed: 0 };

  const deleteRequests = items.map((item) => ({
    DeleteRequest: {
      Key: {
        PK: item.PK,
        SK: item.SK,
      },
    },
  }));

  // Split into batches of 25 (DynamoDB limit)
  const batches = [];
  for (let i = 0; i < deleteRequests.length; i += BATCH_SIZE) {
    batches.push(deleteRequests.slice(i, i + BATCH_SIZE));
  }

  let deleted = 0;
  let failed = 0;

  for (const batch of batches) {
    if (DRY_RUN) {
      deleted += batch.length;
      continue;
    }

    try {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch,
          },
        })
      );
      deleted += batch.length;
      stats.batches++;
    } catch (error) {
      log(`❌ Error deleting batch: ${error.message}`, colors.red);
      failed += batch.length;
    }
  }

  return { deleted, failed };
}

// Main deletion process
async function deleteAllItems() {
  log(
    `\n🔍 Scanning table: ${colors.yellow}${TABLE_NAME}${colors.reset}`,
    colors.blue
  );

  let lastEvaluatedKey = undefined;
  let totalProcessed = 0;

  do {
    const scanParams = {
      TableName: TABLE_NAME,
      Limit: SCAN_LIMIT,
    };

    if (lastEvaluatedKey) {
      scanParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    try {
      const result = await docClient.send(new ScanCommand(scanParams));

      if (result.Items && result.Items.length > 0) {
        const items = result.Items;
        stats.totalItems += items.length;

        // Analyze items for reporting
        if (totalProcessed === 0) {
          const types = analyzeItems(items);
          log(`\n📊 Found item types:`, colors.cyan);
          Object.entries(types).forEach(([type, count]) => {
            log(`   ${type}: ${count} items`, colors.cyan);
          });
        }

        // Delete batch
        const { deleted, failed } = await deleteItemsBatch(items);
        stats.deletedItems += deleted;
        stats.failedItems += failed;

        totalProcessed += items.length;

        const action = DRY_RUN ? "would delete" : "deleted";
        process.stdout.write(
          `\r🗑️  ${action}: ${stats.deletedItems}/${stats.totalItems} items (${stats.batches} batches)`
        );
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } catch (error) {
      log(`\n❌ Error scanning table: ${error.message}`, colors.red);
      throw error;
    }
  } while (lastEvaluatedKey);

  console.log(); // New line after progress output
}

// Generate final report
function generateReport() {
  const duration = Math.round((Date.now() - stats.startTime) / 1000);
  const action = DRY_RUN ? "would be deleted" : "deleted";

  log(`\n📈 Final Report:`, colors.bright);
  log(`   Environment: ${ENVIRONMENT}`, colors.blue);
  log(`   Table: ${TABLE_NAME}`, colors.blue);
  log(
    `   Items ${action}: ${stats.deletedItems}`,
    stats.deletedItems > 0 ? colors.green : colors.yellow
  );

  if (stats.failedItems > 0) {
    log(`   Failed deletions: ${stats.failedItems}`, colors.red);
  }

  log(`   Batches processed: ${stats.batches}`, colors.blue);
  log(`   Duration: ${duration} seconds`, colors.blue);

  if (DRY_RUN) {
    log(
      `\n💡 This was a dry run. No items were actually deleted.`,
      colors.yellow
    );
    log(`   Use --confirm to perform actual deletion.`, colors.yellow);
  } else if (stats.deletedItems > 0) {
    log(`\n✅ Deletion completed successfully!`, colors.green);
  } else {
    log(`\n🤷 No items found to delete.`, colors.yellow);
  }
}

// Main execution
async function main() {
  try {
    // Show configuration
    log(`🚀 DynamoDB Items Deletion Script`, colors.bright);
    log(`   Environment: ${colors.yellow}${ENVIRONMENT}${colors.reset}`);
    log(`   Table: ${colors.yellow}${TABLE_NAME}${colors.reset}`);
    log(
      `   Mode: ${
        DRY_RUN ? colors.green + "DRY RUN" : colors.red + "LIVE DELETION"
      }${colors.reset}`
    );

    if (CREATE_BACKUP && !DRY_RUN) {
      log(`   Backup: ${colors.green}Enabled${colors.reset}`);
    }

    // Get user confirmation for production
    const confirmed = await getProductionConfirmation();
    if (!confirmed) {
      log(`\n❌ Operation cancelled by user.`, colors.yellow);
      process.exit(0);
    }

    // Create backup if requested
    let backupFile = null;
    if (CREATE_BACKUP && !DRY_RUN) {
      backupFile = await createBackup();
    }

    // Perform deletion
    await deleteAllItems();

    // Generate report
    generateReport();

    if (backupFile) {
      log(`\n💾 Backup location: ${backupFile}`, colors.blue);
    }
  } catch (error) {
    log(`\n💥 Script failed with error: ${error.message}`, colors.red);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  log(
    `\n\n⚠️  Script interrupted by user. Some items may have been deleted.`,
    colors.yellow
  );
  generateReport();
  process.exit(1);
});

process.on("SIGTERM", () => {
  log(
    `\n\n⚠️  Script terminated. Some items may have been deleted.`,
    colors.yellow
  );
  generateReport();
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, deleteAllItems, createBackup };
