"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { WebSocketMessage, GenerationQueueStatus } from "@/types/websocket";
import {
  GenerationResponse,
  GenerationSettings,
  Media,
  WorkflowNode,
} from "@/types";
import { generateApi } from "@/lib/api/generate";

interface GenerationRequest extends GenerationSettings {}

interface UseGenerationReturn {
  isGenerating: boolean;
  queueStatus: GenerationQueueStatus | null;
  generatedImages: Media[];
  error: string | null;
  progress: number;
  maxProgress: number;
  currentMessage: string;
  currentNode: string;
  nodeState: string;
  retryCount: number;
  isRetrying: boolean;
  workflowNodes: WorkflowNode[];
  currentNodeIndex: number;
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
  const [currentNode, setCurrentNode] = useState("");
  const [nodeState, setNodeState] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // New workflow state
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);

  const { subscribe, unsubscribe, isConnected } = useWebSocket();
  const currentQueueIdRef = useRef<string | null>(null);

  // Use refs to store latest values for WebSocket callback access
  const workflowNodesRef = useRef(workflowNodes);
  const currentNodeIndexRef = useRef(currentNodeIndex);

  // Update refs when state changes
  useEffect(() => {
    workflowNodesRef.current = workflowNodes;
  }, [workflowNodes]);

  useEffect(() => {
    currentNodeIndexRef.current = currentNodeIndex;
  }, [currentNodeIndex]);

  // Helper function to determine if a node progress should be shown
  const shouldShowNodeProgress = useCallback(
    (
      nodeId: string,
      nodes: typeof workflowNodes,
      nodeIndex: number
    ): boolean => {
      if (nodes.length === 0) return true; // Show if no workflow info yet

      const foundNodeIndex = nodes.findIndex((node) => node.nodeId === nodeId);
      if (foundNodeIndex === -1) return true; // Show if node not found in workflow

      // Only show progress for current node or later nodes, not past nodes
      return foundNodeIndex >= nodeIndex;
    },
    []
  );

  // Helper function to calculate overall progress based on estTimeUnits
  const calculateOverallProgress = useCallback(
    (
      currentNodeId: string,
      currentNodeProgress: number,
      currentNodeMaxProgress: number,
      nodes: typeof workflowNodes,
      nodeIndex: number
    ): { overallProgress: number; overallMaxProgress: number } => {
      if (nodes.length === 0) {
        return {
          overallProgress: currentNodeProgress,
          overallMaxProgress: currentNodeMaxProgress,
        };
      }

      // Calculate total estTimeUnits across all nodes
      const totalEstTimeUnits = nodes.reduce(
        (sum, node) => sum + node.estTimeUnits,
        0
      );

      // Calculate completed estTimeUnits (nodes before current node)
      let completedEstTimeUnits = 0;
      for (let i = 0; i < nodeIndex && i < nodes.length; i++) {
        completedEstTimeUnits += nodes[i].estTimeUnits;
      }

      // Add progress from current node if it's processing
      let currentNodeEstTimeUnits = 0;
      if (
        currentNodeId &&
        currentNodeProgress > 0 &&
        currentNodeMaxProgress > 0
      ) {
        const currentNode = nodes.find((node) => node.nodeId === currentNodeId);
        if (currentNode) {
          const nodeProgressRatio =
            currentNodeProgress / currentNodeMaxProgress;
          currentNodeEstTimeUnits =
            currentNode.estTimeUnits * nodeProgressRatio;
        }
      }

      const totalCompletedEstTimeUnits =
        completedEstTimeUnits + currentNodeEstTimeUnits;

      // Calculate overall progress as percentage
      const overallProgress =
        totalEstTimeUnits > 0
          ? Math.round((totalCompletedEstTimeUnits / totalEstTimeUnits) * 100)
          : 0;

      return {
        overallProgress,
        overallMaxProgress: 100,
      };
    },
    []
  );

  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      console.log("🎨 Generation update received:", message);

      switch (message.type) {
        case "queue_update":
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

        case "job_progress":
          // Handle enhanced node-level progress with overall progress calculation
          if (message.progressData) {
            console.log({ message });
            const { progressData } = message;
            const nodeId =
              progressData.nodeId || progressData.displayNodeId || "";
            console.log({ nodeId });

            // Get current values from refs to avoid stale closure
            const currentWorkflowNodes = workflowNodesRef.current;
            const currentNodeIdx = currentNodeIndexRef.current;

            // Only update progress if this node should be shown (not past nodes)
            if (
              shouldShowNodeProgress(
                nodeId,
                currentWorkflowNodes,
                currentNodeIdx
              )
            ) {
              console.log("Should show node progress:", nodeId);

              // Calculate overall progress based on estTimeUnits
              const { overallProgress, overallMaxProgress } =
                calculateOverallProgress(
                  nodeId,
                  progressData.value,
                  progressData.max,
                  currentWorkflowNodes,
                  currentNodeIdx
                );

              setProgress(overallProgress);
              setMaxProgress(overallMaxProgress);

              // Use nodeTitle from workflow or fallback to nodeName
              const nodeTitle =
                currentWorkflowNodes.find((n) => n.nodeId === nodeId)
                  ?.nodeTitle ||
                progressData.nodeName ||
                progressData.displayNodeId ||
                nodeId;

              console.log({ nodeTitle, overallProgress, overallMaxProgress });

              setCurrentNode(nodeTitle);
              setNodeState(progressData.nodeState || "");
              setCurrentMessage(progressData.message);

              // Update current node index in workflow
              const nodeIndex = currentWorkflowNodes.findIndex(
                (n) => n.nodeId === nodeId
              );
              console.log({
                nodeId,
                nodeIndex,
                currentNodeIndex: currentNodeIdx,
                workflowNodes: currentWorkflowNodes,
              });
              if (nodeIndex >= 0 && nodeIndex > currentNodeIdx) {
                setCurrentNodeIndex(nodeIndex);
              }
            } else {
              console.log(
                `🚫 Skipping progress for past node: ${nodeId} (workflow position: ${currentWorkflowNodes.findIndex(
                  (n) => n.nodeId === nodeId
                )}, current: ${currentNodeIdx})`
              );
            }
          }
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
          setCurrentNode(""); // Reset node info for retry
          setNodeState("");
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
    [unsubscribe, shouldShowNodeProgress, calculateOverallProgress]
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

        const result = await generateApi.generate(request);

        console.log("✅ Generation request submitted:", result);

        // Store the queue ID for WebSocket subscription
        currentQueueIdRef.current = result.queueId;

        // Set workflow nodes from API response instead of WebSocket
        if (result.workflowData) {
          setWorkflowNodes(result.workflowData.nodes);
          setCurrentNodeIndex(result.workflowData.currentNodeIndex);
          console.log(
            "📋 Workflow nodes received from API:",
            result.workflowData.nodes
              .map((n) => `${n.nodeId}(${n.nodeTitle})`)
              .join(" → ")
          );
        }

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
    setCurrentNode("");
    setNodeState("");
    setQueueStatus(null);
    setRetryCount(0);
    setIsRetrying(false);
    setWorkflowNodes([]);
    setCurrentNodeIndex(0);

    // Unsubscribe from any active subscriptions
    if (currentQueueIdRef.current) {
      unsubscribe(currentQueueIdRef.current);
      currentQueueIdRef.current = null;
    }
  }, [unsubscribe]);

  useEffect(() => {
    console.log("workflow nodes changed:", { workflowNodes });
  }, [workflowNodes]);

  return {
    isGenerating,
    queueStatus,
    generatedImages,
    error,
    progress,
    maxProgress,
    currentMessage,
    currentNode,
    nodeState,
    retryCount,
    isRetrying,
    workflowNodes,
    currentNodeIndex,
    generateImages,
    clearResults,
  };
}
