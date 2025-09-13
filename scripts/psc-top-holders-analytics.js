#!/usr/bin/env node
/**
 * psc-top-holders-analytics.js
 *
 * Analytics script to list the top 25 users by PornSpotCoin (PSC) balance
 *
 * Usage:
 *   node psc-top-holders-analytics.js --env=local [--dry-run] [--detailed] [--top=N]
 *   node psc-top-holders-analytics.js --env=stage [--dry-run] [--detailed] [--top=N]
 *   node psc-top-holders-analytics.js --env=prod [--dry-run] [--detailed] [--top=N]
 *
 * Options:
 *   --env=<environment>    Load environment variables from .env.<environment>
 *   --dry-run             Show analysis without creating any reports
 *   --detailed            Show detailed user information including transaction history
 *   --output-json         Output results in JSON format for further processing
 *   --top=<number>        Number of top holders to show (default: 25)
 *   --min-balance=<number> Minimum PSC balance to include (default: 0)
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
const topArg = process.argv.find(function (arg) {
  return arg.startsWith("--top=");
});
const minBalanceArg = process.argv.find(function (arg) {
  return arg.startsWith("--min-balance=");
});

let envFile = ".env";
if (envArg) {
  const envName = envArg.split("=")[1];
  envFile = `.env.${envName}`;
}

const topCount = topArg ? parseInt(topArg.split("=")[1]) : 25;
const minBalance = minBalanceArg ? parseFloat(minBalanceArg.split("=")[1]) : 0;

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

/**
 * Get all users with PSC data from DynamoDB using GSI1 query
 */
async function getAllUsersWithPSC() {
  console.log("🔍 Querying all users via GSI1 for PSC balance analysis...");

  const users = [];
  let lastEvaluatedKey = null;
  let queriedCount = 0;

  do {
    const queryParams = {
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": "USER_EMAIL",
      },
      ProjectionExpression: [
        "userId",
        "email",
        "username",
        "createdAt",
        "lastActive",
        "lastLoginAt",
        "#plan",
        "#role",
        "isActive",
        "pscBalance",
        "pscTotalEarned",
        "pscTotalSpent",
        "pscTotalWithdrawn",
        "pscLastTransactionAt",
      ].join(", "),
      ExpressionAttributeNames: {
        "#plan": "plan",
        "#role": "role",
      },
    };

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    try {
      const result = await docClient.send(new QueryCommand(queryParams));

      if (result.Items) {
        // Filter users with PSC data
        const usersWithPSC = result.Items.filter((user) => {
          return user.pscBalance !== undefined && user.pscBalance !== null;
        });

        users.push(...usersWithPSC);
        queriedCount += result.Items.length;

        console.log(
          `📊 Queried ${queriedCount} users, found ${users.length} with PSC data...`
        );
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } catch (error) {
      console.error("❌ Error querying users:", error);
      throw error;
    }
  } while (lastEvaluatedKey);

  console.log(
    `✅ Query complete: ${queriedCount} total users, ${users.length} with PSC data`
  );
  return users;
}

/**
 * Analyze PSC holdings and generate top holders report
 */
async function analyzePSCHoldings(users) {
  console.log(`📈 Analyzing PSC holdings for ${users.length} users...`);

  // Filter by minimum balance and sort by PSC balance descending
  const eligibleUsers = users
    .filter((user) => (user.pscBalance || 0) >= minBalance)
    .sort((a, b) => (b.pscBalance || 0) - (a.pscBalance || 0));

  // Get top holders
  const topHolders = eligibleUsers.slice(0, topCount);

  // Calculate statistics
  const totalPSCInCirculation = users.reduce(
    (sum, user) => sum + (user.pscBalance || 0),
    0
  );
  const totalPSCEarned = users.reduce(
    (sum, user) => sum + (user.pscTotalEarned || 0),
    0
  );
  const totalPSCSpent = users.reduce(
    (sum, user) => sum + (user.pscTotalSpent || 0),
    0
  );
  const totalPSCWithdrawn = users.reduce(
    (sum, user) => sum + (user.pscTotalWithdrawn || 0),
    0
  );

  const topHoldersBalance = topHolders.reduce(
    (sum, user) => sum + (user.pscBalance || 0),
    0
  );
  const topHoldersPercentage =
    totalPSCInCirculation > 0
      ? (topHoldersBalance / totalPSCInCirculation) * 100
      : 0;

  const usersWithBalance = users.filter((user) => (user.pscBalance || 0) > 0);
  const averageBalance =
    usersWithBalance.length > 0
      ? totalPSCInCirculation / usersWithBalance.length
      : 0;

  return {
    topHolders,
    eligibleUsers: eligibleUsers.length,
    totalUsers: users.length,
    usersWithBalance: usersWithBalance.length,
    totalPSCInCirculation,
    totalPSCEarned,
    totalPSCSpent,
    totalPSCWithdrawn,
    topHoldersBalance,
    topHoldersPercentage,
    averageBalance,
    medianBalance: calculateMedian(eligibleUsers.map((u) => u.pscBalance || 0)),
    analysis: {
      distributionConcentration: topHoldersPercentage,
      wealthInequality: calculateGiniCoefficient(
        eligibleUsers.map((u) => u.pscBalance || 0)
      ),
    },
  };
}

