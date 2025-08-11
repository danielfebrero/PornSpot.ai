"use client";

import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { WebSocketMessage, GenerationQueueStatus } from "@/types/websocket";
import { GenerationResponse, GenerationSettings, Media } from "@/types";

interface GenerationRequest extends GenerationSettings {}

interface UseGenerationReturn {
  isGenerating: boolean;
  queueStatus: GenerationQueueStatus | null;
  generatedImages: Media[];
  error: string | null;
  progress: number;
  maxProgress: number;
  currentMessage: string;
  retryCount: number;
  isRetrying: boolean;
  generateImages: (request: GenerationRequest) => Promise<void>;
  clearResults: () => void;
}

export function useGeneration(): UseGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [queueStatus, setQueueStatus] = useState<GenerationQueueStatus | null>(
    null
  );
  const [generatedImages, setGeneratedImages] = useState<Media[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [maxProgress, setMaxProgress] = useState(100);
  const [currentMessage, setCurrentMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const { subscribe, unsubscribe, isConnected } = useWebSocket();
  const currentQueueIdRef = useRef<string | null>(null);

  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      console.log("🎨 Generation update received:", message);

      switch (message.type) {
        case "queued":
          setQueueStatus({
            queueId: message.queueId!,
            queuePosition: message.queuePosition || 0,
            estimatedWaitTime: message.estimatedWaitTime || 0,
            status: "pending",
            message: message.message || "Added to queue",
          });
          setCurrentMessage(
            message.message || `Position ${message.queuePosition} in queue`
          );
          break;

        case "processing":
          setIsRetrying(false); // Clear retry state when processing starts
          setQueueStatus((prev) =>
            prev
              ? {
                  ...prev,
                  status: "processing",
                  message: message.message || "Processing...",
                }
              : null
          );
          setCurrentMessage(
            message.message || "Your generation is now being processed"
          );
          break;

        case "progress":
          setProgress(message.progress || 0);
          setMaxProgress(message.maxProgress || 100);
          setCurrentMessage(
            message.message ||
              `Processing... ${Math.round(
                ((message.progress || 0) / (message.maxProgress || 100)) * 100
              )}%`
          );
          break;

        case "completed":
          setQueueStatus((prev) =>
            prev
              ? {
                  ...prev,
                  status: "completed",
                  message: message.message || "Generation completed",
                  images: message.medias,
                }
              : null
          );

          if (message.medias) {
            setGeneratedImages(message.medias);
          }

          setCurrentMessage(
            message.message || "Generation completed successfully!"
          );
          setIsGenerating(false);
          setProgress(100);

          // Unsubscribe from updates
          if (currentQueueIdRef.current) {
            unsubscribe(currentQueueIdRef.current);
            currentQueueIdRef.current = null;
          }
          break;

        case "retrying":
          setRetryCount(message.retryCount || 1);
          setIsRetrying(true);
          setError(null); // Clear previous error on retry
          setQueueStatus((prev) =>
            prev
              ? {
                  ...prev,
                  status: "pending", // Reset to pending for retry
                  message: message.message || "Retrying generation...",
                }
              : null
          );
          setCurrentMessage(
            message.message ||
              `Retrying generation... (attempt ${message.retryCount || 1}/3)`
          );
          setProgress(0); // Reset progress for retry
          break;

        case "error":
          // Check if this is a final failure or if retries are still possible
          const isRetryableError =
            message.errorType && message.retryCount && message.retryCount < 3;

          setError(message.error || "Generation failed");
          setCurrentMessage(
            message.message ||
              (isRetryableError
                ? "Generation failed, but will be retried automatically"
                : "Generation failed")
          );

          // Only stop generating if this is a final failure
          if (!isRetryableError) {
            setIsGenerating(false);

            // Unsubscribe from updates
            if (currentQueueIdRef.current) {
              unsubscribe(currentQueueIdRef.current);
              currentQueueIdRef.current = null;
            }
          }
          break;
      }
    },
    [unsubscribe]
  );

  const generateImages = useCallback(
    async (request: GenerationRequest) => {
      if (!isConnected) {
        setError("WebSocket not connected. Please refresh the page.");
        return;
      }

      try {
        setIsGenerating(true);
        setError(null);
        setGeneratedImages([]);
        setProgress(0);
        setMaxProgress(100);
        setCurrentMessage("Submitting request...");
        setQueueStatus(null);

        // Get API URL from environment
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "https://your-api-gateway-url";

        console.log("🚀 Submitting generation request:", request);

        const response = await fetch(`${apiUrl}/generation/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Include cookies for authentication
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message ||
              `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const result: GenerationResponse = await response.json();
        console.log("✅ Generation request submitted:", result);

        // Store the queue ID for WebSocket subscription
        currentQueueIdRef.current = result.queueId;

        // Set initial queue status
        setQueueStatus({
          queueId: result.queueId,
          queuePosition: result.queuePosition,
          estimatedWaitTime: result.estimatedWaitTime,
          status: result.status,
          message: result.message,
        });

        setCurrentMessage(result.message);

        // Subscribe to WebSocket updates for this generation
        subscribe(result.queueId, handleWebSocketMessage);
      } catch (err) {
        console.error("❌ Generation request failed:", err);

        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        setCurrentMessage(`Error: ${errorMessage}`);
        setIsGenerating(false);

        // Clean up any pending subscription
        if (currentQueueIdRef.current) {
          unsubscribe(currentQueueIdRef.current);
          currentQueueIdRef.current = null;
        }
      }
    },
    [isConnected, subscribe, handleWebSocketMessage, unsubscribe]
  );

  const clearResults = useCallback(() => {
    setGeneratedImages([]);
    setError(null);
    setProgress(0);
    setMaxProgress(100);
    setCurrentMessage("");
    setQueueStatus(null);
    setRetryCount(0);
    setIsRetrying(false);

    // Unsubscribe from any active subscriptions
    if (currentQueueIdRef.current) {
      unsubscribe(currentQueueIdRef.current);
      currentQueueIdRef.current = null;
    }
  }, [unsubscribe]);

  return {
    isGenerating,
    queueStatus,
    generatedImages,
    error,
    progress,
    maxProgress,
    currentMessage,
    retryCount,
    isRetrying,
    generateImages,
    clearResults,
  };
}
