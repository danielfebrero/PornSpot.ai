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

export interface I2VLoraSelectionResult {
  loras: string[];
  triggerWords: string[];
}

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

  static async selectI2VLoras(prompt: string): Promise<I2VLoraSelectionResult> {
    const cleanedPrompt = prompt?.trim();
    if (!cleanedPrompt) {
      return { loras: [], triggerWords: [] };
    }

    try {
      const openRouter = OpenRouterService.getInstance();
      const response = await openRouter.chatCompletion({
        instructionTemplate: "i2v-loras-selection",
        userMessage: cleanedPrompt,
        model: "mistralai/mistral-medium-3.1",
        parameters: {
          temperature: 0.1,
          max_tokens: 256,
        },
      });

      const content = (response.content || "").trim();
      if (!content) {
        return { loras: [], triggerWords: [] };
      }

      try {
        const candidates: string[] = [];

        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (codeBlockMatch?.[1]) {
          candidates.push(codeBlockMatch[1].trim());
        }

        const structuredMatch = content.match(
          /\{[\s\S]*?"loras"\s*:\s*\[[\s\S]*?\][\s\S]*?"trigger_words"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/i
        );
        if (structuredMatch?.[0]) {
          candidates.push(structuredMatch[0].trim());
        }

        const fallbackMatch = content.match(/\{[\s\S]*\}/);
        if (fallbackMatch?.[0]) {
          candidates.push(fallbackMatch[0].trim());
        }

        const seen = new Set<string>();
        let parsed: unknown = null;

        for (const candidate of candidates) {
          const normalized = candidate.trim();
          if (!normalized || seen.has(normalized)) {
            continue;
          }
          seen.add(normalized);

          try {
            parsed = JSON.parse(normalized);
            break;
          } catch (candidateParseError) {
            console.warn(
              "Failed to parse candidate JSON for i2v lora response",
              {
                candidate: normalized,
                candidateParseError,
              }
            );
          }
        }

        if (!parsed) {
          throw new Error("No valid JSON candidates found");
        }

        const parsedObject = parsed as Record<string, unknown>;

        const rawLoras = Array.isArray(parsedObject["loras"])
          ? (parsedObject["loras"] as unknown[])
          : [];

        const triggerWordsSource = Array.isArray(parsedObject["trigger_words"])
          ? (parsedObject["trigger_words"] as unknown[])
          : Array.isArray(parsedObject["triggerWords"])
          ? (parsedObject["triggerWords"] as unknown[])
          : [];

        const loras = rawLoras
          .map((name: unknown) =>
            typeof name === "string" ? name.trim().toUpperCase() : ""
          )
          .filter(Boolean);

        const triggerWords = triggerWordsSource
          .map((word: unknown) => (typeof word === "string" ? word.trim() : ""))
          .filter(Boolean);

        return { loras, triggerWords };
      } catch (parseError) {
        console.warn("Failed to parse i2v lora response as JSON", {
          content,
          parseError,
        });
        return { loras: [], triggerWords: [] };
      }
    } catch (error) {
      console.error("❌ Failed to select I2V LoRAs:", error);
      return { loras: [], triggerWords: [] };
    }
  }
}
