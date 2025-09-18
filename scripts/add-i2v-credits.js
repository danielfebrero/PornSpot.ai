#!/usr/bin/env node

/**
 * Increment a user's purchased I2V credits (i2vCreditsSecondsPurchased) by a specified number of seconds.
 *
 * Supports lookup by either email (GSI1) or username (GSI3).
 *
 * Usage:
 *   node scripts/add-i2v-credits.js --env=<environment> (--email=<email> | --username=<username>) --seconds=<positive_integer> [--dry-run]
 *   node scripts/add-i2v-credits.js --help
 *
 * Examples:
 *   # Add 120 seconds to a user by email in dev
 *   node scripts/add-i2v-credits.js --env=dev --email=user@example.com --seconds=120
 *
 *   # Add 300 seconds to a user by username in prod (with warning)
 *   node scripts/add-i2v-credits.js --env=prod --username=cooluser --seconds=300
 *
 *   # Dry run (no DB write)
 *   node scripts/add-i2v-credits.js --env=staging --email=user@example.com --seconds=60 --dry-run
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

// ----------------------------- Argument Parsing -----------------------------
function parseArguments() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    const match = arg.match(/^--(\w+(?:-\w+)*)=(.+)$/);
    if (match) {
      const key = match[1].replace(/-/g, "_");
      parsed[key] = match[2];
    } else if (arg === "--dry-run") {
      parsed.dry_run = true;
    }
  }
  return parsed;
}

// ----------------------------- Environment Handling -----------------------------
function loadEnvironmentConfig(environment) {
  const envFile = path.join(__dirname, `.env.${environment}`);
  if (fs.existsSync(envFile)) {
    console.log(`📄 Loading environment config from: .env.${environment}`);
    require("dotenv").config({ path: envFile });
  } else {
    console.log(
      `ℹ️  Environment file not found: .env.${environment} (using process env vars)`
    );
  }
}

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
  return { region: process.env.AWS_REGION || "us-east-1" };
};

const getTableName = (environment) => {
  return process.env.DYNAMODB_TABLE || `${environment}-pornspot-media`;
};

// ----------------------------- Validation Helpers -----------------------------
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateUsername(username) {
  // Basic username rules (mirror typical constraints): alphanumeric + underscores, 3-30 chars
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

function displayUsage() {
  console.log(
    `\n📋 Add I2V Credits Script\n\nUsage:\n  node scripts/add-i2v-credits.js --env=<environment> (--email=<email> | --username=<username>) --seconds=<positive_integer> [--dry-run]\n\nRequired Arguments:\n  --env=<environment>        Environment (local, dev, staging, prod)\n  --seconds=<n>              Positive integer number of seconds to add\n  One of:\n    --email=<email>          User email address\n    --username=<username>    Username\n\nOptional Flags:\n  --dry-run                  Show what would change without writing to DB\n  --help                     Show this help\n\nExamples:\n  node scripts/add-i2v-credits.js --env=dev --email=user@example.com --seconds=120\n  node scripts/add-i2v-credits.js --env=prod --username=cooluser --seconds=300\n  node scripts/add-i2v-credits.js --env=staging --email=user@example.com --seconds=60 --dry-run\n`
  );
}

// ----------------------------- Core Logic -----------------------------
async function findUser(docClient, tableName, { email, username }) {
  if (email) {
    const res = await docClient.send(
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
    return res.Items?.[0] || null;
  }
  if (username) {
    const res = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI3",
        KeyConditionExpression: "GSI3PK = :gsi3pk AND GSI3SK = :gsi3sk",
        ExpressionAttributeValues: {
          ":gsi3pk": "USER_USERNAME",
          ":gsi3sk": username.toLowerCase(),
        },
        Limit: 1,
      })
    );
    return res.Items?.[0] || null;
  }
  return null;
}

async function addI2VCredits(
  environment,
  { email, username, seconds, dryRun }
) {
  loadEnvironmentConfig(environment);
  const clientConfig = getClientConfig(environment);
  const tableName = getTableName(environment);

  console.log(`🚀 Adding I2V credits`);
  console.log(`   Environment: ${environment}`);
  console.log(`   Table: ${tableName}`);
  if (email) console.log(`   Lookup (email): ${email}`);
  if (username) console.log(`   Lookup (username): ${username}`);
  console.log(`   Increment (seconds): ${seconds}`);
  if (dryRun) console.log(`   Mode: DRY RUN (no changes will be written)`);

  if (environment === "prod") {
    console.log("⚠️  WARNING: You are modifying user credits in PRODUCTION!\n");
  }

  const client = new DynamoDBClient(clientConfig);
  const docClient = DynamoDBDocumentClient.from(client);

  // Fetch user
  console.log("🔍 Looking up user...");
  const user = await findUser(docClient, tableName, { email, username });
  if (!user) {
    throw new Error(
      `User not found via ${
        email ? `email '${email}'` : `username '${username}'`
      }`
    );
  }

  const current = user.i2vCreditsSecondsPurchased || 0;
  const after = current + seconds;
  console.log(`✅ User found: ${user.userId} (${user.username || user.email})`);
  console.log(`   Current i2vCreditsSecondsPurchased: ${current}`);
  console.log(`   New value after increment: ${after}`);

  if (dryRun) {
    console.log("💡 Dry run complete. No update performed.");
    return { before: current, after };
  }

  // Perform atomic increment (ADD) + set updatedAt timestamp
  const now = new Date().toISOString();
  const updateRes = await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: user.PK, SK: user.SK },
      UpdateExpression:
        "SET #updatedAt = :updatedAt ADD #i2vCreditsSecondsPurchased :inc",
      ExpressionAttributeNames: {
        "#updatedAt": "updatedAt",
        "#i2vCreditsSecondsPurchased": "i2vCreditsSecondsPurchased",
      },
      ExpressionAttributeValues: {
        ":updatedAt": now,
        ":inc": seconds,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  const newVal = updateRes.Attributes?.i2vCreditsSecondsPurchased;
  console.log("📝 Update successful!");
  console.log(`   Updated i2vCreditsSecondsPurchased: ${newVal}`);
  console.log(`   updatedAt: ${updateRes.Attributes?.updatedAt}`);
  return { before: current, after: newVal };
}

// ----------------------------- Main Entry -----------------------------
async function main() {
  const args = parseArguments();
  if (args.help) {
    displayUsage();
    return;
  }

  // Required args
  if (!args.env) {
    console.error("❌ Missing required argument: --env");
    displayUsage();
    process.exit(1);
  }
  if (!args.seconds) {
    console.error("❌ Missing required argument: --seconds");
    displayUsage();
    process.exit(1);
  }
  if (!args.email && !args.username) {
    console.error("❌ Either --email or --username must be provided");
    displayUsage();
    process.exit(1);
  }
  if (args.email && args.username) {
    console.error("❌ Provide only one of --email or --username (not both)");
    process.exit(1);
  }

  const seconds = Number(args.seconds);
  if (!Number.isInteger(seconds) || seconds <= 0) {
    console.error("❌ --seconds must be a positive integer");
    process.exit(1);
  }

  if (args.email && !validateEmail(args.email)) {
    console.error(`❌ Invalid email format: ${args.email}`);
    process.exit(1);
  }
  if (args.username && !validateUsername(args.username)) {
    console.error(`❌ Invalid username format: ${args.username}`);
    process.exit(1);
  }

  try {
    await addI2VCredits(args.env, {
      email: args.email,
      username: args.username,
      seconds,
      dryRun: !!args.dry_run,
    });
  } catch (err) {
    console.error("❌ Error adding I2V credits:", err.message || err);
    if (err.name === "ResourceNotFoundException") {
      console.error(
        `❌ DynamoDB table '${getTableName(
          args.env
        )}' not found. Ensure environment is deployed.`
      );
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("💥 Unexpected failure:", err);
    process.exit(1);
  });
}

module.exports = { addI2VCredits, parseArguments };
