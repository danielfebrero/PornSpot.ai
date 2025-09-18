/**
 * reset-pro-i2v-credits.js
 *
 * Resets i2vCreditsSecondsFromPlan to 100 for Pro users.
 *
 * INDEX STRATEGY:
 *   Uses GSI4 design where:
 *     GSI4PK = 'USER_PLAN#pro'
 *     GSI4SK = '{planEndDate || 9999-12-31T00:00:00.000Z}#{userId}'
 *   This lets us query by plan and filter out expired subscriptions via range condition.
 *
 * DEFAULT BEHAVIOR:
 *   Only active (non-expired) Pro users are processed (GSI4SK >= nowISO) unless --all passed.
 *
 * EXECUTION:
 *   node reset-pro-i2v-credits.js --env=prod [--dry-run] [--limit=500] [--all]
 *
 * OPTIONS:
 *   --env=<env>     Loads .env.<env> (falls back to .env)
 *   --dry-run       Show intended updates without writing
 *   --limit=N       Stop after processing N matching users
 *   --all           Include expired Pro users too
 */
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

process.on("unhandledRejection", (r) => {
  console.error("UNHANDLED REJECTION", r);
  process.exit(1);
});
process.on("uncaughtException", (e) => {
  console.error("UNCAUGHT EXCEPTION", e);
  process.exit(1);
});

// ------------- CLI ARG PARSING -------------
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const includeAll = args.includes("--all");
const envArg = args.find((a) => a.startsWith("--env="));
const limitArg = args.find((a) => a.startsWith("--limit="));

let envFile = ".env";
if (envArg) {
  const val = envArg.split("=")[1];
  if (val) envFile = val.startsWith(".env") ? val : `.env.${val}`;
}
const hardLimit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

// ------------- LOAD ENV -------------
const envPath = path.resolve(__dirname, envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`Loaded env from ${envPath}`);
} else if (fs.existsSync(path.resolve(__dirname, ".env"))) {
  dotenv.config({ path: path.resolve(__dirname, ".env") });
  console.log("Loaded default .env");
} else {
  console.warn("No env file found, relying on process environment");
}

// ------------- CONFIG -------------
const TABLE_NAME = process.env.DYNAMODB_TABLE;
if (!TABLE_NAME) {
  console.error("DYNAMODB_TABLE not set");
  process.exit(1);
}

const isLocal = !!process.env.LOCAL_AWS_ENDPOINT;
const clientConfig = isLocal
  ? {
      endpoint: process.env.LOCAL_AWS_ENDPOINT,
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
      },
    }
  : { region: process.env.AWS_REGION || "us-east-1" };

const client = new DynamoDBClient(clientConfig);
const ddoc = DynamoDBDocumentClient.from(client);

// ------------- CONSTANTS -------------
const TARGET_PLAN = "pro";
const NEW_VALUE = 100;
const BATCH_QUERY_LIMIT = 50; // page size

// ------------- MAIN -------------
async function main() {
  console.log("🚀 Starting i2v plan credits reset (Pro users)");
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log(
    `Scope: ${includeAll ? "ALL (including expired)" : "ACTIVE ONLY"}`
  );
  if (hardLimit) console.log(`Hard limit: ${hardLimit}`);
  console.log("");

  let lastEvaluatedKey = undefined;
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const nowISO = new Date().toISOString();

  do {
    try {
      // Build query input
      const queryInput = {
        TableName: TABLE_NAME,
        IndexName: "GSI4",
        KeyConditionExpression:
          "GSI4PK = :pk" + (includeAll ? "" : " AND GSI4SK >= :now"),
        ExpressionAttributeValues: includeAll
          ? { ":pk": `USER_PLAN#${TARGET_PLAN}` }
          : { ":pk": `USER_PLAN#${TARGET_PLAN}`, ":now": nowISO },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: BATCH_QUERY_LIMIT,
      };

      const queryResult = await ddoc.send(new QueryCommand(queryInput));
      const users = queryResult.Items || [];

      for (const user of users) {
        if (hardLimit && processed >= hardLimit) break;
        processed++;
        const { userId } = user;
        if (!userId) {
          skipped++;
          continue;
        }

        const currentVal = user.i2vCreditsSecondsFromPlan;
        if (currentVal === NEW_VALUE) {
          skipped++;
          continue;
        }

        console.log(
          `User ${userId}: current=${currentVal ?? "N/A"} -> new=${NEW_VALUE}`
        );
        if (!isDryRun) {
          try {
            await ddoc.send(
              new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { PK: user.PK, SK: user.SK },
                UpdateExpression: "SET i2vCreditsSecondsFromPlan = :val",
                ConditionExpression:
                  "attribute_exists(PK) AND begins_with(PK, :userPrefix)",
                ExpressionAttributeValues: {
                  ":val": NEW_VALUE,
                  ":userPrefix": "USER#",
                },
              })
            );
          } catch (e) {
            errors++;
            console.error("  ❌ Update failed", e.message || e);
            continue;
          }
        }
        updated++;
      }

      lastEvaluatedKey = queryResult.LastEvaluatedKey;
      console.log(
        `Batch complete. Processed=${processed} Updated=${updated} Skipped=${skipped} Errors=${errors}`
      );
      if (hardLimit && processed >= hardLimit) break;
    } catch (err) {
      console.error("❌ Query error:", err);
      break;
    }
  } while (lastEvaluatedKey);

  console.log("\n🏁 Done");
  console.log(`Processed: ${processed}`);
  console.log(`Updated:   ${updated}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Errors:    ${errors}`);
  if (isDryRun) console.log("\nRun without --dry-run to persist changes.");
}

main().catch((err) => {
  console.error("Fatal error", err);
  process.exit(1);
});
