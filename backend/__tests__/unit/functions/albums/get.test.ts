import { handler } from "../../../../functions/albums/get";
import { DynamoDBService } from "../../../../shared/utils/dynamodb";
import {
  createGetAlbumsEvent,
  expectSuccessResponse,
  expectInternalErrorResponse,
  createCursor,
} from "../../../helpers/api-gateway";
import {
  mockAlbumsListForAPI,
  mockPaginationResponse,
} from "../../../fixtures/albums";

// Mock the DynamoDB service
jest.mock("../../../../shared/utils/dynamodb");

const mockListAlbums = DynamoDBService.listAlbums as jest.MockedFunction<
  typeof DynamoDBService.listAlbums
>;

const mockListAlbumsByPublicStatus =
  DynamoDBService.listAlbumsByPublicStatus as jest.MockedFunction<
    typeof DynamoDBService.listAlbumsByPublicStatus
  >;

const mockListAlbumsByCreator =
  DynamoDBService.listAlbumsByCreator as jest.MockedFunction<
    typeof DynamoDBService.listAlbumsByCreator
  >;

describe("Albums Get Handler", () => {
  beforeEach(() => {
    mockListAlbums.mockClear();
    mockListAlbumsByPublicStatus.mockClear();
    mockListAlbumsByCreator.mockClear();
  });

  describe("successful requests", () => {
    it("should return albums with default pagination when no query params provided", async () => {
      mockListAlbums.mockResolvedValue({
        albums: mockAlbumsListForAPI,
      });

      const event = createGetAlbumsEvent();
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.albums).toHaveLength(3);
      expect(data.albums[0]).toEqual({
        id: mockAlbumsListForAPI[0]!.id,
        title: mockAlbumsListForAPI[0]!.title,
        tags: mockAlbumsListForAPI[0]!.tags,
        coverImageUrl: mockAlbumsListForAPI[0]!.coverImageUrl,
        createdAt: mockAlbumsListForAPI[0]!.createdAt,
        updatedAt: mockAlbumsListForAPI[0]!.updatedAt,
        mediaCount: mockAlbumsListForAPI[0]!.mediaCount,
        isPublic: mockAlbumsListForAPI[0]!.isPublic,
      });
      expect(data.nextCursor).toBeNull();
      expect(data.hasNext).toBe(false);

      expect(mockListAlbums).toHaveBeenCalledWith(20, undefined, undefined);
    });

    it("should return albums filtered by isPublic=true", async () => {
      mockListAlbumsByPublicStatus.mockResolvedValue({
        albums: mockAlbumsListForAPI.slice(0, 2),
      });

      const event = createGetAlbumsEvent({ isPublic: "true", limit: "2" });
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.albums).toHaveLength(2);
      expect(mockListAlbumsByPublicStatus).toHaveBeenCalledWith(
        true,
        2,
        undefined,
        undefined
      );
    });

    it("should return albums filtered by isPublic=false", async () => {
      mockListAlbumsByPublicStatus.mockResolvedValue({
        albums: [mockAlbumsListForAPI[2]!],
      });

      const event = createGetAlbumsEvent({ isPublic: "false" });
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.albums).toHaveLength(1);
      expect(mockListAlbumsByPublicStatus).toHaveBeenCalledWith(
        false,
        20,
        undefined,
        undefined
      );
    });

    it("should return albums filtered by creator", async () => {
      mockListAlbumsByCreator.mockResolvedValue({
        albums: mockAlbumsListForAPI.slice(0, 2),
      });

      const event = createGetAlbumsEvent({ createdBy: "test-user-123" });
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.albums).toHaveLength(2);
      expect(mockListAlbumsByCreator).toHaveBeenCalledWith(
        "test-user-123",
        20,
        undefined,
        undefined
      );
    });

    it("should return albums with pagination cursor", async () => {
      const lastEvaluatedKey = mockPaginationResponse.lastEvaluatedKey;
      mockListAlbums.mockResolvedValue({
        albums: mockAlbumsListForAPI,
        lastEvaluatedKey,
      });

      const event = createGetAlbumsEvent();
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.hasNext).toBe(true);
      expect(data.nextCursor).toBe(createCursor(lastEvaluatedKey));
    });

    it("should handle cursor from query parameters", async () => {
      const lastEvaluatedKey = mockPaginationResponse.lastEvaluatedKey;
      const cursor = createCursor(lastEvaluatedKey);

      mockListAlbums.mockResolvedValue({
        albums: mockAlbumsListForAPI,
      });

      const event = createGetAlbumsEvent({ cursor, limit: "10" });
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.hasNext).toBe(false);
      expect(mockListAlbums).toHaveBeenCalledWith(
        10,
        lastEvaluatedKey,
        undefined
      );
    });

    it("should handle albums without optional fields", async () => {
      const minimalAlbums = [
        {
          ...mockAlbumsListForAPI[2]!,
          tags: undefined,
          coverImageUrl: undefined,
        },
      ];

      mockListAlbums.mockResolvedValue({
        albums: minimalAlbums,
      });

      const event = createGetAlbumsEvent();
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.albums).toHaveLength(1);
      expect(data.albums[0].tags).toBeUndefined();
      expect(data.albums[0].coverImageUrl).toBeUndefined();
      expect(data.albums[0].title).toBe(minimalAlbums[0]!.title);
    });

    it("should handle empty albums list", async () => {
      mockListAlbums.mockResolvedValue({
        albums: [],
      });

      const event = createGetAlbumsEvent();
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.albums).toHaveLength(0);
      expect(data.hasNext).toBe(false);
    });

    it("should handle tag filtering with listAlbums", async () => {
      mockListAlbums.mockResolvedValue({
        albums: mockAlbumsListForAPI.filter((a) => a.tags?.includes("test")),
      });

      const event = createGetAlbumsEvent({ tag: "test" });
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.albums.length).toBeGreaterThan(0);
      expect(mockListAlbums).toHaveBeenCalledWith(20, undefined, "test");
    });

    it("should handle tag filtering with isPublic filter", async () => {
      mockListAlbumsByPublicStatus.mockResolvedValue({
        albums: mockAlbumsListForAPI.filter(
          (a) => a.isPublic && a.tags?.includes("second")
        ),
      });

      const event = createGetAlbumsEvent({ isPublic: "true", tag: "second" });
      const result = await handler(event);

      expectSuccessResponse(result);
      expect(mockListAlbumsByPublicStatus).toHaveBeenCalledWith(
        true,
        20,
        undefined,
        "second"
      );
    });
  });

  describe("query parameter handling", () => {
    it("should use default limit when limit is not provided", async () => {
      mockListAlbums.mockResolvedValue({
        albums: mockAlbumsListForAPI,
      });

      const event = createGetAlbumsEvent();
      const result = await handler(event);

      expectSuccessResponse(result);
      expect(mockListAlbums).toHaveBeenCalledWith(20, undefined, undefined);
    });

    it("should parse limit from query parameters", async () => {
      mockListAlbums.mockResolvedValue({
        albums: mockAlbumsListForAPI,
      });

      const event = createGetAlbumsEvent({ limit: "5" });
      const result = await handler(event);

      expectSuccessResponse(result);
      expect(mockListAlbums).toHaveBeenCalledWith(5, undefined, undefined);
    });

    it("should handle invalid limit gracefully", async () => {
      mockListAlbums.mockResolvedValue({
        albums: mockAlbumsListForAPI,
      });

      const event = createGetAlbumsEvent({ limit: "invalid" });
      const result = await handler(event);

      expectSuccessResponse(result);
      expect(mockListAlbums).toHaveBeenCalledWith(NaN, undefined, undefined);
    });

    it("should handle invalid cursor gracefully", async () => {
      const event = createGetAlbumsEvent({ cursor: "invalid-base64" });

      // This should return an error when trying to parse the cursor
      const result = await handler(event);
      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Invalid cursor");
    });
  });

  describe("error handling", () => {
    it("should return 500 when DynamoDB service throws error", async () => {
      const error = new Error("DynamoDB connection failed");
      mockListAlbums.mockRejectedValue(error);

      const event = createGetAlbumsEvent();
      const result = await handler(event);

      expectInternalErrorResponse(result, "Error fetching albums");
      expect(mockListAlbums).toHaveBeenCalled();
    });

    it("should return 500 when DynamoDB service throws unknown error", async () => {
      mockListAlbums.mockRejectedValue(new Error("Unknown error"));

      const event = createGetAlbumsEvent();
      const result = await handler(event);

      expectInternalErrorResponse(result, "Error fetching albums");
    });

    it("should log error to console", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const error = new Error("Test error");
      mockListAlbums.mockRejectedValue(error);

      const event = createGetAlbumsEvent();
      await handler(event);

      expect(consoleSpy).toHaveBeenCalledWith("Error fetching albums:", error);
      consoleSpy.mockRestore();
    });
  });

  describe("response format", () => {
    it("should return correct response structure", async () => {
      mockListAlbums.mockResolvedValue({
        albums: mockAlbumsListForAPI,
        lastEvaluatedKey: mockPaginationResponse.lastEvaluatedKey,
      });

      const event = createGetAlbumsEvent();
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data).toHaveProperty("albums");
      expect(data).toHaveProperty("nextCursor");
      expect(data).toHaveProperty("hasNext");
      expect(Array.isArray(data.albums)).toBe(true);
    });

    it("should include all required album fields", async () => {
      mockListAlbums.mockResolvedValue({
        albums: [mockAlbumsListForAPI[0]!],
      });

      const event = createGetAlbumsEvent();
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      const album = data.albums[0];

      expect(album).toHaveProperty("id");
      expect(album).toHaveProperty("title");
      expect(album).toHaveProperty("createdAt");
      expect(album).toHaveProperty("updatedAt");
      expect(album).toHaveProperty("mediaCount");
      expect(album).toHaveProperty("isPublic");

      // Optional fields should be present if they exist in the entity
      expect(album).toHaveProperty("tags");
      expect(album).toHaveProperty("coverImageUrl");
    });
  });
});
