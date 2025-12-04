/**
 * Following Feed Service for PornSpot.ai
 *
 * This service implements the complex following feed aggregation strategy:
 * 1. Get all users followed by the requesting user
 * 2. Find the most recent content date for each followed user
 * 3. Sort followed users by their most recent content activity
 * 4. Aggregate content from followed users in time windows
 * 5. Implement custom cursor pagination based on lastContentDate
 *
 * @fileoverview Following feed aggregation service
 * @author PornSpot.ai Development Team
 */

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

/**
 * Interface for followed user activity metadata
 */
interface FollowedUserActivity {
  userId: string;
  mostRecentContentDate: string | null;
  mostRecentAlbumDate: string | null;
  mostRecentMediaDate: string | null;
}

/**
 * Interface for content within a time window
 */
interface TimeWindowContent {
  albums: Album[];
  media: Media[];
  fromDate: string;
  toDate: string;
  userId: string;
}

/**
 * Interface for following feed cursor
 */
interface FollowingFeedCursor {
  lastContentDate: string;
  type: "following"; // Distinguish from other cursor types
}

/**
 * Interface for following feed result
 */
interface FollowingFeedResult {
  items: (Album | Media)[];
  cursor: string | null;
  metadata: {
    totalItems: number;
    albumCount: number;
    mediaCount: number;
    followedUsersProcessed: number;
    timeWindow: string;
  };
}

export class FollowingFeedService {
  /**
   * Get the most recent content date for a specific user
   * Checks both albums and media to find the latest creation date
   * If lastContentDate is provided, only returns content older than that date
   */
  static async getUserMostRecentContentDate(
    userId: string,
    lastContentDate?: string
  ): Promise<{
    mostRecentDate: string | null;
    mostRecentAlbumDate: string | null;
    mostRecentMediaDate: string | null;
  }> {
    console.log(
      `[FollowingFeed] Getting most recent content date for user: ${userId}${
        lastContentDate ? ` (older than ${lastContentDate})` : ""
      }`
    );

    // Query user's most recent album (limit 1, most recent first)
    const recentAlbumQuery: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI4", // GSI4 for albums by creator
      KeyConditionExpression: lastContentDate
        ? "GSI4PK = :gsi4pk AND GSI4SK BETWEEN :minKey AND :maxKey"
        : "GSI4PK = :gsi4pk AND begins_with(GSI4SK, :userPrefix)",
      ExpressionAttributeValues: {
        ":gsi4pk": "ALBUM_BY_CREATOR",
        ...(!lastContentDate && { ":userPrefix": `${userId}#` }),
        ...(lastContentDate && {
          ":minKey": `${userId}#`,
          ":maxKey": `${userId}#${lastContentDate}`,
        }),
      },
      ScanIndexForward: false, // Most recent first
      Limit: 1,
    };

