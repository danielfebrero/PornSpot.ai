#!/usr/bin/env node

/**
 * Script to update user plans based on email addresses
 * Usage: node scripts/update-user-plan.js --env=<environment> --email=<email> --plan=<plan> [--status=<status>] [--subscription-id=<id>] [--end-date=<date>]
 * Example: node scripts/update-user-plan.js --env=dev --email=user@example.com --plan=pro --status=active
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

// Valid plan and status values
const VALID_PLANS = ["free", "starter", "unlimited", "pro"];
const VALID_STATUSES = ["active", "canceled", "expired"];

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

// Validate email format
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate date format (ISO 8601)
function validateDate(dateString) {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString === date.toISOString();
}

// Helper function to build GSI4 values for user plan indexing
function buildGsi4(plan, planEndDate, userId) {
  const FAR_FUTURE = '9999-12-31T00:00:00.000Z';
  const safeEnd = planEndDate && planEndDate.length >= 10 ? planEndDate : FAR_FUTURE;
  return {
    GSI4PK: `USER_PLAN#${plan}`,
    GSI4SK: `${safeEnd}#${userId}`
  };
}

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (const arg of args) {
    const match = arg.match(/^--(\w+(?:-\w+)*)=(.+)$/);
    if (match) {
      const key = match[1].replace(/-/g, "_"); // Convert kebab-case to snake_case
      parsed[key] = match[2];
    }
  }

  return parsed;
}

// Update user plan
async function updateUserPlan(environment, email, plan, options = {}) {
  try {
    // Load environment configuration
    loadEnvironmentConfig(environment);

    const clientConfig = getClientConfig(environment);
    const tableName = getTableName(environment);

    console.log(`🔄 Updating user plan for: ${email}`);
    console.log(`   Environment: ${environment}`);
    console.log(`   Table: ${tableName}`);
    console.log(`   Plan: ${plan}`);
    if (options.status) console.log(`   Status: ${options.status}`);

    // Initialize DynamoDB client
    const client = new DynamoDBClient(clientConfig);
    const docClient = DynamoDBDocumentClient.from(client);

    // Find user by email using GSI1
    console.log(`🔍 Looking up user by email: ${email}`);
    const userResult = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk AND GSI1SK = :gsi1sk",
        ExpressionAttributeValues: {
          ":gsi1pk": "USER_EMAIL",
          ":gsi1sk": email.toLowerCase(),
        },
        Limit: 1,
      })
    );

    if (!userResult.Items || userResult.Items.length === 0) {
      throw new Error(`User not found with email: ${email}`);
    }

    const user = userResult.Items[0];
    console.log(`✅ Found user: ${user.userId} (${user.username})`);

    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    // Always update the plan
    updateExpressions.push("#plan = :plan");
    expressionAttributeNames["#plan"] = "plan";
    expressionAttributeValues[":plan"] = plan;

    // Update subscription status if provided
    if (options.status) {
      updateExpressions.push("#subscriptionStatus = :subscriptionStatus");
      expressionAttributeNames["#subscriptionStatus"] = "subscriptionStatus";
      expressionAttributeValues[":subscriptionStatus"] = options.status;
    }

    // Update subscription ID if provided
    if (options.subscription_id) {
      updateExpressions.push("#subscriptionId = :subscriptionId");
      expressionAttributeNames["#subscriptionId"] = "subscriptionId";
      expressionAttributeValues[":subscriptionId"] = options.subscription_id;
    }

    // Update plan start date (always set to current time when updating)
    const now = new Date().toISOString();
    updateExpressions.push("#planStartDate = :planStartDate");
    expressionAttributeNames["#planStartDate"] = "planStartDate";
    expressionAttributeValues[":planStartDate"] = now;

    // Update plan end date if provided
    if (options.end_date) {
      updateExpressions.push("#planEndDate = :planEndDate");
      expressionAttributeNames["#planEndDate"] = "planEndDate";
      expressionAttributeValues[":planEndDate"] = options.end_date;
    }

    // Build and update GSI4 fields for plan indexing
    const gsi4 = buildGsi4(plan, options.end_date, user.userId);
    updateExpressions.push("#GSI4PK = :gsi4pk, #GSI4SK = :gsi4sk");
    expressionAttributeNames["#GSI4PK"] = "GSI4PK";
    expressionAttributeNames["#GSI4SK"] = "GSI4SK";
    expressionAttributeValues[":gsi4pk"] = gsi4.GSI4PK;
    expressionAttributeValues[":gsi4sk"] = gsi4.GSI4SK;

    // Perform the update
    console.log(`📝 Updating user plan...`);
    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: user.PK,
          SK: user.SK,
        },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );

    console.log(`✅ User plan updated successfully!`);
    console.log(`   User: ${email} (${user.userId})`);
    console.log(`   Plan: ${plan}`);
    console.log(`   GSI4PK: ${gsi4.GSI4PK}`);
    console.log(`   GSI4SK: ${gsi4.GSI4SK}`);
    if (options.status) console.log(`   Status: ${options.status}`);
    if (options.subscription_id)
      console.log(`   Subscription ID: ${options.subscription_id}`);
    console.log(`   Plan Start Date: ${now}`);
    if (options.end_date) console.log(`   Plan End Date: ${options.end_date}`);
  } catch (error) {
    console.error(`❌ Error updating user plan:`, error.message);

    if (error.name === "ResourceNotFoundException") {
      console.error(
        `❌ DynamoDB table '${getTableName(environment)}' not found.`
      );
      console.error(
        `   Make sure the infrastructure is deployed for environment: ${environment}`
      );
    } else if (
      error.name === "CredentialsError" ||
      error.name === "UnauthorizedOperation"
    ) {
      console.error(
        `❌ AWS credentials error. Make sure you have proper AWS credentials configured.`
      );
      console.error(
        `   For production, ensure your AWS profile has DynamoDB write permissions.`
      );
    }

    process.exit(1);
  }
}

// Display usage information
function displayUsage() {
  console.log(`
📋 Update User Plan Script

Usage:
  node scripts/update-user-plan.js --env=<environment> --email=<email> --plan=<plan> [options]

Required Arguments:
  --env=<environment>     Environment (local, dev, staging, prod)
  --email=<email>         User's email address
  --plan=<plan>          New plan (${VALID_PLANS.join(", ")})

Optional Arguments:
  --status=<status>       Subscription status (${VALID_STATUSES.join(", ")})
  --subscription-id=<id>  Stripe subscription ID
  --end-date=<date>       Plan end date (ISO 8601 format, e.g., 2024-12-31T23:59:59.000Z)

Examples:
  # Update user to pro plan with active status
  node scripts/update-user-plan.js --env=dev --email=user@example.com --plan=pro --status=active

  # Update user to starter plan with subscription ID
  node scripts/update-user-plan.js --env=prod --email=user@example.com --plan=starter --status=active --subscription-id=sub_1234567890

  # Update user to unlimited plan with end date
  node scripts/update-user-plan.js --env=staging --email=user@example.com --plan=unlimited --status=active --end-date=2024-12-31T23:59:59.000Z

Environment Files:
  The script will automatically load environment configuration from:
  - scripts/.env.<environment>
  
  Example .env.dev file:
    AWS_REGION=us-east-1
    DYNAMODB_TABLE=dev-pornspot-media
    AWS_ACCESS_KEY_ID=your_key_id
    AWS_SECRET_ACCESS_KEY=your_secret_key
`);
}

// Main function
async function main() {
  const args = parseArguments();

  // Check for help flag
  if (args.help || args.h) {
    displayUsage();
    return;
  }

  // Validate required arguments
  if (!args.env) {
    console.error(`❌ Missing required argument: --env`);
    displayUsage();
    process.exit(1);
  }

  if (!args.email) {
    console.error(`❌ Missing required argument: --email`);
    displayUsage();
    process.exit(1);
  }

  if (!args.plan) {
    console.error(`❌ Missing required argument: --plan`);
    displayUsage();
    process.exit(1);
  }

  // Validate email format
  if (!validateEmail(args.email)) {
    console.error(`❌ Invalid email format: ${args.email}`);
    process.exit(1);
  }

  // Validate plan
  if (!VALID_PLANS.includes(args.plan)) {
    console.error(`❌ Invalid plan: ${args.plan}`);
    console.error(`   Valid plans: ${VALID_PLANS.join(", ")}`);
    process.exit(1);
  }

  // Validate status if provided
  if (args.status && !VALID_STATUSES.includes(args.status)) {
    console.error(`❌ Invalid status: ${args.status}`);
    console.error(`   Valid statuses: ${VALID_STATUSES.join(", ")}`);
    process.exit(1);
  }

  // Validate end date if provided
  if (args.end_date && !validateDate(args.end_date)) {
    console.error(`❌ Invalid end date format: ${args.end_date}`);
    console.error(
      `   Expected ISO 8601 format, e.g., 2024-12-31T23:59:59.000Z`
    );
    process.exit(1);
  }

  // Build options object
  const options = {};
  if (args.status) options.status = args.status;
  if (args.subscription_id) options.subscription_id = args.subscription_id;
  if (args.end_date) options.end_date = args.end_date;

  // Update user plan
  await updateUserPlan(args.env, args.email, args.plan, options);
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error(`💥 Unexpected error:`, error);
    process.exit(1);
  });
}

module.exports = {
  updateUserPlan,
  validateEmail,
  validateDate,
  parseArguments,
};
