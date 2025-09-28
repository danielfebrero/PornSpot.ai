import { PromptProcessingService } from "../../../../shared/services/prompt-processing";

const mockChatCompletion = jest.fn();

jest.mock("@shared/services/openrouter-chat", () => ({
  OpenRouterService: {
    getInstance: () => ({
      chatCompletion: mockChatCompletion,
    }),
  },
}));

describe("PromptProcessingService.selectI2VLoras", () => {
  beforeEach(() => {
    mockChatCompletion.mockReset();
  });

  it("should extract LoRAs and trigger words from a JSON code block", async () => {
    mockChatCompletion.mockResolvedValue({
      content:
        'Here you go!```json\n{\n  "loras": ["anime-style"],\n  "trigger_words": ["dreamy light"]\n}\n```',
    });

    const result = await PromptProcessingService.selectI2VLoras("test prompt");

    expect(result.loras).toEqual(["ANIME-STYLE"]);
    expect(result.triggerWords).toEqual(["dreamy light"]);
  });

  it("should fallback to structured JSON within text when no code block is provided", async () => {
    mockChatCompletion.mockResolvedValue({
      content:
        'I recommend using the following configuration: { "loras": ["style-one"], "trigger_words": ["magic"] } Enjoy!',
    });

    const result = await PromptProcessingService.selectI2VLoras("test prompt");

    expect(result.loras).toEqual(["STYLE-ONE"]);
    expect(result.triggerWords).toEqual(["magic"]);
  });

  it("should return empty lists when JSON data is not present", async () => {
    mockChatCompletion.mockResolvedValue({
      content: "Sorry, I don't have any recommendations right now.",
    });

    const result = await PromptProcessingService.selectI2VLoras("test prompt");

    expect(result).toEqual({ loras: [], triggerWords: [] });
  });
});
