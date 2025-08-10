/**
 * Shared utilities for DynamoDB counter operations to reduce duplication
 */

interface DynamoDBClientConfig {
  endpoint?: string;
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export class CounterUtil {
  /**
   * Generic increment operation for any entity counter
   */
  private static async incrementCounter(
    pk: string,
    sk: string,
    counterField: string,
    increment: number = 1
  ): Promise<void> {
    const { DynamoDBDocumentClient, UpdateCommand } = await import("@aws-sdk/lib-dynamodb");
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    
    const isLocal = process.env["AWS_SAM_LOCAL"] === "true";
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

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: `ADD ${counterField} :inc`,
        ExpressionAttributeValues: {
          ":inc": increment,
        },
      })
    );
  }

  /**
   * Album counter operations
   */
  static async incrementAlbumLikeCount(
    albumId: string,
    increment: number = 1
  ): Promise<void> {
    await this.incrementCounter(
      `ALBUM#${albumId}`,
      "METADATA",
      "likeCount",
      increment
    );
  }

  static async incrementAlbumBookmarkCount(
    albumId: string,
    increment: number = 1
  ): Promise<void> {
    await this.incrementCounter(
      `ALBUM#${albumId}`,
      "METADATA",
      "bookmarkCount",
      increment
    );
  }

  static async incrementAlbumViewCount(
    albumId: string,
    increment: number = 1
  ): Promise<void> {
    await this.incrementCounter(
      `ALBUM#${albumId}`,
      "METADATA",
      "viewCount",
      increment
    );
  }

  static async incrementAlbumCommentCount(
    albumId: string,
    increment: number = 1
  ): Promise<void> {
    await this.incrementCounter(
      `ALBUM#${albumId}`,
      "METADATA",
      "commentCount",
      increment
    );
  }

  static async incrementAlbumMediaCount(
    albumId: string,
    increment: number = 1
  ): Promise<void> {
    const { DynamoDBDocumentClient, UpdateCommand } = await import("@aws-sdk/lib-dynamodb");
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    
    const isLocal = process.env["AWS_SAM_LOCAL"] === "true";
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

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `ALBUM#${albumId}`, SK: "METADATA" },
        UpdateExpression: "ADD mediaCount :inc SET updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":inc": increment,
          ":updatedAt": new Date().toISOString(),
        },
      })
    );
  }

  /**
   * Media counter operations
   */
  static async incrementMediaLikeCount(
    mediaId: string,
    increment: number = 1
  ): Promise<void> {
    await this.incrementCounter(
      `MEDIA#${mediaId}`,
      "METADATA",
      "likeCount",
      increment
    );
  }

  static async incrementMediaBookmarkCount(
    mediaId: string,
    increment: number = 1
  ): Promise<void> {
    await this.incrementCounter(
      `MEDIA#${mediaId}`,
      "METADATA",
      "bookmarkCount",
      increment
    );
  }

  static async incrementMediaViewCount(
    mediaId: string,
    increment: number = 1
  ): Promise<void> {
    await this.incrementCounter(
      `MEDIA#${mediaId}`,
      "METADATA",
      "viewCount",
      increment
    );
  }

  static async incrementMediaCommentCount(
    mediaId: string,
    increment: number = 1
  ): Promise<void> {
    await this.incrementCounter(
      `MEDIA#${mediaId}`,
      "METADATA",
      "commentCount",
      increment
    );
  }

  /**
   * Comment counter operations
   */
  static async incrementCommentLikeCount(
    commentId: string,
    increment: number = 1
  ): Promise<void> {
    await this.incrementCounter(
      `COMMENT#${commentId}`,
      "METADATA",
      "likeCount",
      increment
    );
  }

  /**
   * Convenience methods for decrementing (negative increment)
   */
  static async decrementAlbumLikeCount(albumId: string): Promise<void> {
    await this.incrementAlbumLikeCount(albumId, -1);
  }

  static async decrementAlbumBookmarkCount(albumId: string): Promise<void> {
    await this.incrementAlbumBookmarkCount(albumId, -1);
  }

  static async decrementAlbumMediaCount(albumId: string): Promise<void> {
    await this.incrementAlbumMediaCount(albumId, -1);
  }

  static async decrementMediaLikeCount(mediaId: string): Promise<void> {
    await this.incrementMediaLikeCount(mediaId, -1);
  }

  static async decrementMediaBookmarkCount(mediaId: string): Promise<void> {
    await this.incrementMediaBookmarkCount(mediaId, -1);
  }

  /**
   * Bulk counter operations for multiple items
   */
  static async incrementMultipleCounters(
    operations: Array<{
      entityType: "album" | "media" | "comment";
      entityId: string;
      counterType: "like" | "bookmark" | "view" | "comment" | "media";
      increment: number;
    }>
  ): Promise<void> {
    const promises = operations.map(async (op) => {
      switch (op.entityType) {
        case "album":
          switch (op.counterType) {
            case "like":
              return this.incrementAlbumLikeCount(op.entityId, op.increment);
            case "bookmark":
              return this.incrementAlbumBookmarkCount(op.entityId, op.increment);
            case "view":
              return this.incrementAlbumViewCount(op.entityId, op.increment);
            case "comment":
              return this.incrementAlbumCommentCount(op.entityId, op.increment);
            case "media":
              return this.incrementAlbumMediaCount(op.entityId, op.increment);
          }
          break;
        case "media":
          switch (op.counterType) {
            case "like":
              return this.incrementMediaLikeCount(op.entityId, op.increment);
            case "bookmark":
              return this.incrementMediaBookmarkCount(op.entityId, op.increment);
            case "view":
              return this.incrementMediaViewCount(op.entityId, op.increment);
            case "comment":
              return this.incrementMediaCommentCount(op.entityId, op.increment);
          }
          break;
        case "comment":
          if (op.counterType === "like") {
            return this.incrementCommentLikeCount(op.entityId, op.increment);
          }
          break;
      }
    });

    await Promise.all(promises);
  }
}