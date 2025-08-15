import { ParameterStoreService } from "@shared/utils/parameters";
import * as fs from "fs";
import * as path from "path";
import type {
  OpenRouterChatRequest,
  OpenRouterChatResponse,
  OpenRouterStreamChunk,
  InstructionTemplate,
  ChatCompletionRequest,
  ChatCompletionResponse,
  OpenRouterMessage,
} from "@shared/shared-types";

export class OpenRouterService {
  private static instance: OpenRouterService;
  private apiKey: string | null = null;
  private baseUrl = "https://openrouter.ai/api/v1";
  private instructionTemplates: Map<string, InstructionTemplate> = new Map();

  private constructor() {
    this.loadInstructionTemplates();
  }

  public static getInstance(): OpenRouterService {
    if (!OpenRouterService.instance) {
      OpenRouterService.instance = new OpenRouterService();
    }
    return OpenRouterService.instance;
  }

  /**
   * Get the API key from parameter store (cached after first retrieval)
   */
  private async getApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await ParameterStoreService.getOpenRouterApiKey();
    }
    return this.apiKey;
  }

  /**
   * Load instruction templates from the instructions directory
   */
  private loadInstructionTemplates(): void {
    try {
      const instructionsDir = path.join(__dirname, "../instructions");
      const files = fs.readdirSync(instructionsDir);

      for (const file of files) {
        if (file.endsWith(".txt")) {
          const templateName = file.replace(".txt", "");
          const filePath = path.join(instructionsDir, file);
          const content = fs.readFileSync(filePath, "utf-8");

          // Create instruction template
          const template: InstructionTemplate = {
            name: templateName,
            description: `Instruction template loaded from ${file}`,
            systemInstructions: content,
            variableInstructions: {
              currentDateTime: () => new Date().toISOString(),
              platformName: () => "PornSpot.ai",
            },
            defaultParameters: {
              temperature: 0.7,
              max_tokens: 2048,
              reasoning: {
                enabled: false,
              },
              provider: {
                only: ["mistral"],
              },
            },
          };

          this.instructionTemplates.set(templateName, template);
          console.log(`Loaded instruction template: ${templateName}`);
        }
      }
    } catch (error) {
      console.error("Error loading instruction templates:", error);
    }
  }

  /**
   * Get an instruction template by name
   */
  private getInstructionTemplate(name: string): InstructionTemplate | null {
    return this.instructionTemplates.get(name) || null;
  }

  /**
   * Process template variables in content
   */
  private processTemplateVariables(
    content: string,
    template: InstructionTemplate,
    userVariables?: Record<string, string>
  ): string {
    let processedContent = content;

    // Process built-in variable instructions
    if (template.variableInstructions) {
      for (const [key, getValue] of Object.entries(
        template.variableInstructions
      )) {
        const placeholder = `{{${key}}}`;
        const value = getValue();
        processedContent = processedContent.replace(
          new RegExp(placeholder, "g"),
          value
        );
      }
    }

    // Process user-provided variables
    if (userVariables) {
      for (const [key, value] of Object.entries(userVariables)) {
        const placeholder = `{{${key}}}`;
        processedContent = processedContent.replace(
          new RegExp(placeholder, "g"),
          value
        );
      }
    }

    return processedContent;
  }

  /**
   * Make a chat completion request to OpenRouter
   */
  async chatCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    const apiKey = await this.getApiKey();
    const template = this.getInstructionTemplate(request.instructionTemplate);

    if (!template) {
      throw new Error(
        `Instruction template "${request.instructionTemplate}" not found`
      );
    }

    // Process system instructions with variables
    const processedSystemInstructions = this.processTemplateVariables(
      template.systemInstructions,
      template,
      request.variables
    );

    // Build messages array
    const messages: OpenRouterMessage[] = [
      {
        role: "system",
        content: processedSystemInstructions,
      },
      {
        role: "user",
        content: request.userMessage,
      },
    ];

    // Merge parameters
    const requestParams: OpenRouterChatRequest = {
      model: request.model || "mistralai/mistral-medium-3.1",
      messages,
      stream: false,
      ...template.defaultParameters,
      ...request.parameters,
    };

    console.log(
      `Making OpenRouter API request with model: ${requestParams.model}`
    );

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://pornspot.ai",
          "X-Title": "PornSpot.ai",
        },
        body: JSON.stringify(requestParams),
      });
      console.log("Got response from open router");

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenRouter API error (${response.status}): ${errorText}`
        );
      }

      console.log("will parse json");

      const data = (await response.json()) as OpenRouterChatResponse;

      console.log("got json");

      if (!data.choices || data.choices.length === 0) {
        throw new Error("No response from OpenRouter API");
      }

      const choice = data.choices[0];
      if (!choice?.message?.content) {
        throw new Error("Invalid response format from OpenRouter API");
      }

      return {
        content: choice.message.content,
        usage: data.usage,
        model: data.model,
      };
    } catch (error) {
      console.error("OpenRouter API error:", error);
      throw error;
    }
  }

  /**
   * Make a streaming chat completion request to OpenRouter
   */
  async chatCompletionStream(
    request: ChatCompletionRequest
  ): Promise<AsyncGenerator<string, void, unknown>> {
    const apiKey = await this.getApiKey();
    const template = this.getInstructionTemplate(request.instructionTemplate);

    if (!template) {
      throw new Error(
        `Instruction template "${request.instructionTemplate}" not found`
      );
    }

    // Process system instructions with variables
    const processedSystemInstructions = this.processTemplateVariables(
      template.systemInstructions,
      template,
      request.variables
    );

    // Build messages array
    const messages: OpenRouterMessage[] = [
      {
        role: "system",
        content: processedSystemInstructions,
      },
      {
        role: "user",
        content: request.userMessage,
      },
    ];

    // Merge parameters
    const requestParams: OpenRouterChatRequest = {
      model: request.model || "mistralai/mistral-small-3.2-24b-instruct",
      messages,
      stream: true,
      ...template.defaultParameters,
      ...request.parameters,
    };

    console.log(
      `Making streaming OpenRouter API request with model: ${requestParams.model}`
    );

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://pornspot.ai",
        "X-Title": "PornSpot.ai",
      },
      body: JSON.stringify(requestParams),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenRouter API error (${response.status}): ${errorText}`
      );
    }

    if (!response.body) {
      throw new Error("No response body from OpenRouter API");
    }

    return this.parseStreamResponse(response.body);
  }

  /**
   * Parse the streaming response from OpenRouter
   */
  private async *parseStreamResponse(
    body: ReadableStream<Uint8Array>
  ): AsyncGenerator<string, void, unknown> {
    const reader = body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.trim() === "") continue;
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") return;

            try {
              const parsed: OpenRouterStreamChunk = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (parseError) {
              console.warn("Failed to parse stream chunk:", parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get list of available instruction templates
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.instructionTemplates.keys());
  }

  /**
   * Get details of a specific instruction template
   */
  getTemplateDetails(name: string): InstructionTemplate | null {
    return this.getInstructionTemplate(name);
  }
}
