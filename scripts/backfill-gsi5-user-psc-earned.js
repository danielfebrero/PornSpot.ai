/**
 * backfill-gsi5-user-psc-earned.js
 *
 * Backfill script to ensure User entities have the correct GSI5 keys for PSC earnings ranking.
 *
 * Requirements:
 *   GSI5PK (User) = "USER_PSC_TOTAL_EARNED"
 *   GSI5SK (User) = "{pscTotalEarned}#{userId}"
 *
 * This index allows querying users sorted by total PSC earned (leaderboard functionality).
 *
 * Usage examples:
 *   node backfill-gsi5-user-psc-earned.js --env=local [--dry-run]
 *   node backfill-gsi5-user-psc-earned.js --env=stage --concurrency=50
 *
 * CLI options:
 *   --env=<environment>   Load env vars from .env.<environment> (default: .env)
 *   --dry-run              Preview updates without writing to DynamoDB
 *   --concurrency=<num>    Parallel update concurrency (default 25)
 *   --page-size=<num>      Items fetched per query (default 250)
 */

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Fail fast on unhandled errors
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

const isDryRun = process.argv.includes("--dry-run");

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

const envPath = path.resolve(__dirname, envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`Loaded environment variables from ${envPath}`);
} else {
  const fallbackPath = path.resolve(__dirname, ".env");
  if (fs.existsSync(fallbackPath)) {
    dotenv.config({ path: fallbackPath });
    console.log(
      `Could not find ${envPath}, loaded default .env from script directory`
    );
  } else {
    console.warn(
      `Warning: Could not find env file ${envPath}. Proceeding with process.env as-is.`
    );
  }
}

const concurrencyArg = process.argv.find((arg) =>
  arg.startsWith("--concurrency=")
);
const pageSizeArg = process.argv.find((arg) => arg.startsWith("--page-size="));
const CONCURRENCY = Math.max(
  1,
  parseInt(
    concurrencyArg?.split("=")[1] ||
      process.env.GSI5_BACKFILL_CONCURRENCY ||
      "25",
    10
  )
);
const PAGE_SIZE = Math.max(
  1,
  parseInt(
    pageSizeArg?.split("=")[1] || process.env.GSI5_BACKFILL_PAGE_SIZE || "250",
    10
  )
);

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = process.env["DYNAMODB_TABLE"];
if (!TABLE_NAME) {
  console.error("Error: DYNAMODB_TABLE environment variable is required.");
  process.exit(1);
}

