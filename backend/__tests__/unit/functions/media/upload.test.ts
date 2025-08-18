import { handler } from "../../../../functions/media/add";
import { DynamoDBService } from "../../../../shared/utils/dynamodb";
import { S3Service } from "../../../../shared/utils/s3";
import { UserAuthMiddleware } from "../../../../shared/auth/user-middleware";
import { PlanUtil } from "../../../../shared/utils/plan";
import {
  createUploadMediaEvent,
  expectSuccessResponse,
  expectBadRequestResponse,
  expectNotFoundResponse,
  expectInternalErrorResponse,
} from "../../../helpers/api-gateway";
import {
  mockAlbumEntity,
  mockAlbumId,
  mockTimestamp,
} from "../../../fixtures/albums";
import { mockUploadMediaRequest, mockS3Key } from "../../../fixtures/media";

// Mock the services and uuid
jest.mock("../../../../shared/utils/dynamodb");
jest.mock("../../../../shared/utils/s3");
jest.mock("../../../../shared/auth/user-middleware");
jest.mock("../../../../shared/utils/plan");
jest.mock("uuid");

const mockGetAlbum = DynamoDBService.getAlbum as jest.MockedFunction<
  typeof DynamoDBService.getAlbum
>;
const mockCreateMedia = DynamoDBService.createMedia as jest.MockedFunction<
  typeof DynamoDBService.createMedia
>;
const mockIncrementAlbumMediaCount =
  DynamoDBService.incrementAlbumMediaCount as jest.MockedFunction<
    typeof DynamoDBService.incrementAlbumMediaCount
  >;
const mockAddMediaToAlbum =
  DynamoDBService.addMediaToAlbum as jest.MockedFunction<
    typeof DynamoDBService.addMediaToAlbum
  >;
const mockGeneratePresignedUploadUrl =
  S3Service.generatePresignedUploadUrl as jest.MockedFunction<
    typeof S3Service.generatePresignedUploadUrl
  >;
const mockGetPublicUrl = S3Service.getPublicUrl as jest.MockedFunction<
  typeof S3Service.getPublicUrl
>;
const mockGetRelativePath = S3Service.getRelativePath as jest.MockedFunction<
  typeof S3Service.getRelativePath
>;
const mockValidateSession =
  UserAuthMiddleware.validateSession as jest.MockedFunction<
    typeof UserAuthMiddleware.validateSession
  >;
const mockGetUserRole = PlanUtil.getUserRole as jest.MockedFunction<
  typeof PlanUtil.getUserRole
>;

