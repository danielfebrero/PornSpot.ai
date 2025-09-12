#!/usr/bin/env node
/**
 * user-return-rate-analytics.js
 *
 * Analytics script to calculate the percentage of registered users that came back
 * by comparing createdAt and lastActive timestamps
 *
 * Usage:
 *   node user-return-rate-analytics.js --env=local [--dry-run] [--detailed]
 *   node user-return-rate-analytics.js --env=stage [--dry-run] [--detailed]
 *   node user-return-rate-analytics.js --env=prod [--dry-run] [--detailed]
 *
 * Options:
 *   --env=<environment>    Load environment variables from .env.<environment>
 *   --dry-run             Show analysis without creating any reports
 *   --detailed            Show detailed breakdown of user categories
 *   --output-json         Output results in JSON format for further processing
 *   --min-days=<number>   Minimum days since registration to consider (default: 1)
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
process.on("unhandledRejection", function (reason) {
  console.error(
    "UNHANDLED REJECTION:",
    reason,
    typeof reason === "object" ? JSON.stringify(reason, null, 2) : ""
  );
  process.exit(1);
});
process.on("uncaughtException", function (err) {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

// Parse command line arguments
const isDryRun = process.argv.includes("--dry-run");
const isDetailed = process.argv.includes("--detailed");
const isJsonOutput = process.argv.includes("--output-json");

const envArg = process.argv.find(function (arg) {
  return arg.startsWith("--env=");
});

const minDaysArg = process.argv.find(function (arg) {
  return arg.startsWith("--min-days=");
});

let envFile = ".env";
if (envArg) {
  const envName = envArg.split("=")[1];
  envFile = `.env.${envName}`;
}

const minDaysSinceRegistration = minDaysArg
  ? parseInt(minDaysArg.split("=")[1], 10)
  : 1;

// Load environment variables
const envPath = path.resolve(__dirname, envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded environment from ${envFile}`);
} else {
  console.warn(`⚠️ Environment file ${envFile} not found, using default .env`);
  dotenv.config();
}

// AWS SDK requires (for local compatibility)
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const isLocal = process.env["AWS_SAM_LOCAL"] === "true";

const clientConfig = {};

if (isLocal) {
  clientConfig.endpoint = "http://pornspot-local-aws:4566";
  clientConfig.region = "us-east-1";
  clientConfig.credentials = {
    accessKeyId: "test",
    secretAccessKey: "test",
  };
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env["DYNAMODB_TABLE"];

if (!TABLE_NAME) {
  console.error("❌ DYNAMODB_TABLE environment variable is required");
  process.exit(1);
}

/**
 * Get all users from DynamoDB using pagination
 */
async function getAllUsers() {
  const users = [];
  let lastEvaluatedKey = null;
  let pageCount = 0;

  console.log("🔍 Fetching all users from DynamoDB...");

  do {
    pageCount++;
    console.log(`  📄 Processing page ${pageCount}...`);

    const queryParams = {
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": "USER_EMAIL",
      },
      Limit: 100, // Process in batches
    };

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    if (result.Items && result.Items.length > 0) {
      // Filter out deleted users and only include User entities
      const validUsers = result.Items.filter(
        (item) =>
          item.EntityType === "User" &&
          item.username !== "[deleted]" &&
          item.createdAt &&
          item.isActive !== false // Include active users
      );

      users.push(...validUsers);
      console.log(`    ✓ Found ${validUsers.length} valid users on this page`);
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`✅ Total users fetched: ${users.length}`);
  return users;
}

/**
 * Analyze user return rate based on createdAt vs lastActive
 */
