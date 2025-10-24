#!/usr/bin/env node

/**
 * Script to update user email preferences in bulk
 *
 * This script backfills users' emailPreferences.communications to "always"
 *
 * Usage: node scripts/update-email-preferences.js --env=<environment> [--dry-run] [--limit=N]
 *
 * Examples:
 *   # Update all users in dev environment (dry run)
 *   node scripts/update-email-preferences.js --env=dev --dry-run
 *
 *   # Update all users in production
 *   node scripts/update-email-preferences.js --env=prod
 *
 *   # Update first 100 users only
 *   node scripts/update-email-preferences.js --env=dev --limit=100
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Global error handlers
process.on("unhandledRejection", (r) => {
  console.error("UNHANDLED REJECTION", r);
  process.exit(1);
});
process.on("uncaughtException", (e) => {
  console.error("UNCAUGHT EXCEPTION", e);
  process.exit(1);
});

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  const parsed = {
    isDryRun: args.includes("--dry-run"),
    help: args.includes("--help") || args.includes("-h"),
  };

  for (const arg of args) {
    const match = arg.match(/^--(\w+(?:-\w+)*)=(.+)$/);
    if (match) {
      const key = match[1].replace(/-/g, "_");
      parsed[key] = match[2];
    }
  }

  return parsed;
}

// Load environment variables from .env file
function loadEnvironmentConfig(environment) {
  const envFile = path.join(__dirname, `.env.${environment}`);

  if (fs.existsSync(envFile)) {
    console.log(`📄 Loading environment config from: .env.${environment}`);
    require("dotenv").config({ path: envFile });
  } else {
    console.log(`⚠️  Environment file not found: .env.${environment}`);
    console.log(`   Using default environment variables`);
  }
}

// Environment-specific configurations
const getClientConfig = (environment) => {
  if (environment === "local") {
    return {
      endpoint: process.env.LOCAL_AWS_ENDPOINT || "http://localhost:4566",
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
      },
    };
  }

  // For staging/prod, use default AWS credentials from environment/profile
  return {
    region: process.env.AWS_REGION || "us-east-1",
  };
};

const getTableName = (environment) => {
  return process.env.DYNAMODB_TABLE || `${environment}-pornspot-media`;
};

// Display usage information
function displayUsage() {
  console.log(`
📋 Update Email Preferences Script

This script backfills users' emailPreferences.communications 
to "always" in DynamoDB.

Usage:
  node scripts/update-email-preferences.js --env=<environment> [--dry-run] [--limit=N]

Required Arguments:
  --env=<environment>        Environment (local, dev, stage, prod)

Optional Flags:
  --dry-run                  Show what would change without writing to DB
  --limit=N                  Maximum number of users to process
  --help, -h                 Show this help

Examples:
  # Dry run in dev environment
  node scripts/update-email-preferences.js --env=dev --dry-run

  # Update all users in production
  node scripts/update-email-preferences.js --env=prod

  # Update first 100 users in staging
  node scripts/update-email-preferences.js --env=stage --limit=100
`);
}

// Update email preferences for users
async function updateEmailPreferences(environment, options = {}) {
  const { isDryRun = false, limit = null } = options;

  try {
    // Load environment configuration
    loadEnvironmentConfig(environment);

    // Initialize DynamoDB client
    const clientConfig = getClientConfig(environment);
    const client = new DynamoDBClient(clientConfig);
    const ddoc = DynamoDBDocumentClient.from(client);

    const tableName = getTableName(environment);

    console.log("\n🔍 Configuration:");
    console.log(`   Environment: ${environment}`);
    console.log(`   Table: ${tableName}`);
    console.log(`   Mode: ${isDryRun ? "DRY RUN ⚠️" : "LIVE 🚀"}`);
    if (limit) console.log(`   Limit: ${limit} users`);
    console.log("");

    let lastEvaluatedKey = undefined;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    do {
      // Query GSI1 for all users
      const queryResult = await ddoc.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "GSI1",
          KeyConditionExpression: "GSI1PK = :userEmail",
          ExpressionAttributeValues: {
            ":userEmail": "USER_EMAIL",
          },
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 50, // Process in batches
        })
      );

      const users = queryResult.Items || [];

      for (const user of users) {
        if (limit && totalProcessed >= limit) break;
        totalProcessed++;

        try {
          const userId = user.PK?.replace("USER#", "") || user.userId;
          const email = user.email;
          const username = user.username || "N/A";

          // Check if user has emailPreferences.communications
          // Backfill to "always" unless current value is "never"
          const currentPreference = user.emailPreferences?.communications;

          // Skip only if explicitly set to "never" or already "always"
          if (currentPreference === "never") {
            totalSkipped++;
            if (totalProcessed % 10 === 0) {
              console.log(
                `[${totalProcessed}] ⏭️  Skipped (current: "never"): ${username} (${email})`
              );
            }
          } else if (currentPreference === "always") {
            totalSkipped++;
            if (totalProcessed % 10 === 0) {
              console.log(
                `[${totalProcessed}] ⏭️  Skipped (already "always"): ${username} (${email})`
              );
            }
          } else {
            // Update: "intelligently", undefined, or not set
            console.log(
              `\n[${totalProcessed}] 📧 User: ${username} (${email})`
            );
            console.log(
              `   Current: emailPreferences.communications = ${
                currentPreference ? `"${currentPreference}"` : "not set"
              }`
            );
            console.log(`   New: emailPreferences.communications = "always"`);

            if (!isDryRun) {
              // Update the user's email preferences
              // Need to handle both cases: when emailPreferences exists and when it doesn't
              const updateParams = {
                TableName: tableName,
                Key: {
                  PK: `USER#${userId}`,
                  SK: "METADATA",
                },
              };

              // If emailPreferences doesn't exist, create it with all defaults
              if (!user.emailPreferences) {
                updateParams.UpdateExpression =
                  "SET emailPreferences = :emailPrefs";
                updateParams.ExpressionAttributeValues = {
                  ":emailPrefs": {
                    pscBalance: "intelligently",
                    unreadNotifications: "always",
                    newFollowers: "intelligently",
                    communications: "always",
                  },
                };
              } else {
                // If it exists, just update the nested property
                updateParams.UpdateExpression =
                  "SET emailPreferences.communications = :always";
                updateParams.ExpressionAttributeValues = {
                  ":always": "always",
                };
              }

              await ddoc.send(new UpdateCommand(updateParams));

              console.log(`   ✅ Updated successfully`);
              totalUpdated++;
            } else {
              console.log(`   🔄 Would update (dry run)`);
              totalUpdated++;
            }
          }
        } catch (error) {
          console.error(
            `\n❌ Error processing user ${user.email}:`,
            error.message
          );
          totalErrors++;
        }
      }

      lastEvaluatedKey = queryResult.LastEvaluatedKey;

      // Stop if we've hit the limit
      if (limit && totalProcessed >= limit) {
        break;
      }
    } while (lastEvaluatedKey);

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Summary:");
    console.log(`   Total users processed: ${totalProcessed}`);
    console.log(`   Users ${isDryRun ? "to be " : ""}updated: ${totalUpdated}`);
    console.log(`   Users skipped: ${totalSkipped}`);
    console.log(`   Errors: ${totalErrors}`);
    console.log("=".repeat(60) + "\n");

    if (isDryRun) {
      console.log("⚠️  This was a dry run. No changes were made.");
      console.log(
        "   Run without --dry-run to apply changes to the database.\n"
      );
    } else {
      console.log("✅ Email preferences update completed!\n");
    }
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const args = parseArguments();

  if (args.help) {
    displayUsage();
    process.exit(0);
  }

  if (!args.env) {
    console.error("\n❌ Error: --env parameter is required\n");
    displayUsage();
    process.exit(1);
  }

  const environment = args.env;
  const isDryRun = args.isDryRun;
  const limit = args.limit ? parseInt(args.limit, 10) : null;

  // Validate environment
  const validEnvironments = ["local", "dev", "stage", "prod"];
  if (!validEnvironments.includes(environment)) {
    console.error(
      `\n❌ Error: Invalid environment '${environment}'. Must be one of: ${validEnvironments.join(
        ", "
      )}\n`
    );
    process.exit(1);
  }

  // Confirm production updates
  if (environment === "prod" && !isDryRun) {
    console.log("\n⚠️  WARNING: You are about to update PRODUCTION data!");
    console.log(
      "   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n"
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  await updateEmailPreferences(environment, { isDryRun, limit });
}

// Run the script
main();
