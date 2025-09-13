/**
 * count-lora-usage.js
 *
 * Script to count how many times each LoRA has been used in media generation.
 *
 * This script queries all media entries using GSI4 and analyzes the
 * metadata.selectedLoras array to provide usage statistics.
 *
 * Usage:
 *   node count-lora-usage.js --env=local [--output=csv|json] [--min-usage=1]
 *   node count-lora-usage.js --env=prod [--output=csv|json] [--min-usage=1]
 *
 * Options:
 *   --env=<environment>    Load environment variables from .env.<environment>
 *   --output=<format>      Output format: 'json' (default), 'csv', or 'table'
 *   --min-usage=<number>   Only show LoRAs used at least this many times (default: 1)
 *   --sort=<field>         Sort by: 'usage' (default), 'name', 'recent'
 *   --batch-size=<number>  Number of items to process per DynamoDB query (default: 1000)
 *   --help                 Show this help message
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
process.on("unhandledRejection", (reason) => {
  console.error(
    "UNHANDLED REJECTION:",
    reason,
    typeof reason === "object" ? JSON.stringify(reason, null, 2) : ""
  );
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {};
const options = {};

args.forEach((arg) => {
  if (arg.startsWith("--")) {
    const [key, value] = arg.substring(2).split("=");
    if (value !== undefined) {
      options[key] = value;
    } else {
      flags[key] = true;
    }
  }
});

// Show help
if (flags.help) {
  console.log(`
LoRA Usage Counter Script

This script analyzes all media entities in the DynamoDB table to count
how many times each LoRA has been used in media generation.

Usage:
  node count-lora-usage.js --env=<environment> [options]

Options:
  --env=<env>           Environment (local, dev, stage, prod)
  --output=<format>     Output format: json, csv, table (default: table)
  --min-usage=<number>  Minimum usage count to display (default: 1)
  --sort=<field>        Sort by: usage, name, recent (default: usage)
  --batch-size=<number> DynamoDB batch size: 100-10000 (default: 1000)
  --help               Show this help

Examples:
  node count-lora-usage.js --env=prod --output=csv --min-usage=5
  node count-lora-usage.js --env=local --sort=name --batch-size=2000
  node count-lora-usage.js --env=stage --output=json > lora-stats.json

Performance Notes:
  - Uses DynamoDB projection to fetch only needed fields (id, createdAt, metadata.selectedLoras)
  - Batch size controls memory usage vs network calls trade-off
  - Higher batch sizes = fewer network calls but more memory usage
`);
  process.exit(0);
}

// Environment setup
let envFile = ".env";
if (options.env) {
  const envValue = options.env;
  if (envValue.startsWith(".env")) {
    envFile = envValue;
  } else if (/^[\w.-]+$/.test(envValue)) {
    envFile = `.env.${envValue}`;
  } else {
    envFile = envValue;
  }
}

// Resolve env file relative to current script directory
const envPath = path.resolve(__dirname, envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`Loaded environment variables from ${envPath}`);
} else {
  // fallback: try .env in script directory
  const fallbackPath = path.resolve(__dirname, ".env");
  if (fs.existsSync(fallbackPath)) {
    dotenv.config({ path: fallbackPath });
    console.log(
      `Could not find ${envPath}, loaded default .env from script directory`
    );
  } else {
    console.warn(
      `Warning: Could not find env file: ${envPath} or .env. Proceeding with process.env as-is.`
    );
  }
}

// Validate required environment variables
const requiredEnvVars = ["DYNAMODB_TABLE"];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingEnvVars.forEach((envVar) => console.error(`   - ${envVar}`));
  console.error("\nPlease check your environment configuration.");
  process.exit(1);
}

console.log("✅ Environment configuration loaded successfully");
console.log(`Table: ${process.env.DYNAMODB_TABLE}`);

// Initialize AWS clients
async function createDynamoClient() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");

  const isLocal = process.env["AWS_SAM_LOCAL"] === "true";
  const clientConfig = {};

  if (isLocal) {
    clientConfig.endpoint =
      process.env["LOCAL_AWS_ENDPOINT"] || "http://pornspot-local-aws:4566";
    clientConfig.region = process.env["AWS_REGION"] || "us-east-1";
    clientConfig.credentials = {
      accessKeyId: "test",
      secretAccessKey: "test",
    };
    console.log(`🔧 Using local AWS endpoint: ${clientConfig.endpoint}`);
  } else {
    // Use environment credentials for non-local
    clientConfig.region = process.env["AWS_REGION"] || "us-east-1";
    console.log(`☁️ Using AWS region: ${clientConfig.region}`);
  }

  const dynamoClient = new DynamoDBClient(clientConfig);
  const docClient = DynamoDBDocumentClient.from(dynamoClient);

  return { dynamoClient, docClient };
}

// Query all media entities using GSI4 with optimized projection
async function getAllMediaEntities(docClient, tableName, batchSize = 1000) {
  const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");

  console.log(
    "\n🔍 Querying all media entities using GSI4 (optimized with projection)..."
  );
  console.log(`📦 Using batch size: ${batchSize} items per query`);

  const mediaEntities = [];
  let lastEvaluatedKey = null;
  let pageCount = 0;
  let totalDataTransferred = 0;

  do {
    pageCount++;
    const params = {
      TableName: tableName,
      IndexName: "GSI4", // GSI4 index name
      KeyConditionExpression: "GSI4PK = :pk",
      ExpressionAttributeValues: {
        ":pk": "MEDIA",
      },
      // Projection: Only fetch the fields we actually need
      ProjectionExpression: "id, createdAt, metadata.selectedLoras",
      Limit: batchSize, // Control batch size for memory management
      ScanIndexForward: false, // Most recent first
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    console.log(`📄 Fetching page ${pageCount}...`);

    try {
      const result = await docClient.send(new QueryCommand(params));

      if (result.Items) {
        // Calculate approximate data transfer size for performance monitoring
        const pageSize = JSON.stringify(result.Items).length;
        totalDataTransferred += pageSize;

        mediaEntities.push(...result.Items);
        console.log(
          `   Found ${result.Items.length} items on page ${pageCount} (total: ${
            mediaEntities.length
          }, ~${(pageSize / 1024).toFixed(1)}KB this page)`
        );
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } catch (error) {
      console.error(`❌ Error querying page ${pageCount}:`, error);
      throw error;
    }
  } while (lastEvaluatedKey);

  console.log(`✅ Found ${mediaEntities.length} total media entities`);
  console.log(
    `📊 Total data transferred: ~${(totalDataTransferred / 1024 / 1024).toFixed(
      2
    )}MB`
  );
  console.log(
    `⚡ Performance: ~${(
      totalDataTransferred /
      1024 /
      mediaEntities.length
    ).toFixed(2)}KB per media item`
  );
  return mediaEntities;
}

// Analyze LoRA usage from media entities (optimized for projection)
function analyzeLoraUsage(mediaEntities) {
  console.log("\n📊 Analyzing LoRA usage...");

  const loraStats = new Map();
  let totalMediaWithLoras = 0;
  let totalLoraUsages = 0;
  let mediaWithoutMetadata = 0;

  mediaEntities.forEach((entity, index) => {
    // Log progress for large datasets
    if (index > 0 && index % 1000 === 0) {
      console.log(`   Processed ${index}/${mediaEntities.length} entities...`);
    }

    // Handle projected data structure - metadata might be at root level or nested
    const selectedLoras =
      entity.metadata?.selectedLoras || entity.selectedLoras;

    if (!selectedLoras || !Array.isArray(selectedLoras)) {
      if (!entity.metadata) {
        mediaWithoutMetadata++;
      }
      return;
    }

    if (selectedLoras.length > 0) {
      totalMediaWithLoras++;
    }

    selectedLoras.forEach((lora) => {
      if (typeof lora !== "string" || !lora.trim()) {
        return; // Skip invalid entries
      }

      const loraName = lora.trim();
      totalLoraUsages++;

      if (!loraStats.has(loraName)) {
        loraStats.set(loraName, {
          name: loraName,
          usageCount: 0,
          firstSeen: entity.createdAt,
          lastSeen: entity.createdAt,
          mediaIds: new Set(),
        });
      }

      const stats = loraStats.get(loraName);
      stats.usageCount++;
      stats.mediaIds.add(entity.id);

      // Update first/last seen dates
      if (entity.createdAt < stats.firstSeen) {
        stats.firstSeen = entity.createdAt;
      }
      if (entity.createdAt > stats.lastSeen) {
        stats.lastSeen = entity.createdAt;
      }
    });
  });

  // Convert Map to Array and add derived statistics
  const loraArray = Array.from(loraStats.values()).map((stats) => ({
    name: stats.name,
    usageCount: stats.usageCount,
    uniqueMediaCount: stats.mediaIds.size,
    firstSeen: stats.firstSeen,
    lastSeen: stats.lastSeen,
    daysSinceFirstUse: Math.ceil(
      (new Date() - new Date(stats.firstSeen)) / (1000 * 60 * 60 * 24)
    ),
    daysSinceLastUse: Math.ceil(
      (new Date() - new Date(stats.lastSeen)) / (1000 * 60 * 60 * 24)
    ),
  }));

  console.log(`✅ Analysis complete:`);
  console.log(`   Total media entities: ${mediaEntities.length}`);
  console.log(`   Media with LoRAs: ${totalMediaWithLoras}`);
  if (mediaWithoutMetadata > 0) {
    console.log(`   Media without metadata: ${mediaWithoutMetadata}`);
  }
  console.log(`   Total LoRA usages: ${totalLoraUsages}`);
  console.log(`   Unique LoRAs found: ${loraArray.length}`);

  return {
    loras: loraArray,
    summary: {
      totalMediaEntities: mediaEntities.length,
      mediaWithLoras: totalMediaWithLoras,
      mediaWithoutMetadata,
      totalLoraUsages,
      uniqueLorasCount: loraArray.length,
      averageLorasPerMedia:
        totalMediaWithLoras > 0
          ? (totalLoraUsages / totalMediaWithLoras).toFixed(2)
          : 0,
    },
  };
}

// Sort and filter results
function processResults(results, minUsage = 1, sortBy = "usage") {
  let filteredLoras = results.loras.filter(
    (lora) => lora.usageCount >= minUsage
  );

  // Sort results
  switch (sortBy) {
    case "name":
      filteredLoras.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "recent":
      filteredLoras.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
      break;
    case "usage":
    default:
      filteredLoras.sort((a, b) => b.usageCount - a.usageCount);
      break;
  }

  return {
    ...results,
    loras: filteredLoras,
    filtered: {
      totalShown: filteredLoras.length,
      totalHidden: results.loras.length - filteredLoras.length,
      minUsageFilter: minUsage,
      sortedBy: sortBy,
    },
  };
}

// Output functions
function outputAsTable(results) {
  console.log("\n" + "=".repeat(120));
  console.log("📊 LORA USAGE STATISTICS");
  console.log("=".repeat(120));

  // Summary
  console.log("\n📈 SUMMARY:");
  console.log(
    `Total Media Entities: ${results.summary.totalMediaEntities.toLocaleString()}`
  );
  console.log(
    `Media with LoRAs: ${results.summary.mediaWithLoras.toLocaleString()}`
  );
  console.log(
    `Total LoRA Usages: ${results.summary.totalLoraUsages.toLocaleString()}`
  );
  console.log(
    `Unique LoRAs: ${results.summary.uniqueLorasCount.toLocaleString()}`
  );
  console.log(
    `Average LoRAs per Media: ${results.summary.averageLorasPerMedia}`
  );

  if (results.filtered.totalHidden > 0) {
    console.log(
      `\n🔍 FILTER: Showing ${results.filtered.totalShown} LoRAs (hiding ${results.filtered.totalHidden} with < ${results.filtered.minUsageFilter} uses)`
    );
  }

  if (results.loras.length === 0) {
    console.log("\n❌ No LoRAs found matching the criteria.");
    return;
  }

  console.log(`\n📋 TOP LORAS (sorted by ${results.filtered.sortedBy}):`);
  console.log("-".repeat(120));
  console.log(
    "Rank | LoRA Name".padEnd(50) +
      " | Uses | Media | First Used | Last Used  | Days Ago"
  );
  console.log("-".repeat(120));

  results.loras.forEach((lora, index) => {
    const rank = (index + 1).toString().padStart(4);
    const name =
      lora.name.length > 40 ? lora.name.substring(0, 37) + "..." : lora.name;
    const nameCol = name.padEnd(45);
    const usageCol = lora.usageCount.toString().padStart(5);
    const mediaCol = lora.uniqueMediaCount.toString().padStart(5);
    const firstCol = lora.firstSeen.substring(0, 10);
    const lastCol = lora.lastSeen.substring(0, 10);
    const daysCol = lora.daysSinceLastUse.toString().padStart(8);

    console.log(
      `${rank} | ${nameCol} | ${usageCol} | ${mediaCol} | ${firstCol} | ${lastCol} | ${daysCol}`
    );
  });

  console.log("-".repeat(120));
}

function outputAsCSV(results) {
  console.log(
    "name,usageCount,uniqueMediaCount,firstSeen,lastSeen,daysSinceFirstUse,daysSinceLastUse"
  );
  results.loras.forEach((lora) => {
    const csvRow = [
      `"${lora.name.replace(/"/g, '""')}"`, // Escape quotes in CSV
      lora.usageCount,
      lora.uniqueMediaCount,
      lora.firstSeen,
      lora.lastSeen,
      lora.daysSinceFirstUse,
      lora.daysSinceLastUse,
    ].join(",");
    console.log(csvRow);
  });
}

function outputAsJSON(results) {
  console.log(JSON.stringify(results, null, 2));
}

// Main execution function
async function main() {
  const outputFormat = options.output || "table";
  const minUsage = parseInt(options["min-usage"]) || 1;
  const sortBy = options.sort || "usage";
  const batchSize = parseInt(options["batch-size"]) || 1000;

  if (!["json", "csv", "table"].includes(outputFormat)) {
    console.error("❌ Invalid output format. Use: json, csv, or table");
    process.exit(1);
  }

  if (!["usage", "name", "recent"].includes(sortBy)) {
    console.error("❌ Invalid sort field. Use: usage, name, or recent");
    process.exit(1);
  }

  if (batchSize < 100 || batchSize > 10000) {
    console.error("❌ Batch size must be between 100 and 10000");
    process.exit(1);
  }

  try {
    const startTime = Date.now();

    // Initialize AWS clients
    const { docClient } = await createDynamoClient();

    // Get all media entities with optimized batch size
    const mediaEntities = await getAllMediaEntities(
      docClient,
      process.env.DYNAMODB_TABLE,
      batchSize
    );

    // Analyze LoRA usage
    const results = analyzeLoraUsage(mediaEntities);

    // Process and filter results
    const processedResults = processResults(results, minUsage, sortBy);

    // Calculate and log total execution time
    const executionTime = Date.now() - startTime;
    console.log(
      `\n⏱️  Total execution time: ${(executionTime / 1000).toFixed(2)} seconds`
    );

    // Output results
    switch (outputFormat) {
      case "csv":
        outputAsCSV(processedResults);
        break;
      case "json":
        outputAsJSON(processedResults);
        break;
      case "table":
      default:
        outputAsTable(processedResults);
        break;
    }
  } catch (error) {
    console.error("❌ Script execution failed:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}

module.exports = { main, analyzeLoraUsage, getAllMediaEntities };