function analyzeUserReturnRate(users) {
  const now = new Date();
  const analysis = {
    totalUsers: users.length,
    newUsers: 0, // Users who never came back (no lastActive or same as createdAt)
    returningUsers: 0, // Users who came back (lastActive > createdAt)
    recentRegistrations: 0, // Users registered within minDays (excluded from analysis)
    invalidData: 0, // Users with missing/invalid data
    categories: {
      neverActive: 0, // No lastActive field
      sameDay: 0, // lastActive same as createdAt
      returned: 0, // lastActive > createdAt
      recentSignup: 0, // Too recent to analyze
    },
    detailedBreakdown: [],
  };

  users.forEach((user, index) => {
    const userAnalysis = {
      userId: user.userId,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      lastActive: user.lastActive,
      status: "",
      daysSinceRegistration: 0,
      daysSinceLastActive: 0,
    };

    try {
      const createdDate = new Date(user.createdAt);
      const daysSinceRegistration = Math.floor(
        (now - createdDate) / (1000 * 60 * 60 * 24)
      );
      userAnalysis.daysSinceRegistration = daysSinceRegistration;

      // Skip users who registered too recently
      if (daysSinceRegistration < minDaysSinceRegistration) {
        analysis.recentRegistrations++;
        analysis.categories.recentSignup++;
        userAnalysis.status = "recent_signup";
        if (isDetailed) analysis.detailedBreakdown.push(userAnalysis);
        return;
      }

      // Check if user has lastActive field
      if (!user.lastActive) {
        analysis.newUsers++;
        analysis.categories.neverActive++;
        userAnalysis.status = "never_active";
        if (isDetailed) analysis.detailedBreakdown.push(userAnalysis);
        return;
      }

      const lastActiveDate = new Date(user.lastActive);
      const daysSinceLastActive = Math.floor(
        (now - lastActiveDate) / (1000 * 60 * 60 * 24)
      );
      userAnalysis.daysSinceLastActive = daysSinceLastActive;

      // Compare dates to see if user returned
      const createdDay = createdDate.toDateString();
      const lastActiveDay = lastActiveDate.toDateString();

      if (lastActiveDay === createdDay) {
        // User was only active on registration day
        analysis.newUsers++;
        analysis.categories.sameDay++;
        userAnalysis.status = "same_day_only";
      } else if (lastActiveDate > createdDate) {
        // User came back after registration
        analysis.returningUsers++;
        analysis.categories.returned++;
        userAnalysis.status = "returned";
      } else {
        // Shouldn't happen (lastActive before createdAt), treat as invalid
        analysis.invalidData++;
        userAnalysis.status = "invalid_data";
      }

      if (isDetailed) analysis.detailedBreakdown.push(userAnalysis);
    } catch (error) {
      console.warn(`⚠️ Error processing user ${user.userId}:`, error.message);
      analysis.invalidData++;
      userAnalysis.status = "processing_error";
      if (isDetailed) analysis.detailedBreakdown.push(userAnalysis);
    }
  });

  // Calculate percentages (excluding recent registrations and invalid data)
  const eligibleUsers =
    analysis.totalUsers - analysis.recentRegistrations - analysis.invalidData;
  analysis.eligibleUsers = eligibleUsers;
  analysis.returnRate =
    eligibleUsers > 0 ? (analysis.returningUsers / eligibleUsers) * 100 : 0;
  analysis.newUserRate =
    eligibleUsers > 0 ? (analysis.newUsers / eligibleUsers) * 100 : 0;

  return analysis;
}

/**
 * Format and display the analysis results
 */
