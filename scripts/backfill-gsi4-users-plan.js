/**
 * backfill-gsi4-users-plan.js
 *
 * Adds GSI4 indexing attributes to User entities for querying by subscription plan and expiry.
 *
 * UPDATED INDEX DESIGN (optimized):
 *   GSI4PK = 'USER_PLAN#{plan}'   // partition per plan
 *   GSI4SK = '{planEndDate || 9999-12-31T00:00:00.000Z}#{userId}'
 *
 * BENEFITS:
 *   - Query a single plan cheaply (targeted partition)
 *   - Range condition supports `GSI4SK >= todayISO` to fetch active/non-expired users
 *   - Natural ascending order by expiry date for renewal workflows
 *
 * PRIOR VERSION (deprecated):
 *   GSI4PK='USER_PLAN' and GSI4SK='{plan}#date#userId' (kept only in comments; not used)
 *
 * EXECUTION:
 *   node backfill-gsi4-users-plan.js --env=prod [--dry-run] [--plan=pro]
 *
 * OPTIONS:
 *   --env=<env>     Loads .env.<env>
 *   --dry-run       Shows intended updates only
 *   --plan=<plan>   Restrict to specific plan
 *   --limit=N       Hard cap number processed
 */

// Required modules (re-added after edit)
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

// Global error handlers (optional but helpful)
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
const envArg = args.find((a) => a.startsWith("--env="));
const planFilterArg = args.find((a) => a.startsWith("--plan="));
const limitArg = args.find((a) => a.startsWith("--limit="));

let envFile = ".env";
if (envArg) {
  const val = envArg.split("=")[1];
  if (val) envFile = val.startsWith(".env") ? val : `.env.${val}`;
}
const planFilter = planFilterArg ? planFilterArg.split("=")[1] : undefined;
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

// ------------- HELPERS -------------
const FAR_FUTURE = "9999-12-31T00:00:00.000Z";
function buildGsi4(plan, planEndDate, userId) {
  const safeEnd =
    planEndDate && planEndDate.length >= 10 ? planEndDate : FAR_FUTURE;
  return {
    GSI4PK: `USER_PLAN#${plan}`,
    GSI4SK: `${safeEnd}#${userId}`,
  };
}

function shouldIndex(plan) {
  return !!plan; // all plans indexed, including free (optional business decision)
}

// ------------- MAIN -------------
async function main() {
  console.log("🚀 Starting GSI4 backfill for users (plan indexing)");
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  if (planFilter) console.log(`Plan filter: ${planFilter}`);
  if (hardLimit) console.log(`Hard limit: ${hardLimit}`);
  console.log("");

  let lastEvaluatedKey = undefined;
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  do {
    try {
      // Query GSI1 for all users (more efficient than scan)
      const queryResult = await ddoc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
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
        if (hardLimit && processed >= hardLimit) break;
        processed++;

        try {
          const { userId, plan, planEndDate } = user;
          if (!userId) {
            skipped++;
            continue;
          }
          if (planFilter && plan !== planFilter) {
            skipped++;
            continue;
          }

          if (!shouldIndex(plan)) {
            skipped++;
            continue;
          }

          if (user.GSI4PK && user.GSI4SK) {
            skipped++;
            continue;
          }

          const { GSI4PK, GSI4SK } = buildGsi4(plan, planEndDate, userId);

          console.log(
            `User ${userId}: plan=${plan} end=${planEndDate || "N/A"}`
          );
          console.log(` -> GSI4PK=${GSI4PK} GSI4SK=${GSI4SK}`);

          if (!isDryRun) {
            await ddoc.send(
              new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { PK: user.PK, SK: user.SK },
                UpdateExpression: "SET GSI4PK = :pk, GSI4SK = :sk",
                ExpressionAttributeValues: { ":pk": GSI4PK, ":sk": GSI4SK },
                ConditionExpression: "attribute_exists(PK)",
              })
            );
          }
          updated++;
        } catch (err) {
          errors++;
          console.error("Error updating user", user.userId, err.message || err);
        }
      }

      lastEvaluatedKey = queryResult.LastEvaluatedKey;
      console.log(
        `Batch complete. Processed=${processed} Updated=${updated} Skipped=${skipped} Errors=${errors}`
      );

      if (hardLimit && processed >= hardLimit) break;
    } catch (error) {
      console.error("❌ Error during query:", error);
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
