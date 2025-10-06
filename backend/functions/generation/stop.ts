import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  LambdaHandlerUtil,
  OptionalAuthResult,
} from "@shared/utils/lambda-handler";
import { ResponseUtil } from "@shared/utils/response";
import { ValidationUtil } from "@shared/utils/validation";
import { GenerationQueueService } from "@shared/services/generation-queue";
import {
  StopGenerationRequest,
  StopGenerationResponse,
} from "@shared/shared-types";

function parseRequestBody(
  event: APIGatewayProxyEvent
): StopGenerationRequest | null {
  if (!event.body) {
    return null;
  }

  try {
    const parsed = JSON.parse(event.body) as StopGenerationRequest;
    return parsed;
  } catch (error) {
    console.error("Failed to parse stop generation payload", error);
    return null;
  }
}

async function handleStopGeneration(
  event: APIGatewayProxyEvent,
  auth: OptionalAuthResult
): Promise<APIGatewayProxyResult> {
  if (event.httpMethod !== "POST") {
    return ResponseUtil.methodNotAllowed(event, "Only POST method allowed");
  }

  const payload = parseRequestBody(event);
  if (!payload || !payload.queueId) {
    return ResponseUtil.badRequest(event, "queueId is required");
  }

  const queueId = ValidationUtil.validateRequiredString(
    payload.queueId,
    "queueId"
  );

  const queueService = GenerationQueueService.getInstance();
  const queueEntry = await queueService.getQueueEntry(queueId);

  if (!queueEntry) {
    return ResponseUtil.notFound(event, "Queue entry not found");
  }

  const isOwner =
    !!queueEntry.userId && !!auth.userId && queueEntry.userId === auth.userId;
  const connectionMatches =
    !!payload.connectionId &&
    !!queueEntry.connectionId &&
    payload.connectionId === queueEntry.connectionId;

  if (!isOwner && !connectionMatches) {
    return ResponseUtil.forbidden(
      event,
      "You are not authorized to stop this generation"
    );
  }

  try {
    await queueService.removeQueueEntry(queueId);

    // Update queue positions for remaining entries, but don't fail the request if this errors.
    try {
      await queueService.updateQueuePositions();
    } catch (updateError) {
      console.warn("Failed to update queue positions after stop", {
        queueId,
        updateError,
      });
    }
  } catch (error) {
    console.error("Failed to stop generation", { queueId, error });
    return ResponseUtil.internalError(
      event,
      "Failed to stop generation request"
    );
  }

  const response: StopGenerationResponse = {
    queueId,
    status: "stopped",
  };

  return ResponseUtil.success(event, response);
}

export const handler = LambdaHandlerUtil.withOptionalAuth(handleStopGeneration, {
  requireBody: true,
});