function displayResults(analysis) {
  const timestamp = new Date().toISOString();

  if (isJsonOutput) {
    console.log(
      JSON.stringify(
        {
          timestamp,
          minDaysSinceRegistration,
          analysis,
        },
        null,
        2
      )
    );
    return;
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 USER RETURN RATE ANALYSIS RESULTS");
  console.log("=".repeat(60));
  console.log(`📅 Analysis Date: ${timestamp}`);
  console.log(
    `⏱️  Minimum Days Since Registration: ${minDaysSinceRegistration}`
  );
  console.log("");

  console.log("📈 SUMMARY STATISTICS:");
  console.log(
    `   Total Users in Database: ${analysis.totalUsers.toLocaleString()}`
  );
  console.log(
    `   Eligible Users (excluding recent): ${analysis.eligibleUsers.toLocaleString()}`
  );
  console.log(
    `   Recent Registrations (excluded): ${analysis.recentRegistrations.toLocaleString()}`
  );
  console.log(
    `   Invalid/Error Records: ${analysis.invalidData.toLocaleString()}`
  );
  console.log("");

  console.log("🎯 RETURN RATE ANALYSIS:");
  console.log(
    `   📈 Returning Users: ${analysis.returningUsers.toLocaleString()} (${analysis.returnRate.toFixed(
      2
    )}%)`
  );
  console.log(
    `   📉 One-Time Users: ${analysis.newUsers.toLocaleString()} (${analysis.newUserRate.toFixed(
      2
    )}%)`
  );
  console.log("");

  console.log("🔍 DETAILED BREAKDOWN:");
  console.log(
    `   Never Active: ${analysis.categories.neverActive.toLocaleString()}`
  );
  console.log(
    `   Same Day Only: ${analysis.categories.sameDay.toLocaleString()}`
  );
  console.log(`   Returned: ${analysis.categories.returned.toLocaleString()}`);
  console.log(
    `   Recent Signup: ${analysis.categories.recentSignup.toLocaleString()}`
  );
  console.log("");

  // Key insights
  console.log("💡 KEY INSIGHTS:");
  if (analysis.returnRate > 50) {
    console.log(
      `   ✅ Good return rate (${analysis.returnRate.toFixed(
        1
      )}%) - majority of users come back`
    );
  } else if (analysis.returnRate > 25) {
    console.log(
      `   ⚠️  Moderate return rate (${analysis.returnRate.toFixed(
        1
      )}%) - room for improvement`
    );
  } else {
    console.log(
      `   ❌ Low return rate (${analysis.returnRate.toFixed(
        1
      )}%) - retention needs attention`
    );
  }

  const neverActiveRate =
    (analysis.categories.neverActive / analysis.eligibleUsers) * 100;
  if (neverActiveRate > 20) {
    console.log(
      `   📊 High percentage of never-active users (${neverActiveRate.toFixed(
        1
      )}%)`
    );
  }

  console.log("");

  if (isDetailed && analysis.detailedBreakdown.length > 0) {
    console.log("📋 DETAILED USER BREAKDOWN:");
    console.log("-".repeat(60));

    // Group by status for better readability
    const groupedUsers = analysis.detailedBreakdown.reduce((acc, user) => {
      if (!acc[user.status]) acc[user.status] = [];
      acc[user.status].push(user);
      return acc;
    }, {});

    Object.entries(groupedUsers).forEach(([status, users]) => {
      console.log(
        `\n${status.toUpperCase().replace("_", " ")} (${users.length} users):`
      );
      users.slice(0, 10).forEach((user) => {
        // Show first 10 of each category
        console.log(
          `   ${user.username} | Reg: ${user.daysSinceRegistration}d ago | Last: ${user.daysSinceLastActive}d ago`
        );
      });
      if (users.length > 10) {
        console.log(`   ... and ${users.length - 10} more users`);
      }
    });
  }
}

/**
 * Save results to file
 */
async function saveResults(analysis) {
  if (isDryRun) {
    console.log("🔍 Dry run mode - no files will be saved");
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `user-return-rate-analysis-${timestamp}.json`;
  const filepath = path.join(__dirname, filename);

  const reportData = {
    timestamp: new Date().toISOString(),
    minDaysSinceRegistration,
    environment: envArg ? envArg.split("=")[1] : "default",
    analysis,
  };

  try {
    fs.writeFileSync(filepath, JSON.stringify(reportData, null, 2));
    console.log(`💾 Results saved to: ${filename}`);
  } catch (error) {
    console.error(`❌ Failed to save results: ${error.message}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log("🚀 Starting User Return Rate Analysis");
    console.log(`📊 Environment: ${envArg ? envArg.split("=")[1] : "default"}`);
    console.log(`🏢 Table: ${TABLE_NAME}`);
    console.log(`🔍 Mode: ${isDryRun ? "DRY RUN" : "FULL ANALYSIS"}`);
    console.log(
      `📅 Minimum days since registration: ${minDaysSinceRegistration}`
    );
    console.log("");

    // Fetch all users
    const users = await getAllUsers();

    if (users.length === 0) {
      console.log("⚠️ No users found in database");
      return;
    }

    // Analyze return rate
    console.log("🔬 Analyzing user return patterns...");
    const analysis = analyzeUserReturnRate(users);

    // Display results
    displayResults(analysis);

    // Save results to file
    await saveResults(analysis);

    console.log("\n✅ Analysis complete!");
  } catch (error) {
    console.error("❌ Error during analysis:", error);
    process.exit(1);
  }
}

// Run the script
main();