    // Query user's most recent media (limit 1, most recent first)
    const recentMediaQuery: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI1", // GSI1 for media by creator
      KeyConditionExpression: lastContentDate
        ? "GSI1PK = :gsi1pk AND GSI1SK BETWEEN :minKey AND :maxKey"
        : "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :userPrefix)",
      ExpressionAttributeValues: {
        ":gsi1pk": "MEDIA_BY_CREATOR",
        ...(!lastContentDate && { ":userPrefix": `${userId}#` }),
        ...(lastContentDate && {
          ":minKey": `${userId}#`,
          ":maxKey": `${userId}#${lastContentDate}`,
        }),
      },
      ScanIndexForward: false, // Most recent first
      Limit: 1,
    };

    const [albumResult, mediaResult] = await Promise.all([
      docClient.send(new QueryCommand(recentAlbumQuery)),
      docClient.send(new QueryCommand(recentMediaQuery)),
    ]);

    const mostRecentAlbum = albumResult.Items?.[0] as AlbumEntity | undefined;
    const mostRecentMedia = mediaResult.Items?.[0] as MediaEntity | undefined;

    const mostRecentAlbumDate = mostRecentAlbum?.createdAt || null;
    const mostRecentMediaDate = mostRecentMedia?.createdAt || null;

    // Find the most recent between albums and media
    let mostRecentDate: string | null = null;
    if (mostRecentAlbumDate && mostRecentMediaDate) {
      mostRecentDate =
        mostRecentAlbumDate > mostRecentMediaDate
          ? mostRecentAlbumDate
          : mostRecentMediaDate;
    } else if (mostRecentAlbumDate) {
      mostRecentDate = mostRecentAlbumDate;
    } else if (mostRecentMediaDate) {
      mostRecentDate = mostRecentMediaDate;
    }

    console.log(`[FollowingFeed] User ${userId} most recent dates:`, {
      mostRecentDate,
      mostRecentAlbumDate,
      mostRecentMediaDate,
    });

    return {
      mostRecentDate,
      mostRecentAlbumDate,
      mostRecentMediaDate,
    };
  }

  /**
   * Get content from a user within a specific time window
   * Returns both albums and media created between fromDate and toDate
   */
  static async getContentInTimeWindow(
    userId: string,
    fromDate: string,
    toDate: string,
    limit: number = 50
  ): Promise<TimeWindowContent> {
    console.log(
      `[FollowingFeed] Getting content for user ${userId} between ${fromDate} and ${toDate}`
    );

    // Get albums in time window
    const albumQuery: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI4",
      KeyConditionExpression:
        "GSI4PK = :gsi4pk AND GSI4SK BETWEEN :fromKey AND :toKey",
      FilterExpression: "isPublic = :isPublic", // Only public content
      ExpressionAttributeValues: {
        ":gsi4pk": "ALBUM_BY_CREATOR",
        ":fromKey": `${userId}#${fromDate}#`,
        ":toKey": `${userId}#${toDate}#ZZZZZZ`, // ZZZZZZ ensures we catch all within the date range
        ":isPublic": "true",
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit, // Split limit between albums and media
    };

    // Get media in time window
    const mediaQuery: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression:
        "GSI1PK = :gsi1pk AND GSI1SK BETWEEN :fromKey AND :toKey",
      FilterExpression: "isPublic = :isPublic", // Only public content
      ExpressionAttributeValues: {
        ":gsi1pk": "MEDIA_BY_CREATOR",
        ":fromKey": `${userId}#${fromDate}#`,
        ":toKey": `${userId}#${toDate}#ZZZZZZ`,
        ":isPublic": "true",
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    };

    const [albumResult, mediaResult] = await Promise.all([
      docClient.send(new QueryCommand(albumQuery)),
      docClient.send(new QueryCommand(mediaQuery)),
    ]);

    const albumEntities = (albumResult.Items as AlbumEntity[]) || [];
    const mediaEntities = (mediaResult.Items as MediaEntity[]) || [];

    // Convert entities to domain objects
    const albums: Album[] = await Promise.all(
      albumEntities.map((entity) =>
        DynamoDBService.convertAlbumEntityToAlbum(entity)
      )
    );

    const media: Media[] = mediaEntities.map((entity) =>
      DynamoDBService.convertMediaEntityToMedia(entity)
    );

    console.log(
      `[FollowingFeed] Found ${albums.length} albums and ${media.length} media for user ${userId} in time window`
    );

    return {
      albums,
      media,
      fromDate,
      toDate,
      userId,
    };
  }

  /**
   * Generate the following feed for a user
   * Implements the complex aggregation strategy described in the user's requirements
   */
  static async generateFollowingFeed(
    currentUserId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<FollowingFeedResult> {
    console.log(
      `[FollowingFeed] Generating feed for user: ${currentUserId}, limit: ${limit}`
    );

    // Parse cursor if provided
    let lastContentDate: string | null = null;
    if (cursor) {
      try {
        const decodedCursor = JSON.parse(
          Buffer.from(cursor, "base64").toString()
        ) as FollowingFeedCursor;
        lastContentDate = decodedCursor.lastContentDate;
        console.log(
          `[FollowingFeed] Continuing from cursor date: ${lastContentDate}`
        );
      } catch (error) {
        console.warn(
          "[FollowingFeed] Invalid cursor, starting from beginning:",
          error
        );
      }
    }

    // Step 1: Get all users followed by the current user
    console.log("[FollowingFeed] Step 1: Getting followed users");
    const followingResult = await DynamoDBService.getUserFollowing(
      currentUserId,
      1000 // Get up to 1000 followed users - this should cover most cases
    );

    if (followingResult.follows.length === 0) {
      console.log("[FollowingFeed] User follows no one, returning empty feed");
      return {
        items: [],
        cursor: null,
        metadata: {
          totalItems: 0,
          albumCount: 0,
          mediaCount: 0,
          followedUsersProcessed: 0,
          timeWindow: "empty",
        },
      };
    }

    console.log(
      `[FollowingFeed] Found ${followingResult.follows.length} followed users`
    );

    // Step 2: Get most recent content date for each followed user
    console.log("[FollowingFeed] Step 2: Getting most recent content dates");
    const followedUsersActivity: FollowedUserActivity[] = [];

    for (const follow of followingResult.follows) {
      const contentDates = await this.getUserMostRecentContentDate(
        follow.followedId,
        lastContentDate ?? undefined
      );

      followedUsersActivity.push({
        userId: follow.followedId,
        mostRecentContentDate: contentDates.mostRecentDate,
        mostRecentAlbumDate: contentDates.mostRecentAlbumDate,
        mostRecentMediaDate: contentDates.mostRecentMediaDate,
      });
    }

    // Step 3: Sort followed users by most recent content activity
    const activeFollowedUsers = followedUsersActivity
      .filter((user) => user.mostRecentContentDate !== null)
      .sort((a, b) => {
        // Sort by most recent content date (descending)
        return b.mostRecentContentDate!.localeCompare(a.mostRecentContentDate!);
      });

    console.log(
      `[FollowingFeed] Found ${activeFollowedUsers.length} active followed users with content`
    );

    if (activeFollowedUsers.length === 0) {
      console.log(
        "[FollowingFeed] No followed users have content, returning empty feed"
      );
      return {
        items: [],
        cursor: null,
        metadata: {
          totalItems: 0,
          albumCount: 0,
          mediaCount: 0,
          followedUsersProcessed: 0,
          timeWindow: "no-content",
        },
      };
    }

    // Step 4: Aggregate content using time windows
    console.log("[FollowingFeed] Step 4: Aggregating content in time windows");
    const aggregatedItems: (Album | Media)[] = [];
    let processedUsers = 0;
    let currentItemDate: string | null = null;

    // If we have a cursor, start from the appropriate position
    let startIndex = 0;
    if (lastContentDate) {
      // Find the first user whose content might be older than our cursor
      startIndex = activeFollowedUsers.findIndex(
        (user) => user.mostRecentContentDate! <= lastContentDate!
      );
      if (startIndex === -1) {
        startIndex = activeFollowedUsers.length; // All users processed
      }
    }

    for (
      let i = startIndex;
      i < activeFollowedUsers.length && aggregatedItems.length < limit;
      i++
    ) {
      const currentUser = activeFollowedUsers[i] as FollowedUserActivity;
      const nextUser = activeFollowedUsers[i + 1];

      processedUsers++;

      // Determine time window: from nextUser's most recent date to current user's most recent date
      const toDate = currentUser?.mostRecentContentDate!;
      let fromDate: string;

      if (nextUser) {
        fromDate = nextUser.mostRecentContentDate!;
      } else {
        // For the last user, go back 30 days from their most recent content
        const thirtyDaysAgo = new Date(
          new Date(toDate).getTime() - 30 * 24 * 60 * 60 * 1000
        );
        fromDate = thirtyDaysAgo.toISOString();
      }

      // If we have a cursor and this is the first user, adjust the toDate
      if (lastContentDate && i === startIndex) {
        // Only get content older than the cursor date
        if (toDate > lastContentDate) {
          continue; // Skip this user as we've already processed their newer content
        }
      }

      console.log(
        `[FollowingFeed] Processing user: ${currentUser?.userId} from ${fromDate} to ${toDate}`
      );

      // Get content in this time window
      const timeWindowContent = await this.getContentInTimeWindow(
        currentUser?.userId,
        fromDate,
        toDate,
        limit - aggregatedItems.length
      );

      // Combine and sort albums and media by creation date
      const userItems: (Album | Media)[] = [
        ...timeWindowContent.albums,
        ...timeWindowContent.media,
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      // Add items until we reach the limit or run out
      for (const item of userItems) {
        if (aggregatedItems.length >= limit) {
          break;
        }

        // If we have a cursor, only include items older than the cursor date
        if (lastContentDate && item.createdAt > lastContentDate) {
          continue;
        }

        aggregatedItems.push(item);
        currentItemDate = item.createdAt;
      }

      // Stop if we've reached the limit
      if (aggregatedItems.length >= limit) {
        break;
      }
    }

    // If we haven't reached the limit, try to get more content by updating user dates
    while (aggregatedItems.length < limit && activeFollowedUsers.length > 0) {
      console.log(
        `[FollowingFeed] Need more content. Current: ${aggregatedItems.length}/${limit}. Looking for older content.`
      );

      // Get the oldest item we've collected so far to use as the new threshold
      const oldestCollectedItem = aggregatedItems[aggregatedItems.length - 1];
      if (!oldestCollectedItem) {
        break;
      }

      // Update all followed users' most recent content dates to get older content
      const updatedFollowedUsers: FollowedUserActivity[] = [];

      for (const user of activeFollowedUsers) {
        const updatedContentDates = await this.getUserMostRecentContentDate(
          user.userId,
          oldestCollectedItem.createdAt
        );

        if (updatedContentDates.mostRecentDate) {
          updatedFollowedUsers.push({
            userId: user.userId,
            mostRecentContentDate: updatedContentDates.mostRecentDate,
            mostRecentAlbumDate: updatedContentDates.mostRecentAlbumDate,
            mostRecentMediaDate: updatedContentDates.mostRecentMediaDate,
          });
        }
      }

      // If no users have older content, break
      if (updatedFollowedUsers.length === 0) {
        console.log(
          "[FollowingFeed] No more older content available from any followed users."
        );
        break;
      }

      // Re-sort by most recent content date and update our active list
      activeFollowedUsers.length = 0; // Clear the array
      activeFollowedUsers.push(
        ...updatedFollowedUsers.sort((a, b) => {
          return b.mostRecentContentDate!.localeCompare(
            a.mostRecentContentDate!
          );
        })
      );

      console.log(
        `[FollowingFeed] Updated followed users list. Found ${activeFollowedUsers.length} users with older content.`
      );

      // Process the next time window with updated user dates
      for (
        let i = 0;
        i < activeFollowedUsers.length && aggregatedItems.length < limit;
        i++
      ) {
        const currentUser = activeFollowedUsers[i] as FollowedUserActivity;
        const nextUser = activeFollowedUsers[i + 1];

        processedUsers++;

        // Determine time window: from nextUser's most recent date to current user's most recent date
        const toDate = currentUser?.mostRecentContentDate!;
        let fromDate: string;

        if (nextUser) {
          fromDate = nextUser.mostRecentContentDate!;
        } else {
          // For the last user, go back 30 days from their most recent content
          const thirtyDaysAgo = new Date(
            new Date(toDate).getTime() - 30 * 24 * 60 * 60 * 1000
          );
          fromDate = thirtyDaysAgo.toISOString();
        }

        console.log(
          `[FollowingFeed] Processing user: ${currentUser?.userId} from ${fromDate} to ${toDate}`
        );

        // Get content in this time window
        const timeWindowContent = await this.getContentInTimeWindow(
          currentUser?.userId,
          fromDate,
          toDate,
          limit - aggregatedItems.length
        );

        // Combine and sort albums and media by creation date
        const userItems: (Album | Media)[] = [
          ...timeWindowContent.albums,
          ...timeWindowContent.media,
        ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        // Add items until we reach the limit or run out
        for (const item of userItems) {
          if (aggregatedItems.length >= limit) {
            break;
          }

          aggregatedItems.push(item);
          currentItemDate = item.createdAt;
        }

        // Stop if we've reached the limit
        if (aggregatedItems.length >= limit) {
          break;
        }
      }
    }

    // Step 5: Create cursor for next page
    let nextCursor: string | null = null;
    if (aggregatedItems.length === limit && currentItemDate) {
      const cursorData: FollowingFeedCursor = {
        lastContentDate: currentItemDate,
        type: "following",
      };
      nextCursor = Buffer.from(JSON.stringify(cursorData)).toString("base64");
    }

    // Add content preview for albums
    const itemsWithPreview = await Promise.all(
      aggregatedItems.map(async (item) => {
        if ("mediaCount" in item) {
          // This is an album
          return {
            ...item,
            contentPreview:
              (await DynamoDBService.getContentPreviewForAlbum(item.id)) ||
              null,
          };
        }
        return item; // This is media, return as-is
      })
    );

    // Count types
    const albumCount = itemsWithPreview.filter(
      (item) => "mediaCount" in item
    ).length;
    const mediaCount = itemsWithPreview.filter(
      (item) => "url" in item && !("mediaCount" in item)
    ).length;

    const result: FollowingFeedResult = {
      items: itemsWithPreview,
      cursor: nextCursor,
      metadata: {
        totalItems: itemsWithPreview.length,
        albumCount,
        mediaCount,
        followedUsersProcessed: processedUsers,
        timeWindow: lastContentDate ? `since-${lastContentDate}` : "recent",
      },
    };

    console.log("[FollowingFeed] Generated feed:", {
      totalItems: result.metadata.totalItems,
      albumCount: result.metadata.albumCount,
      mediaCount: result.metadata.mediaCount,
      followedUsersProcessed: result.metadata.followedUsersProcessed,
      hasMorePages: !!nextCursor,
    });

    return result;
  }

  /**
   * Generate the following feed filtered by media type (video or image only)
   * Used for the separate VideoRow in the discover page
   */
  static async generateFollowingFeedByMediaType(
    currentUserId: string,
    mediaType: "video" | "image",
    limit: number = 10,
    cursor?: string
  ): Promise<{
    items: Media[];
    cursor: string | null;
    metadata: {
      totalItems: number;
      followedUsersProcessed: number;
      timeWindow: string;
    };
  }> {
    console.log(
      `[FollowingFeed] Generating ${mediaType} feed for user: ${currentUserId}, limit: ${limit}`
    );

    // Parse cursor if provided
    let lastContentDate: string | null = null;
    if (cursor) {
      try {
        const decodedCursor = JSON.parse(
          Buffer.from(cursor, "base64").toString()
        ) as FollowingFeedCursor;
        lastContentDate = decodedCursor.lastContentDate;
        console.log(
          `[FollowingFeed] Continuing from cursor date: ${lastContentDate}`
        );
      } catch (error) {
        console.warn(
          "[FollowingFeed] Invalid cursor, starting from beginning:",
          error
        );
      }
    }

    // Step 1: Get all users followed by the current user
    const followingResult = await DynamoDBService.getUserFollowing(
      currentUserId,
      1000
    );

    if (followingResult.follows.length === 0) {
      console.log(`[FollowingFeed] User follows no one, returning empty ${mediaType} feed`);
      return {
        items: [],
        cursor: null,
        metadata: {
          totalItems: 0,
          followedUsersProcessed: 0,
          timeWindow: "empty",
        },
      };
    }

    // Step 2: Get most recent media dates for each followed user
    const followedUsersActivity: FollowedUserActivity[] = [];

    for (const follow of followingResult.follows) {
      const contentDates = await this.getUserMostRecentContentDate(
        follow.followedId,
        lastContentDate ?? undefined
      );

      followedUsersActivity.push({
        userId: follow.followedId,
        mostRecentContentDate: contentDates.mostRecentMediaDate, // Only look at media, not albums
        mostRecentAlbumDate: null,
        mostRecentMediaDate: contentDates.mostRecentMediaDate,
      });
    }

    // Step 3: Sort by most recent media activity
    const activeFollowedUsers = followedUsersActivity
      .filter((user) => user.mostRecentContentDate !== null)
      .sort((a, b) => {
        return b.mostRecentContentDate!.localeCompare(a.mostRecentContentDate!);
      });

    if (activeFollowedUsers.length === 0) {
      console.log(
        `[FollowingFeed] No followed users have ${mediaType} content`
      );
      return {
        items: [],
        cursor: null,
        metadata: {
          totalItems: 0,
          followedUsersProcessed: 0,
          timeWindow: "no-content",
        },
      };
    }

    // Step 4: Aggregate media content filtered by type
    const aggregatedItems: Media[] = [];
    let processedUsers = 0;
    let currentItemDate: string | null = null;

    let startIndex = 0;
    if (lastContentDate) {
      startIndex = activeFollowedUsers.findIndex(
        (user) => user.mostRecentContentDate! <= lastContentDate!
      );
      if (startIndex === -1) {
        startIndex = activeFollowedUsers.length;
      }
    }

    for (
      let i = startIndex;
      i < activeFollowedUsers.length && aggregatedItems.length < limit;
      i++
    ) {
      const currentUser = activeFollowedUsers[i];
      if (!currentUser) continue;
      processedUsers++;

      // Build time window for this user
      const toDate =
        currentUser.mostRecentContentDate || new Date().toISOString();
      const fromDate = new Date(0).toISOString(); // Epoch, will be limited by query

      // Get media in this time window
      const timeWindowContent = await this.getContentInTimeWindow(
        currentUser.userId,
        fromDate,
        toDate,
        (limit - aggregatedItems.length) * 3 // Fetch extra to filter by type
      );

      // Filter by media type
      const filteredMedia = timeWindowContent.media.filter(
        (m) => m.type === mediaType
      );

      // Sort by creation date
      const sortedMedia = filteredMedia.sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );

      // Add items until we reach the limit
      for (const item of sortedMedia) {
        if (aggregatedItems.length >= limit) {
          break;
        }
        aggregatedItems.push(item);
        currentItemDate = item.createdAt;
      }
    }

    // Step 5: Create cursor for next page
    let nextCursor: string | null = null;
    if (aggregatedItems.length === limit && currentItemDate) {
      const cursorData: FollowingFeedCursor = {
        lastContentDate: currentItemDate,
        type: "following",
      };
      nextCursor = Buffer.from(JSON.stringify(cursorData)).toString("base64");
    }

    console.log(`[FollowingFeed] Generated ${mediaType} feed:`, {
      totalItems: aggregatedItems.length,
      followedUsersProcessed: processedUsers,
      hasMorePages: !!nextCursor,
    });

    return {
      items: aggregatedItems,
      cursor: nextCursor,
      metadata: {
        totalItems: aggregatedItems.length,
        followedUsersProcessed: processedUsers,
        timeWindow: lastContentDate ? `since-${lastContentDate}` : "recent",
      },
    };
  }
}
