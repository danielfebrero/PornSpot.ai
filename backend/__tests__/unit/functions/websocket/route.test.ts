import axios from "axios";

const mockQueueService = {
  findQueueEntryByPromptId: jest.fn(),
  updateQueueEntry: jest.fn(),
  getQueueEntry: jest.fn(),
};

const mockS3StorageService = {
  uploadGeneratedImageWithCustomFilename: jest.fn(),
};

const mockApiGatewayClient = {
  send: jest.fn(),
};

jest.mock("@shared/services/generation-queue", () => ({
  GenerationQueueService: {
    getInstance: jest.fn(() => mockQueueService),
  },
}));

jest.mock("@shared/services/s3-storage", () => ({
  S3StorageService: {
    getInstance: jest.fn(() => mockS3StorageService),
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
    ParameterStoreService: {
      getComfyUIApiEndpoint: jest.fn(),
    },
    S3Service: {
      getRelativePath: jest.fn(),
    },
  };
});

jest.mock("axios");

process.env.WEBSOCKET_API_ENDPOINT = "https://ws.example.com";

import { handleGenerationComplete } from "../../../../functions/websocket/route";

const { DynamoDBService, ParameterStoreService, S3Service } = jest.requireMock(
  "@shared"
) as {
  DynamoDBService: {
    createMedia: jest.Mock;
    updateMedia: jest.Mock;
    deleteMedia: jest.Mock;
    incrementUserProfileMetric: jest.Mock;
    convertMediaEntityToMedia: jest.Mock;
  };
  ParameterStoreService: {
    getComfyUIApiEndpoint: jest.Mock;
  };
  S3Service: {
    getRelativePath: jest.Mock;
  };
};

type ExecutedMessage = {
  type: "executed";
  data: {
    prompt_id: string;
    node: string;
    output: {
      images: Array<{ filename: string; subfolder: string; type: string }>;
    };
  };
};

describe("handleGenerationComplete", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    ParameterStoreService.getComfyUIApiEndpoint.mockResolvedValue(
      "https://comfy.example.com"
    );

    S3Service.getRelativePath.mockImplementation(
      (key: string) => `relative/${key}`
    );

    DynamoDBService.createMedia.mockResolvedValue(undefined);
    DynamoDBService.updateMedia.mockResolvedValue(undefined);
    DynamoDBService.deleteMedia.mockResolvedValue(undefined);
    DynamoDBService.incrementUserProfileMetric.mockResolvedValue(undefined);
    DynamoDBService.convertMediaEntityToMedia.mockImplementation(
      (entity: any) => ({ id: entity.id, url: entity.url })
    );

    mockS3StorageService.uploadGeneratedImageWithCustomFilename.mockResolvedValue(
      {
        publicUrl: "https://cdn.example.com/generated/queue-123_0.png",
      }
    );
  });

  it("completes generation while cleaning up failed downloads", async () => {
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

    mockQueueService.findQueueEntryByPromptId.mockResolvedValue(queueEntry);

    const successBuffer = Buffer.from("mock-image");
    const timeoutError = new Error("timeout");
    (timeoutError as any).code = "ECONNABORTED";

    const mockedAxios = axios as jest.Mocked<typeof axios>;
    mockedAxios.get.mockResolvedValueOnce({ status: 200, data: successBuffer });
    mockedAxios.get
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError);

    const message: ExecutedMessage = {
      type: "executed",
      data: {
        prompt_id: "prompt-123",
        node: "node-1",
        output: {
          images: [
            { filename: "image-1.png", subfolder: "", type: "output" },
            { filename: "image-2.png", subfolder: "", type: "output" },
          ],
        },
      },
    };

    await handleGenerationComplete(message as any);

    expect(mockQueueService.updateQueueEntry).toHaveBeenCalledWith(
      "queue-123",
      expect.objectContaining({
        status: "completed",
        resultImageUrl: "https://cdn.example.com/generated/queue-123_0.png",
      })
    );

    expect(
      mockQueueService.updateQueueEntry.mock.calls.some(
        ([, update]) => update?.status === "failed"
      )
    ).toBe(false);

    expect(DynamoDBService.deleteMedia).toHaveBeenCalledWith("queue-123_1");
    expect(DynamoDBService.incrementUserProfileMetric).toHaveBeenCalledWith(
      "user-1",
      "totalGeneratedMedias",
      -1
    );
    expect(DynamoDBService.convertMediaEntityToMedia).toHaveBeenCalledTimes(1);

    const metadataUpdates = DynamoDBService.updateMedia.mock.calls.filter(
      ([, update]) => update?.metadata
    );
    metadataUpdates.forEach(([, update]) => {
      expect(update?.metadata?.bulkSiblings).toBeUndefined();
    });

    const [{ input }] = mockApiGatewayClient.send.mock.calls.slice(-1);
    const payload = JSON.parse(input.Data);

    expect(payload.status).toBe("completed");
    expect(payload.medias).toHaveLength(1);
    expect(payload.partialFailures).toEqual(
      expect.arrayContaining([expect.objectContaining({ index: 1 })])
    );
  });
});