/**
 * Calculate median value
 */
function calculateMedian(values) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  } else {
    return sorted[middle];
  }
}

/**
 * Calculate Gini coefficient for wealth inequality
 */
function calculateGiniCoefficient(values) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((sum, val) => sum + val, 0) / n;

  if (mean === 0) return 0;

  let numerator = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      numerator += Math.abs(sorted[i] - sorted[j]);
    }
  }

  return numerator / (2 * n * n * mean);
}

/**
 * Format PSC amount for display
 */
function formatPSC(amount) {
  if (amount === 0) return "0 PSC";
  if (amount < 1) return `${amount.toFixed(6)} PSC`;
  if (amount < 1000) return `${amount.toFixed(2)} PSC`;
  if (amount < 1000000) return `${(amount / 1000).toFixed(2)}K PSC`;
  return `${(amount / 1000000).toFixed(2)}M PSC`;
}

/**
 * Format user for display
 */
function formatUser(user, rank) {
  const balance = user.pscBalance || 0;
  const earned = user.pscTotalEarned || 0;
  const spent = user.pscTotalSpent || 0;
  const withdrawn = user.pscTotalWithdrawn || 0;

  let display = `${rank.toString().padStart(2)}. @${
    user.username || "unknown"
  } - ${formatPSC(balance)}`;

  if (isDetailed) {
    display += `\n    📧 ${user.email || "no-email"}`;
    display += `\n    🎖️  ${user.role || "user"} (${user.plan || "free"})`;
    display += `\n    📊 Earned: ${formatPSC(earned)} | Spent: ${formatPSC(
      spent
    )} | Withdrawn: ${formatPSC(withdrawn)}`;
    display += `\n    🕒 Joined: ${
      user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "unknown"
    }`;
    display += `\n    🔄 Last Active: ${
      user.lastActive ? new Date(user.lastActive).toLocaleDateString() : "never"
    }`;

    if (user.pscLastTransactionAt) {
      display += `\n    💰 Last PSC Transaction: ${new Date(
        user.pscLastTransactionAt
      ).toLocaleDateString()}`;
    }
    display += "\n";
  }

  return display;
}

/**
 * Display results
 */
