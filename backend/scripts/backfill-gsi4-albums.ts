#!/usr/bin/env node

/**
 * Migration script to add GSI4 fields to existing album records.
 *
 * This script adds the required GSI4PK and GSI4SK fields to existing albums
 * to support efficient querying of albums by creator.
 *
 * GSI4PK = "ALBUM_BY_CREATOR"
 * GSI4SK = "<createdBy>#<createdAt>#<albumId>"
 *
 * Usage:
 *   npm run build
 *   node dist/scripts/backfill-gsi4-albums.js [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be updated without making changes
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const isLocal = process.env["AWS_SAM_LOCAL"] === "true";
const isDryRun = process.argv.includes("--dry-run");

interface DynamoDBClientConfig {
  endpoint?: string;
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

const clientConfig: DynamoDBClientConfig = {};

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

const TABLE_NAME = process.env["DYNAMODB_TABLE"]!;

interface AlbumRecord {
  PK: string;
  SK: string;
  id: string;
  createdAt: string;
  createdBy?: string;
  GSI4PK?: string;
  GSI4SK?: string;
}

async function main() {
  console.log("🚀 Starting GSI4 backfill for albums...");
  console.log(`📋 Table: ${TABLE_NAME}`);
  console.log(`🌍 Environment: ${isLocal ? "Local" : "AWS"}`);
  console.log(`🔍 Mode: ${isDryRun ? "DRY RUN" : "LIVE UPDATE"}`);
  console.log("");

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    try {
      // Scan for album records
      const scanResult = await docClient.send(
        new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: "begins_with(PK, :albumPrefix) AND SK = :metadata",
          ExpressionAttributeValues: {
            ":albumPrefix": "ALBUM#",
            ":metadata": "METADATA",
          },
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 25, // Process in small batches
        })
      );

      const albums = (scanResult.Items as AlbumRecord[]) || [];

      for (const album of albums) {
        try {
          // Check if GSI4 fields already exist
          if (album.GSI4PK && album.GSI4SK) {
            console.log(`⏭️  Skipping ${album.id} - GSI4 fields already exist`);
            skippedCount++;
            continue;
          }

          // Check if album has createdBy field
          if (!album.createdBy) {
            console.log(`⚠️  Skipping ${album.id} - missing createdBy field`);
            skippedCount++;
            continue;
          }

          const gsi4PK = "ALBUM_BY_CREATOR";
          const gsi4SK = `${album.createdBy}#${album.createdAt}#${album.id}`;

          console.log(`📝 Processing album: ${album.id}`);
          console.log(`   GSI4PK: ${gsi4PK}`);
          console.log(`   GSI4SK: ${gsi4SK}`);

          if (!isDryRun) {
            // Update the record with GSI4 fields
            await docClient.send(
              new UpdateCommand({
                TableName: TABLE_NAME,
                Key: {
                  PK: album.PK,
                  SK: album.SK,
                },
                UpdateExpression: "SET GSI4PK = :gsi4pk, GSI4SK = :gsi4sk",
                ExpressionAttributeValues: {
                  ":gsi4pk": gsi4PK,
                  ":gsi4sk": gsi4SK,
                },
                ConditionExpression: "attribute_exists(PK)", // Ensure record still exists
              })
            );
          }

          updatedCount++;
          console.log(
            `✅ ${isDryRun ? "Would update" : "Updated"} album: ${album.id}`
          );
        } catch (error) {
          console.error(`❌ Error processing album ${album.id}:`, error);
          errorCount++;
        }
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;

      if (lastEvaluatedKey) {
        console.log(`📄 Processed batch, continuing...`);
      }
    } catch (error) {
      console.error("❌ Error during scan:", error);
      break;
    }
  } while (lastEvaluatedKey);

  console.log("");
  console.log("🏁 Migration completed!");
  console.log(
    `✅ ${isDryRun ? "Would update" : "Updated"}: ${updatedCount} albums`
  );
  console.log(`⏭️  Skipped: ${skippedCount} albums`);
  console.log(`❌ Errors: ${errorCount} albums`);

  if (isDryRun) {
    console.log("");
    console.log("🔄 Run without --dry-run to apply changes");
  }
}

// Run the migration
main().catch((error) => {
  console.error("💥 Migration failed:", error);
  process.exit(1);
});
