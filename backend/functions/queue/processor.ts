/*
File objective: Process generation requests from the queue using ComfyUI.
Auth: Internal Lambda function - no user auth required.
Special notes:
- Polls the queue for pending requests
- Processes them with ComfyUI
- Updates queue status and broadcasts progress
- Handles image download and S3 storage
*/
import { ScheduledEvent, Context } from "aws-lambda";
import {
  GenerationQueueService,
  QueueEntry,
} from "@shared/services/generation-queue";
import {
  getComfyUIClient,
  initializeComfyUIClient,
} from "@shared/services/comfyui-client";
import { WorkflowParameters } from "@shared/templates/comfyui-workflow";
import { broadcastToPromptSubscribers } from "../websocket/route";
import {
  saveGeneratedMediaToDatabase,
  createGenerationId,
} from "../generation/utils";
import { S3StorageService } from "@shared/services/s3-storage";
import { ParameterStoreService } from "@shared/utils/parameters";
import {
  ComfyUIError,
  ComfyUIErrorType,
  ComfyUIRetryHandler,
} from "@shared/services/comfyui-error-handler";

const processQueuedGeneration = async (
  queueEntry: QueueEntry
): Promise<void> => {
  const queueService = GenerationQueueService.getInstance();

  console.log(`🎨 Processing queue item: ${queueEntry.queueId}`);

  try {
    // Mark as processing
    await queueService.updateQueueEntry(queueEntry.queueId, {
      status: "processing",
      startedAt: Date.now(),
    });

    // Broadcast processing status
    await broadcastToPromptSubscribers(queueEntry.queueId, {
      type: "processing",
      message: "Your generation is now being processed",
    });

    // Initialize ComfyUI client
    const comfyUIEndpoint =
      process.env["COMFYUI_ENDPOINT"] || "http://localhost:8188";
    let comfyUIClient;

    try {
      comfyUIClient = getComfyUIClient();
    } catch {
      comfyUIClient = initializeComfyUIClient(comfyUIEndpoint);
    }

    // Health check ComfyUI with retry
    const isHealthy = await ComfyUIRetryHandler.withRetry(
      () => comfyUIClient.healthCheck(),
      { maxRetries: 2, baseDelay: 2000 },
      { operationName: "healthCheck", promptId: queueEntry.queueId }
    );

    if (!isHealthy) {
      throw new ComfyUIError(
        ComfyUIErrorType.CONNECTION_FAILED,
        "ComfyUI service is not available after health check",
        { promptId: queueEntry.queueId, retryable: true }
      );
    }

    // Create workflow parameters
    const workflowParams: WorkflowParameters = {
      prompt: queueEntry.prompt,
      negativePrompt: undefined, // TODO: Add negative prompt support to queue
      width: queueEntry.parameters.width,
      height: queueEntry.parameters.height,
      batchSize: queueEntry.parameters.batch_size || 1,
      selectedLoras: undefined, // TODO: Add LoRA support to queue
    };

    // Generate unique generation ID for this processing
    const generationId = createGenerationId();

    // Submit prompt to ComfyUI
    const submitResult = await comfyUIClient.submitPrompt(
      workflowParams,
      generationId
    );
    const promptId = submitResult.promptId;

    // Update queue entry with ComfyUI prompt ID
    await queueService.updateQueueEntry(queueEntry.queueId, {
      comfyPromptId: promptId,
    });

    console.log(
      `🎨 ComfyUI generation started: ${promptId} for queue item ${queueEntry.queueId}`
    );

    // Connect for real-time updates and relay to WebSocket subscribers
    await comfyUIClient.connectForUpdates(
      promptId,
      generationId,
      async (progress) => {
        console.log(`📊 Generation progress for ${promptId}:`, progress);

        // Broadcast progress to WebSocket subscribers
        try {
          await broadcastToPromptSubscribers(queueEntry.queueId, {
            type: progress.status,
            progress: progress.progress,
            maxProgress: progress.maxProgress,
            message: progress.message,
            currentNode: progress.currentNode,
            images: progress.images,
          });
        } catch (broadcastError) {
          console.error("Failed to broadcast progress:", broadcastError);
        }
      }
    );

    // Wait for generation to complete with enhanced error handling
    let completed = false;
    let attempts = 0;
    const maxAttempts = 300; // 5 minutes timeout (300 seconds)

    while (!completed && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

      try {
        const history = await comfyUIClient.getPromptHistory(promptId);
        if (history && history.status.completed) {
          completed = true;

          // Download and process generated images
          const imageUrls: string[] = [];
          const s3Storage = S3StorageService.getInstance();

          if (history.outputs) {
            for (const [, output] of Object.entries(history.outputs)) {
              if (output.images) {
                const imageBuffers: Buffer[] = [];

                // Download all images from ComfyUI with enhanced error handling
                for (const imageResult of output.images) {
                  try {
                    const imageBuffer = await ComfyUIRetryHandler.withRetry(
                      () => comfyUIClient.downloadImage(imageResult),
                      { maxRetries: 3, baseDelay: 1000 },
                      {
                        operationName: `downloadImage(${imageResult.filename})`,
                        promptId,
                      }
                    );
                    imageBuffers.push(imageBuffer);
                    console.log(`📸 Downloaded image: ${imageResult.filename}`);
                  } catch (downloadError) {
                    console.error(
                      `Failed to download image ${imageResult.filename}:`,
                      downloadError instanceof ComfyUIError
                        ? `${downloadError.type}: ${downloadError.message}`
                        : downloadError
                    );

                    // For critical failures, continue with other images
                    if (
                      downloadError instanceof ComfyUIError &&
                      !downloadError.retryable
                    ) {
                      console.warn(
                        `Skipping non-retryable image download failure for ${imageResult.filename}`
                      );
                    }
                  }
                }

                // Upload images to S3
                if (imageBuffers.length > 0) {
                  try {
                    const uploadResults = await s3Storage.uploadGeneratedImages(
                      imageBuffers,
                      generationId,
                      "image/jpeg"
                    );

                    // Use CloudFront URLs if available, otherwise S3 URLs
                    imageUrls.push(
                      ...uploadResults.map((result) => result.publicUrl)
                    );
                    console.log(
                      `☁️ Uploaded ${uploadResults.length} images to S3/CloudFront`
                    );
                  } catch (uploadError) {
                    console.error(
                      "Failed to upload images to S3:",
                      uploadError
                    );
                    // Fallback to placeholder URLs if S3 upload fails
                    for (let i = 0; i < imageBuffers.length; i++) {
                      const fallbackUrl = `https://placeholder-s3-url.com/${generationId}_${i}.jpg`;
                      imageUrls.push(fallbackUrl);
                    }
                  }
                }
              }
            }
          }

          // Save generated media to database
          const saveResult = await saveGeneratedMediaToDatabase({
            userId: queueEntry.userId,
            generationId,
            batchCount: imageUrls.length,
            prompt: queueEntry.prompt,
            negativePrompt: undefined,
            imageSize: `${queueEntry.parameters.width}x${queueEntry.parameters.height}`,
            selectedLoras: [],
            mockUrls: imageUrls, // Will be replaced with real URLs when S3 integration is complete
          });

          // Update queue entry as completed
          await queueService.updateQueueEntry(queueEntry.queueId, {
            status: "completed",
            completedAt: Date.now(),
            resultImageUrl: imageUrls[0], // Store first image URL
          });

          // Broadcast completion
          await broadcastToPromptSubscribers(queueEntry.queueId, {
            type: "completed",
            images: saveResult.mediaEntities,
            message: "Generation completed successfully",
          });

          console.log(
            `✅ Queue item ${queueEntry.queueId} completed successfully with ${saveResult.savedCount} images`
          );

          // Clean up connection
          comfyUIClient.disconnectFromUpdates(promptId);

          return;
        } else if (history && history.status.error) {
          throw new ComfyUIError(
            ComfyUIErrorType.GENERATION_FAILED,
            `ComfyUI generation failed: ${history.status.messages.join(", ")}`,
            { promptId, retryable: false }
          );
        }
      } catch (error) {
        if (error instanceof ComfyUIError) {
          // If it's a generation failure, don't retry the polling
          if (error.type === ComfyUIErrorType.GENERATION_FAILED) {
            throw error;
          }
          // For network errors, log and continue polling
          console.warn(
            `History polling error (attempt ${attempts}):`,
            error.message
          );
        } else {
          console.warn(`Unexpected error during history polling:`, error);
        }
      }

      attempts++;
    }

    if (!completed) {
      throw new ComfyUIError(
        ComfyUIErrorType.TIMEOUT,
        "Generation timeout - ComfyUI took too long to complete",
        { promptId, retryable: true }
      );
    }
  } catch (error) {
    const comfyError =
      error instanceof ComfyUIError
        ? error
        : new ComfyUIError(
            ComfyUIErrorType.UNKNOWN_ERROR,
            error instanceof Error ? error.message : "Unknown error",
            { promptId: queueEntry.queueId }
          );

    console.error(
      `❌ Queue processing error for ${queueEntry.queueId}:`,
      `${comfyError.type}: ${comfyError.message}`
    );

    // Determine if this should be retried based on error type
    const shouldRetry =
      comfyError.retryable && (queueEntry.retryCount || 0) < 3;

    if (shouldRetry) {
      // Update queue entry for retry
      await queueService.updateQueueEntry(queueEntry.queueId, {
        status: "pending", // Reset to pending for retry
        retryCount: (queueEntry.retryCount || 0) + 1,
        lastErrorMessage: comfyError.message,
        errorType: comfyError.type,
      });

      console.log(
        `🔄 Queue item ${queueEntry.queueId} will be retried (attempt ${
          (queueEntry.retryCount || 0) + 1
        }/3)`
      );

      // Broadcast retry message
      try {
        await broadcastToPromptSubscribers(queueEntry.queueId, {
          type: "retrying",
          error: comfyError.message,
          message: `Generation failed, retrying... (attempt ${
            (queueEntry.retryCount || 0) + 1
          }/3)`,
          retryCount: (queueEntry.retryCount || 0) + 1,
        });
      } catch (broadcastError) {
        console.error("Failed to broadcast retry message:", broadcastError);
      }
    } else {
      // Mark as permanently failed
      await queueService.updateQueueEntry(queueEntry.queueId, {
        status: "failed",
        completedAt: Date.now(),
        errorMessage: comfyError.message,
        errorType: comfyError.type,
      });

      // Broadcast final failure
      try {
        await broadcastToPromptSubscribers(queueEntry.queueId, {
          type: "error",
          error: comfyError.message,
          message: comfyError.retryable
            ? "Generation failed after maximum retries"
            : "Generation failed - this error cannot be retried",
          errorType: comfyError.type,
        });
      } catch (broadcastError) {
        console.error("Failed to broadcast error:", broadcastError);
      }

      throw comfyError;
    }
  }
};

