import { DynamoDBService } from "../../../../shared/utils/dynamodb";
import { mockAlbumEntity, mockAlbumsList } from "../../../fixtures/albums";
import { mockMediaEntity, mockMediaList } from "../../../fixtures/media";
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockDynamoDBDocumentClient } from "../../../setup";

// Mock the DynamoDB client
const mockSend = mockDynamoDBDocumentClient.send as jest.Mock;

// Test data
const mockAlbumId = "test-album-123";
const mockMediaId = "test-media-456";

describe("DynamoDBService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date.now() for consistent timestamps
    jest
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2023-01-02T00:00:00.000Z").getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Album operations", () => {
    describe("createAlbum", () => {
      it("should create an album successfully", async () => {
        mockSend.mockResolvedValue({});

        await DynamoDBService.createAlbum(mockAlbumEntity);

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(PutCommand));
      });

      it("should throw error when album already exists", async () => {
        const error = new Error("The conditional request failed");
        (error as any).name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(error);

        await expect(
          DynamoDBService.createAlbum(mockAlbumEntity)
        ).rejects.toThrow("The conditional request failed");
      });
    });

    describe("getAlbum", () => {
      it("should return an album when it exists", async () => {
        mockSend.mockResolvedValue({ Item: mockAlbumEntity });

        const result = await DynamoDBService.getAlbum(mockAlbumId);

        expect(result).toEqual(mockAlbumEntity);
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(GetCommand));
      });

      it("should return null when album does not exist", async () => {
        mockSend.mockResolvedValue({});

        const result = await DynamoDBService.getAlbum(mockAlbumId);

        expect(result).toBeNull();
      });

      it("should throw error on DynamoDB failure", async () => {
        const error = new Error("Requested resource not found");
        (error as any).name = "ResourceNotFoundException";
        mockSend.mockRejectedValue(error);

        await expect(DynamoDBService.getAlbum(mockAlbumId)).rejects.toThrow(
          "Requested resource not found"
        );
      });
    });

    describe("updateAlbum", () => {
      it("should update an album with valid fields", async () => {
        mockSend.mockResolvedValue({});

        const updates = {
          title: "Updated Title",
          description: "Updated Description",
          updatedAt: "2023-01-02T00:00:00.000Z",
        };

        await DynamoDBService.updateAlbum(mockAlbumId, updates);

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
      });

      it("should skip update when no valid fields provided", async () => {
        const updates = {};

        await DynamoDBService.updateAlbum(mockAlbumId, updates);

        expect(mockSend).not.toHaveBeenCalled();
      });

      it("should skip undefined values", async () => {
        mockSend.mockResolvedValue({});

        const updates = {
          title: "Updated Title",
          description: undefined,
          updatedAt: "2023-01-02T00:00:00.000Z",
        };

        await DynamoDBService.updateAlbum(mockAlbumId, updates);

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
      });

      it("should refresh album tag relations when visibility changes", async () => {
        const updateAlbumTagRelationsSpy = jest
          .spyOn(DynamoDBService, "updateAlbumTagRelations")
          .mockResolvedValue();

        mockSend
          .mockImplementationOnce(() =>
            Promise.resolve({ Item: mockAlbumEntity })
          )
          .mockImplementationOnce(() => Promise.resolve({}));

        await DynamoDBService.updateAlbum(mockAlbumId, {
          isPublic: "false",
        });

        expect(mockSend).toHaveBeenNthCalledWith(1, expect.any(GetCommand));
        expect(mockSend).toHaveBeenNthCalledWith(2, expect.any(UpdateCommand));
        expect(updateAlbumTagRelationsSpy).toHaveBeenCalledWith(
          mockAlbumId,
          mockAlbumEntity.tags,
          mockAlbumEntity.createdAt,
          false,
          mockAlbumEntity.createdBy as string
        );

        updateAlbumTagRelationsSpy.mockRestore();
      });

      it("should always update updatedAt and GSI8SK for any album update", async () => {
        mockSend
          .mockImplementationOnce(() =>
            Promise.resolve({ Item: mockAlbumEntity })
          )
          .mockImplementationOnce(() => Promise.resolve({}));

        await DynamoDBService.updateAlbum(mockAlbumId, {
          title: "Updated Title",
        });

        expect(mockSend).toHaveBeenNthCalledWith(1, expect.any(GetCommand));
        expect(mockSend).toHaveBeenNthCalledWith(2, expect.any(UpdateCommand));

        const updateCall = mockSend.mock.calls[1][0];
        const expressionValues = updateCall.input.ExpressionAttributeValues;

        // Check that updatedAt is set
        expect(expressionValues[":updatedAt"]).toBeDefined();

        // Check that GSI8PK and GSI8SK are always updated
        expect(expressionValues[":GSI8PK"]).toBe("VISIBILITY_UPDATED");
        expect(expressionValues[":GSI8SK"]).toMatch(
          new RegExp(`^${mockAlbumEntity.isPublic}#.+#${mockAlbumId}$`)
        );
      });

      it("should update GSI8SK when isPublic changes", async () => {
        const updatedAt = "2023-01-02T00:00:00.000Z";
        mockSend
          .mockImplementationOnce(() =>
            Promise.resolve({ Item: mockAlbumEntity })
          )
          .mockImplementationOnce(() => Promise.resolve({}));

        await DynamoDBService.updateAlbum(mockAlbumId, {
          isPublic: "false",
          updatedAt,
        });

        expect(mockSend).toHaveBeenNthCalledWith(1, expect.any(GetCommand));
        expect(mockSend).toHaveBeenNthCalledWith(2, expect.any(UpdateCommand));

        const updateCall = mockSend.mock.calls[1][0];
        const expressionValues = updateCall.input.ExpressionAttributeValues;

        // Check that GSI8PK and GSI8SK are updated with new isPublic value
        expect(expressionValues[":GSI8PK"]).toBe("VISIBILITY_UPDATED");
        expect(expressionValues[":GSI8SK"]).toBe(
          `false#${updatedAt}#${mockAlbumId}`
        );
      });
    });

    describe("deleteAlbum", () => {
      it("should delete an album successfully", async () => {
        mockSend.mockResolvedValue({});

        await DynamoDBService.deleteAlbum(mockAlbumId);

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteCommand));
      });
    });

    describe("listAlbums", () => {
      it("should return albums with default pagination", async () => {
        mockSend.mockResolvedValue({ Items: mockAlbumsList });

        const result = await DynamoDBService.listAlbums();

        expect(result.albums).toEqual(mockAlbumsList);
        expect(result.lastEvaluatedKey).toBeUndefined();
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(QueryCommand));
      });

      it("should return albums with custom limit and pagination", async () => {
        const lastEvaluatedKey = {
          PK: "ALBUM#test",
          SK: "METADATA",
        };

        const mockPaginationResponse = {
          albums: mockAlbumsList,
          lastEvaluatedKey: {
            PK: "ALBUM#test",
            SK: "METADATA",
          },
        };

        mockSend.mockResolvedValue({
          Items: mockAlbumsList,
          LastEvaluatedKey: mockPaginationResponse.lastEvaluatedKey,
        });

        const result = await DynamoDBService.listAlbums(10, lastEvaluatedKey);

        expect(result.albums).toEqual(mockAlbumsList);
        expect(result.lastEvaluatedKey).toEqual(
          mockPaginationResponse.lastEvaluatedKey
        );
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(QueryCommand));
      });

      it("should return albums with tag filtering", async () => {
        mockSend.mockResolvedValue({ Items: mockAlbumsList });

        const result = await DynamoDBService.listAlbums(20, undefined, "test");

        expect(result.albums).toEqual(mockAlbumsList);
        expect(result.lastEvaluatedKey).toBeUndefined();
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(QueryCommand));
      });
    });

    describe("incrementAlbumMediaCount", () => {
      it("should increment media count successfully", async () => {
        mockSend.mockResolvedValue({});

        await DynamoDBService.incrementAlbumMediaCount(mockAlbumId);

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
      });
    });

    describe("decrementAlbumMediaCount", () => {
      it("should decrement media count successfully", async () => {
        mockSend.mockResolvedValue({});

        await DynamoDBService.decrementAlbumMediaCount(mockAlbumId);

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
      });
    });
  });

  describe("Media operations", () => {
    describe("createMedia", () => {
      it("should create media successfully", async () => {
        mockSend.mockResolvedValue({});

        await DynamoDBService.createMedia(mockMediaEntity);

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(PutCommand));
      });
    });

    describe("upsertMediaEntity", () => {
      it("should create media when it does not exist", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({});

        const result = await DynamoDBService.upsertMediaEntity(mockMediaEntity);

        expect(mockSend).toHaveBeenNthCalledWith(1, expect.any(QueryCommand));
        const putCommand = mockSend.mock.calls[1][0] as PutCommand;
        expect(putCommand).toBeInstanceOf(PutCommand);
        expect(putCommand.input).toBeDefined();
        expect(putCommand.input?.Item).toMatchObject({
          PK: `MEDIA#${mockMediaEntity.id}`,
          GSI1PK: "MEDIA_BY_CREATOR",
          status: "pending",
        });
        expect(result).toMatchObject({
          id: mockMediaEntity.id,
          thumbnailUrl: mockMediaEntity.thumbnailUrl,
        });
      });

      it("should merge existing media without losing thumbnails", async () => {
        const existingEntity = {
          ...mockMediaEntity,
          thumbnailUrl: "existing-thumb",
          thumbnailUrls: { small: "existing-thumb" },
          status: "uploaded",
        };

        const baseMedia = { ...mockMediaEntity };
        delete (baseMedia as any).thumbnailUrl;
        delete (baseMedia as any).thumbnailUrls;

        mockSend
          .mockResolvedValueOnce({ Items: [existingEntity] })
          .mockResolvedValueOnce({});

        await DynamoDBService.upsertMediaEntity(baseMedia, {
          status: "uploaded",
        });

        expect(mockSend).toHaveBeenNthCalledWith(1, expect.any(QueryCommand));
        const putCommand = mockSend.mock.calls[1][0] as PutCommand;
        expect(putCommand.input?.Item).toMatchObject({
          thumbnailUrl: "existing-thumb",
          status: "uploaded",
        });
      });
    });

    describe("getMedia", () => {
      it("should return media when it exists", async () => {
        mockSend.mockResolvedValue({ Item: mockMediaEntity });

        const result = await DynamoDBService.getMedia(mockMediaId);

        expect(result).toMatchObject({
          id: mockMediaEntity.id,
          filename: mockMediaEntity.filename,
        });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(GetCommand));
      });

      it("should return null when media does not exist", async () => {
        mockSend.mockResolvedValue({});

        const result = await DynamoDBService.getMedia(mockMediaId);

        expect(result).toBeNull();
      });
    });

    describe("listAlbumMedia", () => {
      it("should return media for an album", async () => {
        mockSend.mockResolvedValue({ Items: mockMediaList });

        const result = await DynamoDBService.listAlbumMedia(mockAlbumId);

        expect(result.media).toEqual(mockMediaList);
        expect(result.lastEvaluatedKey).toBeUndefined();
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(QueryCommand));
      });

      it("should return media with pagination", async () => {
        const lastEvaluatedKey = {
          PK: "ALBUM#test-album-123",
          SK: "MEDIA#test",
        };

        const mockMediaPaginationResponse = {
          media: mockMediaList,
          lastEvaluatedKey: {
            PK: "ALBUM#test-album-123",
            SK: "MEDIA#test",
          },
        };

        mockSend.mockResolvedValue({
          Items: mockMediaList,
          LastEvaluatedKey: mockMediaPaginationResponse.lastEvaluatedKey,
        });

        const result = await DynamoDBService.listAlbumMedia(
          mockAlbumId,
          25,
          lastEvaluatedKey
        );

        expect(result.media).toEqual(mockMediaList);
        expect(result.lastEvaluatedKey).toEqual(
          mockMediaPaginationResponse.lastEvaluatedKey
        );
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(QueryCommand));
      });
    });

    describe("deleteMedia", () => {
      it("should delete media successfully", async () => {
        mockSend.mockResolvedValue({});

        await DynamoDBService.deleteMedia(mockMediaId);

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteCommand));
      });
    });
  });

  describe("Error handling", () => {
    it("should handle DynamoDB errors properly", async () => {
      const error = new Error("Service unavailable");
      (error as any).name = "ServiceUnavailableException";
      mockSend.mockRejectedValue(error);

      await expect(DynamoDBService.getAlbum(mockAlbumId)).rejects.toThrow(
        "Service unavailable"
      );
    });

    it("should handle validation errors", async () => {
      const error = new Error("One or more parameter values were invalid");
      (error as any).name = "ValidationException";
      mockSend.mockRejectedValue(error);

      await expect(
        DynamoDBService.createAlbum(mockAlbumEntity)
      ).rejects.toThrow("One or more parameter values were invalid");
    });
  });
});
