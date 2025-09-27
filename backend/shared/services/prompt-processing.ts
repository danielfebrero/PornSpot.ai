import { OpenRouterService } from "@shared/services/openrouter-chat";

const MODERATION_MODEL = "mistralai/mistral-medium-3.1";
const OPTIMIZATION_MODEL = "mistralai/mistral-medium-3.1";

export type PromptModerationResult =
  | { success: true }
  | { success: false; reason: string };

export interface OptimizeI2VPromptOptions {
  prompt: string;
  imageUrl: string;
}

export type OptimizeI2VPromptResult =
  | { success: true; prompt: string }
  | { success: false; error: string };

export class PromptProcessingService {
  static async moderatePrompt(prompt: string): Promise<PromptModerationResult> {
    try {
      const openRouter = OpenRouterService.getInstance();
      const response = await openRouter.chatCompletion({
        instructionTemplate: "prompt-moderation",
        userMessage: (prompt || "").trim(),
        model: MODERATION_MODEL,
        parameters: {
          temperature: 0.1,
          max_tokens: 256,
        },
      });

      const content = (response.content || "").trim();
      if (content === "OK") {
        console.log("✅ Prompt passed moderation check");
        return { success: true };
      }

      const jsonMatch = content.match(/\{[^}]*"reason"\s*:\s*"([^"]+)"[^}]*\}/);
      const reason = jsonMatch?.[1] || "Content violates platform rules";
      console.log("❌ Prompt rejected by moderation:", reason);
      return { success: false, reason };
    } catch (error) {
      console.error("❌ Moderation check failed:", error);
      return { success: false, reason: "Moderation check failed" };
    }
  }

  static async optimizeI2VPrompt(
    options: OptimizeI2VPromptOptions
  ): Promise<OptimizeI2VPromptResult> {
    const prompt = options.prompt?.trim();
    if (!prompt) {
      return { success: false, error: "Prompt is empty" };
    }
    const imageUrl = options.imageUrl?.trim();
    if (!imageUrl) {
      return { success: false, error: "Image URL is empty" };
    }

    try {
      const openRouter = OpenRouterService.getInstance();
      const response = await openRouter.chatCompletion({
        instructionTemplate: "i2v-prompt-optimization",
        model: OPTIMIZATION_MODEL,
        userContent: [
          {
            type: "text",
            text: prompt,
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
        parameters: {
          temperature: 0.7,
          max_tokens: 1024,
        },
      });

      const optimizedPrompt = (response.content || "").trim();
      if (!optimizedPrompt) {
        console.warn("⚠️ Received empty optimized prompt; returning original");
        return { success: false, error: "Empty optimized prompt" };
      }

      return { success: true, prompt: optimizedPrompt };
    } catch (error) {
      console.error("❌ Failed to optimize I2V prompt:", error);
      return { success: false, error: "Prompt optimization failed" };
    }
  }
}
