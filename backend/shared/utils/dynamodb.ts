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
} from "@aws-sdk/lib-dynamodb";
import {
  Album,
  Media,
  AlbumEntity,
  MediaEntity,
  AlbumMediaEntity,
  CommentEntity,
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

interface DynamoDBQueryResult {
  Items?: Record<string, unknown>[];
  LastEvaluatedKey?: Record<string, unknown>;
  Count?: number;
  ScannedCount?: number;
}

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
    console.log("🔄 About to call DynamoDBService.listAlbums");
    console.log("📋 Using table name:", TABLE_NAME);
    console.log("🔍 Query parameters:", { limit, lastEvaluatedKey, tag });

    // Build query parameters
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

    // Add tag filtering if specified
    if (tag) {
      queryParams.FilterExpression = "contains(#tags, :tag)";
      queryParams.ExpressionAttributeNames = {
        "#tags": "tags",
      };
      queryParams.ExpressionAttributeValues![":tag"] = tag;
    }

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

    // Add tag filtering if specified
    if (tag) {
      queryParams.FilterExpression = "contains(#tags, :tag)";
      queryParams.ExpressionAttributeNames!["#tags"] = "tags";
      queryParams.ExpressionAttributeValues![":tag"] = tag;
    }

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

    // Add tag filtering if specified
    if (tag) {
      queryParams.FilterExpression = "contains(#tags, :tag)";
      queryParams.ExpressionAttributeNames!["#tags"] = "tags";
      queryParams.ExpressionAttributeValues![":tag"] = tag;
    }

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
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    media: MediaEntity[];
    nextKey?: Record<string, any>;
  }> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        FilterExpression: "createdBy = :userId",
        ExpressionAttributeValues: {
          ":gsi1pk": "MEDIA_BY_CREATOR",
          ":userId": userId,
        },
        Limit: limit,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
        ScanIndexForward: false, // newest first
      })
    );

    return {
      media: (result.Items as MediaEntity[]) || [],
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

  static async getAllPublicMedia(): Promise<Media[]> {
    // Get all public albums first
    const allMediaIds = new Set<string>();
    let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;

    do {
      const result: DynamoDBQueryResult = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "isPublic-createdAt-index",
          KeyConditionExpression: "#isPublic = :isPublic",
          ExpressionAttributeNames: {
            "#isPublic": "isPublic",
          },
          ExpressionAttributeValues: {
            ":isPublic": "true",
          },
          ScanIndexForward: false, // Most recent first
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      const publicAlbums = (result.Items as unknown as AlbumEntity[]) || [];

      // For each public album, get all its media IDs
      for (const album of publicAlbums) {
        let mediaLastKey: Record<string, unknown> | undefined = undefined;

        do {
          const mediaResult: DynamoDBQueryResult = await docClient.send(
            new QueryCommand({
              TableName: TABLE_NAME,
              KeyConditionExpression:
                "PK = :pk AND begins_with(SK, :sk_prefix)",
              ExpressionAttributeValues: {
                ":pk": `ALBUM#${album.id}`,
                ":sk_prefix": "MEDIA#",
              },
              ExclusiveStartKey: mediaLastKey,
            })
          );

          const albumMediaRelationships =
            (mediaResult.Items as unknown as AlbumMediaEntity[]) || [];
          albumMediaRelationships.forEach((rel) =>
            allMediaIds.add(rel.mediaId)
          );

          mediaLastKey = mediaResult.LastEvaluatedKey;
        } while (mediaLastKey);
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    // Now fetch all unique media records
    const mediaPromises = Array.from(allMediaIds).map((mediaId) =>
      this.getMedia(mediaId)
    );

    const mediaResults = await Promise.all(mediaPromises);
    return mediaResults.filter((media) => media !== null) as Media[];
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

  // User interaction operations
  static async createUserInteraction(
    interaction: UserInteractionEntity
  ): Promise<void> {
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
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    interactions: UserInteraction[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk_prefix)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":sk_prefix": `INTERACTION#${interactionType}#`,
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

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
      const userMediaResult = await this.getUserMedia(userId, 1000); // Get up to 1000 media items
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
}
