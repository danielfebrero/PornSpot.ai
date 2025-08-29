#!/usr/bin/env node

/**
 * Script to update existing generation settings with new cfgScale and steps values
 * Usage: node scripts/update-generation-settings.js --env=<environment> [--dry-run]
 * Example: node scripts/update-generation-settings.js --env=dev --dry-run
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const path = require("path");
const fs = require("fs");
const readline = require("readline");
require("dotenv").config();

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

// Parse command line arguments
function parseArguments() {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith("--")) {
      const [key, value] = arg.substring(2).split("=");
      args[key] = value || true;
    }
  });
  return args;
}

// Validate arguments
function validateArguments(args) {
  if (!args.env) {
    console.error("❌ Error: --env parameter is required");
    console.log(
      "Usage: node scripts/update-generation-settings.js --env=<environment> [--dry-run]"
    );
    console.log(
      "Example: node scripts/update-generation-settings.js --env=dev --dry-run"
    );
    process.exit(1);
  }

  if (!["local", "dev", "stage", "prod"].includes(args.env)) {
    console.error("❌ Error: --env must be one of: local, dev, stage, prod");
    process.exit(1);
  }

  return args;
}

// Prompt user for confirmation
function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

// Scan for all generation settings
async function scanGenerationSettings(docClient, tableName) {
  console.log("🔍 Scanning for existing generation settings...");

  const settings = [];
  let lastEvaluatedKey = undefined;
  let itemCount = 0;

  do {
    const params = {
      TableName: tableName,
      FilterExpression: "EntityType = :entityType",
      ExpressionAttributeValues: {
        ":entityType": "GenerationSettings",
      },
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    try {
      const result = await docClient.send(new ScanCommand(params));

      if (result.Items) {
        settings.push(...result.Items);
        itemCount += result.Items.length;
        console.log(
          `   Found ${result.Items.length} generation settings (total: ${itemCount})`
        );
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } catch (error) {
      console.error("❌ Error scanning generation settings:", error);
      throw error;
    }
  } while (lastEvaluatedKey);

  console.log(
    `✅ Scan complete. Found ${settings.length} generation settings.`
  );
  return settings;
}

// Update a single generation setting
async function updateGenerationSetting(
  docClient,
  tableName,
  setting,
  dryRun = false
) {
  const updateParams = {
    TableName: tableName,
    Key: {
      PK: setting.PK,
      SK: setting.SK,
    },
    UpdateExpression:
      "SET cfgScale = :cfgScale, steps = :steps, updatedAt = :updatedAt",
    ExpressionAttributeValues: {
      ":cfgScale": 1,
      ":steps": 6,
      ":updatedAt": new Date().toISOString(),
    },
    ReturnValues: "UPDATED_NEW",
  };

  if (dryRun) {
    console.log(
      `   [DRY RUN] Would update ${setting.PK} - cfgScale: ${setting.cfgScale} → 1, steps: ${setting.steps} → 6`
    );
    return { success: true, dryRun: true };
  }

  try {
    const result = await docClient.send(new UpdateCommand(updateParams));
    console.log(
      `   ✅ Updated ${setting.PK} - cfgScale: ${setting.cfgScale} → 1, steps: ${setting.steps} → 6`
    );
    return { success: true, result };
  } catch (error) {
    console.error(`   ❌ Failed to update ${setting.PK}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Update all generation settings
async function updateAllGenerationSettings(
  docClient,
  tableName,
  settings,
  dryRun = false
) {
  console.log(
    `\n🔄 ${dryRun ? "[DRY RUN] " : ""}Updating ${
      settings.length
    } generation settings...`
  );

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  // Process settings in batches to avoid overwhelming DynamoDB
  const batchSize = 10;
  for (let i = 0; i < settings.length; i += batchSize) {
    const batch = settings.slice(i, i + batchSize);

    console.log(
      `\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        settings.length / batchSize
      )} (${batch.length} items)`
    );

    const promises = batch.map((setting) =>
      updateGenerationSetting(docClient, tableName, setting, dryRun)
    );

    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.success) {
        successCount++;
      } else {
        errorCount++;
        const setting = batch[index];
        const error =
          result.status === "rejected" ? result.reason : result.value.error;
        errors.push({ setting: setting.PK, error });
      }
    });

    // Small delay between batches to be gentle on DynamoDB
    if (i + batchSize < settings.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`\n📊 Update Summary:`);
  console.log(`   ✅ Successful updates: ${successCount}`);
  console.log(`   ❌ Failed updates: ${errorCount}`);

  if (errors.length > 0) {
    console.log(`\n❌ Errors encountered:`);
    errors.forEach(({ setting, error }) => {
      console.log(`   ${setting}: ${error}`);
    });
  }

  return { successCount, errorCount, errors };
}

// Display settings summary
function displaySettingsSummary(settings) {
  console.log(`\n📋 Generation Settings Summary:`);
  console.log(`   Total settings found: ${settings.length}`);

  if (settings.length === 0) {
    console.log(`   No generation settings to update.`);
    return;
  }

  // Analyze current values
  const cfgScaleValues = {};
  const stepsValues = {};

  settings.forEach((setting) => {
    const cfgScale = setting.cfgScale;
    const steps = setting.steps;

    cfgScaleValues[cfgScale] = (cfgScaleValues[cfgScale] || 0) + 1;
    stepsValues[steps] = (stepsValues[steps] || 0) + 1;
  });

  console.log(`\n   Current cfgScale distribution:`);
  Object.entries(cfgScaleValues)
    .sort()
    .forEach(([value, count]) => {
      console.log(`     ${value}: ${count} settings`);
    });

  console.log(`\n   Current steps distribution:`);
  Object.entries(stepsValues)
    .sort()
    .forEach(([value, count]) => {
      console.log(`     ${value}: ${count} settings`);
    });

  // Settings that need updating
  const needUpdate = settings.filter((s) => s.cfgScale !== 1 || s.steps !== 6);
  console.log(`\n   Settings that need updating: ${needUpdate.length}`);
  console.log(
    `   Settings already correct: ${settings.length - needUpdate.length}`
  );
}

// Main function
async function main() {
  try {
    // Parse and validate arguments
    const args = parseArguments();
    const validatedArgs = validateArguments(args);
    const isDryRun = validatedArgs["dry-run"] === true;

    console.log("🚀 Generation Settings Update Script");
    console.log(`   Environment: ${validatedArgs.env}`);
    console.log(`   Mode: ${isDryRun ? "DRY RUN" : "LIVE UPDATE"}`);

    // Load environment configuration
    loadEnvironmentConfig(validatedArgs.env);

    // Verify required environment variables
    const tableName = process.env.DYNAMODB_TABLE;
    if (!tableName) {
      console.error(
        "❌ Error: DYNAMODB_TABLE environment variable is required"
      );
      process.exit(1);
    }

    console.log(`   Table: ${tableName}`);

    // Initialize DynamoDB client
    const clientConfig = getClientConfig(validatedArgs.env);
    const dynamoClient = new DynamoDBClient(clientConfig);
    const docClient = DynamoDBDocumentClient.from(dynamoClient);

    // Scan for existing generation settings
    const settings = await scanGenerationSettings(docClient, tableName);

    if (settings.length === 0) {
      console.log("✅ No generation settings found. Nothing to update.");
      return;
    }

    // Display summary
    displaySettingsSummary(settings);

    // Filter settings that actually need updating
    const settingsToUpdate = settings.filter(
      (s) => s.cfgScale !== 1 || s.steps !== 6
    );

    if (settingsToUpdate.length === 0) {
      console.log(
        "✅ All generation settings already have the correct values (cfgScale=1, steps=6)."
      );
      return;
    }

    // Confirmation prompt for live updates
    if (!isDryRun) {
      console.log(
        `\n⚠️  This will update ${settingsToUpdate.length} generation settings in the ${validatedArgs.env} environment.`
      );
      console.log(`   All settings will be updated to: cfgScale=1, steps=6`);

      const confirmation = await promptUser(
        "Do you want to proceed? (yes/no): "
      );

      if (confirmation !== "yes" && confirmation !== "y") {
        console.log("❌ Update cancelled by user.");
        return;
      }
    }

    // Perform updates
    const result = await updateAllGenerationSettings(
      docClient,
      tableName,
      settingsToUpdate,
      isDryRun
    );

    if (isDryRun) {
      console.log(
        `\n✅ Dry run completed. ${settingsToUpdate.length} settings would be updated.`
      );
      console.log(
        `   To perform the actual update, run without --dry-run flag.`
      );
    } else {
      console.log(`\n✅ Update completed!`);
      console.log(`   Successfully updated: ${result.successCount} settings`);
      if (result.errorCount > 0) {
        console.log(`   Failed updates: ${result.errorCount} settings`);
        console.log(`   Check the error messages above for details.`);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  scanGenerationSettings,
  updateGenerationSetting,
  updateAllGenerationSettings,
};
