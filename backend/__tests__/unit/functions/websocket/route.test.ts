/**
 * @fileoverview Unit tests for the WebSocket generation completion handler.
 * @description Validates handling of upload_complete messages emitted by the ComfyUI monitor.
 */
import { ComfyUIUploadCompleteMessage } from "../../../../shared/shared-types/comfyui-events";
import { handleGenerationComplete } from "../../../../functions/websocket/route";

const mockQueueService = {
  findQueueEntryByPromptId: jest.fn(),
  updateQueueEntry: jest.fn(),
  getQueueEntry: jest.fn(),
};

const mockApiGatewayClient = {
  send: jest.fn(),
};

jest.mock("@shared/services/generation-queue", () => ({
  GenerationQueueService: {
    getInstance: jest.fn(() => mockQueueService),
  },
}));

jest.mock("@aws-sdk/client-apigatewaymanagementapi", () => ({
  ApiGatewayManagementApiClient: jest
    .fn()
    .mockImplementation(() => mockApiGatewayClient),
  PostToConnectionCommand: jest
    .fn()
    .mockImplementation((input: any) => ({ input })),
}));

jest.mock("@shared", () => {
  const actual = jest.requireActual("@shared");

  return {
    ...actual,
    DynamoDBService: {
      createMedia: jest.fn(),
      updateMedia: jest.fn(),
      deleteMedia: jest.fn(),
      incrementUserProfileMetric: jest.fn(),
      convertMediaEntityToMedia: jest.fn(),
    },
    S3Service: {
      getRelativePath: jest.fn(),
      composePublicUrl: jest.fn(),
      extractKeyFromUrl: jest.fn(),
    },
  };
});

process.env.WEBSOCKET_API_ENDPOINT = "https://ws.example.com";

const { DynamoDBService, S3Service } = jest.requireMock("@shared") as {
  DynamoDBService: {
    createMedia: jest.Mock;
    updateMedia: jest.Mock;
    deleteMedia: jest.Mock;
    incrementUserProfileMetric: jest.Mock;
    convertMediaEntityToMedia: jest.Mock;
  };
  S3Service: {
    getRelativePath: jest.Mock;
    composePublicUrl: jest.Mock;
    extractKeyFromUrl: jest.Mock;
  };
};

describe("handleGenerationComplete (upload_complete)", () => {
  const queueEntry = {
    queueId: "queue-123",
    comfyPromptId: "prompt-123",
    connectionId: "connection-abc",
    userId: "user-1",
    filename: "original.png",
    parameters: {
      width: 512,
      height: 512,
      prompt: "test",
      negativePrompt: "",
      isPublic: "true",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockQueueService.findQueueEntryByPromptId.mockResolvedValue(queueEntry);
    mockQueueService.updateQueueEntry.mockResolvedValue(undefined);

    S3Service.getRelativePath.mockImplementation((key: string) =>
      key.startsWith("/") ? key : `/${key}`
    );
    S3Service.composePublicUrl.mockImplementation(
      (relativePath: string) => `https://cdn.example.com${relativePath}`
    );
    S3Service.extractKeyFromUrl.mockImplementation((url: string) => {
      const match = url.match(/https?:\/\/[^/]+\/(.+)$/);
      return match ? match[1] : null;
    });

    DynamoDBService.createMedia.mockResolvedValue(undefined);
    DynamoDBService.updateMedia.mockResolvedValue(undefined);
    DynamoDBService.deleteMedia.mockResolvedValue(undefined);
    DynamoDBService.incrementUserProfileMetric.mockResolvedValue(undefined);
    DynamoDBService.convertMediaEntityToMedia.mockImplementation(
      (entity: any) => ({ id: entity.id, url: entity.url })
    );
  });

  it("persists uploaded images and reports partial failures", async () => {
    const message: ComfyUIUploadCompleteMessage = {
      type: "upload_complete",
      data: {
        prompt_id: "prompt-123",
        node: "node-1",
        uploaded_images: [
          {
            index: 0,
            s3Key: "generated/queue-123/image-0.png",
            relativePath: "/generated/queue-123/image-0.png",
            publicUrl:
              "https://cdn.example.com/generated/queue-123/image-0.png",
            size: 1024,
            mimeType: "image/png",
            originalFilename: "image-0.png",
          },
        ],
        failed_uploads: [
          { index: 1, filename: "image-1.png", error: "timeout" },
        ],
        total_images: 2,
        status: "partial",
      },
    };

    await handleGenerationComplete(message);

    expect(DynamoDBService.createMedia).toHaveBeenCalledTimes(1);
    const createdEntity = DynamoDBService.createMedia.mock.calls[0][0];
    expect(createdEntity).toMatchObject({
      id: "queue-123_0",
      filename: "generated/queue-123/image-0.png",
      url: "/generated/queue-123/image-0.png",
      mimeType: "image/png",
      metadata: expect.objectContaining({
        generationId: "queue-123",
        batchCount: 2,
      }),
    });

    expect(DynamoDBService.incrementUserProfileMetric).toHaveBeenCalledWith(
      "user-1",
      "totalGeneratedMedias",
      1
    );
    expect(DynamoDBService.convertMediaEntityToMedia).toHaveBeenCalledTimes(1);

    expect(mockQueueService.updateQueueEntry).toHaveBeenCalledWith(
      "queue-123",
      expect.objectContaining({
        status: "completed",
        resultImageUrl:
          "https://cdn.example.com/generated/queue-123/image-0.png",
      })
    );

    const [{ input }] = mockApiGatewayClient.send.mock.calls.slice(-1);
    const payload = JSON.parse(input.Data);

    expect(payload.status).toBe("completed");
    expect(payload.medias).toHaveLength(1);
    expect(payload.partialFailures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ index: 1, error: "timeout" }),
      ])
    );
  });

  it("marks queue as failed when no uploads succeed", async () => {
    const message: ComfyUIUploadCompleteMessage = {
      type: "upload_complete",
      data: {
        prompt_id: "prompt-123",
        node: "node-1",
        uploaded_images: [],
        failed_uploads: [{ index: 0, error: "network failure" }],
        total_images: 1,
        status: "failed",
      },
    };

    await handleGenerationComplete(message);

    expect(mockQueueService.updateQueueEntry).toHaveBeenCalledWith(
      "queue-123",
      expect.objectContaining({
        status: "failed",
        errorMessage: "Generation failed: no images uploaded",
      })
    );

    const [{ input }] = mockApiGatewayClient.send.mock.calls.slice(-1);
    const payload = JSON.parse(input.Data);
    expect(payload.type).toBe("failed");
    expect(payload.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ error: "network failure" }),
      ])
    );
  });
});
