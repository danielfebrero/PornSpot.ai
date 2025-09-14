/**
 * backfill-gsi3-notifications.js
 *
 * Migration script to add/fix GSI3 fields on Notification entities.
 *
 * For each Notification item:
 * - Set GSI3PK = "NOTIFICATION_STATUS"
 * - Set GSI3SK = status in UPPERCASE ("UNREAD" | "READ")
 *
 * Usage:
 *   node backfill-gsi3-notifications.js --env=local [--dry-run]
 *   node backfill-gsi3-notifications.js --env=stage [--dry-run]
 *   node backfill-gsi3-notifications.js --env=prod [--dry-run]
 *   # include read notifications as well as unread:
 *   node backfill-gsi3-notifications.js --env=prod [--dry-run] --include-read
 *
 * Options:
 *   --env=<environment>    Load environment variables from .env.<environment>
 *   --dry-run              Show what would be updated without making changes
 *   --include-read         Also backfill notifications with status=read (default is only unread)
 *   --concurrency-users=N   Number of users to process in parallel (default: 5)
 *   --concurrency-updates=N Number of updates to run in parallel per page (default: 10)
 *   --page-limit=N          Page size for queries (default: 200)
 *
 * Required ENV:
 * - DYNAMODB_TABLE
 * - AWS_REGION (for AWS)
 * - For local: LOCAL_AWS_ENDPOINT (optional, defaults to http://localhost:4566)
 */

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

// CLI args
const isDryRun = process.argv.includes("--dry-run");
const envArg = process.argv.find((a) => a.startsWith("--env="));
let envFile = ".env";
if (envArg) {
  const envName = envArg.split("=")[1];
  envFile = `.env.${envName}`;
  console.log(`🔧 Using env file: ${envFile}`);
}

// Load env
const envPath = path.join(__dirname, envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded environment from ${envFile}`);
} else {
  console.warn(`⚠️  Env file ${envFile} not found. Using process.env`);
}

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = process.env.DYNAMODB_TABLE;
const isLocal =
  process.env.AWS_SAM_LOCAL === "true" || envFile.includes("local");

if (!TABLE_NAME) {
  console.error("❌ DYNAMODB_TABLE is required");
  process.exit(1);
}

console.log(`🗄️  Table: ${TABLE_NAME}`);
console.log(`🌍 Environment: ${isLocal ? "Local" : "AWS"}`);
console.log(`🔍 Mode: ${isDryRun ? "DRY RUN" : "LIVE UPDATE"}`);

// Client
const clientConfig = {};
if (isLocal) {
  clientConfig.endpoint =
    process.env.LOCAL_AWS_ENDPOINT || "http://localhost:4566";
  clientConfig.region = "us-east-1";
  clientConfig.credentials = { accessKeyId: "test", secretAccessKey: "test" };
  console.log(`🔌 Using local endpoint: ${clientConfig.endpoint}`);
}
const ddbClient = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(ddbClient);

function toGsi3SkFromStatus(status) {
  if (!status) return undefined;
  const s = String(status).toLowerCase();
  if (s === "unread") return "UNREAD";
  if (s === "read") return "READ";
  return undefined;
}

function getIntArg(flag, def) {
  const arg = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (!arg) return def;
  const raw = arg.split("=")[1];
  const val = parseInt(raw, 10);
  return Number.isFinite(val) ? val : def;
}

async function* iterateUsers(pageLimit = 200) {
  console.log("👥 Iterating users via GSI1 USER_EMAIL...");
  let lastEvaluatedKey;
  do {
    const params = {
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: { ":gsi1pk": "USER_EMAIL" },
      ProjectionExpression: "PK, SK, userId, username",
      Limit: pageLimit,
      ExclusiveStartKey: lastEvaluatedKey,
    };
    const res = await docClient.send(new QueryCommand(params));
    const users = (res.Items || []).filter((u) => u.username !== "[deleted]");
    yield users;
    lastEvaluatedKey = res.LastEvaluatedKey;
  } while (lastEvaluatedKey);
}

async function retry(fn, attempts = 3, baseDelayMs = 100) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err && (err.name || err.code || err.message || "");
      const isThrottle =
        /Throttling|ProvisionedThroughputExceeded|TooManyRequests/i.test(
          String(msg)
        );
      if (!isThrottle || i === attempts - 1) throw err;
      const delay = baseDelayMs * Math.pow(2, i);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastErr;
}

async function pool(items, limit, iterator) {
  const executing = new Set();
  const results = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => iterator(item));
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

async function queryUserNotificationsNeedingBackfill(
  userId,
  statuses = ["unread"],
  pageLimit = 200
) {
  const items = [];
  for (const status of statuses) {
    let lastEvaluatedKey;
    do {
      const params = {
        TableName: TABLE_NAME,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :gsi2pk",
        ExpressionAttributeValues: {
          ":gsi2pk": `USER#${userId}#NOTIFICATIONS#${status}`,
        },
        ExpressionAttributeNames: { "#s": "status" },
        ProjectionExpression:
          "PK, SK, EntityType, #s, targetUserId, sourceUserId, createdAt, notificationId, GSI3PK, GSI3SK",
        Limit: pageLimit,
        ExclusiveStartKey: lastEvaluatedKey,
      };
      const res = await docClient.send(new QueryCommand(params));
      const needing = (res.Items || []).filter(
        (it) => it.EntityType === "Notification" && (!it.GSI3PK || !it.GSI3SK)
      );
      items.push(...needing);
      lastEvaluatedKey = res.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  }
  return items;
}