export const handler = async (
  _event: ScheduledEvent,
  _context: Context
): Promise<{ statusCode: number; body: string }> => {
  console.log("🔄 Queue processor triggered");

  const queueService = GenerationQueueService.getInstance();

  try {
    // Clean up timed out entries first
    await queueService.cleanupTimeoutEntries();

    // Update queue positions
    await queueService.updateQueuePositions();

    // Process up to 3 items from the queue concurrently
    const maxConcurrentProcessing = 3;
    const processingPromises: Promise<void>[] = [];

    for (let i = 0; i < maxConcurrentProcessing; i++) {
      const queueEntry = await queueService.getNextPendingItem();

      if (!queueEntry) {
        console.log("📭 No pending items in queue");
        break;
      }

      console.log(`🎯 Processing queue item ${i + 1}: ${queueEntry.queueId}`);

      // Process item asynchronously
      const processingPromise = processQueuedGeneration(queueEntry).catch(
        (error) => {
          console.error(
            `Failed to process queue item ${queueEntry.queueId}:`,
            error
          );
          // Don't throw to avoid stopping other processing
        }
      );

      processingPromises.push(processingPromise);
    }

    // Wait for all processing to complete
    if (processingPromises.length > 0) {
      await Promise.all(processingPromises);
      console.log(`✅ Processed ${processingPromises.length} queue items`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Processed ${processingPromises.length} queue items`,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("❌ Queue processor error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