function displayResults(results) {
  const {
    topHolders,
    eligibleUsers,
    totalUsers,
    usersWithBalance,
    totalPSCInCirculation,
    totalPSCEarned,
    totalPSCSpent,
    totalPSCWithdrawn,
    topHoldersBalance,
    topHoldersPercentage,
    averageBalance,
    medianBalance,
    analysis,
  } = results;

  if (isJsonOutput) {
    console.log(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          topHolders: topHolders.map((user, index) => ({
            rank: index + 1,
            userId: user.userId,
            username: user.username,
            email: user.email,
            role: user.role,
            plan: user.plan,
            pscBalance: user.pscBalance || 0,
            pscTotalEarned: user.pscTotalEarned || 0,
            pscTotalSpent: user.pscTotalSpent || 0,
            pscTotalWithdrawn: user.pscTotalWithdrawn || 0,
            createdAt: user.createdAt,
            lastActive: user.lastActive,
            pscLastTransactionAt: user.pscLastTransactionAt,
          })),
          summary: {
            eligibleUsers,
            totalUsers,
            usersWithBalance,
            totalPSCInCirculation,
            totalPSCEarned,
            totalPSCSpent,
            totalPSCWithdrawn,
            topHoldersBalance,
            topHoldersPercentage,
            averageBalance,
            medianBalance,
            analysis,
          },
        },
        null,
        2
      )
    );
    return;
  }

  console.log("\n" + "=".repeat(80));
  console.log(`🏆 TOP ${topCount} PORNSPOTCOIN (PSC) HOLDERS`);
  console.log("=".repeat(80));

  if (topHolders.length === 0) {
    console.log("❌ No users found with PSC balance >= " + minBalance);
    return;
  }

  topHolders.forEach((user, index) => {
    console.log(formatUser(user, index + 1));
  });

  console.log("\n" + "=".repeat(80));
  console.log("📊 PSC ECOSYSTEM SUMMARY");
  console.log("=".repeat(80));
  console.log(`👥 Total Users: ${totalUsers.toLocaleString()}`);
  console.log(`💰 Users with PSC: ${usersWithBalance.toLocaleString()}`);
  console.log(
    `🎯 Eligible Users (balance ≥ ${minBalance}): ${eligibleUsers.toLocaleString()}`
  );
  console.log(
    `\n💎 Total PSC in Circulation: ${formatPSC(totalPSCInCirculation)}`
  );
  console.log(`📈 Total PSC Ever Earned: ${formatPSC(totalPSCEarned)}`);
  console.log(`💸 Total PSC Ever Spent: ${formatPSC(totalPSCSpent)}`);
  console.log(`🏦 Total PSC Withdrawn: ${formatPSC(totalPSCWithdrawn)}`);

  console.log(
    `\n🏆 Top ${topCount} Holders Combined: ${formatPSC(topHoldersBalance)}`
  );
  console.log(
    `📊 Top ${topCount} Hold: ${topHoldersPercentage.toFixed(2)}% of total PSC`
  );
  console.log(`📊 Average Balance: ${formatPSC(averageBalance)}`);
  console.log(`📊 Median Balance: ${formatPSC(medianBalance)}`);

  console.log(`\n📈 Wealth Distribution Analysis:`);
  console.log(
    `   🎯 Concentration in Top ${topCount}: ${topHoldersPercentage.toFixed(
      2
    )}%`
  );
  console.log(
    `   ⚖️  Gini Coefficient: ${analysis.wealthInequality.toFixed(
      4
    )} (0=equal, 1=unequal)`
  );

  // Provide interpretation
  if (topHoldersPercentage > 80) {
    console.log(
      `   ⚠️  Very high concentration - top holders dominate ecosystem`
    );
  } else if (topHoldersPercentage > 60) {
    console.log(`   🔶 High concentration - significant wealth concentration`);
  } else if (topHoldersPercentage > 40) {
    console.log(`   🔹 Moderate concentration - balanced distribution`);
  } else {
    console.log(`   ✅ Low concentration - well distributed wealth`);
  }

  console.log("\n" + "=".repeat(80));

  if (isDryRun) {
    console.log("🔍 DRY RUN - No reports saved");
  } else {
    // Save report to file
    const reportPath = `psc-top-holders-${
      new Date().toISOString().split("T")[0]
    }.json`;
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          parameters: { topCount, minBalance, environment: envFile },
          ...results,
        },
        null,
        2
      )
    );
    console.log(`💾 Detailed report saved to: ${reportPath}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    if (!TABLE_NAME) {
      throw new Error("DYNAMODB_TABLE environment variable is required");
    }

    console.log(`🚀 Starting PSC Top Holders Analysis`);
    console.log(`📋 Table: ${TABLE_NAME}`);
    console.log(`🎯 Target: Top ${topCount} holders`);
    console.log(`💰 Min Balance: ${formatPSC(minBalance)}`);
    console.log(`🔧 Environment: ${envFile}`);

    if (isDryRun) {
      console.log("🔍 DRY RUN MODE - No changes will be made");
    }
    if (isDetailed) {
      console.log("📝 DETAILED MODE - Extended user information");
    }

    console.log("");

    // Get all users with PSC data
    const users = await getAllUsersWithPSC();

    if (users.length === 0) {
      console.log("❌ No users with PSC data found");
      return;
    }

    // Analyze PSC holdings
    const results = await analyzePSCHoldings(users);

    // Display results
    displayResults(results);

    console.log("\n✅ PSC Top Holders Analysis Complete");
  } catch (error) {
    console.error("❌ Error during PSC analysis:", error);
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

module.exports = {
  main,
  getAllUsersWithPSC,
  analyzePSCHoldings,
  formatPSC,
  calculateGiniCoefficient,
};
