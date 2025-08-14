/*
File objective: Stream optimized AI prompt generation in real-time using Server-Sent Events.
Auth: Requires user session via LambdaHandlerUtil.withAuth.
Special notes:
- Streams prompt optimization tokens in real-time to frontend
- Uses OpenRouter's streaming API for token-by-token optimization
- Returns Server-Sent Events for real-time updates during prompt optimization
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { OpenRouterService } from "@shared/services/openrouter-chat";

interface OptimizePromptRequest {
  prompt: string;
}

const handleOptimizePromptStream = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("🎨 /generation/optimize-prompt-stream handler called");

  if (event.httpMethod !== "POST") {
    return ResponseUtil.badRequest(event, "Only POST method allowed");
  }

  console.log("✅ Authenticated user:", auth.userId);

  const requestBody: OptimizePromptRequest =
    LambdaHandlerUtil.parseJsonBody(event);
  const { prompt } = requestBody;

  // Validate required fields
  const validatedPrompt = ValidationUtil.validateRequiredString(
    prompt,
    "Prompt"
  );

  if (validatedPrompt.length > 1000) {
    return ResponseUtil.badRequest(
      event,
      "Prompt is too long (max 1000 characters)"
    );
  }

  // Set headers for streaming response
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    const openRouterService = OpenRouterService.getInstance();
    let optimizedPrompt = "";
    let response = "";

    // Send initial event
    let eventData: any = {
      type: "optimization_start",
      originalPrompt: validatedPrompt,
      optimizedPrompt: "",
      completed: false,
    };
    response += `data: ${JSON.stringify(eventData)}\n\n`;

    // Get the stream from OpenRouter
    const stream = await openRouterService.chatCompletionStream({
      instructionTemplate: "prompt-optimization",
      userMessage: validatedPrompt,
      model: "mistralai/mistral-medium-3.1",
      parameters: {
        temperature: 0.7,
        max_tokens: 1024,
      },
    });

    // Stream the optimization tokens
    for await (const token of stream) {
      optimizedPrompt += token;
      eventData = {
        type: "optimization_token",
        originalPrompt: validatedPrompt,
        optimizedPrompt,
        token,
        completed: false,
      };
      response += `data: ${JSON.stringify(eventData)}\n\n`;
    }

    // Send completion event with final optimized prompt
    eventData = {
      type: "optimization_complete",
      originalPrompt: validatedPrompt,
      optimizedPrompt: optimizedPrompt.trim(),
      completed: true,
    };
    response += `data: ${JSON.stringify(eventData)}\n\n`;
    response += `data: [DONE]\n\n`;

    return {
      statusCode: 200,
      headers,
      body: response,
    };
  } catch (error) {
    console.error("❌ Prompt optimization failed:", error);

    // Send error event
    const errorData = {
      type: "optimization_error",
      originalPrompt: validatedPrompt,
      error: error instanceof Error ? error.message : "Unknown error",
      completed: true,
    };
    const errorResponse = `data: ${JSON.stringify(
      errorData
    )}\n\ndata: [DONE]\n\n`;

    return {
      statusCode: 200,
      headers,
      body: errorResponse,
    };
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleOptimizePromptStream, {
  requireBody: true,
});
