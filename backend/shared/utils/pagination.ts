/**
 * @fileoverview Pagination Utility
 * @description Unified cursor-based pagination for DynamoDB queries with Base64 encoding.
 * @notes
 * - Encodes/decodes LastEvaluatedKey as Base64 cursor.
 * - Parses request params for limit/cursor with defaults/max.
 * - Creates paginated responses with meta (hasNext, cursor, limit).
 * - Validates cursor format.
 * - Defaults and max limits for entities (albums, media, etc.).
 * - Errors for invalid limit/cursor.
 */

import { ApiKeyedPaginatedResponse, PaginationMeta } from "@shared";

/**
 * Pagination utility class with static methods for cursor management
 */
export class PaginationUtil {
  /**
   * Encode DynamoDB lastEvaluatedKey as Base64 cursor
   *
   * @param lastEvaluatedKey - DynamoDB LastEvaluatedKey object
   * @returns Base64-encoded cursor string or null if no more pages
   */
  static encodeCursor(
    lastEvaluatedKey: Record<string, any> | undefined
  ): string | null {
    if (!lastEvaluatedKey) return null;

    try {
      return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64");
    } catch (error) {
      console.error("❌ Error encoding cursor:", error);
      return null;
    }
  }

  /**
   * Decode Base64 cursor to DynamoDB lastEvaluatedKey
   *
   * @param cursor - Base64-encoded cursor string
   * @returns Decoded lastEvaluatedKey object or undefined
   * @throws Error if cursor format is invalid
   */
  static decodeCursor(
    cursor: string | undefined
  ): Record<string, any> | undefined {
    if (!cursor) return undefined;

    try {
      const decoded = Buffer.from(cursor, "base64").toString();
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error("Invalid cursor format");
    }
  }

  /**
   * Create standardized pagination metadata
   *
   * @param lastEvaluatedKey - DynamoDB LastEvaluatedKey from query result
   * @param limit - Actual limit used in the query
   * @returns Standardized pagination metadata object
   */
  static createPaginationMeta(
    lastEvaluatedKey: Record<string, any> | undefined,
    limit: number
  ): PaginationMeta {
    return {
      hasNext: !!lastEvaluatedKey,
      cursor: this.encodeCursor(lastEvaluatedKey),
      limit,
    };
  }

  /**
   * Parse and validate pagination parameters from API Gateway event
   *
   * @param queryParams - Query string parameters from API Gateway event
   * @param defaultLimit - Default limit if not provided
   * @param maxLimit - Maximum allowed limit
   * @returns Validated pagination parameters
   */
  static parseRequestParams(
    queryParams: Record<string, string> | null,
    defaultLimit: number = 20,
    maxLimit: number = 100
  ): { cursor: Record<string, any> | undefined; limit: number } {
    const params = queryParams || {};

    // Parse and validate limit
    let limit = defaultLimit;
    if (params["limit"]) {
      const parsedLimit = parseInt(params["limit"], 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, maxLimit);
      }
    }

    // Parse and validate cursor
    let cursor: Record<string, any> | undefined;
    if (params["cursor"]) {
      try {
        cursor = this.decodeCursor(params["cursor"]);
      } catch (error) {
        throw new Error("Invalid cursor parameter");
      }
    }

    return { cursor, limit };
  }

  /**
   * Create a complete paginated response
   *
   * @param items - Array of items for current page
   * @param lastEvaluatedKey - DynamoDB LastEvaluatedKey
   * @param limit - Actual limit used
   * @returns Complete paginated response object
   */
  static createPaginatedResponse<K extends string, T>(
    key: K,
    items: T[],
    lastEvaluatedKey: Record<string, any> | undefined,
    limit: number
  ): ApiKeyedPaginatedResponse<K, T>["data"] {
    return {
      [key]: items,
      pagination: this.createPaginationMeta(lastEvaluatedKey, limit),
    } as ApiKeyedPaginatedResponse<K, T>["data"]; // satisfies keyed payload shape
  }

  /**
   * Validate cursor format without throwing
   *
   * @param cursor - Cursor string to validate
   * @returns True if cursor is valid, false otherwise
   */
  static isValidCursor(cursor: string): boolean {
    try {
      this.decodeCursor(cursor);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Type guard to check if response is paginated
 */
// Removed generic isPaginatedResponse type guard; prefer explicit keyed payload checks per endpoint

/**
 * Default pagination limits for different entity types
 */
export const DEFAULT_PAGINATION_LIMITS = {
  albums: 20,
  media: 50,
  comments: 20,
  interactions: 20,
  users: 25,
  admin: 25,
  notifications: 20,
  follow: 20,
  pscTransactions: 100,
  leaderboards: 25,
} as const;

/**
 * Maximum pagination limits for different entity types
 */
export const MAX_PAGINATION_LIMITS = {
  albums: 100,
  media: 100,
  comments: 50,
  interactions: 100,
  users: 100,
  admin: 100,
  notifications: 100,
  follow: 100,
  pscTransactions: 500,
  leaderboards: 100,
} as const;

/**
 * Common pagination error messages
 */
export const PAGINATION_ERRORS = {
  INVALID_CURSOR: "Invalid cursor parameter",
  INVALID_LIMIT: "Invalid limit parameter",
  LIMIT_EXCEEDED: "Limit exceeds maximum allowed value",
  CURSOR_REQUIRED: "Cursor parameter is required for this operation",
} as const;
