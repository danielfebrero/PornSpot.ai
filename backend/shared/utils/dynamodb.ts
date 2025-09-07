/**
 * @fileoverview DynamoDB Service Utility
 * @description Centralized DynamoDB operations for entities like Album, Media, User, Session, Comment, etc.
 * @notes
 * - Uses DynamoDBDocumentClient for JSON handling.
 * - Supports LocalStack in development.
 * - Includes conversion methods for entities to API formats.
 * - Handles counters, relationships, interactions, notifications.
 * - Large class with static methods for CRUD and complex queries.
 * - GSI indexes for efficient querying (e.g., by creator, public status, expiry).
 * - Popularity scoring via GSI6SK.
 * - Cleanup methods for expired tokens/sessions.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
  BatchGetCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  Album,
  Media,
  AlbumEntity,
  MediaEntity,
  AlbumMediaEntity,
  AlbumTagEntity,
  CommentEntity,
  ThumbnailUrls,
  NotificationEntity,
  NotificationWithDetails,
  GenerationSettingsEntity,
  FollowEntity,
  TransactionEntity,
  DailyBudgetEntity,
  PSCSystemConfig,
  UserViewCounterEntity,
} from "@shared/shared-types";
import {
  UserEntity,
  UserSessionEntity,
  EmailVerificationTokenEntity,
  UserInteractionEntity,
  UserInteraction,
} from "@shared/shared-types";
import { ConnectionEntity } from "@shared/shared-types/websocket";
import { CounterUtil } from "./counter";
import { v4 as uuidv4 } from "uuid";

const isLocal = process.env["AWS_SAM_LOCAL"] === "true";

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

console.log(
  "🔧 DynamoDB Client Config:",
  JSON.stringify(clientConfig, null, 2)
);
console.log("🌍 AWS_SAM_LOCAL env var:", process.env["AWS_SAM_LOCAL"]);

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true, // Automatically remove undefined values
  },
});

const TABLE_NAME = process.env["DYNAMODB_TABLE"]!;
console.log("📋 Table name from env:", TABLE_NAME);

export class DynamoDBService {
  // Helper method to convert AlbumEntity to Album
  static async convertAlbumEntityToAlbum(entity: AlbumEntity): Promise<Album> {
    const album: Album = {
      id: entity.id,
      title: entity.title,
      type: "album",
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      mediaCount: entity.mediaCount,
      isPublic: entity.isPublic === "true",
      popularity: entity.GSI6SK,
    };

    if (entity.tags !== undefined) {
      album.tags = entity.tags;
    }

    if (entity.coverImageUrl !== undefined) {
      album.coverImageUrl = entity.coverImageUrl;
    }

    if (entity.thumbnailUrls !== undefined) {
      album.thumbnailUrls = entity.thumbnailUrls;
    }

    if (entity.likeCount !== undefined) {
      album.likeCount = entity.likeCount;
    }

    if (entity.bookmarkCount !== undefined) {
      album.bookmarkCount = entity.bookmarkCount;
    }

    if (entity.viewCount !== undefined) {
      album.viewCount = entity.viewCount;
    }

    // Add creator information if available
    if (entity.createdBy !== undefined) {
      album.createdBy = entity.createdBy;
      try {
        const creator = await this.getUserById(entity.createdBy);

        if (creator && creator.username) {
          // Add creator information to metadata
          if (!album.metadata) {
            album.metadata = {};
          }
          album.metadata["creatorUsername"] = creator.username;
        }
      } catch (error) {
        console.error("Failed to fetch creator info for album:", error);
        // Don't fail the conversion if creator info can't be fetched
      }
    }

    if (entity.createdByType !== undefined) {
      album.createdByType = entity.createdByType;
    }

    return album;
  }

  // Helper method to convert MediaEntity to Media
  static convertMediaEntityToMedia(entity: MediaEntity): Media {
    const media: Media = {
      id: entity.id,
      filename: entity.filename,
      type: "media",
      originalFilename: entity.originalFilename,
      mimeType: entity.mimeType,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      popularity: entity.GSI6SK,
    };

    if (entity.size !== undefined) {
      media.size = entity.size;
    }

    if (entity.url !== undefined) {
      media.url = entity.url;
    }

    // Add optional fields if they exist
    if (entity.width !== undefined) {
      media.width = entity.width;
    }

    if (entity.height !== undefined) {
      media.height = entity.height;
    }

    if (entity.thumbnailUrl !== undefined) {
      media.thumbnailUrl = entity.thumbnailUrl;
    }

    if (entity.thumbnailUrls !== undefined) {
      media.thumbnailUrls = entity.thumbnailUrls;
    }

    if (entity.metadata !== undefined) {
      media.metadata = entity.metadata;
    }

    if (entity.status !== undefined) {
      media.status = entity.status;
    }

    // Convert isPublic from string to boolean for Media interface
    if (entity.isPublic !== undefined) {
      media.isPublic = entity.isPublic === "true";
    }

    // Add interaction counts
    if (entity.likeCount !== undefined) {
      media.likeCount = entity.likeCount;
    }

    if (entity.bookmarkCount !== undefined) {
      media.bookmarkCount = entity.bookmarkCount;
    }

    if (entity.viewCount !== undefined) {
      media.viewCount = entity.viewCount;
    }

    if (entity.commentCount !== undefined) {
      media.commentCount = entity.commentCount;
    }

    // Add creator information if available
    if (entity.createdBy !== undefined) {
      media.createdBy = entity.createdBy;
    }

    if (entity.createdByType !== undefined) {
      media.createdByType = entity.createdByType;
    }

    return media;
  }

  // Album operations
  static async createAlbum(album: AlbumEntity): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: album,
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
  }

  static async getAlbumEntity(albumId: string): Promise<AlbumEntity | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `ALBUM#${albumId}`,
          SK: "METADATA",
        },
      })
    );

    return result.Item as AlbumEntity | null;
  }

  static async getAlbum(albumId: string): Promise<Album | null> {
    const result = await this.getAlbumEntity(albumId);

    return result ? this.convertAlbumEntityToAlbum(result) : null;
  }

  static async getAlbumForAPI(albumId: string): Promise<Album | null> {
    return await this.getAlbum(albumId);
  }

  static async updateAlbum(
    albumId: string,
    updates: Partial<AlbumEntity>
  ): Promise<void> {
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== "PK" && key !== "SK" && value !== undefined) {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    if (updateExpression.length === 0) return;

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `ALBUM#${albumId}`,
          SK: "METADATA",
        },
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  }

  static async deleteAlbum(albumId: string): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `ALBUM#${albumId}`,
          SK: "METADATA",
        },
      })
    );
  }

  static async listAlbums(
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>,
    tag?: string
  ): Promise<{
    albums: Album[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    // If tag filtering is requested, use the new efficient method
    if (tag) {
      return this.listAlbumsByTag(tag, limit, lastEvaluatedKey);
    }

    // Build query parameters for all albums
    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": "ALBUM",
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));

    const albumEntities = (result.Items as AlbumEntity[]) || [];

    const response: {
      albums: Album[];
      lastEvaluatedKey?: Record<string, any>;
    } = {
      albums: await Promise.all(
        albumEntities.map((entity) => this.convertAlbumEntityToAlbum(entity))
      ),
    };

    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = result.LastEvaluatedKey;
    }

    return response;
  }

  static async listAlbumsByPublicStatus(
    isPublic: boolean,
    limit: number = 20,
    lastEvaluatedKey?: Record<string, unknown>,
    tag?: string
  ): Promise<{
    albums: Album[];
    lastEvaluatedKey?: Record<string, unknown>;
  }> {
    // If tag filtering is requested, use the new efficient method with isPublic
    if (tag) {
      return this.listAlbumsByTag(tag, limit, lastEvaluatedKey, isPublic);
    }

    const isPublicString = isPublic.toString();

    // Build query parameters
    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI5",
      KeyConditionExpression: "#GSI5PK = :album AND #GSI5SK = :isPublic",
      ExpressionAttributeNames: {
        "#GSI5PK": "GSI5PK",
        "#GSI5SK": "GSI5SK",
      },
      ExpressionAttributeValues: {
        ":album": "ALBUM",
        ":isPublic": isPublicString,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));

    const albumEntities = (result.Items as AlbumEntity[]) || [];

    // Convert AlbumEntity to Album format for API response
    const albums: Album[] = await Promise.all(
      albumEntities.map((entity) => this.convertAlbumEntityToAlbum(entity))
    );

    const response: {
      albums: Album[];
      lastEvaluatedKey?: Record<string, any>;
    } = {
      albums,
    };

    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = result.LastEvaluatedKey;
    }

    return response;
  }

  static async listAlbumsByCreator(
    createdBy: string,
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>,
    tag?: string
  ): Promise<{
    albums: Album[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    // If tag filtering is requested, use the new efficient GSI3-based method
    if (tag) {
      return this.listAlbumsByCreatorAndTag(
        createdBy,
        tag,
        limit,
        lastEvaluatedKey
      );
    }

    // Use GSI4 for efficient querying of albums by creator
    // GSI4PK = "ALBUM_BY_CREATOR", GSI4SK = "<createdBy>#<createdAt>#<albumId>"

    console.log("[DynamoDB] listAlbumsByCreator called with:", {
      createdBy,
      limit,
      tag,
      tableName: TABLE_NAME,
      lastEvaluatedKey: lastEvaluatedKey ? "present" : "none",
    });

    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI4",
      KeyConditionExpression:
        "#gsi4pk = :gsi4pk AND begins_with(#gsi4sk, :createdBy)",
      ExpressionAttributeNames: {
        "#gsi4pk": "GSI4PK",
        "#gsi4sk": "GSI4SK",
      },
      ExpressionAttributeValues: {
        ":gsi4pk": "ALBUM_BY_CREATOR",
        ":createdBy": `${createdBy}#`,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));

    const albumEntities = (result.Items as AlbumEntity[]) || [];

    // Convert AlbumEntity to Album format for API response
    const albums: Album[] = await Promise.all(
      albumEntities.map((entity) => this.convertAlbumEntityToAlbum(entity))
    );

    const response: {
      albums: Album[];
      lastEvaluatedKey?: Record<string, any>;
    } = {
      albums,
    };

    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = result.LastEvaluatedKey;
    }

    return response;
  }

  // Album counter operations - delegate to CounterUtil
  static async incrementAlbumLikeCount(
    albumId: string,
    increment: number = 1
  ): Promise<void> {
    return CounterUtil.incrementAlbumLikeCount(albumId, increment);
  }

  static async incrementMediaLikeCount(
    mediaId: string,
    increment: number = 1
  ): Promise<void> {
    return CounterUtil.incrementMediaLikeCount(mediaId, increment);
  }

  static async incrementAlbumBookmarkCount(
    albumId: string,
    increment: number = 1
  ): Promise<void> {
    return CounterUtil.incrementAlbumBookmarkCount(albumId, increment);
  }

  static async incrementMediaBookmarkCount(
    mediaId: string,
    increment: number = 1
  ): Promise<void> {
    return CounterUtil.incrementMediaBookmarkCount(mediaId, increment);
  }

  static async incrementAlbumViewCount(
    albumId: string,
    increment: number = 1
  ): Promise<void> {
    return CounterUtil.incrementAlbumViewCount(albumId, increment);
  }

  static async incrementMediaViewCount(
    mediaId: string,
    increment: number = 1
  ): Promise<void> {
    return CounterUtil.incrementMediaViewCount(mediaId, increment);
  }

  // Album-Tag relationship operations
  static async createAlbumTagRelations(
    albumId: string,
    tags: string[],
    createdAt: string,
    isPublic: boolean,
    userId: string
  ): Promise<void> {
    if (!tags || tags.length === 0) return;

    const isPublicString = isPublic.toString();

    const albumTagEntities: AlbumTagEntity[] = tags.map((tag) => {
      const normalizedTag = tag.toLowerCase().trim();
      return {
        PK: `ALBUM_TAG#${normalizedTag}`,
        SK: `ALBUM#${albumId}#${createdAt}`,
        GSI1PK: "ALBUM_TAG",
        GSI1SK: `${normalizedTag}#${createdAt}#${albumId}`,
        GSI2PK: `ALBUM_TAG#${normalizedTag}#${isPublicString}`,
        GSI2SK: createdAt,
        GSI3PK: `ALBUM_TAG#${userId}#${isPublicString}`,
        GSI3SK: `${normalizedTag}#${createdAt}`,
        EntityType: "AlbumTag",
        albumId,
        userId,
        tag,
        normalizedTag,
        createdAt,
        isPublic: isPublicString,
      };
    });

    // Use batch write for efficiency
    const batchWritePromises = [];
    const BATCH_SIZE = 25; // DynamoDB batch limit

    for (let i = 0; i < albumTagEntities.length; i += BATCH_SIZE) {
      const batch = albumTagEntities.slice(i, i + BATCH_SIZE);
      const putRequests = batch.map((entity) => ({
        PutRequest: { Item: entity },
      }));

      batchWritePromises.push(
        docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: putRequests,
            },
          })
        )
      );
    }

    await Promise.all(batchWritePromises);
  }

  static async deleteAlbumTagRelations(albumId: string): Promise<void> {
    // Find all tag relations for this album using the main table
    // We query by PK pattern ALBUM_TAG#* and filter by SK containing our albumId

    // Since we can't efficiently query across multiple ALBUM_TAG# partitions,
    // we'll need to scan or query via GSI1 where all album tags have GSI1PK = "ALBUM_TAG"
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        FilterExpression: "albumId = :albumId",
        ExpressionAttributeValues: {
          ":gsi1pk": "ALBUM_TAG",
          ":albumId": albumId,
        },
      })
    );

    const albumTagEntities = (result.Items as AlbumTagEntity[]) || [];

    if (albumTagEntities.length === 0) return;

    // Delete all found album-tag relations
    const deletePromises = albumTagEntities.map((entity) =>
      docClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: entity.PK,
            SK: entity.SK,
          },
        })
      )
    );

    await Promise.all(deletePromises);
  }

  static async updateAlbumTagRelations(
    albumId: string,
    newTags: string[],
    createdAt: string,
    isPublic: boolean,
    userId: string
  ): Promise<void> {
    // Delete existing relations
    await this.deleteAlbumTagRelations(albumId);

    // Create new relations
    await this.createAlbumTagRelations(
      albumId,
      newTags,
      createdAt,
      isPublic,
      userId
    );
  }

  static async listAlbumsByTag(
    tag: string,
    limit: number = 20,
    lastEvaluatedKey?: Record<string, unknown>,
    isPublic?: boolean
  ): Promise<{
    albums: Album[];
    lastEvaluatedKey?: Record<string, unknown>;
  }> {
    const normalizedTag = tag.toLowerCase().trim();

    // Use GSI2 for efficient tag filtering
    // If isPublic is specified, include it in GSI2PK for maximum efficiency
    let gsi2pk: string;
    if (isPublic !== undefined) {
      gsi2pk = `ALBUM_TAG#${normalizedTag}#${isPublic.toString()}`;
    } else {
      // If isPublic is not specified, we need to query both public and private
      // For now, let's query public albums by default (most common case)
      // TODO: Implement pagination across multiple GSI2PK values for full coverage
      gsi2pk = `ALBUM_TAG#${normalizedTag}#true`;
    }

    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :gsi2pk",
      ExpressionAttributeValues: {
        ":gsi2pk": gsi2pk,
      },
      ScanIndexForward: false, // Most recent first (descending order by createdAt)
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));
    const albumTagEntities = (result.Items as AlbumTagEntity[]) || [];

    // Get the actual album records
    const albumPromises = albumTagEntities.map((tagEntity) =>
      this.getAlbum(tagEntity.albumId)
    );

    const albumResults = await Promise.all(albumPromises);
    const albums = albumResults.filter((album) => album !== null) as Album[];

    const response: {
      albums: Album[];
      lastEvaluatedKey?: Record<string, unknown>;
    } = { albums };

    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = result.LastEvaluatedKey;
    }

    return response;
  }

  static async listAlbumsByCreatorAndTag(
    userId: string,
    tag?: string,
    limit: number = 20,
    lastEvaluatedKey?: Record<string, unknown>,
    isPublic?: boolean
  ): Promise<{
    albums: Album[];
    lastEvaluatedKey?: Record<string, unknown>;
  }> {
    // If no tag is specified, fall back to regular listAlbumsByCreator
    if (!tag) {
      return this.listAlbumsByCreator(userId, limit, lastEvaluatedKey);
    }

    const normalizedTag = tag.toLowerCase().trim();

    // Use GSI3 for efficient creator + tag filtering
    // If isPublic is specified, include it in GSI3PK for maximum efficiency
    let gsi3pk: string;
    if (isPublic !== undefined) {
      gsi3pk = `ALBUM_TAG#${userId}#${isPublic.toString()}`;
    } else {
      // If isPublic is not specified, query both public and private by default
      // For now, let's start with public (most common case)
      // TODO: Implement pagination across multiple GSI3PK values for full coverage
      gsi3pk = `ALBUM_TAG#${userId}#true`;
    }

    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI3",
      KeyConditionExpression:
        "GSI3PK = :gsi3pk AND begins_with(GSI3SK, :tagPrefix)",
      ExpressionAttributeValues: {
        ":gsi3pk": gsi3pk,
        ":tagPrefix": `${normalizedTag}#`,
      },
      ScanIndexForward: false, // Most recent first (descending order by createdAt)
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));
    const albumTagEntities = (result.Items as AlbumTagEntity[]) || [];

    // Get the actual album records
    const albumPromises = albumTagEntities.map((tagEntity) =>
      this.getAlbum(tagEntity.albumId)
    );

    const albumResults = await Promise.all(albumPromises);
    const albums = albumResults.filter((album) => album !== null) as Album[];

    const response: {
      albums: Album[];
      lastEvaluatedKey?: Record<string, unknown>;
    } = { albums };

    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = result.LastEvaluatedKey;
    }

    return response;
  }

  static async getAllTagsWithCounts(): Promise<
    Array<{ tag: string; count: number }>
  > {
    // Query all album-tag relations via GSI1
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": "ALBUM_TAG",
        },
        ProjectionExpression: "normalizedTag",
      })
    );

    const albumTagEntities =
      (result.Items as Pick<AlbumTagEntity, "normalizedTag">[]) || [];

    // Count occurrences of each tag
    const tagCounts = albumTagEntities.reduce((acc, entity) => {
      const tag = entity.normalizedTag;
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Convert to array and sort by count descending
    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  // Media operations - NEW DESIGN: Media can belong to multiple albums
  static async createMedia(media: MediaEntity): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: media,
      })
    );
  }

  static async getMedia(mediaId: string): Promise<Media | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `MEDIA#${mediaId}`,
          SK: "METADATA",
        },
      })
    );

    if (result.Item) {
      return this.convertMediaEntityToMedia(result.Item as MediaEntity);
    } else {
      return null;
    }
  }

  static async findMediaById(mediaId: string): Promise<MediaEntity | null> {
    // Use GSI2 for efficient direct media lookup by ID
    try {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI2",
          KeyConditionExpression: "GSI2PK = :gsi2pk AND GSI2SK = :gsi2sk",
          ExpressionAttributeValues: {
            ":gsi2pk": "MEDIA_ID",
            ":gsi2sk": mediaId,
          },
          Limit: 1,
        })
      );

      const items = result.Items as MediaEntity[] | undefined;
      return items?.[0] || null;
    } catch (error) {
      console.error("❌ Error finding media by ID:", error);
      return null;
    }
  }

  static async deleteMedia(mediaId: string): Promise<void> {
    // Delete the media record
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `MEDIA#${mediaId}`,
          SK: "METADATA",
        },
      })
    );

    // Also delete all album-media relationships for this media
    await this.removeMediaFromAllAlbums(mediaId);
  }

  static async updateMediaAndSiblingsFilename(
    mediaId: string,
    filename: string
  ): Promise<void> {
    try {
      // First, query all items with GSI2PK="MEDIA_ID" and GSI2SK begins_with mediaId
      const queryResult = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI2",
          KeyConditionExpression:
            "GSI2PK = :gsi2pk AND begins_with(GSI2SK, :gsi2sk)",
          ExpressionAttributeValues: {
            ":gsi2pk": "MEDIA_ID",
            ":gsi2sk": mediaId,
          },
        })
      );

      const items = queryResult.Items || [];

      // Update each item with the new filename
      for (const item of items) {
        await docClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item["PK"],
              SK: item["SK"],
            },
            UpdateExpression:
              "SET filename = :filename, updatedAt = :updatedAt",
            ExpressionAttributeValues: {
              ":filename": filename,
              ":updatedAt": new Date().toISOString(),
            },
          })
        );
      }

      console.log(
        `✅ Updated filename for ${items.length} items related to media ${mediaId}`
      );
    } catch (error) {
      console.error("❌ Error updating media and siblings filename:", error);
      throw error;
    }
  }

  static async updateMedia(
    mediaId: string,
    updates: Partial<MediaEntity>
  ): Promise<void> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};

    // Build dynamic update expression
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== "PK" && key !== "SK" && key !== "id") {
        const attrName = `#${key}`;
        const attrValue = `:${key}`;
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = value;
      }
    });

    if (updateExpressions.length === 0) {
      return; // Nothing to update
    }

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `MEDIA#${mediaId}`,
          SK: "METADATA",
        },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  }

  static async getUserMedia(
    userId: string,
    limit: number = 50,
    lastEvaluatedKey?: Record<string, any>,
    publicOnly: boolean = false
  ): Promise<{
    media: MediaEntity[];
    nextKey?: Record<string, any>;
  }> {
    if (publicOnly) {
      // Use GSI3 for public-only media - no filter needed!
      const queryParams: any = {
        TableName: TABLE_NAME,
        IndexName: "GSI3",
        KeyConditionExpression:
          "GSI3PK = :gsi3pk AND begins_with(GSI3SK, :gsi3sk)",
        ExpressionAttributeValues: {
          ":gsi3pk": "MEDIA_BY_USER_true",
          ":gsi3sk": `${userId}#`,
        },
        Limit: limit,
        ScanIndexForward: false, // newest first
      };

      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new QueryCommand(queryParams));

      return {
        media: (result.Items as MediaEntity[]) || [],
        ...(result.LastEvaluatedKey && { nextKey: result.LastEvaluatedKey }),
      };
    } else {
      // For all media (public + private), we need to query both GSI3 partitions
      // For simplicity, we'll use GSI1 which contains all media by creator
      const queryParams: any = {
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression:
          "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :gsi1sk)",
        ExpressionAttributeValues: {
          ":gsi1pk": "MEDIA_BY_CREATOR",
          ":gsi1sk": `${userId}#`,
        },
        Limit: limit,
        ScanIndexForward: false, // newest first
      };

      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new QueryCommand(queryParams));

      return {
        media: (result.Items as MediaEntity[]) || [],
        ...(result.LastEvaluatedKey && { nextKey: result.LastEvaluatedKey }),
      };
    }
  }

  // Admin method to list all media across all users
  static async listAllMedia(
    limit: number = 50,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    media: Media[];
    nextKey?: Record<string, any>;
  }> {
    const queryParams: any = {
      TableName: TABLE_NAME,
      IndexName: "GSI4",
      KeyConditionExpression: "GSI4PK = :gsi4pk",
      ExpressionAttributeValues: {
        ":gsi4pk": "MEDIA",
      },
      Limit: limit,
      ScanIndexForward: false, // newest first (descending order by createdAt)
    };

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    const mediaEntities = (result.Items as MediaEntity[]) || [];
    const media = mediaEntities.map((entity) =>
      this.convertMediaEntityToMedia(entity)
    );

    return {
      media,
      ...(result.LastEvaluatedKey && { nextKey: result.LastEvaluatedKey }),
    };
  }

  // Album-Media relationship operations
  static async addMediaToAlbum(
    albumId: string,
    mediaId: string,
    addedBy?: string
  ): Promise<void> {
    const now = new Date().toISOString();

    // Verify both album and media exist
    const [album, media] = await Promise.all([
      this.getAlbum(albumId),
      this.getMedia(mediaId),
    ]);

    if (!album) {
      throw new Error(`Album ${albumId} not found`);
    }
    if (!media) {
      throw new Error(`Media ${mediaId} not found`);
    }

    const albumMediaEntity: AlbumMediaEntity = {
      PK: `ALBUM#${albumId}`,
      SK: `MEDIA#${mediaId}`,
      GSI1PK: `MEDIA#${mediaId}`,
      GSI1SK: `ALBUM#${albumId}#${now}`,
      GSI2PK: "ALBUM_MEDIA_BY_DATE",
      GSI2SK: `${now}#${albumId}#${mediaId}`,
      EntityType: "AlbumMedia",
      albumId,
      mediaId,
      addedAt: now,
      addedBy,
    };

    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: albumMediaEntity,
          ConditionExpression:
            "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        })
      );

      // Update album media count
      await this.incrementAlbumMediaCount(albumId);
    } catch (error: unknown) {
      const errorObj = error as Error & { name?: string };
      if (errorObj.name === "ConditionalCheckFailedException") {
        throw new Error(`Media ${mediaId} is already in album ${albumId}`);
      }
      throw errorObj;
    }
  }

  static async bulkAddMediaToAlbum(
    albumId: string,
    mediaIds: string[],
    addedBy?: string
  ): Promise<{
    successful: string[];
    failed: { mediaId: string; error: string }[];
    totalProcessed: number;
  }> {
    const results = {
      successful: [] as string[],
      failed: [] as { mediaId: string; error: string }[],
      totalProcessed: 0,
    };

    // Verify album exists first
    const album = await this.getAlbum(albumId);
    if (!album) {
      throw new Error(`Album ${albumId} not found`);
    }

    console.log(
      `📝 Starting bulk add of ${mediaIds.length} media items to album ${albumId}`
    );

    // Process each media addition individually to handle duplicate errors gracefully
    for (const mediaId of mediaIds) {
      try {
        results.totalProcessed++;
        await this.addMediaToAlbum(albumId, mediaId, addedBy);
        results.successful.push(mediaId);
        console.log(
          `✅ Successfully added media ${mediaId} to album ${albumId}`
        );
      } catch (error: unknown) {
        const errorObj = error as Error;
        const errorMessage = errorObj.message || "Unknown error";
        results.failed.push({
          mediaId,
          error: errorMessage,
        });
        console.log(
          `❌ Failed to add media ${mediaId} to album ${albumId}: ${errorMessage}`
        );
      }
    }

    console.log(
      `📊 Bulk add complete. Success: ${results.successful.length}, Failed: ${results.failed.length}`
    );

    return results;
  }

  static async removeMediaFromAlbum(
    albumId: string,
    mediaId: string
  ): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `ALBUM#${albumId}`,
          SK: `MEDIA#${mediaId}`,
        },
      })
    );

    // Update album media count
    await this.decrementAlbumMediaCount(albumId);
  }

  static async bulkRemoveMediaFromAlbum(
    albumId: string,
    mediaIds: string[]
  ): Promise<{
    successful: string[];
    failed: { mediaId: string; error: string }[];
    totalProcessed: number;
  }> {
    const results = {
      successful: [] as string[],
      failed: [] as { mediaId: string; error: string }[],
      totalProcessed: 0,
    };

    // Verify album exists first
    const album = await this.getAlbum(albumId);
    if (!album) {
      throw new Error(`Album ${albumId} not found`);
    }

    console.log(
      `🗑️ Starting bulk remove of ${mediaIds.length} media items from album ${albumId}`
    );

    // Process each media removal individually to handle errors gracefully
    for (const mediaId of mediaIds) {
      try {
        results.totalProcessed++;
        await this.removeMediaFromAlbum(albumId, mediaId);
        results.successful.push(mediaId);
        console.log(
          `✅ Successfully removed media ${mediaId} from album ${albumId}`
        );
      } catch (error: unknown) {
        const errorObj = error as Error;
        const errorMessage = errorObj.message || "Unknown error";
        results.failed.push({
          mediaId,
          error: errorMessage,
        });
        console.log(
          `❌ Failed to remove media ${mediaId} from album ${albumId}: ${errorMessage}`
        );
      }
    }

    console.log(
      `📊 Bulk remove complete. Success: ${results.successful.length}, Failed: ${results.failed.length}`
    );

    return results;
  }

  static async removeMediaFromAllAlbums(mediaId: string): Promise<void> {
    // Find all albums this media belongs to
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": `MEDIA#${mediaId}`,
        },
      })
    );

    const albumMediaRelationships = (result.Items as AlbumMediaEntity[]) || [];

    // Delete all relationships and update counts
    for (const relationship of albumMediaRelationships) {
      await this.removeMediaFromAlbum(relationship.albumId, mediaId);
    }
  }

  static async getAlbumMediaRelations(
    mediaId: string
  ): Promise<AlbumMediaEntity[]> {
    // Find all albums this media belongs to
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": `MEDIA#${mediaId}`,
        },
      })
    );

    return (result.Items as AlbumMediaEntity[]) || [];
  }

  static async getMediaIdsForAlbum(albumId: string): Promise<string[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk_prefix)",
        ExpressionAttributeValues: {
          ":pk": `ALBUM#${albumId}`,
          ":sk_prefix": "MEDIA#",
        },
      })
    );

    return (
      (result.Items as AlbumMediaEntity[])?.map((item) => item.mediaId) || []
    );
  }

  static async getContentPreviewForAlbum(
    albumId: string
  ): Promise<ThumbnailUrls[]> {
    const mediaIds = await this.getMediaIdsForAlbum(albumId);

    const mediaPromises = mediaIds.map((mediaId) => this.getMedia(mediaId));

    const mediaResults = await Promise.all(mediaPromises);
    return mediaResults
      .slice(0, 10) // Limit to first 10 media items for preview
      .filter((m) => m !== null)
      .map((m) => m.thumbnailUrls) as ThumbnailUrls[];
  }

  static async listAlbumMedia(
    albumId: string,
    limit: number = 50,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    media: Media[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    // First, get album-media relationships
    const relationshipsResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk_prefix)",
        ExpressionAttributeValues: {
          ":pk": `ALBUM#${albumId}`,
          ":sk_prefix": "MEDIA#",
        },
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const relationships =
      (relationshipsResult.Items as AlbumMediaEntity[]) || [];

    // Get the actual media records
    const mediaPromises = relationships.map((rel) =>
      this.getMedia(rel.mediaId)
    );

    const mediaResults = await Promise.all(mediaPromises);
    const media = mediaResults.filter((m) => m !== null) as Media[];

    const response: {
      media: Media[];
      lastEvaluatedKey?: Record<string, unknown>;
    } = { media };

    if (relationshipsResult.LastEvaluatedKey) {
      response.lastEvaluatedKey = relationshipsResult.LastEvaluatedKey;
    }

    return response;
  }

  static async getMediaAlbums(mediaId: string): Promise<string[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": `MEDIA#${mediaId}`,
        },
      })
    );

    const relationships = (result.Items as AlbumMediaEntity[]) || [];
    return relationships.map((rel) => rel.albumId);
  }

  static async getAlbumsForMedia(mediaId: string): Promise<Album[]> {
    // First get the album IDs
    const albumIds = await this.getMediaAlbums(mediaId);

    if (albumIds.length === 0) {
      return [];
    }

    // Fetch all album entities
    const albumPromises = albumIds.map((albumId) => this.getAlbum(albumId));
    const albumEntities = await Promise.all(albumPromises);

    // Filter out null results and convert to Album format
    const albums = albumEntities.filter(
      (entity): entity is Album => entity !== null
    );

    return albums;
  }

  static async getAllPublicMedia(
    limit: number = 50,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    media: Media[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    // Use GSI5 to directly query all public media
    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI5",
      KeyConditionExpression: "GSI5PK = :gsi5pk AND GSI5SK = :gsi5sk",
      ExpressionAttributeValues: {
        ":gsi5pk": "MEDIA",
        ":gsi5sk": "true", // isPublic = "true"
      },
      ScanIndexForward: false, // Most recent first (descending order by createdAt)
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));

    const mediaEntities = (result.Items as MediaEntity[]) || [];

    // Convert MediaEntity to Media format for API response
    const media: Media[] = mediaEntities.map((entity) =>
      this.convertMediaEntityToMedia(entity)
    );

    const response: {
      media: Media[];
      lastEvaluatedKey?: Record<string, any>;
    } = {
      media,
    };

    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = result.LastEvaluatedKey;
    }

    return response;
  }

  static async incrementAlbumMediaCount(albumId: string): Promise<void> {
    return CounterUtil.incrementAlbumMediaCount(albumId);
  }

  static async decrementAlbumMediaCount(albumId: string): Promise<void> {
    return CounterUtil.decrementAlbumMediaCount(albumId);
  }

  static async deleteSession(sessionId: string): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `SESSION#${sessionId}`,
          SK: "METADATA",
        },
      })
    );
  }

  static async updateSessionLastAccessed(sessionId: string): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `SESSION#${sessionId}`,
          SK: "METADATA",
        },
        UpdateExpression: "SET lastAccessedAt = :lastAccessedAt",
        ExpressionAttributeValues: {
          ":lastAccessedAt": new Date().toISOString(),
        },
      })
    );
  }

  static async cleanupExpiredSessions(): Promise<void> {
    const now = new Date().toISOString();

    // Query for expired sessions using GSI1
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk AND GSI1SK < :now",
        ExpressionAttributeValues: {
          ":gsi1pk": "SESSION_EXPIRY",
          ":now": now,
        },
      })
    );

    // Delete expired sessions
    if (result.Items && result.Items.length > 0) {
      const deletePromises = result.Items.map((item) =>
        docClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item["PK"],
              SK: item["SK"],
            },
          })
        )
      );

      await Promise.all(deletePromises);
    }
  }

  // User operations
  static async createUser(user: UserEntity): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: user,
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
  }

  static async getUserByEmail(email: string): Promise<UserEntity | null> {
    // Query using GSI1 to find user by email
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk AND GSI1SK = :gsi1sk",
        ExpressionAttributeValues: {
          ":gsi1pk": "USER_EMAIL",
          ":gsi1sk": email.toLowerCase(),
        },
        Limit: 1,
      })
    );

    return (result.Items?.[0] as UserEntity) || null;
  }

  static async getUserById(userId: string): Promise<UserEntity | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: "METADATA",
        },
      })
    );

    return (result.Item as UserEntity) || null;
  }

  static async getUserByGoogleId(googleId: string): Promise<UserEntity | null> {
    // Query using GSI2 to find user by Google ID
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :gsi2pk AND GSI2SK = :gsi2sk",
        ExpressionAttributeValues: {
          ":gsi2pk": "USER_GOOGLE",
          ":gsi2sk": googleId,
        },
        Limit: 1,
      })
    );

    return (result.Items?.[0] as UserEntity) || null;
  }

  static async getUserByUsername(username: string): Promise<UserEntity | null> {
    console.log("[DynamoDB] getUserByUsername called with:", username);
    console.log("[DynamoDB] Table name:", TABLE_NAME);

    // Query using GSI3 to find user by username
    const queryParams = {
      TableName: TABLE_NAME,
      IndexName: "GSI3",
      KeyConditionExpression: "GSI3PK = :gsi3pk AND GSI3SK = :gsi3sk",
      ExpressionAttributeValues: {
        ":gsi3pk": "USER_USERNAME",
        ":gsi3sk": username.toLowerCase(),
      },
      Limit: 1,
    };

    console.log(
      "[DynamoDB] GSI3 query params:",
      JSON.stringify(queryParams, null, 2)
    );

    const result = await docClient.send(new QueryCommand(queryParams));

    console.log("[DynamoDB] GSI3 query result:", {
      itemsCount: result.Items?.length || 0,
      items: result.Items,
    });

    return (result.Items?.[0] as UserEntity) || null;
  }

  static async updateUser(
    userId: string,
    updates: Partial<UserEntity>
  ): Promise<void> {
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== "PK" && key !== "SK" && value !== undefined) {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    if (updateExpression.length === 0) return;

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: "METADATA",
        },
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  }

  static async getAllUsers(
    limit: number = 50,
    lastEvaluatedKey?: any
  ): Promise<{
    users: UserEntity[];
    lastEvaluatedKey?: any;
  }> {
    console.log("[DynamoDB] getAllUsers called with:", {
      limit,
      lastEvaluatedKey,
    });

    // Query GSI1 to get all users by USER_EMAIL
    const queryParams: any = {
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": "USER_EMAIL",
      },
      Limit: limit,
    };

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    console.log("[DynamoDB] getAllUsers result:", {
      itemsCount: result.Items?.length || 0,
      hasMorePages: !!result.LastEvaluatedKey,
    });

    return {
      users: (result.Items || []).filter(
        (item) => item["username"] !== "[deleted]"
      ) as UserEntity[],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  // User session operations
  static async createUserSession(session: UserSessionEntity): Promise<void> {
    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: session,
        })
      );
    } catch (err) {
      console.error("[DDB] Failed to write user session", {
        pk: session.PK,
        table: TABLE_NAME,
        err,
      });
      throw err;
    }
  }

  static async getUserSession(
    sessionId: string
  ): Promise<UserSessionEntity | null> {
    // Diagnostic logging for debugging session bug
    console.log("[DDB] getUserSession called:", {
      sessionId,
      table: TABLE_NAME,
      region: process.env["AWS_REGION"],
      env: {
        IS_OFFLINE: process.env["IS_OFFLINE"],
        NODE_ENV: process.env["NODE_ENV"],
      },
    });

    const queryKey = {
      PK: `SESSION#${sessionId}`,
      SK: "METADATA",
    };

    console.log("🔍 DIAGNOSTIC - Exact DynamoDB query:", {
      TableName: TABLE_NAME,
      Key: queryKey,
    });

    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: queryKey,
      })
    );

    console.log("🔍 DIAGNOSTIC - DynamoDB result:", {
      hasItem: !!result.Item,
      item: result.Item
        ? {
            PK: result.Item["PK"],
            SK: result.Item["SK"],
            sessionId: result.Item["sessionId"],
            userId: result.Item["userId"],
          }
        : null,
    });

    return (result.Item as UserSessionEntity) || null;
  }

  static async deleteUserSession(sessionId: string): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `SESSION#${sessionId}`,
          SK: "METADATA",
        },
      })
    );
  }

  static async updateUserSessionLastAccessed(sessionId: string): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `SESSION#${sessionId}`,
          SK: "METADATA",
        },
        UpdateExpression: "SET lastAccessedAt = :lastAccessedAt",
        ExpressionAttributeValues: {
          ":lastAccessedAt": new Date().toISOString(),
        },
      })
    );
  }

  static async deleteUserSessionsByUserId(userId: string): Promise<void> {
    console.log(
      "[DynamoDB] deleteUserSessionsByUserId called with userId:",
      userId
    );

    // Query all sessions for this user using GSI2
    const queryParams = {
      TableName: TABLE_NAME,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :gsi2pk",
      ExpressionAttributeValues: {
        ":gsi2pk": `USER#${userId}#SESSION`,
      },
    };

    const result = await docClient.send(new QueryCommand(queryParams));

    if (!result.Items || result.Items.length === 0) {
      console.log("[DynamoDB] No sessions found for user:", userId);
      return;
    }

    // Delete all sessions found
    const deleteRequests = result.Items.map((session: any) => ({
      DeleteRequest: {
        Key: {
          PK: session.PK,
          SK: session.SK,
        },
      },
    }));

    // Batch delete sessions (max 25 items per batch)
    for (let i = 0; i < deleteRequests.length; i += 25) {
      const batch = deleteRequests.slice(i, i + 25);
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch,
          },
        })
      );
    }

    console.log(
      `[DynamoDB] Deleted ${deleteRequests.length} sessions for user ${userId}`
    );
  }

  static async cleanupExpiredUserSessions(): Promise<void> {
    const now = new Date().toISOString();

    // Query for expired user sessions using GSI1
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk AND GSI1SK < :now",
        ExpressionAttributeValues: {
          ":gsi1pk": "USER_SESSION_EXPIRY",
          ":now": now,
        },
      })
    );

    // Delete expired sessions
    if (result.Items && result.Items.length > 0) {
      const deletePromises = result.Items.map((item) =>
        docClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item["PK"],
              SK: item["SK"],
            },
          })
        )
      );

      await Promise.all(deletePromises);
    }
  }

  // ComfyUI Monitor operations
  static async storeComfyUIMonitorClientId(
    clientId: string,
    metadata: {
      comfyui_host: string;
      version: string;
      lastConnectedAt: string;
    }
  ): Promise<void> {
    const monitorRecord = {
      PK: "SYSTEM#COMFYUI_MONITOR",
      SK: "METADATA",
      EntityType: "ComfyUIMonitor",
      clientId,
      comfyui_host: metadata.comfyui_host,
      version: metadata.version,
      lastConnectedAt: metadata.lastConnectedAt,
      updatedAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: monitorRecord,
      })
    );
  }

  static async getComfyUIMonitorClientId(): Promise<string | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: "SYSTEM#COMFYUI_MONITOR",
          SK: "METADATA",
        },
      })
    );

    return result.Item?.["clientId"] || null;
  }

  static async deleteComfyUIMonitorClientId(): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: "SYSTEM#COMFYUI_MONITOR",
          SK: "METADATA",
        },
      })
    );
  }

  // Email verification token operations (for Phase 2)
  static async createEmailVerificationToken(
    token: EmailVerificationTokenEntity
  ): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: token,
      })
    );
  }

  static async getEmailVerificationToken(
    token: string
  ): Promise<EmailVerificationTokenEntity | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `EMAIL_VERIFICATION#${token}`,
          SK: "METADATA",
        },
      })
    );

    return (result.Item as EmailVerificationTokenEntity) || null;
  }

  static async deleteEmailVerificationToken(token: string): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `EMAIL_VERIFICATION#${token}`,
          SK: "METADATA",
        },
      })
    );
  }

  static async cleanupExpiredEmailTokens(): Promise<void> {
    const now = new Date().toISOString();

    // Query for expired email verification tokens using GSI1
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk AND GSI1SK < :now",
        ExpressionAttributeValues: {
          ":gsi1pk": "EMAIL_VERIFICATION_EXPIRY",
          ":now": now,
        },
      })
    );

    // Delete expired tokens
    if (result.Items && result.Items.length > 0) {
      const deletePromises = result.Items.map((item) =>
        docClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item["PK"],
              SK: item["SK"],
            },
          })
        )
      );

      await Promise.all(deletePromises);
    }
  }

  // Password reset token operations
  static async createPasswordResetToken(
    token: string,
    userId: string,
    email: string,
    expiresAt: Date
  ): Promise<void> {
    const tokenEntity = {
      PK: `PASSWORD_RESET#${token}`,
      SK: "TOKEN",
      GSI1PK: "PASSWORD_RESET_EXPIRY",
      GSI1SK: `${expiresAt.toISOString()}#${token}`,
      EntityType: "PasswordResetToken" as const,
      token,
      userId,
      email,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      ttl: Math.floor(expiresAt.getTime() / 1000), // TTL for automatic cleanup
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: tokenEntity,
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
  }

  static async getPasswordResetToken(
    token: string
  ): Promise<
    import("@shared/shared-types/database").PasswordResetTokenEntity | null
  > {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PASSWORD_RESET#${token}`,
          SK: "TOKEN",
        },
      })
    );

    return (
      (result.Item as import("@shared/shared-types/database").PasswordResetTokenEntity) ||
      null
    );
  }

  static async deletePasswordResetToken(token: string): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PASSWORD_RESET#${token}`,
          SK: "TOKEN",
        },
      })
    );
  }

  static async cleanupExpiredPasswordResetTokens(): Promise<void> {
    const now = new Date().toISOString();

    // Query for expired password reset tokens using GSI1
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk AND GSI1SK < :now",
        ExpressionAttributeValues: {
          ":gsi1pk": "PASSWORD_RESET_EXPIRY",
          ":now": now,
        },
      })
    );

    // Delete expired tokens
    if (result.Items && result.Items.length > 0) {
      const deletePromises = result.Items.map((item) =>
        docClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item["PK"],
              SK: item["SK"],
            },
          })
        )
      );

      await Promise.all(deletePromises);
    }
  }

  // User interaction operations
  static async createUserInteraction(
    userId: string,
    interactionType: "like" | "bookmark",
    targetType: "media" | "album" | "comment",
    targetId: string
  ): Promise<void> {
    const now = new Date().toISOString();

    const interaction: UserInteractionEntity = {
      PK: `USER#${userId}`,
      SK:
        targetType === "comment"
          ? `COMMENT_INTERACTION#${interactionType}#${targetId}`
          : `INTERACTION#${interactionType}#${targetId}`,
      GSI1PK:
        targetType === "comment"
          ? `COMMENT_INTERACTION#${interactionType}#${targetId}`
          : `INTERACTION#${interactionType}#${targetId}`,
      GSI1SK: userId,
      GSI2PK: `USER#${userId}#INTERACTIONS#${interactionType}`,
      GSI2SK: targetType === "comment" ? `COMMENT#${now}` : `CONTENT#${now}`,
      GSI3PK: `INTERACTION#${interactionType}`,
      GSI3SK: now,
      EntityType: "UserInteraction",
      userId,
      interactionType,
      targetType,
      targetId,
      createdAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: interaction,
        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  }

  static async deleteUserInteraction(
    userId: string,
    interactionType: "like" | "bookmark",
    targetId: string
  ): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `INTERACTION#${interactionType}#${targetId}`,
        },
      })
    );
  }

  static convertUserInteractionEntityToUserInteraction(
    entity: UserInteractionEntity
  ): UserInteraction {
    return {
      userId: entity.userId,
      interactionType: entity.interactionType,
      targetType: entity.targetType,
      targetId: entity.targetId,
      createdAt: entity.createdAt,
    };
  }

  static async getUserInteraction(
    userId: string,
    interactionType: "like" | "bookmark",
    targetId: string
  ): Promise<UserInteraction | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `INTERACTION#${interactionType}#${targetId}`,
        },
      })
    );

    return result.Item
      ? this.convertUserInteractionEntityToUserInteraction(
          result.Item as UserInteractionEntity
        )
      : null;
  }

  static async getUserInteractions(
    userId: string,
    interactionType: "like" | "bookmark",
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>,
    includeComments: boolean = true
  ): Promise<{
    interactions: UserInteraction[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI2", // Use GSI2 for chronological ordering
      KeyConditionExpression: "GSI2PK = :gsi2pk",
      ExpressionAttributeValues: {
        ":gsi2pk": `USER#${userId}#INTERACTIONS#${interactionType}`,
      },
      ScanIndexForward: false, // Most recent first (descending order by createdAt)
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    if (!includeComments) {
      queryParams.KeyConditionExpression += " AND begins_with(GSI2SK, :gsi2sk)";
      queryParams.ExpressionAttributeValues![":gsi2sk"] = "CONTENT#";
    }
    // Use GSI2 for efficient chronological sorting by createdAt
    const result = await docClient.send(new QueryCommand(queryParams));

    const response: {
      interactions: UserInteraction[];
      lastEvaluatedKey?: Record<string, any>;
    } = {
      interactions:
        result.Items?.map((item) =>
          this.convertUserInteractionEntityToUserInteraction(
            item as UserInteractionEntity
          )
        ) || [],
    };

    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = result.LastEvaluatedKey;
    }

    return response;
  }

  static async getInteractionCounts(
    _targetType: "album" | "media",
    targetId: string
  ): Promise<{
    likeCount: number;
    bookmarkCount: number;
  }> {
    // Get like count
    const likeResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": `INTERACTION#like#${targetId}`,
        },
        Select: "COUNT",
      })
    );

    // Get bookmark count
    const bookmarkResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": `INTERACTION#bookmark#${targetId}`,
        },
        Select: "COUNT",
      })
    );

    return {
      likeCount: likeResult.Count || 0,
      bookmarkCount: bookmarkResult.Count || 0,
    };
  }

  static async getUserInteractionStatus(
    userId: string,
    targetId: string
  ): Promise<{
    userLiked: boolean;
    userBookmarked: boolean;
  }> {
    // Check if user liked the target
    const likeResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `INTERACTION#like#${targetId}`,
        },
      })
    );

    // Check if user bookmarked the target
    const bookmarkResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `INTERACTION#bookmark#${targetId}`,
        },
      })
    );

    return {
      userLiked: !!likeResult.Item,
      userBookmarked: !!bookmarkResult.Item,
    };
  }

  static async getTotalLikesReceivedOnUserContent(
    userId: string
  ): Promise<number> {
    // First, get all user's albums
    const userAlbumsResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":sk": "ALBUM#",
        },
      })
    );

    const userAlbums = userAlbumsResult.Items || [];
    const albumIds = userAlbums.map((album: Record<string, unknown>) =>
      (album["SK"] as string).replace("ALBUM#", "")
    );

    if (albumIds.length === 0) {
      return 0;
    }

    // Count likes on all user's albums
    let totalLikes = 0;

    for (const albumId of albumIds) {
      try {
        const likesResult = await docClient.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: "GSI1",
            KeyConditionExpression: "GSI1PK = :gsi1pk",
            ExpressionAttributeValues: {
              ":gsi1pk": `INTERACTION#like#${albumId}`,
            },
            Select: "COUNT",
          })
        );

        totalLikes += likesResult.Count || 0;
      } catch (error) {
        console.warn(`Failed to count likes for album ${albumId}:`, error);
      }
    }

    return totalLikes;
  }

  static async getTotalBookmarksReceivedOnUserContent(
    userId: string
  ): Promise<number> {
    // First, get all user's albums
    const userAlbumsResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":sk": "ALBUM#",
        },
      })
    );

    const userAlbums = userAlbumsResult.Items || [];
    const albumIds = userAlbums.map((album: Record<string, unknown>) =>
      (album["SK"] as string).replace("ALBUM#", "")
    );

    if (albumIds.length === 0) {
      return 0;
    }

    // Count bookmarks on all user's albums
    let totalBookmarks = 0;

    for (const albumId of albumIds) {
      try {
        const bookmarksResult = await docClient.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: "GSI1",
            KeyConditionExpression: "GSI1PK = :gsi1pk",
            ExpressionAttributeValues: {
              ":gsi1pk": `INTERACTION#bookmark#${albumId}`,
            },
            Select: "COUNT",
          })
        );

        totalBookmarks += bookmarksResult.Count || 0;
      } catch (error) {
        console.warn(`Failed to count bookmarks for album ${albumId}:`, error);
      }
    }

    return totalBookmarks;
  }

  // User profile metrics methods
  static async getUserProfileInsights(userId: string): Promise<{
    totalLikesReceived: number;
    totalBookmarksReceived: number;
    totalMediaViews: number;
    totalProfileViews: number;
    totalGeneratedMedias: number;
    totalAlbums: number;
  }> {
    console.log(`🔍 Getting profile insights for user: ${userId}`);

    try {
      // Get user entity to check for cached metrics
      const user = await this.getUserById(userId);
      if (user?.profileInsights) {
        console.log("✅ Returning cached profile insights");
        return {
          totalLikesReceived: user.profileInsights.totalLikesReceived,
          totalBookmarksReceived: user.profileInsights.totalBookmarksReceived,
          totalMediaViews: user.profileInsights.totalMediaViews,
          totalProfileViews: user.profileInsights.totalProfileViews,
          totalGeneratedMedias: user.profileInsights.totalGeneratedMedias,
          totalAlbums: user.profileInsights.totalAlbums,
        };
      }

      console.log("🔄 Computing profile insights from database...");

      // Compute metrics in parallel for efficiency
      const [
        totalLikesReceived,
        totalBookmarksReceived,
        totalMediaViews,
        { totalGeneratedMedias, totalAlbums },
      ] = await Promise.all([
        this.getTotalLikesReceivedOnUserContent(userId),
        this.getTotalBookmarksReceivedOnUserContent(userId),
        this.getTotalMediaViewsForUser(userId),
        this.getUserContentCounts(userId),
      ]);

      // Profile views start at 0 (will be incremented as users visit the profile)
      const totalProfileViews = 0;

      const insights = {
        totalLikesReceived,
        totalBookmarksReceived,
        totalMediaViews,
        totalProfileViews,
        totalGeneratedMedias,
        totalAlbums,
      };

      // Cache the computed insights in the user record
      await this.updateUserProfileInsights(userId, insights);

      console.log("✅ Computed and cached profile insights:", insights);
      return insights;
    } catch (error) {
      console.error("❌ Failed to get user profile insights:", error);
      // Return default values on error
      return {
        totalLikesReceived: 0,
        totalBookmarksReceived: 0,
        totalMediaViews: 0,
        totalProfileViews: 0,
        totalGeneratedMedias: 0,
        totalAlbums: 0,
      };
    }
  }

  static async getTotalMediaViewsForUser(userId: string): Promise<number> {
    console.log(`🔍 Computing total media views for user: ${userId}`);

    try {
      // Get all user's albums
      const userAlbumsResult = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          ExpressionAttributeValues: {
            ":pk": `USER#${userId}`,
            ":sk": "ALBUM#",
          },
        })
      );

      const userAlbums = userAlbumsResult.Items || [];
      let totalViews = 0;

      // Sum up view counts from all user's albums
      for (const albumEntity of userAlbums) {
        const viewCount = albumEntity["viewCount"] || 0;
        totalViews += viewCount;
      }

      // Also get media view counts (for media not in albums or individual media views)
      const userMediaResult = await this.getUserMedia(
        userId,
        1000,
        undefined,
        false
      ); // Get up to 1000 media items, include private
      for (const mediaEntity of userMediaResult.media) {
        const viewCount = mediaEntity.viewCount || 0;
        totalViews += viewCount;
      }

      console.log(`✅ Total media views for user ${userId}: ${totalViews}`);
      return totalViews;
    } catch (error) {
      console.error(
        `❌ Failed to compute media views for user ${userId}:`,
        error
      );
      return 0;
    }
  }

  static async getUserContentCounts(userId: string): Promise<{
    totalGeneratedMedias: number;
    totalAlbums: number;
  }> {
    console.log(`🔍 Computing content counts for user: ${userId}`);

    try {
      // Count user's albums
      const albumsResult = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          ExpressionAttributeValues: {
            ":pk": `USER#${userId}`,
            ":sk": "ALBUM#",
          },
          Select: "COUNT",
        })
      );

      const totalAlbums = albumsResult.Count || 0;

      // Count user's generated media via GSI1
      const mediaResult = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI1",
          KeyConditionExpression: "GSI1PK = :gsi1pk",
          FilterExpression: "createdBy = :userId",
          ExpressionAttributeValues: {
            ":gsi1pk": "MEDIA_BY_CREATOR",
            ":userId": userId,
          },
          Select: "COUNT",
        })
      );

      const totalGeneratedMedias = mediaResult.Count || 0;

      console.log(
        `✅ Content counts for user ${userId}: ${totalAlbums} albums, ${totalGeneratedMedias} media`
      );
      return { totalGeneratedMedias, totalAlbums };
    } catch (error) {
      console.error(
        `❌ Failed to compute content counts for user ${userId}:`,
        error
      );
      return { totalGeneratedMedias: 0, totalAlbums: 0 };
    }
  }

  static async updateUserProfileInsights(
    userId: string,
    insights: {
      totalLikesReceived: number;
      totalBookmarksReceived: number;
      totalMediaViews: number;
      totalProfileViews: number;
      totalGeneratedMedias: number;
      totalAlbums: number;
    }
  ): Promise<void> {
    console.log(`🔄 Updating profile insights for user: ${userId}`);

    try {
      const now = new Date().toISOString();

      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `USER#${userId}`,
            SK: "METADATA",
          },
          UpdateExpression: `SET 
            profileInsights = :insights,
            #lastActive = :lastActive`,
          ExpressionAttributeNames: {
            "#lastActive": "lastActive",
          },
          ExpressionAttributeValues: {
            ":insights": {
              ...insights,
              lastUpdated: now,
            },
            ":lastActive": now,
          },
        })
      );

      console.log(`✅ Updated profile insights for user: ${userId}`);
    } catch (error) {
      console.error(
        `❌ Failed to update profile insights for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  // Real-time metrics increment/decrement methods
  static async incrementUserProfileMetric(
    userId: string,
    metric:
      | "totalLikesReceived"
      | "totalBookmarksReceived"
      | "totalMediaViews"
      | "totalProfileViews"
      | "totalGeneratedMedias"
      | "totalAlbums",
    increment: number = 1
  ): Promise<void> {
    console.log(`📈 Incrementing ${metric} for user ${userId} by ${increment}`);

    const now = new Date().toISOString();

    try {
      // First attempt: Try to increment assuming profileInsights exists
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `USER#${userId}`,
            SK: "METADATA",
          },
          UpdateExpression: `ADD 
            profileInsights.#metric :increment 
            SET 
            profileInsights.lastUpdated = :lastUpdated`,
          ExpressionAttributeNames: {
            "#metric": metric,
          },
          ExpressionAttributeValues: {
            ":increment": increment,
            ":lastUpdated": now,
          },
          // Ensure profileInsights exists
          ConditionExpression: "attribute_exists(profileInsights)",
        })
      );

      console.log(`✅ Incremented ${metric} for user ${userId}`);
    } catch (error: unknown) {
      const errorObj = error as Error & { name?: string };
      // If profileInsights doesn't exist, initialize it with the increment
      if (errorObj.name === "ConditionalCheckFailedException") {
        console.log(
          `⚠️ Profile insights not initialized for user ${userId}, initializing with increment...`
        );

        try {
          // Initialize profileInsights structure with the metric set to the increment value
          // and all other metrics set to 0
          const initialInsights = {
            totalLikesReceived: metric === "totalLikesReceived" ? increment : 0,
            totalBookmarksReceived:
              metric === "totalBookmarksReceived" ? increment : 0,
            totalMediaViews: metric === "totalMediaViews" ? increment : 0,
            totalProfileViews: metric === "totalProfileViews" ? increment : 0,
            totalGeneratedMedias:
              metric === "totalGeneratedMedias" ? increment : 0,
            totalAlbums: metric === "totalAlbums" ? increment : 0,
            lastUpdated: now,
          };

          await docClient.send(
            new UpdateCommand({
              TableName: TABLE_NAME,
              Key: {
                PK: `USER#${userId}`,
                SK: "METADATA",
              },
              UpdateExpression: `SET 
                profileInsights = :insights`,
              ExpressionAttributeValues: {
                ":insights": initialInsights,
              },
              // Only initialize if profileInsights doesn't exist
              ConditionExpression: "attribute_not_exists(profileInsights)",
            })
          );

          console.log(
            `✅ Initialized and incremented ${metric} for user ${userId}`
          );
        } catch (initError: unknown) {
          const initErrorObj = initError as Error & { name?: string };
          if (initErrorObj.name === "ConditionalCheckFailedException") {
            // profileInsights was created by another process, retry the original increment
            console.log(
              `🔄 Profile insights was created concurrently for user ${userId}, retrying increment...`
            );
            return this.incrementUserProfileMetric(userId, metric, increment);
          } else {
            console.error(
              `❌ Failed to initialize profile insights for user ${userId}:`,
              initError
            );
            throw initError;
          }
        }
      } else {
        console.error(
          `❌ Failed to increment ${metric} for user ${userId}:`,
          error
        );
        throw error;
      }
    }
  }

  // Helper method to recalculate and update user profile insights
  static async recalculateUserProfileInsights(userId: string): Promise<void> {
    console.log(`🔄 Recalculating profile insights for user: ${userId}`);

    try {
      // Force recalculation by clearing cached insights first
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `USER#${userId}`,
            SK: "METADATA",
          },
          UpdateExpression: "REMOVE profileInsights",
        })
      );

      // Now get fresh insights (this will trigger computation)
      await this.getUserProfileInsights(userId);
      console.log(`✅ Recalculated profile insights for user: ${userId}`);
    } catch (error) {
      console.error(
        `❌ Failed to recalculate profile insights for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  // Cleanup methods for orphaned interactions
  static async deleteAllInteractionsForTarget(targetId: string): Promise<void> {
    console.log(`🧹 Cleaning up all interactions for target: ${targetId}`);

    // Delete all likes for this target and decrement counts
    const likeCount = await this.deleteInteractionsByType(targetId, "like");

    // Delete all bookmarks for this target and decrement counts
    const bookmarkCount = await this.deleteInteractionsByType(
      targetId,
      "bookmark"
    );

    // Check if this is an album or media and decrement the appropriate counts
    try {
      const album = await this.getAlbum(targetId);
      if (album) {
        // This is an album, decrement the album counts
        if (likeCount > 0) {
          await this.incrementAlbumLikeCount(targetId, -likeCount);
        }
        if (bookmarkCount > 0) {
          await this.incrementAlbumBookmarkCount(targetId, -bookmarkCount);
        }
        console.log(
          `📉 Decremented album counts: ${likeCount} likes, ${bookmarkCount} bookmarks`
        );
      } else {
        // Try to get media to see if this is a media target
        const media = await this.getMedia(targetId);
        if (media) {
          // This is media, decrement the media counts
          if (likeCount > 0) {
            await this.incrementMediaLikeCount(targetId, -likeCount);
          }
          if (bookmarkCount > 0) {
            await this.incrementMediaBookmarkCount(targetId, -bookmarkCount);
          }
          console.log(
            `📉 Decremented media counts: ${likeCount} likes, ${bookmarkCount} bookmarks`
          );
        }
      }
    } catch (error) {
      // Target doesn't exist or other error, which is expected for deleted items
      console.log(
        `📝 Target ${targetId} is not found or error occurred (expected for deleted items)`
      );
    }
  }

  private static async deleteInteractionsByType(
    targetId: string,
    interactionType: "like" | "bookmark"
  ): Promise<number> {
    try {
      // Query GSI1 to find all interactions for this target
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI1",
          KeyConditionExpression: "GSI1PK = :gsi1pk",
          ExpressionAttributeValues: {
            ":gsi1pk": `INTERACTION#${interactionType}#${targetId}`,
          },
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return 0;
      }

      // Delete interactions in batches
      const batchSize = 25;
      for (let i = 0; i < result.Items.length; i += batchSize) {
        const batch = result.Items.slice(i, i + batchSize);

        const deleteRequests = batch.map((item: Record<string, unknown>) => ({
          DeleteRequest: {
            Key: {
              PK: item["PK"],
              SK: item["SK"],
            },
          },
        }));

        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: deleteRequests,
            },
          })
        );
      }

      console.log(
        `✅ Deleted ${result.Items.length} ${interactionType} interactions for target: ${targetId}`
      );
      return result.Items.length;
    } catch (error) {
      console.error(
        `❌ Error deleting ${interactionType} interactions for target ${targetId}:`,
        error
      );
      throw error;
    }
  }

  // Comment operations
  static async createComment(comment: CommentEntity): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: comment,
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
  }

  static async getComment(commentId: string): Promise<CommentEntity | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `COMMENT#${commentId}`,
          SK: "METADATA",
        },
      })
    );

    return (result.Item as CommentEntity) || null;
  }

  static async updateComment(
    commentId: string,
    updates: Partial<CommentEntity>
  ): Promise<void> {
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== "PK" && key !== "SK" && value !== undefined) {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    if (updateExpression.length === 0) return;

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `COMMENT#${commentId}`,
          SK: "METADATA",
        },
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  }

  static async deleteComment(commentId: string): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `COMMENT#${commentId}`,
          SK: "METADATA",
        },
      })
    );
  }

  static async getCommentsForTarget(
    targetType: "album" | "media",
    targetId: string,
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    comments: CommentEntity[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": `COMMENTS_BY_TARGET#${targetType}#${targetId}`,
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const response: {
      comments: CommentEntity[];
      lastEvaluatedKey?: Record<string, any>;
    } = {
      comments: (result.Items as CommentEntity[]) || [],
    };

    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = result.LastEvaluatedKey;
    }

    return response;
  }

  static async getCommentsByUser(
    userId: string,
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    comments: CommentEntity[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :gsi2pk",
        ExpressionAttributeValues: {
          ":gsi2pk": `COMMENTS_BY_USER#${userId}`,
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const response: {
      comments: CommentEntity[];
      lastEvaluatedKey?: Record<string, any>;
    } = {
      comments: (result.Items as CommentEntity[]) || [],
    };

    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = result.LastEvaluatedKey;
    }

    return response;
  }

  static async incrementAlbumCommentCount(
    albumId: string,
    increment: number = 1
  ): Promise<void> {
    return CounterUtil.incrementAlbumCommentCount(albumId, increment);
  }

  static async incrementMediaCommentCount(
    mediaId: string,
    increment: number = 1
  ): Promise<void> {
    return CounterUtil.incrementMediaCommentCount(mediaId, increment);
  }

  static async incrementCommentLikeCount(
    commentId: string,
    increment: number = 1
  ): Promise<void> {
    return CounterUtil.incrementCommentLikeCount(commentId, increment);
  }

  // Comment interaction operations
  static async getUserInteractionForComment(
    userId: string,
    interactionType: "like",
    commentId: string
  ): Promise<UserInteractionEntity | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `COMMENT_INTERACTION#${interactionType}#${commentId}`,
        },
      })
    );

    return (result.Item as UserInteractionEntity) || null;
  }

  static async deleteUserInteractionForComment(
    userId: string,
    interactionType: "like",
    commentId: string
  ): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `COMMENT_INTERACTION#${interactionType}#${commentId}`,
        },
      })
    );
  }

  static async deleteAllCommentsForTarget(targetId: string): Promise<void> {
    console.log(`🧹 Cleaning up all comments for target: ${targetId}`);

    try {
      // Get all comments for this target using both album and media target types
      const albumCommentsResult = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI1",
          KeyConditionExpression: "GSI1PK = :gsi1pk",
          ExpressionAttributeValues: {
            ":gsi1pk": `COMMENTS_BY_TARGET#album#${targetId}`,
          },
        })
      );

      const mediaCommentsResult = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI1",
          KeyConditionExpression: "GSI1PK = :gsi1pk",
          ExpressionAttributeValues: {
            ":gsi1pk": `COMMENTS_BY_TARGET#media#${targetId}`,
          },
        })
      );

      const allComments = [
        ...(albumCommentsResult.Items || []),
        ...(mediaCommentsResult.Items || []),
      ];

      if (allComments.length === 0) {
        console.log(`No comments found for target: ${targetId}`);
        return;
      }

      // Extract comment IDs for cleaning up likes
      const commentIds = allComments.map(
        (comment: Record<string, unknown>) => comment["id"] as string
      );

      // Delete all comment likes for these comments
      if (commentIds.length > 0) {
        await this.deleteAllCommentLikesForComments(commentIds);
      }

      // Delete comments in batches
      const batchSize = 25;
      for (let i = 0; i < allComments.length; i += batchSize) {
        const batch = allComments.slice(i, i + batchSize);

        const deleteRequests = batch.map((item: Record<string, unknown>) => ({
          DeleteRequest: {
            Key: {
              PK: item["PK"],
              SK: item["SK"],
            },
          },
        }));

        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: deleteRequests,
            },
          })
        );
      }

      console.log(
        `✅ Deleted ${allComments.length} comments and their likes for target: ${targetId}`
      );
    } catch (error) {
      console.error(
        `❌ Error deleting comments for target ${targetId}:`,
        error
      );
      throw error;
    }
  }

  // Helper method to delete all likes for a list of comments
  static async deleteAllCommentLikesForComments(
    commentIds: string[]
  ): Promise<void> {
    console.log(`🧹 Cleaning up likes for ${commentIds.length} comments`);

    try {
      // For each comment, find all users who liked it using GSI1
      const allLikesToDelete: { PK: string; SK: string }[] = [];

      for (const commentId of commentIds) {
        const likesResult = await docClient.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: "GSI1",
            KeyConditionExpression: "GSI1PK = :gsi1pk",
            ExpressionAttributeValues: {
              ":gsi1pk": `COMMENT_INTERACTION#like#${commentId}`,
            },
          })
        );

        const commentLikes = likesResult.Items || [];
        commentLikes.forEach((like: Record<string, unknown>) => {
          allLikesToDelete.push({
            PK: like["PK"] as string,
            SK: like["SK"] as string,
          });
        });
      }

      if (allLikesToDelete.length === 0) {
        console.log(`No comment likes found to delete`);
        return;
      }

      // Delete all comment likes in batches
      const batchSize = 25;
      for (let i = 0; i < allLikesToDelete.length; i += batchSize) {
        const batch = allLikesToDelete.slice(i, i + batchSize);

        const deleteRequests = batch.map((like) => ({
          DeleteRequest: {
            Key: {
              PK: like.PK,
              SK: like.SK,
            },
          },
        }));

        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: deleteRequests,
            },
          })
        );
      }

      console.log(
        `✅ Deleted ${allLikesToDelete.length} comment likes for ${commentIds.length} comments`
      );
    } catch (error) {
      console.error(`❌ Error deleting comment likes:`, error);
      throw error;
    }
  }

  static async isValidUserConnectionId(
    userId: string,
    connectionId: string
  ): Promise<boolean> {
    try {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI1",
          KeyConditionExpression: "GSI1PK = :gsi1pk AND GSI1SK = :gsi1sk",
          ExpressionAttributeValues: {
            ":gsi1pk": "WEBSOCKET_CONNECTIONS",
            ":gsi1sk": `${userId}#${connectionId}`,
          },
          Limit: 1,
        })
      );
      return !!(result.Items && result.Items.length > 0);
    } catch (error) {
      console.error(
        `❌ Error validating user connection ID for user ${userId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get active WebSocket connection ID for a user
   * Returns the most recent active connection for the user
   */
  static async getActiveConnectionIdForUser(
    userId: string
  ): Promise<string | null> {
    try {
      console.log(`🔍 Looking for active connection for user: ${userId}`);

      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI1",
          KeyConditionExpression:
            "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :gsi1sk)",
          ExpressionAttributeValues: {
            ":gsi1pk": "WEBSOCKET_CONNECTIONS",
            ":gsi1sk": `${userId}#`,
          },
          ScanIndexForward: false, // Get most recent first
          Limit: 1, // We only need the most recent connection
        })
      );

      const connections = result.Items as ConnectionEntity[] | undefined;

      if (!connections || connections.length === 0) {
        console.log(`📭 No active connections found for user: ${userId}`);
        return null;
      }

      const connection = connections[0];
      if (!connection) {
        console.log(`📭 No valid connection found for user: ${userId}`);
        return null;
      }

      console.log(
        `✅ Found active connection for user ${userId}: ${connection.connectionId}`
      );

      return connection.connectionId;
    } catch (error) {
      console.error(
        `❌ Error getting active connection for user ${userId}:`,
        error
      );
      return null;
    }
  }

  // Rate limiting helpers
  static async createIPGenerationRecord(record: {
    PK: string;
    SK: string;
    userId?: string;
    plan?: string;
    generatedAt: string;
    ttl: number;
  }): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: record,
      })
    );
  }

  static async createUserGenerationRecord(record: {
    PK: string;
    SK: string;
    hashedIP?: string;
    plan?: string;
    generatedAt: string;
    ttl: number;
  }): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: record,
      })
    );
  }

  static async getIPGenerationRecord(
    pk: string,
    sk: string
  ): Promise<any | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: pk,
          SK: sk,
        },
      })
    );

    return result.Item || null;
  }

  static async queryIPGenerationRecords(
    clientIp: string,
    startDate: string
  ): Promise<any[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `IP#${clientIp}`,
          ":skPrefix": `GEN#${startDate}`,
        },
      })
    );

    return result.Items || [];
  }

  static async queryUserGenerationRecords(
    userId: string,
    startDate: string
  ): Promise<any[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":skPrefix": `GEN#${startDate}`,
        },
      })
    );

    return result.Items || [];
  }

  static async countIPGenerations(
    clientIp: string,
    startDate: string,
    endDate: string
  ): Promise<number> {
    try {
      const items = await this.queryIPGenerationRecords(clientIp, startDate);

      // Filter items that are within the date range
      const filteredItems = items.filter((item) => {
        const sk = item.SK as string;
        if (!sk.startsWith("GEN#")) return false;

        // Extract date from SK format: GEN#YYYY-MM-DD#...
        const datePart = sk.split("#")[1];
        return datePart && datePart >= startDate && datePart <= endDate;
      });

      return filteredItems.length;
    } catch (error) {
      console.error("Error counting IP generations:", error);
      return 0; // On error, assume no generations to avoid blocking
    }
  }

  static async countUserGenerations(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<number> {
    try {
      const items = await this.queryUserGenerationRecords(userId, startDate);

      // Filter items that are within the date range
      const filteredItems = items.filter((item) => {
        const sk = item.SK as string;
        if (!sk.startsWith("GEN#")) return false;

        // Extract date from SK format: GEN#YYYY-MM-DD#...
        const datePart = sk.split("#")[1];
        return datePart && datePart >= startDate && datePart <= endDate;
      });

      return filteredItems.length;
    } catch (error) {
      console.error("Error counting user generations:", error);
      return 0; // On error, assume no generations to avoid blocking
    }
  }

  /**
   * Count distinct generations for IP quota checking using union of IP and user records
   * This prevents double-counting when the same generation appears in both IP and user records
   */
  static async countDistinctGenerationsForIP(
    clientIp: string,
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<number> {
    try {
      // Get generations from IP records for this IP
      const ipItems = await this.queryIPGenerationRecords(clientIp, startDate);

      // Get generations from user records for this user
      const userItems = await this.queryUserGenerationRecords(
        userId,
        startDate
      );

      // Create a set of unique generation IDs to avoid double counting
      const uniqueGenerations = new Set<string>();

      // Process IP records
      ipItems.forEach((item) => {
        const sk = item.SK as string;
        if (sk.startsWith("GEN#")) {
          const datePart = sk.split("#")[1];
          if (datePart && datePart >= startDate && datePart <= endDate) {
            uniqueGenerations.add(sk);
          }
        }
      });

      // Process user records
      userItems.forEach((item) => {
        const sk = item.SK as string;
        if (sk.startsWith("GEN#")) {
          const datePart = sk.split("#")[1];
          if (datePart && datePart >= startDate && datePart <= endDate) {
            uniqueGenerations.add(sk);
          }
        }
      });

      return uniqueGenerations.size;
    } catch (error) {
      console.error("Error counting distinct generations for IP:", error);
      return 0; // On error, assume no generations to avoid blocking
    }
  }

  /**
   * Count distinct generations for user quota checking using union of IP and user records
   * This prevents double-counting when the same generation appears in both IP and user records
   */
  static async countDistinctGenerationsForUser(
    userId: string,
    clientIp: string,
    startDate: string,
    endDate: string
  ): Promise<number> {
    try {
      // Get generations from user records for this user
      const userItems = await this.queryUserGenerationRecords(
        userId,
        startDate
      );

      // Get generations from IP records for this IP
      const ipItems = await this.queryIPGenerationRecords(clientIp, startDate);

      // Create a set of unique generation IDs to avoid double counting
      const uniqueGenerations = new Set<string>();

      // Process user records
      userItems.forEach((item) => {
        const sk = item.SK as string;
        if (sk.startsWith("GEN#")) {
          const datePart = sk.split("#")[1];
          if (datePart && datePart >= startDate && datePart <= endDate) {
            uniqueGenerations.add(sk);
          }
        }
      });

      // Process IP records
      ipItems.forEach((item) => {
        const sk = item.SK as string;
        if (sk.startsWith("GEN#")) {
          const datePart = sk.split("#")[1];
          if (datePart && datePart >= startDate && datePart <= endDate) {
            uniqueGenerations.add(sk);
          }
        }
      });

      return uniqueGenerations.size;
    } catch (error) {
      console.error("Error counting distinct generations for user:", error);
      return 0; // On error, assume no generations to avoid blocking
    }
  }

  static async getUserByIdWithStats(
    userId: string
  ): Promise<UserEntity | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: "PROFILE",
        },
      })
    );

    return (result.Item as UserEntity) || null;
  }

  // ===================== NOTIFICATION FUNCTIONS =====================

  /**
   * Create a notification for a user interaction
   */
  static async createNotification(
    targetUserId: string,
    sourceUserId: string,
    notificationType: "like" | "comment" | "bookmark" | "follow",
    targetType: "album" | "media" | "comment" | "user",
    targetId: string
  ): Promise<void> {
    // Don't create notification if user is interacting with their own content
    if (targetUserId === sourceUserId) {
      return;
    }

    const notificationId = uuidv4();
    const now = new Date().toISOString();

    const notification: NotificationEntity = {
      PK: `NOTIFICATION#${notificationId}`,
      SK: "METADATA",
      GSI1PK: `USER#${targetUserId}#NOTIFICATIONS`,
      GSI1SK: `${now}#unread#${notificationId}`, // Sort by date, then status
      GSI2PK: `USER#${targetUserId}#NOTIFICATIONS#unread`,
      GSI2SK: `${now}#${notificationId}`, // For efficient unread counting
      EntityType: "Notification",
      notificationId,
      targetUserId,
      sourceUserId,
      notificationType,
      targetType,
      targetId,
      status: "unread",
      createdAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: notification,
      })
    );

    console.log(
      `📬 Created notification: ${notificationType} for ${targetUserId} from ${sourceUserId}`
    );
  }

  /**
   * Get notifications for a user (automatically marks them as read)
   */
  static async getNotificationsForUser(
    userId: string,
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    notifications: NotificationWithDetails[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `USER#${userId}#NOTIFICATIONS`,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));
    const notificationEntities = (result.Items || []) as NotificationEntity[];

    // Collect IDs for batch operations
    const unreadNotificationIds: string[] = [];
    const sourceUserIds = new Set<string>();
    const targetIds = new Map<string, { type: string; id: string }>();

    notificationEntities.forEach((notification) => {
      if (notification.status === "unread") {
        unreadNotificationIds.push(notification.notificationId);
      }
      sourceUserIds.add(notification.sourceUserId);
      targetIds.set(notification.targetId, {
        type: notification.targetType,
        id: notification.targetId,
      });
    });

    // Batch mark unread notifications as read
    if (unreadNotificationIds.length > 0) {
      await this.markNotificationsAsRead(userId, unreadNotificationIds);
    }

    // Fetch source usernames and target details in parallel
    const [sourceUsers, targetDetails] = await Promise.all([
      this.getUsersBatch([...sourceUserIds]),
      this.getTargetDetailsBatch([...targetIds.values()]),
    ]);

    // Enrich notifications with details
    const enrichedNotifications: NotificationWithDetails[] =
      notificationEntities.map((notification) => {
        const sourceUser = sourceUsers.find(
          (u) => u?.userId === notification.sourceUserId
        );
        const targetDetail = targetDetails.get(notification.targetId);

        const enriched: NotificationWithDetails = {
          notificationId: notification.notificationId,
          targetUserId: notification.targetUserId,
          sourceUserId: notification.sourceUserId,
          notificationType: notification.notificationType,
          targetType: notification.targetType,
          targetId: notification.targetId,
          status: notification.status,
          createdAt: notification.createdAt,
          readAt: notification.readAt || new Date().toISOString(),
          sourceUsername: sourceUser?.username,
          targetTitle: targetDetail?.title,
        };

        // Add comment target info if this is a comment notification
        if (
          notification.targetType === "comment" &&
          targetDetail?.commentTargetType &&
          targetDetail?.commentTargetId
        ) {
          enriched.commentTargetType = targetDetail.commentTargetType;
          enriched.commentTargetId = targetDetail.commentTargetId;
        }

        return enriched;
      });

    const response: {
      notifications: NotificationWithDetails[];
      lastEvaluatedKey?: Record<string, any>;
    } = {
      notifications: enrichedNotifications,
    };

    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = result.LastEvaluatedKey;
    }

    return response;
  }

  /**
   * Get unread notification count for a user
   */
  static async getUnreadNotificationCount(userId: string): Promise<number> {
    const params: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :gsi2pk",
      ExpressionAttributeValues: {
        ":gsi2pk": `USER#${userId}#NOTIFICATIONS#unread`,
      },
      Select: "COUNT",
    };

    const result = await docClient.send(new QueryCommand(params));
    return result.Count || 0;
  }

  /**
   * Mark multiple notifications as read
   */
  private static async markNotificationsAsRead(
    userId: string,
    notificationIds: string[]
  ): Promise<void> {
    const now = new Date().toISOString();
    const batchSize = 25; // DynamoDB limit

    for (let i = 0; i < notificationIds.length; i += batchSize) {
      const batch = notificationIds.slice(i, i + batchSize);
      const updateRequests = batch.map((notificationId) => ({
        Update: {
          TableName: TABLE_NAME,
          Key: {
            PK: `NOTIFICATION#${notificationId}`,
            SK: "METADATA",
          },
          UpdateExpression:
            "SET #status = :read, readAt = :readAt, GSI1SK = :gsi1sk, GSI2PK = :gsi2pk",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":read": "read",
            ":readAt": now,
            ":gsi1sk": `${now}#read#${notificationId}`,
            ":gsi2pk": `USER#${userId}#NOTIFICATIONS#read`,
          },
        },
      }));

      await docClient.send(
        new TransactWriteCommand({
          TransactItems: updateRequests,
        })
      );
    }

    console.log(
      `✅ Marked ${notificationIds.length} notifications as read for user ${userId}`
    );
  }

  /**
   * Get users by batch for enriching notifications
   */
  private static async getUsersBatch(
    userIds: string[]
  ): Promise<(UserEntity | null)[]> {
    if (userIds.length === 0) return [];

    const batchSize = 100; // DynamoDB BatchGet limit
    const allUsers: (UserEntity | null)[] = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const requestItems = batch.map((userId) => ({
        PK: `USER#${userId}`,
        SK: "METADATA",
      }));

      const result = await docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [TABLE_NAME]: {
              Keys: requestItems,
            },
          },
        })
      );

      const batchUsers = (result.Responses?.[TABLE_NAME] || []) as UserEntity[];

      // Maintain order and include nulls for missing users
      batch.forEach((userId) => {
        const user = batchUsers.find((u) => u.userId === userId);
        allUsers.push(user || null);
      });
    }

    return allUsers;
  }

  /**
   * Get target details (title, comment info) for notifications
   */
  private static async getTargetDetailsBatch(
    targets: { type: string; id: string }[]
  ): Promise<
    Map<
      string,
      {
        title?: string;
        commentTargetType?: "album" | "media";
        commentTargetId?: string;
      }
    >
  > {
    const details = new Map<
      string,
      {
        title?: string;
        commentTargetType?: "album" | "media";
        commentTargetId?: string;
      }
    >();

    if (targets.length === 0) return details;

    const batchSize = 100;
    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      const requestItems = batch
        .map((target) => {
          if (target.type === "album") {
            return { PK: `ALBUM#${target.id}`, SK: "METADATA" };
          } else if (target.type === "media") {
            return { PK: `MEDIA#${target.id}`, SK: "METADATA" };
          } else if (target.type === "comment") {
            return { PK: `COMMENT#${target.id}`, SK: "METADATA" };
          }
          return null;
        })
        .filter((item): item is { PK: string; SK: string } => item !== null);

      if (requestItems.length === 0) continue;

      const result = await docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [TABLE_NAME]: {
              Keys: requestItems,
            },
          },
        })
      );

      const items = result.Responses?.[TABLE_NAME] || [];

      items.forEach((item: any) => {
        let targetId: string | undefined;
        let title: string | undefined;
        let commentTargetType: "album" | "media" | undefined;
        let commentTargetId: string | undefined;

        if (item.EntityType === "Album") {
          targetId = item.id;
          title = item.title;
        } else if (item.EntityType === "Media") {
          targetId = item.id;
          title = item.originalFilename;
        } else if (item.EntityType === "Comment") {
          targetId = item.id; // Use comment id, not commentId
          title =
            item.content?.substring(0, 50) +
            (item.content?.length > 50 ? "..." : "");
          // Add comment target information
          commentTargetType = item.targetType as "album" | "media";
          commentTargetId = item.targetId;
        }

        if (targetId) {
          details.set(targetId, {
            title,
            ...(commentTargetType &&
              commentTargetId && {
                commentTargetType,
                commentTargetId,
              }),
          });
        }
      });
    }

    return details;
  }

  /**
   * Increments view count for current hour, day, week, and month
   * Creates dedicated view count entities that will be used by analytics
   */
  static async incrementViewCountForAnalytics(): Promise<void> {
    try {
      const now = new Date();

      // Calculate time boundaries for different granularities
      const currentHour = new Date(now);
      currentHour.setMinutes(0, 0, 0);

      const currentDay = new Date(now);
      currentDay.setHours(0, 0, 0, 0);

      const currentWeek = new Date(now);
      const dayOfWeek = currentWeek.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days since Monday
      currentWeek.setDate(currentWeek.getDate() - daysToMonday);
      currentWeek.setHours(0, 0, 0, 0);

      const currentMonth = new Date(now);
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      // Define the updates for each granularity
      const updates = [
        {
          pk: "VIEW_COUNT#hourly",
          sk: currentHour.toISOString(),
          timestamp: currentHour.toISOString(),
          granularity: "hourly" as const,
        },
        {
          pk: "VIEW_COUNT#daily",
          sk: currentDay.toISOString(),
          timestamp: currentDay.toISOString(),
          granularity: "daily" as const,
        },
        {
          pk: "VIEW_COUNT#weekly",
          sk: currentWeek.toISOString(),
          timestamp: currentWeek.toISOString(),
          granularity: "weekly" as const,
        },
        {
          pk: "VIEW_COUNT#monthly",
          sk: currentMonth.toISOString(),
          timestamp: currentMonth.toISOString(),
          granularity: "monthly" as const,
        },
      ];

      // Execute all updates in parallel
      const updatePromises = updates.map(async (update) => {
        try {
          await docClient.send(
            new UpdateCommand({
              TableName: TABLE_NAME,
              Key: {
                PK: update.pk,
                SK: update.sk,
              },
              UpdateExpression: `
                SET 
                  EntityType = if_not_exists(EntityType, :entityType),
                  granularity = if_not_exists(granularity, :granularity),
                  #timestamp = if_not_exists(#timestamp, :timestamp),
                  lastUpdated = :lastUpdated,
                  newViews = if_not_exists(newViews, :zero) + :increment,
                  createdAt = if_not_exists(createdAt, :createdAt)
              `,
              ExpressionAttributeNames: {
                "#timestamp": "timestamp", // timestamp is a reserved keyword
              },
              ExpressionAttributeValues: {
                ":entityType": "ViewCount",
                ":granularity": update.granularity,
                ":timestamp": update.timestamp,
                ":lastUpdated": now.toISOString(),
                ":zero": 0,
                ":increment": 1,
                ":createdAt": now.toISOString(),
              },
            })
          );

          console.log(
            `📈 Incremented view count for ${update.granularity}: ${update.sk}`
          );
        } catch (error) {
          console.error(
            `❌ Failed to increment view count for ${update.granularity}:`,
            error
          );
          // Don't throw - we want other updates to continue even if one fails
        }
      });

      await Promise.allSettled(updatePromises);

      console.log("✅ Successfully updated view counts for all granularities");
    } catch (error) {
      console.error("❌ Failed to increment view count:", error);
      // Don't throw - view tracking failure shouldn't break view tracking
    }
  }

  // ====================================
  // Generation Settings Methods
  // ====================================

  static async createGenerationSettings(
    settings: GenerationSettingsEntity
  ): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: settings,
      })
    );
  }

  static async createGenerationSettingsFromRequest(
    userId: string,
    requestBody: any
  ): Promise<void> {
    const settingsEntity: GenerationSettingsEntity = {
      PK: `GEN_SETTINGS#${userId}`,
      SK: "METADATA",
      EntityType: "GenerationSettings",
      userId: userId,
      imageSize: requestBody.imageSize || "512x512",
      customWidth: requestBody.customWidth || 512,
      customHeight: requestBody.customHeight || 512,
      batchCount: requestBody.batchCount || 1,
      isPublic:
        requestBody.isPublic !== undefined
          ? String(requestBody.isPublic)
          : "false",
      cfgScale: requestBody.cfgScale || 4.5,
      steps: requestBody.steps || 30,
      negativePrompt: requestBody.negativePrompt || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.createGenerationSettings(settingsEntity);
  }

  static async getGenerationSettings(
    userId: string
  ): Promise<GenerationSettingsEntity | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `GEN_SETTINGS#${userId}`,
          SK: "METADATA",
        },
      })
    );

    return (result.Item as GenerationSettingsEntity) || null;
  }

  // Follow relationship operations
  static async createFollowRelationship(
    followerId: string,
    followedId: string
  ): Promise<void> {
    const now = new Date().toISOString();

    const followEntity: FollowEntity = {
      PK: `FOLLOW#${followerId}#${followedId}`,
      SK: "METADATA",
      GSI1PK: `FOLLOWING#${followerId}`,
      GSI1SK: `${now}#${followedId}`,
      GSI2PK: `FOLLOWERS#${followedId}`,
      GSI2SK: `${now}#${followerId}`,
      EntityType: "Follow",
      followerId,
      followedId,
      createdAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: followEntity,
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
  }

  static async getFollowRelationship(
    followerId: string,
    followedId: string
  ): Promise<FollowEntity | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `FOLLOW#${followerId}#${followedId}`,
          SK: "METADATA",
        },
      })
    );

    return (result.Item as FollowEntity) || null;
  }

  static async deleteFollowRelationship(
    followerId: string,
    followedId: string
  ): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `FOLLOW#${followerId}#${followedId}`,
          SK: "METADATA",
        },
      })
    );
  }

  static async getUserFollowing(
    userId: string,
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    follows: FollowEntity[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": `FOLLOWING#${userId}`,
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const response: {
      follows: FollowEntity[];
      lastEvaluatedKey?: Record<string, any>;
    } = {
      follows: (result.Items as FollowEntity[]) || [],
    };

    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = result.LastEvaluatedKey;
    }

    return response;
  }

  static async getUserFollowers(
    userId: string,
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    follows: FollowEntity[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :gsi2pk",
        ExpressionAttributeValues: {
          ":gsi2pk": `FOLLOWERS#${userId}`,
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const response: {
      follows: FollowEntity[];
      lastEvaluatedKey?: Record<string, any>;
    } = {
      follows: (result.Items as FollowEntity[]) || [],
    };

    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = result.LastEvaluatedKey;
    }

    return response;
  }

  static async incrementUserFollowerCount(userId: string): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: "METADATA",
        },
        UpdateExpression: "ADD followerCount :increment",
        ExpressionAttributeValues: {
          ":increment": 1,
        },
      })
    );
  }

  static async decrementUserFollowerCount(userId: string): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: "METADATA",
        },
        UpdateExpression: "ADD followerCount :decrement",
        ExpressionAttributeValues: {
          ":decrement": -1,
        },
      })
    );
  }

  // ===== PornSpotCoin (PSC) Methods =====

  /**
   * Create a transaction record
   */
  static async createTransaction(
    transaction: TransactionEntity
  ): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: transaction,
      })
    );
  }

  /**
   * Get transaction by ID
   */
  static async getTransactionById(
    transactionId: string
  ): Promise<TransactionEntity | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `TRANSACTION#${transactionId}`,
          SK: "METADATA",
        },
      })
    );

    return (result.Item as TransactionEntity) || null;
  }

  /**
   * Update transaction
   */
  static async updateTransaction(
    transactionId: string,
    updates: Partial<TransactionEntity>
  ): Promise<void> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value], index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    });

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `TRANSACTION#${transactionId}`,
          SK: "METADATA",
        },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  }

  /**
   * Get transactions by user (to or from)
   */
  static async getTransactionsByUser(
    userId: string,
    limit: number = 20,
    exclusiveStartKey?: string,
    transactionType?: string,
    status?: string
  ): Promise<{
    items: TransactionEntity[];
    lastEvaluatedKey?: string;
    count: number;
  }> {
    const allTransactions: TransactionEntity[] = [];
    const lastKey: any = exclusiveStartKey
      ? JSON.parse(exclusiveStartKey)
      : undefined;

    // Build filter expression for optional parameters
    const filterExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};

    if (transactionType) {
      filterExpressions.push("transactionType = :transactionType");
      expressionAttributeValues[":transactionType"] = transactionType;
    }

    if (status) {
      filterExpressions.push("#status = :status");
      expressionAttributeValues[":status"] = status;
    }

    const filterExpression =
      filterExpressions.length > 0
        ? filterExpressions.join(" AND ")
        : undefined;
    const expressionAttributeNames = status
      ? { "#status": "status" }
      : undefined;

    // Query transactions where user is the recipient (GSI3)
    const toUserQuery = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI3",
        KeyConditionExpression:
          "GSI3PK = :gsi3pk AND begins_with(GSI3SK, :userPrefix)",
        ExpressionAttributeValues: {
          ":gsi3pk": "TRANSACTION_BY_TO_USER",
          ":userPrefix": `${userId}#`,
          ...expressionAttributeValues,
        },
        ...(filterExpression && { FilterExpression: filterExpression }),
        ...(expressionAttributeNames && {
          ExpressionAttributeNames: expressionAttributeNames,
        }),
        ScanIndexForward: false,
        Limit: Math.ceil(limit / 2), // Split limit between "to" and "from" queries
        ExclusiveStartKey: lastKey,
      })
    );

    const toUserTransactions = (toUserQuery.Items as TransactionEntity[]) || [];
    allTransactions.push(...toUserTransactions);

    // Query transactions where user is the sender (GSI2) - only if user is not "TREASURE"
    let fromUserTransactions: TransactionEntity[] = [];
    if (userId !== "TREASURE" && allTransactions.length < limit) {
      const fromUserQuery = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI2",
          KeyConditionExpression:
            "GSI2PK = :gsi2pk AND begins_with(GSI2SK, :userPrefix)",
          ExpressionAttributeValues: {
            ":gsi2pk": "TRANSACTION_BY_FROM_USER",
            ":userPrefix": `${userId}#`,
            ...expressionAttributeValues,
          },
          ...(filterExpression && { FilterExpression: filterExpression }),
          ...(expressionAttributeNames && {
            ExpressionAttributeNames: expressionAttributeNames,
          }),
          ScanIndexForward: false,
          Limit: limit - allTransactions.length,
        })
      );

      fromUserTransactions = (fromUserQuery.Items as TransactionEntity[]) || [];
      allTransactions.push(...fromUserTransactions);
    }

    // Sort by createdAt timestamp (most recent first)
    allTransactions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Limit to requested amount
    const finalTransactions = allTransactions.slice(0, limit);

    return {
      items: finalTransactions,
      lastEvaluatedKey: toUserQuery.LastEvaluatedKey
        ? JSON.stringify(toUserQuery.LastEvaluatedKey)
        : undefined,
      count: finalTransactions.length,
    };
  }

  /**
   * Get transactions by date range
   */
  static async getTransactionsByDateRange(
    startDate: string,
    endDate: string,
    limit: number = 100,
    exclusiveStartKey?: string
  ): Promise<{
    items: TransactionEntity[];
    lastEvaluatedKey?: string;
    count: number;
  }> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression:
          "GSI1PK = :gsi1pk AND GSI1SK BETWEEN :startDate AND :endDate",
        ExpressionAttributeValues: {
          ":gsi1pk": "TRANSACTION_BY_DATE",
          ":startDate": startDate,
          ":endDate": endDate,
        },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey
          ? JSON.parse(exclusiveStartKey)
          : undefined,
      })
    );

    return {
      items: (result.Items as TransactionEntity[]) || [],
      lastEvaluatedKey: result.LastEvaluatedKey
        ? JSON.stringify(result.LastEvaluatedKey)
        : undefined,
      count: result.Count || 0,
    };
  }

  /**
   * Get transactions by type
   */
  static async getTransactionsByType(
    transactionType: string,
    limit: number = 100,
    exclusiveStartKey?: string
  ): Promise<{
    items: TransactionEntity[];
    lastEvaluatedKey?: string;
    count: number;
  }> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI4",
        KeyConditionExpression: "GSI4PK = :gsi4pk",
        FilterExpression: "begins_with(GSI4SK, :typePrefix)",
        ExpressionAttributeValues: {
          ":gsi4pk": "TRANSACTION_BY_TYPE",
          ":typePrefix": `${transactionType}#`,
        },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey
          ? JSON.parse(exclusiveStartKey)
          : undefined,
      })
    );

    return {
      items: (result.Items as TransactionEntity[]) || [],
      lastEvaluatedKey: result.LastEvaluatedKey
        ? JSON.stringify(result.LastEvaluatedKey)
        : undefined,
      count: result.Count || 0,
    };
  }

  /**
   * Create daily budget entity
   */
  static async createDailyBudget(budget: DailyBudgetEntity): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: budget,
      })
    );
  }

  /**
   * Get daily budget by date
   */
  static async getBudgetByDate(
    date: string
  ): Promise<DailyBudgetEntity | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PSC_BUDGET#${date}`,
          SK: "METADATA",
        },
      })
    );

    return (result.Item as DailyBudgetEntity) || null;
  }

  /**
   * Update daily budget activity
   */
  static async updateDailyBudgetActivity(
    date: string,
    eventType: string,
    amount: number
  ): Promise<void> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {
      ":amount": amount,
      ":increment": 1,
      ":lastUpdated": new Date().toISOString(),
    };

    // Update the specific activity counter
    switch (eventType) {
      case "view":
        updateExpressions.push("ADD totalViews :increment");
        break;
      case "like":
        updateExpressions.push("ADD totalLikes :increment");
        break;
      case "comment":
        updateExpressions.push("ADD totalComments :increment");
        break;
      case "bookmark":
        updateExpressions.push("ADD totalBookmarks :increment");
        break;
      case "profile_view":
        updateExpressions.push("ADD totalProfileViews :increment");
        break;
    }

    // Update budget amounts
    updateExpressions.push("ADD distributedBudget :amount");
    updateExpressions.push("ADD remainingBudget :negativeAmount");
    updateExpressions.push("SET lastUpdated = :lastUpdated");

    expressionAttributeValues[":negativeAmount"] = -amount;

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PSC_BUDGET#${date}`,
          SK: "METADATA",
        },
        UpdateExpression: updateExpressions.join(", "),
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  }

  /**
   * Delete daily budget by date
   */
  static async deleteBudget(date: string): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PSC_BUDGET#${date}`,
          SK: "METADATA",
        },
      })
    );
  }

  /**
   * Get all transactions for admin view with filtering and pagination
   */
  static async getAdminTransactions(params: {
    limit?: number;
    lastEvaluatedKey?: Record<string, any>;
    type?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    userId?: string;
  }): Promise<{
    items: TransactionEntity[];
    lastEvaluatedKey?: Record<string, any>;
    count: number;
  }> {
    const {
      limit = 20,
      lastEvaluatedKey,
      type,
      status,
      dateFrom,
      dateTo,
      userId,
    } = params;

    // Build filter expression for optional parameters
    const filterExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {
      ":gsi1pk": "TRANSACTION_BY_DATE",
    };
    const expressionAttributeNames: Record<string, string> = {};

    if (type && type !== "all") {
      filterExpressions.push("transactionType = :transactionType");
      expressionAttributeValues[":transactionType"] = type;
    }

    if (status && status !== "all") {
      filterExpressions.push("#txStatus = :status");
      expressionAttributeValues[":status"] = status;
      expressionAttributeNames["#txStatus"] = "status";
    }

    if (userId) {
      filterExpressions.push(
        "(contains(fromUserId, :userId) OR contains(toUserId, :userId))"
      );
      expressionAttributeValues[":userId"] = userId;
    }

    // Date range filtering using GSI1SK if provided
    let keyConditionExpression = "GSI1PK = :gsi1pk";
    if (dateFrom && dateTo) {
      keyConditionExpression += " AND GSI1SK BETWEEN :dateFrom AND :dateTo";
      expressionAttributeValues[":dateFrom"] = dateFrom;
      expressionAttributeValues[":dateTo"] = `${dateTo}#ZZZZZZZZ`; // Ensure we capture all transactions on the end date
    } else if (dateFrom) {
      keyConditionExpression += " AND GSI1SK >= :dateFrom";
      expressionAttributeValues[":dateFrom"] = dateFrom;
    } else if (dateTo) {
      keyConditionExpression += " AND GSI1SK <= :dateTo";
      expressionAttributeValues[":dateTo"] = `${dateTo}#ZZZZZZZZ`;
    }

    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ScanIndexForward: false, // Most recent first
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(" AND ");
    }

    if (Object.keys(expressionAttributeNames).length > 0) {
      queryParams.ExpressionAttributeNames = expressionAttributeNames;
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    return {
      items: (result.Items as TransactionEntity[]) || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
      count: result.Count || 0,
    };
  }

  /**
   * Convert TransactionEntity to admin API format with username lookup
   */
  static async convertTransactionEntityToAdminFormat(
    transaction: TransactionEntity
  ): Promise<{
    id: string;
    userId: string;
    username: string;
    type: string;
    amount: number;
    status: string;
    timestamp: string;
    metadata?: Record<string, any>;
  }> {
    // For admin view, we typically want to show the user who initiated or benefited from the transaction
    // If it's a reward transaction, show the recipient (toUserId)
    // If it's a user-to-user transaction, show the sender (fromUserId)
    const relevantUserId =
      transaction.fromUserId === "TREASURE"
        ? transaction.toUserId
        : transaction.fromUserId;

    let username = "Unknown";
    if (relevantUserId !== "TREASURE") {
      try {
        const user = await this.getUserById(relevantUserId);
        username = user?.username || "Unknown";
      } catch (error) {
        console.warn(
          `Failed to get username for user ${relevantUserId}:`,
          error
        );
      }
    } else {
      username = "System";
    }

    return {
      id: transaction.transactionId,
      userId: relevantUserId,
      username,
      type: transaction.transactionType,
      amount: transaction.amount,
      status: transaction.status,
      timestamp: transaction.createdAt,
      metadata: transaction.metadata,
    };
  }

  // ===== PSC Configuration Methods =====

  /**
   * Get PSC system configuration
   */
  static async getPSCConfig(): Promise<PSCSystemConfig | null> {
    try {
      const result = await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: "PSC_CONFIG",
            SK: "SYSTEM",
          },
        })
      );

      if (!result.Item) {
        return null;
      }

      return result.Item as PSCSystemConfig;
    } catch (error) {
      console.error("Error getting PSC config:", error);
      throw error;
    }
  }

  /**
   * Save PSC system configuration
   */
  static async savePSCConfig(config: PSCSystemConfig): Promise<void> {
    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: "PSC_CONFIG",
            SK: "SYSTEM",
            EntityType: "PSCConfig",
            ...config,
            lastUpdated: new Date().toISOString(),
          },
        })
      );
    } catch (error) {
      console.error("Error saving PSC config:", error);
      throw error;
    }
  }

  /**
   * Get user view counter for PSC view tracking
   */
  static async getUserViewCounter(
    userId: string
  ): Promise<UserViewCounterEntity | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER_VIEW_COUNTER#${userId}`,
          SK: "METADATA",
        },
      })
    );

    return (result.Item as UserViewCounterEntity) || null;
  }

  /**
   * Create or update user view counter for PSC view tracking
   */
  static async updateUserViewCounter(
    userId: string,
    incrementMediaViews: boolean = false
  ): Promise<UserViewCounterEntity> {
    const now = new Date().toISOString();

    try {
      // Try to get existing counter
      const existing = await DynamoDBService.getUserViewCounter(userId);

      if (existing) {
        // Update existing counter
        let newMediaViewCount = existing.mediaViewCount;
        let newTotalMediaViews = existing.totalMediaViews;
        let lastPayoutAt = existing.lastPayoutAt;

        if (incrementMediaViews) {
          newMediaViewCount = (existing.mediaViewCount + 1) % 10; // Reset to 0 when reaching 10
          newTotalMediaViews = existing.totalMediaViews + 1;

          // If we just reset to 0, it means we hit 10 views
          if (newMediaViewCount === 0) {
            lastPayoutAt = now;
          }
        }

        const updatedCounter: UserViewCounterEntity = {
          ...existing,
          mediaViewCount: newMediaViewCount,
          totalMediaViews: newTotalMediaViews,
          lastViewAt: now,
          lastPayoutAt,
          lastUpdated: now,
        };

        await docClient.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: updatedCounter,
          })
        );

        return updatedCounter;
      } else {
        // Create new counter
        const newCounter: UserViewCounterEntity = {
          PK: `USER_VIEW_COUNTER#${userId}`,
          SK: "METADATA",
          EntityType: "UserViewCounter",
          userId,
          mediaViewCount: incrementMediaViews ? 1 : 0,
          totalMediaViews: incrementMediaViews ? 1 : 0,
          lastViewAt: now,
          lastPayoutAt: undefined,
          createdAt: now,
          lastUpdated: now,
        };

        await docClient.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: newCounter,
          })
        );

        return newCounter;
      }
    } catch (error) {
      console.error("Error updating user view counter:", error);
      throw error;
    }
  }
}