describe("Media Upload Handler", () => {
  beforeEach(() => {
    mockGetAlbum.mockClear();
    mockCreateMedia.mockClear();
    mockIncrementAlbumMediaCount.mockClear();
    mockAddMediaToAlbum.mockClear();
    mockGeneratePresignedUploadUrl.mockClear();
    mockGetPublicUrl.mockClear();
    mockGetRelativePath.mockClear();
    mockValidateSession.mockClear();
    mockGetUserRole.mockClear();

    // Mock Date.prototype.toISOString to return consistent timestamp
    jest.spyOn(Date.prototype, "toISOString").mockReturnValue(mockTimestamp);

    // Mock uuid.v4 to return consistent values
    (require("uuid").v4 as jest.Mock)
      .mockReturnValueOnce("mock-media-uuid-456")
      .mockReturnValueOnce("mock-media-uuid-789");

    // Mock S3Service.getRelativePath to return the key with leading slash
    mockGetRelativePath.mockImplementation((key: string) =>
      key.startsWith("/") ? key : `/${key}`
    );

    // Mock session validation for fallback (local development)
    mockValidateSession.mockResolvedValue({
      isValid: true,
      user: {
        userId: "mock-admin-user-id",
        email: "admin@test.com",
        createdAt: "2023-01-01T00:00:00.000Z",
        isActive: true,
        isEmailVerified: true,
      },
      session: {
        sessionId: "mock-session-id",
        userId: "mock-admin-user-id",
        createdAt: "2023-01-01T00:00:00.000Z",
        expiresAt: "2024-01-01T00:00:00.000Z",
        lastAccessedAt: "2023-01-01T00:00:00.000Z",
      },
    });

    // Mock user role check to return admin
    mockGetUserRole.mockResolvedValue("admin");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("successful requests", () => {
    it("should create media upload successfully", async () => {
      mockGetAlbum.mockResolvedValue(mockAlbumEntity);
      mockGeneratePresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://test-bucket.s3.amazonaws.com/presigned-upload-url",
        key: mockS3Key,
      });
      mockCreateMedia.mockResolvedValue();
      mockAddMediaToAlbum.mockResolvedValue();

      const event = createUploadMediaEvent(mockAlbumId, mockUploadMediaRequest);
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data).toEqual({
        mediaId: "mock-media-uuid-456",
        uploadUrl: "https://test-bucket.s3.amazonaws.com/presigned-upload-url",
        key: mockS3Key,
        expiresIn: 3600,
      });

      expect(mockGetAlbum).toHaveBeenCalledWith(mockAlbumId);
      expect(mockGeneratePresignedUploadUrl).toHaveBeenCalledWith(
        mockAlbumId,
        mockUploadMediaRequest.filename,
        mockUploadMediaRequest.mimeType
      );
      expect(mockCreateMedia).toHaveBeenCalledWith({
        PK: `MEDIA#mock-media-uuid-456`,
        SK: "METADATA",
        GSI1PK: "MEDIA_BY_CREATOR",
        GSI1SK: `mock-admin-user-id#${mockTimestamp}#mock-media-uuid-456`,
        GSI2PK: "MEDIA_ID",
        GSI2SK: "mock-media-uuid-456",
        GSI3PK: "MEDIA_BY_USER_true",
        GSI3SK: `mock-admin-user-id#${mockTimestamp}#mock-media-uuid-456`,
        GSI5PK: "MEDIA",
        GSI5SK: "true",
        EntityType: "Media",
        id: "mock-media-uuid-456",
        filename: mockS3Key,
        originalFilename: mockUploadMediaRequest.filename,
        mimeType: mockUploadMediaRequest.mimeType,
        size: mockUploadMediaRequest.size,
        url: `/${mockS3Key}`,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
        isPublic: "true",
        likeCount: 0,
        bookmarkCount: 0,
        viewCount: 0,
        commentCount: 0,
        createdBy: "mock-admin-user-id",
        createdByType: "admin",
        status: "pending",
      });
      expect(mockAddMediaToAlbum).toHaveBeenCalledWith(
        mockAlbumId,
        "mock-media-uuid-456",
        "mock-admin-user-id"
      );
    });

    it("should handle request without size", async () => {
      mockGetAlbum.mockResolvedValue(mockAlbumEntity);
      mockGeneratePresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://test-bucket.s3.amazonaws.com/presigned-upload-url",
        key: mockS3Key,
      });
      mockCreateMedia.mockResolvedValue();
      mockAddMediaToAlbum.mockResolvedValue();

      const requestWithoutSize = {
        filename: "test-image.jpg",
        mimeType: "image/jpeg",
      };

      const event = createUploadMediaEvent(mockAlbumId, requestWithoutSize);
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.mediaId).toBe("mock-media-uuid-456");

      expect(mockCreateMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 0,
        })
      );
    });

    it("should handle different file types", async () => {
      mockGetAlbum.mockResolvedValue(mockAlbumEntity);
      mockGeneratePresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://test-bucket.s3.amazonaws.com/presigned-upload-url",
        key: "albums/test-album-123/media/mock-media-uuid-456.png",
      });
      mockCreateMedia.mockResolvedValue();
      mockAddMediaToAlbum.mockResolvedValue();

      const pngRequest = {
        filename: "test-image.png",
        mimeType: "image/png",
        size: 2048000,
      };

      const event = createUploadMediaEvent(mockAlbumId, pngRequest);
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.mediaId).toBe("mock-media-uuid-456");

      expect(mockGeneratePresignedUploadUrl).toHaveBeenCalledWith(
        mockAlbumId,
        "test-image.png",
        "image/png"
      );
    });
  });

  describe("validation", () => {
    it("should return 400 when albumId is missing", async () => {
      const event = createUploadMediaEvent("", mockUploadMediaRequest);
      event.pathParameters = null;

      const result = await handler(event);

      expectBadRequestResponse(result, "Album ID is required");
      expect(mockGetAlbum).not.toHaveBeenCalled();
    });

    it("should return 400 when albumId is empty string", async () => {
      const event = createUploadMediaEvent("", mockUploadMediaRequest);

      const result = await handler(event);

      expectBadRequestResponse(result, "Album ID is required");
      expect(mockGetAlbum).not.toHaveBeenCalled();
    });

    it("should return 400 when request body is missing", async () => {
      const event = createUploadMediaEvent(mockAlbumId, {});
      event.body = null;

      const result = await handler(event);

      expectBadRequestResponse(result, "Request body is required");
      expect(mockGetAlbum).not.toHaveBeenCalled();
    });

    it("should return 400 when filename is missing", async () => {
      const requestWithoutFilename = {
        mimeType: "image/jpeg",
        size: 1024000,
      };

      const event = createUploadMediaEvent(mockAlbumId, requestWithoutFilename);
      const result = await handler(event);

      expectBadRequestResponse(result, "Filename and mimeType are required");
      expect(mockGetAlbum).not.toHaveBeenCalled();
    });

    it("should return 400 when mimeType is missing", async () => {
      const requestWithoutMimeType = {
        filename: "test-image.jpg",
        size: 1024000,
      };

      const event = createUploadMediaEvent(mockAlbumId, requestWithoutMimeType);
      const result = await handler(event);

      expectBadRequestResponse(result, "Filename and mimeType are required");
      expect(mockGetAlbum).not.toHaveBeenCalled();
    });

    it("should return 400 when both filename and mimeType are missing", async () => {
      const requestWithoutRequired = {
        size: 1024000,
      };

      const event = createUploadMediaEvent(mockAlbumId, requestWithoutRequired);
      const result = await handler(event);

      expectBadRequestResponse(result, "Filename and mimeType are required");
      expect(mockGetAlbum).not.toHaveBeenCalled();
    });

    it("should return 400 when filename is empty string", async () => {
      const requestWithEmptyFilename = {
        filename: "",
        mimeType: "image/jpeg",
        size: 1024000,
      };

      const event = createUploadMediaEvent(
        mockAlbumId,
        requestWithEmptyFilename
      );
      const result = await handler(event);

      expectBadRequestResponse(result, "Filename and mimeType are required");
      expect(mockGetAlbum).not.toHaveBeenCalled();
    });

    it("should return 400 when mimeType is empty string", async () => {
      const requestWithEmptyMimeType = {
        filename: "test-image.jpg",
        mimeType: "",
        size: 1024000,
      };

      const event = createUploadMediaEvent(
        mockAlbumId,
        requestWithEmptyMimeType
      );
      const result = await handler(event);

      expectBadRequestResponse(result, "Filename and mimeType are required");
      expect(mockGetAlbum).not.toHaveBeenCalled();
    });
  });

  describe("album verification", () => {
    it("should return 404 when album does not exist", async () => {
      mockGetAlbum.mockResolvedValue(null);

      const event = createUploadMediaEvent(
        "non-existent-album",
        mockUploadMediaRequest
      );
      const result = await handler(event);

      expectNotFoundResponse(result, "Album not found");
      expect(mockGetAlbum).toHaveBeenCalledWith("non-existent-album");
      expect(mockGeneratePresignedUploadUrl).not.toHaveBeenCalled();
      expect(mockCreateMedia).not.toHaveBeenCalled();
      expect(mockAddMediaToAlbum).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should return 500 when album lookup fails", async () => {
      const error = new Error("DynamoDB connection failed");
      mockGetAlbum.mockRejectedValue(error);

      const event = createUploadMediaEvent(mockAlbumId, mockUploadMediaRequest);
      const result = await handler(event);

      expectInternalErrorResponse(result, "Failed to create media upload");
      expect(mockGetAlbum).toHaveBeenCalledWith(mockAlbumId);
    });

    it("should return 500 when S3 presigned URL generation fails", async () => {
      mockGetAlbum.mockResolvedValue(mockAlbumEntity);
      const error = new Error("S3 access denied");
      mockGeneratePresignedUploadUrl.mockRejectedValue(error);

      const event = createUploadMediaEvent(mockAlbumId, mockUploadMediaRequest);
      const result = await handler(event);

      expectInternalErrorResponse(result, "Failed to create media upload");
      expect(mockGetAlbum).toHaveBeenCalledWith(mockAlbumId);
      expect(mockGeneratePresignedUploadUrl).toHaveBeenCalled();
    });

    it("should return 500 when media creation fails", async () => {
      mockGetAlbum.mockResolvedValue(mockAlbumEntity);
      mockGeneratePresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://test-bucket.s3.amazonaws.com/presigned-upload-url",
        key: mockS3Key,
      });
      const error = new Error("DynamoDB write failed");
      mockCreateMedia.mockRejectedValue(error);

      const event = createUploadMediaEvent(mockAlbumId, mockUploadMediaRequest);
      const result = await handler(event);

      expectInternalErrorResponse(result, "Failed to create media upload");
      expect(mockCreateMedia).toHaveBeenCalled();
    });

    it("should log error to console", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const error = new Error("Test error");
      mockGetAlbum.mockRejectedValue(error);

      const event = createUploadMediaEvent(mockAlbumId, mockUploadMediaRequest);
      await handler(event);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error creating media upload:",
        error
      );
      consoleSpy.mockRestore();
    });
  });

  describe("response format", () => {
    it("should return correct response structure", async () => {
      mockGetAlbum.mockResolvedValue(mockAlbumEntity);
      mockGeneratePresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://test-bucket.s3.amazonaws.com/presigned-upload-url",
        key: mockS3Key,
      });
      mockCreateMedia.mockResolvedValue();
      mockIncrementAlbumMediaCount.mockResolvedValue();

      const event = createUploadMediaEvent(mockAlbumId, mockUploadMediaRequest);
      const result = await handler(event);

      const data = expectSuccessResponse(result);

      expect(data).toHaveProperty("mediaId");
      expect(data).toHaveProperty("uploadUrl");
      expect(data).toHaveProperty("key");
      expect(data).toHaveProperty("expiresIn");

      expect(typeof data.mediaId).toBe("string");
      expect(typeof data.uploadUrl).toBe("string");
      expect(typeof data.key).toBe("string");
      expect(typeof data.expiresIn).toBe("number");
    });

    it("should return 1 hour expiration by default", async () => {
      mockGetAlbum.mockResolvedValue(mockAlbumEntity);
      mockGeneratePresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://test-bucket.s3.amazonaws.com/presigned-upload-url",
        key: mockS3Key,
      });
      mockCreateMedia.mockResolvedValue();
      mockIncrementAlbumMediaCount.mockResolvedValue();

      const event = createUploadMediaEvent(mockAlbumId, mockUploadMediaRequest);
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.expiresIn).toBe(3600); // 1 hour in seconds
    });
  });

  describe("edge cases", () => {
    it("should handle very long filenames", async () => {
      mockGetAlbum.mockResolvedValue(mockAlbumEntity);
      mockGeneratePresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://test-bucket.s3.amazonaws.com/presigned-upload-url",
        key: mockS3Key,
      });
      mockCreateMedia.mockResolvedValue();
      mockIncrementAlbumMediaCount.mockResolvedValue();

      const longFilename = "a".repeat(1000) + ".jpg";
      const requestWithLongFilename = {
        filename: longFilename,
        mimeType: "image/jpeg",
        size: 1024000,
      };

      const event = createUploadMediaEvent(
        mockAlbumId,
        requestWithLongFilename
      );
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.mediaId).toBe("mock-media-uuid-456");

      expect(mockGeneratePresignedUploadUrl).toHaveBeenCalledWith(
        mockAlbumId,
        longFilename,
        "image/jpeg"
      );
    });

    it("should handle special characters in filename", async () => {
      mockGetAlbum.mockResolvedValue(mockAlbumEntity);
      mockGeneratePresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://test-bucket.s3.amazonaws.com/presigned-upload-url",
        key: mockS3Key,
      });
      mockCreateMedia.mockResolvedValue();
      mockIncrementAlbumMediaCount.mockResolvedValue();

      const specialFilename = "file with spaces & symbols (1).jpg";
      const requestWithSpecialFilename = {
        filename: specialFilename,
        mimeType: "image/jpeg",
        size: 1024000,
      };

      const event = createUploadMediaEvent(
        mockAlbumId,
        requestWithSpecialFilename
      );
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.mediaId).toBe("mock-media-uuid-456");

      expect(mockGeneratePresignedUploadUrl).toHaveBeenCalledWith(
        mockAlbumId,
        specialFilename,
        "image/jpeg"
      );
    });

    it("should handle large file sizes", async () => {
      mockGetAlbum.mockResolvedValue(mockAlbumEntity);
      mockGeneratePresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://test-bucket.s3.amazonaws.com/presigned-upload-url",
        key: mockS3Key,
      });
      mockCreateMedia.mockResolvedValue();
      mockIncrementAlbumMediaCount.mockResolvedValue();

      const largeFileRequest = {
        filename: "large-file.jpg",
        mimeType: "image/jpeg",
        size: 100 * 1024 * 1024, // 100MB
      };

      const event = createUploadMediaEvent(mockAlbumId, largeFileRequest);
      const result = await handler(event);

      const data = expectSuccessResponse(result);
      expect(data.mediaId).toBe("mock-media-uuid-456");

      expect(mockCreateMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 100 * 1024 * 1024,
        })
      );
    });
  });
});