async function updateNotificationGsi3(item) {
  const { PK, SK, status } = item;
  const gsi3PK = "NOTIFICATION_STATUS";
  const gsi3SK = toGsi3SkFromStatus(status);

  if (!gsi3SK) {
    console.warn(
      `⚠️  Unable to determine GSI3SK from status='${status}' for ${PK}#${SK}. Skipping.`
    );
    return false;
  }

  console.log(
    `📝 Updating ${PK}#${SK}: GSI3PK='${gsi3PK}', GSI3SK='${gsi3SK}'`
  );

  if (isDryRun) {
    console.log("   🔍 DRY RUN - would update");
    return true;
  }

  try {
    await retry(() =>
      docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK, SK },
          UpdateExpression: "SET GSI3PK = :pk, GSI3SK = :sk",
          ExpressionAttributeValues: {
            ":pk": gsi3PK,
            ":sk": gsi3SK,
          },
          ConditionExpression: "attribute_exists(PK)",
        })
      )
    );
    console.log("   ✅ Updated successfully");
    return true;
  } catch (err) {
    console.error(`   ❌ Update failed: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("🚀 Starting GSI3 Notification backfill...");
  console.log("=".repeat(60));

  // Control which statuses to backfill; default to only 'unread'
  const includeRead = process.argv.includes("--include-read");
  const statuses = includeRead ? ["unread", "read"] : ["unread"];
  const pageLimit = getIntArg("--page-limit", 200);
  const concurrencyUsers = getIntArg("--concurrency-users", 5);
  const concurrencyUpdates = getIntArg("--concurrency-updates", 10);

  let updated = 0;
  let failed = 0;
  let totalExamined = 0;

  for await (const userPage of iterateUsers(pageLimit)) {
    const pageResults = await pool(userPage, concurrencyUsers, async (user) => {
      const userId = user.userId || (user.PK || "").replace("USER#", "");
      if (!userId) return { u: 0, f: 0, e: 0 };
      const items = await queryUserNotificationsNeedingBackfill(
        userId,
        statuses,
        pageLimit
      );
      const e = items.length;
      if (!items.length) return { u: 0, f: 0, e };
      const updateResults = await pool(
        items,
        concurrencyUpdates,
        updateNotificationGsi3
      );
      const u = updateResults.filter(Boolean).length;
      const f = updateResults.length - u;
      return { u, f, e };
    });
    for (const r of pageResults) {
      updated += r.u;
      failed += r.f;
      totalExamined += r.e;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   🔎 Examined: ${totalExamined}`);
  console.log(`   Mode: ${isDryRun ? "DRY RUN" : "LIVE UPDATE"}`);
  console.log(
    isDryRun
      ? "\n🔍 DRY RUN complete. Run without --dry-run to apply changes."
      : "\n🎉 Backfill complete."
  );
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
