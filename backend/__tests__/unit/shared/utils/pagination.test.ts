import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "../../../../shared/utils/pagination";

describe("PaginationUtil", () => {
  describe("encodeCursor", () => {
    it("should encode lastEvaluatedKey as base64", () => {
      const lastKey = { PK: "USER#123", SK: "INTERACTION#bookmark#456" };
      const cursor = PaginationUtil.encodeCursor(lastKey);

      expect(cursor).toBe(
        Buffer.from(JSON.stringify(lastKey)).toString("base64")
      );
    });

    it("should return null for undefined lastEvaluatedKey", () => {
      expect(PaginationUtil.encodeCursor(undefined)).toBe(null);
    });

    it("should handle empty object", () => {
      const cursor = PaginationUtil.encodeCursor({});
      expect(cursor).toBe(Buffer.from(JSON.stringify({})).toString("base64"));
    });
  });

  describe("decodeCursor", () => {
    it("should decode base64 cursor to object", () => {
      const lastKey = { PK: "USER#123", SK: "INTERACTION#bookmark#456" };
      const cursor = Buffer.from(JSON.stringify(lastKey)).toString("base64");

      expect(PaginationUtil.decodeCursor(cursor)).toEqual(lastKey);
    });

    it("should return undefined for undefined cursor", () => {
      expect(PaginationUtil.decodeCursor(undefined)).toBeUndefined();
    });

    it("should throw error for invalid cursor", () => {
      expect(() => PaginationUtil.decodeCursor("invalid-cursor")).toThrow(
        "Invalid cursor format"
      );
    });

    it("should throw error for non-base64 string", () => {
      expect(() => PaginationUtil.decodeCursor("not-base64!@#")).toThrow(
        "Invalid cursor format"
      );
    });
  });

  describe("createPaginationMeta", () => {
    it("should create pagination meta with lastEvaluatedKey", () => {
      const lastKey = { PK: "USER#123", SK: "INTERACTION#bookmark#456" };
      const limit = 20;

      const meta = PaginationUtil.createPaginationMeta(lastKey, limit);

      expect(meta).toEqual({
        hasNext: true,
        cursor: Buffer.from(JSON.stringify(lastKey)).toString("base64"),
        limit: 20,
      });
    });

    it("should create pagination meta without lastEvaluatedKey", () => {
      const meta = PaginationUtil.createPaginationMeta(undefined, 20);

      expect(meta).toEqual({
        hasNext: false,
        cursor: null,
        limit: 20,
      });
    });
  });

  describe("parseRequestParams", () => {
    it("should parse valid parameters", () => {
      const queryParams = {
        cursor: Buffer.from(JSON.stringify({ PK: "USER#123" })).toString(
          "base64"
        ),
        limit: "25",
      };

      const result = PaginationUtil.parseRequestParams(queryParams, 20, 100);

      expect(result.limit).toBe(25);
      expect(result.cursor).toEqual({ PK: "USER#123" });
    });

    it("should use default limit when not provided", () => {
      const result = PaginationUtil.parseRequestParams({}, 20, 100);

      expect(result.limit).toBe(20);
      expect(result.cursor).toBeUndefined();
    });

    it("should enforce maximum limit", () => {
      const queryParams = { limit: "150" };

      const result = PaginationUtil.parseRequestParams(queryParams, 20, 100);

      expect(result.limit).toBe(100);
    });

    it("should handle invalid limit gracefully", () => {
      const queryParams = { limit: "invalid" };

      const result = PaginationUtil.parseRequestParams(queryParams, 20, 100);

      expect(result.limit).toBe(20);
    });

    it("should handle negative limit", () => {
      const queryParams = { limit: "-5" };

      const result = PaginationUtil.parseRequestParams(queryParams, 20, 100);

      expect(result.limit).toBe(20);
    });

    it("should throw error for invalid cursor", () => {
      const queryParams = { cursor: "invalid-cursor" };

      expect(() =>
        PaginationUtil.parseRequestParams(queryParams, 20, 100)
      ).toThrow("Invalid cursor parameter");
    });

    it("should handle null queryParams", () => {
      const result = PaginationUtil.parseRequestParams(null, 20, 100);

      expect(result.limit).toBe(20);
      expect(result.cursor).toBeUndefined();
    });
  });

  describe("createPaginatedResponse", () => {
    it("should create keyed paginated payload with data", () => {
      const items = [{ id: "1" }, { id: "2" }];
      const lastKey = { PK: "USER#123" };
      const limit = 20;

      const response = PaginationUtil.createPaginatedResponse(
        "items",
        items,
        lastKey,
        limit
      );

      expect(response).toEqual({
        items,
        pagination: {
          hasNext: true,
          cursor: Buffer.from(JSON.stringify(lastKey)).toString("base64"),
          limit: 20,
        },
      });
    });

    it("should create keyed response without next page", () => {
      const items = [{ id: "1" }];

      const response = PaginationUtil.createPaginatedResponse(
        "items",
        items,
        undefined,
        20
      );

      expect(response).toEqual({
        items,
        pagination: {
          hasNext: false,
          cursor: null,
          limit: 20,
        },
      });
    });
  });

  describe("isValidCursor", () => {
    it("should return true for valid cursor", () => {
      const validCursor = Buffer.from(
        JSON.stringify({ PK: "USER#123" })
      ).toString("base64");

      expect(PaginationUtil.isValidCursor(validCursor)).toBe(true);
    });

    it("should return false for invalid cursor", () => {
      expect(PaginationUtil.isValidCursor("invalid-cursor")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(PaginationUtil.isValidCursor("")).toBe(false);
    });
  });

  describe("constants", () => {
    it("should have reasonable default limits", () => {
      expect(DEFAULT_PAGINATION_LIMITS.albums).toBe(20);
      expect(DEFAULT_PAGINATION_LIMITS.media).toBe(50);
      expect(DEFAULT_PAGINATION_LIMITS.comments).toBe(20);
      expect(DEFAULT_PAGINATION_LIMITS.interactions).toBe(20);
    });

    it("should have reasonable maximum limits", () => {
      expect(MAX_PAGINATION_LIMITS.albums).toBe(100);
      expect(MAX_PAGINATION_LIMITS.media).toBe(100);
      expect(MAX_PAGINATION_LIMITS.comments).toBe(50);
      expect(MAX_PAGINATION_LIMITS.interactions).toBe(100);
    });

    it("should have max limits higher than defaults", () => {
      Object.keys(DEFAULT_PAGINATION_LIMITS).forEach((key) => {
        expect(MAX_PAGINATION_LIMITS[key]).toBeGreaterThanOrEqual(
          DEFAULT_PAGINATION_LIMITS[key]
        );
      });
    });
  });
});