const isLocal = !!process.env["LOCAL_AWS_ENDPOINT"];
const clientConfig = {};
if (isLocal) {
  clientConfig.endpoint = process.env["LOCAL_AWS_ENDPOINT"];
  clientConfig.region = process.env["AWS_REGION"] || "us-east-1";
  clientConfig.credentials = {
    accessKeyId: process.env["AWS_ACCESS_KEY_ID"] || "test",
    secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] || "test",
  };
} else {
  clientConfig.region = process.env["AWS_REGION"] || "us-east-1";
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * Format GSI5SK value based on pscTotalEarned
 * Uses zero-padded format for proper lexicographic sorting
 */
function formatGSI5SK(pscTotalEarned, userId) {
  // Default to 0 if not set
  const earned = pscTotalEarned || 0;

  // Pad to 20 digits for proper sorting (supports up to 99,999,999,999,999,999,999.99 PSC)
  // Format: {paddedAmount}#{userId}
  const paddedAmount = earned.toFixed(2).padStart(23, "0");
  return `${paddedAmount}#${userId}`;
}

async function processUsers() {
  console.log("");
  console.log(`▶️  Processing User entities (GSI5PK=USER_PSC_TOTAL_EARNED)`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let scanned = 0;
  let lastEvaluatedKey = undefined;

  const startTime = Date.now();

  do {
    // Query GSI1 for User entities (GSI1PK = "USER_EMAIL") to avoid full table scan
    const queryCommand = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": "USER_EMAIL",
      },
      Limit: PAGE_SIZE,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const scanResult = await docClient.send(queryCommand);
    const items = scanResult.Items || [];
    scanned += items.length;

    console.log(
      `\n📄 Scanned ${items.length} users (total scanned: ${scanned})`
    );

    // Process items in batches with concurrency control
    const batches = [];
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      batches.push(items.slice(i, i + CONCURRENCY));
    }

    for (const batch of batches) {
      const promises = batch.map(async (user) => {
        try {
          const userId = user.userId || user.PK?.replace("USER#", "");
          if (!userId) {
            console.warn(`⚠️  Skipping user with no userId: PK=${user.PK}`);
            skipped++;
            return;
          }

          const currentGSI5PK = user.GSI5PK;
          const currentGSI5SK = user.GSI5SK;
          const pscTotalEarned = user.pscTotalEarned || 0;

          const desiredGSI5PK = "USER_PSC_TOTAL_EARNED";
          const desiredGSI5SK = formatGSI5SK(pscTotalEarned, userId);

          // Check if update is needed
          if (
            currentGSI5PK === desiredGSI5PK &&
            currentGSI5SK === desiredGSI5SK
          ) {
            skipped++;
            return;
          }

          // Log the change
          if (!isDryRun) {
            console.log(
              `  Updating user ${userId}: GSI5SK = "${desiredGSI5SK}" (earned: ${pscTotalEarned})`
            );
          } else {
            console.log(
              `  [DRY RUN] Would update user ${userId}: GSI5SK = "${desiredGSI5SK}" (earned: ${pscTotalEarned})`
            );
          }

          if (!isDryRun) {
            const updateCommand = new UpdateCommand({
              TableName: TABLE_NAME,
              Key: {
                PK: user.PK,
                SK: user.SK,
              },
              UpdateExpression: "SET GSI5PK = :gsi5pk, GSI5SK = :gsi5sk",
              ExpressionAttributeValues: {
                ":gsi5pk": desiredGSI5PK,
                ":gsi5sk": desiredGSI5SK,
              },
            });

            await docClient.send(updateCommand);
          }

          updated++;
        } catch (error) {
          errors++;
          console.error(
            `❌ Error updating user ${user.userId || user.PK}:`,
            error.message
          );
        }
      });

      await Promise.all(promises);
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;

    if (lastEvaluatedKey) {
      console.log(`\n⏭️  Fetching next page...`);
    }
  } while (lastEvaluatedKey);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("");
  console.log("═".repeat(60));
  console.log("✅ User Processing Complete");
  console.log("═".repeat(60));
  console.log(`📊 Total scanned:  ${scanned}`);
  console.log(`✏️  Updated:        ${updated}`);
  console.log(`⏭️  Skipped:        ${skipped}`);
  console.log(`❌ Errors:         ${errors}`);
  console.log(`⏱️  Duration:       ${duration}s`);
  console.log("═".repeat(60));

  return { scanned, updated, skipped, errors };
}

async function main() {
  console.log("");
  console.log("═".repeat(60));
  console.log("🚀 GSI5 User PSC Total Earned Backfill Script");
  console.log("═".repeat(60));
  console.log(`Table:        ${TABLE_NAME}`);
  console.log(`Environment:  ${process.env.ENVIRONMENT || "unknown"}`);
  console.log(`Dry run:      ${isDryRun ? "YES" : "NO"}`);
  console.log(`Concurrency:  ${CONCURRENCY}`);
  console.log(`Page size:    ${PAGE_SIZE}`);
  console.log("═".repeat(60));

  if (isDryRun) {
    console.log("");
    console.log("⚠️  DRY RUN MODE - No changes will be written to DynamoDB");
    console.log("");
  }

  try {
    const results = await processUsers();

    console.log("");
    console.log("✅ Backfill completed successfully!");

    if (isDryRun) {
      console.log("");
      console.log(
        "💡 Run without --dry-run to apply these changes to the database."
      );
    }

    process.exit(0);
  } catch (error) {
    console.error("");
    console.error("❌ Fatal error during backfill:");
    console.error(error);
    process.exit(1);
  }
}

main();
