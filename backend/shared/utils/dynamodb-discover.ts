import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { Album, Media } from "@shared/shared-types";
import { AlbumEntity, MediaEntity } from "@shared/shared-types";
import { DynamoDBService } from "./dynamodb";

// Initialize DynamoDB client
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

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const TABLE_NAME = process.env["DYNAMODB_TABLE"]!;

export class DynamoDBDiscoverService {
  /**
   * Query recent public albums using GSI7
   * GSI7PK: CONTENT, GSI7SK: {createdAt}
   */
  static async queryRecentAlbums(
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    albums: Album[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI7",
      KeyConditionExpression: "GSI7PK = :gsi7pk",
      FilterExpression: "EntityType = :entityType AND isPublic = :isPublic",
      ExpressionAttributeValues: {
        ":gsi7pk": "CONTENT",
        ":entityType": "Album",
        ":isPublic": "true",
      },
      ScanIndexForward: false, // Most recent first (descending by createdAt)
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));
    const albumEntities = (result.Items as AlbumEntity[]) || [];

    // Convert AlbumEntity to Album format
    const albums: Album[] = await Promise.all(
      albumEntities.map((entity) =>
        DynamoDBService.convertAlbumEntityToAlbum(entity)
      )
    );

    return {
      albums,
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  /**
   * Query recent public media using GSI7
   * GSI7PK: CONTENT, GSI7SK: {createdAt}
   */
  static async queryRecentMedia(
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    media: Media[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI7",
      KeyConditionExpression: "GSI7PK = :gsi7pk",
      FilterExpression: "EntityType = :entityType AND isPublic = :isPublic",
      ExpressionAttributeValues: {
        ":gsi7pk": "CONTENT",
        ":entityType": "Media",
        ":isPublic": "true",
      },
      ScanIndexForward: false, // Most recent first (descending by createdAt)
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));
    const mediaEntities = (result.Items as MediaEntity[]) || [];

    // Convert MediaEntity to Media format
    const media: Media[] = mediaEntities.map((entity) =>
      DynamoDBService.convertMediaEntityToMedia(entity)
    );

    return {
      media,
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  /**
   * Query popular public albums using GSI6
   * GSI6PK: POPULARITY, GSI6SK
   */
  static async queryPopularAlbums(
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    albums: Album[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI6",
      KeyConditionExpression: "GSI6PK = :gsi6pk",
      FilterExpression:
        "EntityType = :entityType AND isPublic = :isPublic AND mediaCount > :minMediaCount",
      ExpressionAttributeValues: {
        ":gsi6pk": "POPULARITY",
        ":entityType": "Album",
        ":isPublic": "true",
        ":minMediaCount": 0,
      },
      ScanIndexForward: false, // Highest popularity first (descending)
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));
    const albumEntities = (result.Items as AlbumEntity[]) || [];

    // Convert AlbumEntity to Album format
    const albums: Album[] = await Promise.all(
      albumEntities.map((entity) =>
        DynamoDBService.convertAlbumEntityToAlbum(entity)
      )
    );

    return {
      albums,
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  /**
   * Query popular public media using GSI6
   * GSI6PK: POPULARITY, GSI6SK: popularity score
   */
  static async queryPopularMedia(
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    media: Media[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI6",
      KeyConditionExpression: "GSI6PK = :gsi6pk",
      FilterExpression: "EntityType = :entityType AND isPublic = :isPublic",
      ExpressionAttributeValues: {
        ":gsi6pk": "POPULARITY",
        ":entityType": "Media",
        ":isPublic": "true",
      },
      ScanIndexForward: false, // Highest popularity first (descending)
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));
    const mediaEntities = (result.Items as MediaEntity[]) || [];

    // Convert MediaEntity to Media format
    const media: Media[] = mediaEntities.map((entity) =>
      DynamoDBService.convertMediaEntityToMedia(entity)
    );

    return {
      media,
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  /**
   * Query popular public albums with optional tag filtering using GSI6
   * GSI6PK: POPULARITY, GSI6SK: popularity score
   *
   * For tag filtering, this function first gets popular albums, then filters by tag
   * This approach is necessary because tags are stored in a separate GSI structure
   */
  static async queryPopularAlbumsViaGSI6(
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>,
    tag?: string
  ): Promise<{
    albums: Album[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    if (tag) {
      // For tag filtering with popularity sorting, we need to fetch more items
      // and then filter by tag, since we can't efficiently query both at once
      return this.queryPopularAlbumsWithTagFilter(limit, lastEvaluatedKey, tag);
    }

    // No tag filter, use the existing optimized query
    return this.queryPopularAlbums(limit, lastEvaluatedKey);
  }

  /**
   * Query popular public media with optional tag filtering using GSI6
   * GSI6PK: POPULARITY, GSI6SK: popularity score
   *
   * Note: Media items don't typically have tags in the current schema,
   * but this function is provided for consistency and future extensibility
   */
  static async queryPopularMediaViaGSI6(
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>,
    tag?: string
  ): Promise<{
    media: Media[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    if (tag) {
      // Media items don't typically have tags in current schema
      // Return empty result for now, but maintain consistent API
      console.log(
        `[DynamoDBDiscoverService] Tag filtering for media not supported: ${tag}`
      );
      return {
        media: [],
        lastEvaluatedKey: undefined,
      };
    }

    // No tag filter, use the existing optimized query
    return this.queryPopularMedia(limit, lastEvaluatedKey);
  }

  /**
   * Helper function to query popular albums and filter by tag
   * This is less efficient but necessary for tag + popularity combination
   */
  private static async queryPopularAlbumsWithTagFilter(
    limit: number,
    lastEvaluatedKey: Record<string, any> | undefined,
    tag: string
  ): Promise<{
    albums: Album[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const normalizedTag = tag.toLowerCase().trim();
    const fetchLimit = limit * 5; // Fetch more to account for tag filtering
    const allAlbums: Album[] = [];
    let currentLastEvaluatedKey = lastEvaluatedKey;
    let hasMoreItems = true;

    // Keep fetching until we have enough albums with the tag or exhaust results
    while (allAlbums.length < limit && hasMoreItems) {
      const batchResult = await this.queryPopularAlbums(
        fetchLimit,
        currentLastEvaluatedKey
      );

      // Filter albums by tag
      const taggedAlbums = batchResult.albums.filter((album) =>
        album.tags?.some(
          (albumTag) => albumTag.toLowerCase().trim() === normalizedTag
        )
      );

      allAlbums.push(...taggedAlbums);
      currentLastEvaluatedKey = batchResult.lastEvaluatedKey;
      hasMoreItems = !!batchResult.lastEvaluatedKey;

      // Prevent infinite loop by breaking if no albums found in this batch
      if (batchResult.albums.length === 0) {
        break;
      }
    }

    // Return only the requested number of albums
    const resultAlbums = allAlbums.slice(0, limit);

    // For pagination, we need to keep track of position in the filtered results
    // If we have fewer results than requested, we've exhausted the filtered data
    const resultLastEvaluatedKey =
      allAlbums.length > limit || hasMoreItems
        ? currentLastEvaluatedKey
        : undefined;

    return {
      albums: resultAlbums,
      lastEvaluatedKey: resultLastEvaluatedKey,
    };
  }

  /**
   * Alternative approach using GSI5 for content by type and public status
   * GSI5PK: MEDIA or ALBUM, GSI5SK: isPublic (string)
   * Filters out empty albums (albums with mediaCount = 0)
   */
  static async queryPublicAlbumsViaGSI5(
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    albums: Album[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI8",
      KeyConditionExpression:
        "GSI8PK = :gsi8pk AND begins_with(GSI8SK, :gsi8sk)",
      FilterExpression: "mediaCount > :minMediaCount",
      ExpressionAttributeValues: {
        ":gsi8pk": "VISIBILITY_UPDATED",
        ":gsi8sk": "true#",
        ":minMediaCount": 0,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));
    const albumEntities = (result.Items as AlbumEntity[]) || [];

    // Convert AlbumEntity to Album format
    const albums: Album[] = await Promise.all(
      albumEntities.map((entity) =>
        DynamoDBService.convertAlbumEntityToAlbum(entity)
      )
    );

    return {
      albums,
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  /**
   * Query public media using GSI5
   * GSI5PK: MEDIA, GSI5SK: isPublic (string)
   */
  static async queryPublicMediaViaGSI5(
    limit: number = 20,
    lastEvaluatedKey?: Record<string, any>
  ): Promise<{
    media: Media[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI5",
      KeyConditionExpression:
        "GSI5PK = :gsi5pk AND begins_with(GSI5SK, :gsi5sk)",
      ExpressionAttributeValues: {
        ":gsi5pk": "MEDIA",
        ":gsi5sk": "true",
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await docClient.send(new QueryCommand(queryParams));
    const mediaEntities = (result.Items as MediaEntity[]) || [];

    // Convert MediaEntity to Media format
    const media: Media[] = mediaEntities.map((entity) =>
      DynamoDBService.convertMediaEntityToMedia(entity)
    );

    return {
      media,
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  /**
   * Query public media by type (video or image) using GSI9
   * GSI9PK: RECENT_MEDIA_BY_TYPE, GSI9SK: {type}#{createdAt}#{mediaId}
   * Filters for public media only
   * Note: Uses pagination to handle DynamoDB's Limit-before-Filter behavior
   */
  static async queryPublicMediaByType(
    mediaType: "video" | "image",
    limit: number = 20,
    lastEvaluatedKey?: Record<string, unknown>
  ): Promise<{
    media: Media[];
    lastEvaluatedKey?: Record<string, unknown>;
  }> {
    const collectedMedia: Media[] = [];
    let currentLastKey = lastEvaluatedKey;
    let iterations = 0;
    const batchSize = 100;
    const maxIterations = Math.ceil(10000 / batchSize); // Scan up to 10,000 items

    // Keep fetching until we have enough items or run out of data
    while (collectedMedia.length < limit && iterations < maxIterations) {
      iterations++;

      const queryParams: QueryCommandInput = {
        TableName: TABLE_NAME,
        IndexName: "GSI9",
        KeyConditionExpression:
          "GSI9PK = :gsi9pk AND begins_with(GSI9SK, :gsi9sk)",
        FilterExpression: "isPublic = :isPublic",
        ExpressionAttributeValues: {
          ":gsi9pk": "RECENT_MEDIA_BY_TYPE",
          ":gsi9sk": `${mediaType}#`,
          ":isPublic": "true",
        },
        ScanIndexForward: false, // Most recent first
        Limit: batchSize,
        ExclusiveStartKey: currentLastKey,
      };

      const result = await docClient.send(new QueryCommand(queryParams));
      const mediaEntities = (result.Items as MediaEntity[]) || [];

      // Convert and add to collected items
      for (const entity of mediaEntities) {
        if (collectedMedia.length >= limit) break;
        collectedMedia.push(DynamoDBService.convertMediaEntityToMedia(entity));
      }

      currentLastKey = result.LastEvaluatedKey;

      // No more data to fetch
      if (!currentLastKey) break;
    }

    return {
      media: collectedMedia.slice(0, limit),
      lastEvaluatedKey: currentLastKey,
    };
  }

  /**
   * Query popular public media by type using GSI6 with type filter
   * GSI6PK: POPULARITY, GSI6SK: popularity score
   * Filters for public media of specific type only
   * Note: Uses pagination to handle DynamoDB's Limit-before-Filter behavior
   */
  static async queryPopularMediaByType(
    mediaType: "video" | "image",
    limit: number = 20,
    lastEvaluatedKey?: Record<string, unknown>
  ): Promise<{
    media: Media[];
    lastEvaluatedKey?: Record<string, unknown>;
  }> {
    const collectedMedia: Media[] = [];
    let currentLastKey = lastEvaluatedKey;
    let iterations = 0;
    const batchSize = 100;
    const maxIterations = Math.ceil(10000 / batchSize); // Scan up to 10,000 items

    // Keep fetching until we have enough items or run out of data
    while (collectedMedia.length < limit && iterations < maxIterations) {
      iterations++;
      
      const queryParams: QueryCommandInput = {
        TableName: TABLE_NAME,
        IndexName: "GSI6",
        KeyConditionExpression: "GSI6PK = :gsi6pk",
        FilterExpression: "EntityType = :entityType AND isPublic = :isPublic AND #mediaType = :mediaType",
        ExpressionAttributeNames: {
          "#mediaType": "type",
        },
        ExpressionAttributeValues: {
          ":gsi6pk": "POPULARITY",
          ":entityType": "Media",
          ":isPublic": "true",
          ":mediaType": mediaType,
        },
        ScanIndexForward: false, // Highest popularity first (descending)
        Limit: batchSize,
        ExclusiveStartKey: currentLastKey,
      };

      const result = await docClient.send(new QueryCommand(queryParams));
      const mediaEntities = (result.Items as MediaEntity[]) || [];

      // Convert and add to collected items
      for (const entity of mediaEntities) {
        if (collectedMedia.length >= limit) break;
        collectedMedia.push(DynamoDBService.convertMediaEntityToMedia(entity));
      }

      currentLastKey = result.LastEvaluatedKey;
      
      // No more data to fetch
      if (!currentLastKey) break;
    }

    return {
      media: collectedMedia.slice(0, limit),
      lastEvaluatedKey: currentLastKey,
    };
  }
}

/**
 * Content diversification utility
 * Ensures we don't return too much content from the same user
 * and mixes different types of content appropriately
 */
export class ContentDiversificationUtil {
  /**
   * Diversify content to avoid showing too much from the same user
   * @param items Array of albums or media
   * @param maxPerUser Maximum items per user
   * @returns Diversified array
   */
  static diversifyByUser<T extends { createdBy?: string }>(
    items: T[],
    maxPerUser: number = 2
  ): T[] {
    const userCounts = new Map<string, number>();
    const diversified: T[] = [];

    for (const item of items) {
      const userId = item.createdBy || "unknown";
      const count = userCounts.get(userId) || 0;

      if (count < maxPerUser) {
        diversified.push(item);
        userCounts.set(userId, count + 1);
      }
    }

    return diversified;
  }

  /**
   * Merge and shuffle multiple content streams
   * @param streams Array of content arrays
   * @param weights Weight for each stream (how many items to take in each round)
   * @param totalLimit Total items to return
   * @returns Merged and shuffled content
   */
  static mergeStreams<T>(
    streams: T[][],
    weights: number[],
    totalLimit: number
  ): T[] {
    const merged: T[] = [];
    const indices = new Array(streams.length).fill(0);

    while (merged.length < totalLimit) {
      let addedInRound = false;

      for (let i = 0; i < streams.length; i++) {
        const stream = streams[i];
        const weight = weights[i];
        const startIdx = indices[i] || 0;

        if (!stream || !weight) continue;

        // Take 'weight' items from this stream
        for (let j = 0; j < weight && merged.length < totalLimit; j++) {
          if (
            startIdx + j < stream.length &&
            stream[startIdx + j] !== undefined
          ) {
            merged.push(stream[startIdx + j]!);
            addedInRound = true;
          }
        }

        indices[i] = startIdx + weight;
      }

      // If no items were added in this round, we've exhausted all streams
      if (!addedInRound) {
        break;
      }
    }

    return merged;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   * @param array Array to shuffle
   * @returns Shuffled array
   */
  static shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      if (temp !== undefined && shuffled[j] !== undefined) {
        shuffled[i] = shuffled[j]!;
        shuffled[j] = temp;
      }
    }
    return shuffled;
  }

  /**
   * Apply soft randomization to maintain some order but add variety
   * @param array Array to randomize
   * @param windowSize Size of the window for randomization
   * @returns Soft-randomized array
   */
  static softRandomize<T>(array: T[], windowSize: number = 5): T[] {
    const result: T[] = [];
    const temp = [...array];

    while (temp.length > 0) {
      const window = temp.splice(0, Math.min(windowSize, temp.length));
      result.push(...this.shuffle(window));
    }

    return result;
  }
}
