"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { GenerationSettings, Media, WorkflowNode } from "@/types";
import { GenerationQueueStatus } from "@/types/websocket";
import { GenerationWebSocketMessage } from "@/types/shared-types/websocket";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { generateApi } from "@/lib/api/generate";

// Default generation settings following the pattern from GenerateClient
const DEFAULT_SETTINGS: GenerationSettings = {
  prompt: "",
  negativePrompt:
    "ugly, distorted bad teeth, bad hands, distorted face, missing fingers, multiple limbs, distorted arms, distorted legs, low quality, distorted fingers, weird legs, distorted eyes,pixelated, extra fingers, watermark",
  imageSize: "1024x1024",
  customWidth: 1024,
  customHeight: 1024,
  batchCount: 1,
  selectedLoras: [],
  loraStrengths: {},
  loraSelectionMode: "auto",
  optimizePrompt: true,
  isPublic: true,
};

// UI state for the generation interface
interface GenerationUIState {
  // Existing UI state
  allGeneratedImages: Media[];
  deletedImageIds: Set<string>;
  lightboxOpen: boolean;
  lightboxIndex: number;
  showMagicText: boolean;
  showProgressCard: boolean;
  optimizedPromptCache: string;
  originalPromptBeforeOptimization: string;
  isGenerating: boolean;
  isOptimizing: boolean;

  // Generation WebSocket state (moved from useGeneration)
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
  optimizedPrompt: string | null;
  optimizationStream: string | null;
  optimizationToken: string | null;
}

const DEFAULT_UI_STATE: GenerationUIState = {
  // Existing UI state
  allGeneratedImages: [],
  deletedImageIds: new Set(),
  lightboxOpen: false,
  lightboxIndex: 0,
  showMagicText: false,
  showProgressCard: false,
  optimizedPromptCache: "",
  originalPromptBeforeOptimization: "",
  isGenerating: false,
  isOptimizing: false,

  // Generation WebSocket state defaults
  queueStatus: null,
  generatedImages: [],
  error: null,
  progress: 0,
  maxProgress: 100,
  currentMessage: "",
  currentNode: "",
  nodeState: "",
  retryCount: 0,
  isRetrying: false,
  workflowNodes: [],
  currentNodeIndex: 0,
  optimizedPrompt: null,
  optimizationStream: null,
  optimizationToken: null,
};

// Generation context type
interface GenerationContextType {
  // Settings state
  settings: GenerationSettings;
  updateSettings: (key: keyof GenerationSettings, value: unknown) => void;
  resetSettings: () => void;

  // UI state
  uiState: GenerationUIState;
  setAllGeneratedImages: (
    images: Media[] | ((prev: Media[]) => Media[])
  ) => void;
  setDeletedImageIds: (
    ids: Set<string> | ((prev: Set<string>) => Set<string>)
  ) => void;
  setLightboxOpen: (open: boolean) => void;
  setLightboxIndex: (index: number) => void;
  setShowMagicText: (show: boolean) => void;
  setShowProgressCard: (show: boolean) => void;
  setOptimizedPromptCache: (cache: string) => void;
  setOriginalPromptBeforeOptimization: (prompt: string) => void;
  setIsGenerating: (generating: boolean) => void;
  setIsOptimizing: (optimizing: boolean) => void;

  // Generation state getters (for backward compatibility with useGeneration interface)
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
  optimizedPrompt: string | null;
  optimizationStream: string | null;
  optimizationToken: string | null;

  // Generation methods
  generateImages: (request: GenerationSettings) => Promise<void>;
  clearResults: () => void;
  stopGeneration: () => void;

  // Utility methods
  clearAllState: () => void;
  handleDeleteRecentMedia: (mediaId: string) => void;
  toggleLora: (loraId: string) => void;
  updateLoraStrength: (
    loraId: string,
    mode: "auto" | "manual",
    value?: number
  ) => void;
  handleLoraClickInAutoMode: (loraId: string) => void;
}

const GenerationContext = createContext<GenerationContextType | undefined>(
  undefined
);

// Local storage keys
const STORAGE_KEYS = {
  SETTINGS: "pornspot-generation-settings",
  UI_STATE: "pornspot-generation-ui-state",
} as const;

interface GenerationProviderProps {
  children: ReactNode;
}

export function GenerationProvider({ children }: GenerationProviderProps) {
  // Initialize settings from localStorage or defaults
  const [settings, setSettings] = useState<GenerationSettings>(
    () => DEFAULT_SETTINGS
  );

  // Initialize UI state from localStorage or defaults
  const [uiState, setUiState] = useState<GenerationUIState>(
    () => DEFAULT_UI_STATE
  );

  // WebSocket and generation state
  const { subscribe, unsubscribe, isConnected, connectionId } = useWebSocket();
  const currentQueueIdRef = useRef<string | null>(null);
  const messageCallbackRef = useRef<
    ((message: GenerationWebSocketMessage) => void) | null
  >(null);

  // Use refs to store latest values for WebSocket callback access
  const workflowNodesRef = useRef(uiState.workflowNodes);
  const currentNodeIndexRef = useRef(uiState.currentNodeIndex);

  // Update refs when state changes
  useEffect(() => {
    workflowNodesRef.current = uiState.workflowNodes;
  }, [uiState.workflowNodes]);

  useEffect(() => {
    currentNodeIndexRef.current = uiState.currentNodeIndex;
  }, [uiState.currentNodeIndex]);

  // Helper function to determine if a node progress should be shown
  const shouldShowNodeProgress = useCallback(
    (nodeId: string, nodes: WorkflowNode[], nodeIndex: number): boolean => {
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
      nodes: WorkflowNode[],
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

      // Find the actual index of the currently processing node
      const actualCurrentNodeIndex = nodes.findIndex(
        (node) => node.nodeId === currentNodeId
      );
      const useNodeIndex =
        actualCurrentNodeIndex >= 0 ? actualCurrentNodeIndex : nodeIndex;

      // Calculate completed estTimeUnits (nodes before current node)
      let completedEstTimeUnits = 0;
      for (let i = 0; i < useNodeIndex && i < nodes.length; i++) {
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

  // WebSocket message handler
  const handleWebSocketMessage = useCallback(
    (message: GenerationWebSocketMessage) => {
      switch (message.type) {
        case "workflow":
          // Set workflow nodes from API response instead of WebSocket
          if (message.workflowData) {
            setUiState((prev) => ({
              ...prev,
              workflowNodes: message.workflowData.nodes,
              currentNodeIndex: message.workflowData.currentNodeIndex,
            }));
          }
          break;

        case "queue_update":
        case "queued":
          setUiState((prev) => ({
            ...prev,
            queueStatus: {
              queueId: message.queueId!,
              queuePosition: message.queuePosition || 0,
              estimatedWaitTime: message.estimatedWaitTime || 0,
              status: "pending",
              message: message.message || "Added to queue",
            },
            currentMessage:
              message.message || `Position ${message.queuePosition} in queue`,
          }));
          break;

        case "processing":
          setUiState((prev) => ({
            ...prev,
            isRetrying: false, // Clear retry state when processing starts
            queueStatus: prev.queueStatus
              ? {
                  ...prev.queueStatus,
                  status: "processing",
                  message: message.message || "Processing...",
                }
              : null,
            currentMessage:
              message.message || "Your generation is now being processed",
          }));
          break;

        case "job_progress":
          // Handle enhanced node-level progress with overall progress calculation
          if (message.progressData) {
            const { progressData } = message;
            const nodeId =
              progressData.nodeId || progressData.displayNodeId || "";

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
              // Calculate overall progress based on estTimeUnits
              const { overallProgress, overallMaxProgress } =
                calculateOverallProgress(
                  nodeId,
                  progressData.value,
                  progressData.max,
                  currentWorkflowNodes,
                  currentNodeIdx
                );

              // Use nodeTitle from workflow or fallback to nodeName
              const nodeTitle =
                currentWorkflowNodes.find((n) => n.nodeId === nodeId)
                  ?.nodeTitle ||
                progressData.nodeName ||
                progressData.displayNodeId ||
                nodeId;

              setUiState((prev) => ({
                ...prev,
                progress: overallProgress,
                maxProgress: overallMaxProgress,
                currentNode: nodeTitle,
                nodeState: progressData.nodeState || "",
                currentMessage: progressData.message,
              }));

              // Update current node index in workflow
              const nodeIndex = currentWorkflowNodes.findIndex(
                (n) => n.nodeId === nodeId
              );

              if (nodeIndex >= 0 && nodeIndex > currentNodeIdx) {
                setUiState((prev) => ({
                  ...prev,
                  currentNodeIndex: nodeIndex,
                }));
              }
            }
          }
          break;

        case "completed":
          setUiState((prev) => ({
            ...prev,
            queueStatus: prev.queueStatus
              ? {
                  ...prev.queueStatus,
                  status: "completed",
                  message: message.message || "Generation completed",
                  images: message.medias,
                }
              : null,
            generatedImages: message.medias || [],
            currentMessage:
              message.message || "Generation completed successfully!",
            isGenerating: false,
            progress: 100,
          }));

          // Unsubscribe from updates
          if (messageCallbackRef.current) {
            unsubscribe(messageCallbackRef.current);
            messageCallbackRef.current = null;
            currentQueueIdRef.current = null;
          }
          break;

        case "retrying":
          setUiState((prev) => ({
            ...prev,
            retryCount: message.retryCount || 1,
            isRetrying: true,
            error: null, // Clear previous error on retry
            queueStatus: prev.queueStatus
              ? {
                  ...prev.queueStatus,
                  status: "pending", // Reset to pending for retry
                  message: message.message || "Retrying generation...",
                }
              : null,
            currentMessage:
              message.message ||
              `Retrying generation... (attempt ${message.retryCount || 1}/3)`,
            progress: 0, // Reset progress for retry
            currentNode: "", // Reset node info for retry
            nodeState: "",
          }));
          break;

        case "optimization_start":
          setUiState((prev) => ({
            ...prev,
            isOptimizing: true,
            optimizationStream: "",
            error: null,
            currentMessage: message.optimizationData
              ? `Optimizing prompt: "${message.optimizationData.originalPrompt}"`
              : "Optimizing prompt...",
          }));
          break;

        case "optimization_token":
          if (message.optimizationData) {
            const { optimizedPrompt, token } = message.optimizationData;
            setUiState((prev) => ({
              ...prev,
              optimizationStream: optimizedPrompt,
              optimizationToken: token || "",
              currentMessage: "Optimizing prompt...",
            }));
          }
          break;

        case "optimization_complete":
          if (message.optimizationData) {
            const { optimizedPrompt } = message.optimizationData;
            setUiState((prev) => ({
              ...prev,
              optimizedPrompt: optimizedPrompt,
              optimizationStream: optimizedPrompt,
              currentMessage: "Prompt optimized. Starting generation...",
              isOptimizing: false,
            }));
          }
          break;

        case "prompt-moderation":
          setUiState((prev) => ({
            ...prev,
            isOptimizing: false,
            isGenerating: false,
          }));
          if (message.status === "refused") {
            const reason = message.reason || "Content violates platform rules";
            setUiState((prev) => ({
              ...prev,
              error: `Prompt rejected: ${reason}`,
              currentMessage: "Please try a different prompt",
              // Reset state so user can try again
              queueStatus: null,
              progress: 0,
              currentNode: "",
              nodeState: "",
              optimizationStream: "",
              optimizedPrompt: null,
            }));
          }
          break;

        case "optimization_error":
          setUiState((prev) => ({
            ...prev,
            isOptimizing: false,
            error: message.error || "Prompt optimization failed",
            currentMessage:
              "Optimization failed, proceeding with original prompt",
          }));
          break;

        case "error":
          // Check if this is a final failure or if retries are still possible
          const isRetryableError =
            message.errorType && message.retryCount && message.retryCount < 3;

          setUiState((prev) => ({
            ...prev,
            error: message.error || "Generation failed",
            currentMessage:
              message.message ||
              (isRetryableError
                ? "Generation failed, but will be retried automatically"
                : "Generation failed"),
          }));

          // Only stop generating if this is a final failure
          if (!isRetryableError) {
            setUiState((prev) => ({
              ...prev,
              isGenerating: false,
            }));

            // Unsubscribe from updates
            if (messageCallbackRef.current) {
              unsubscribe(messageCallbackRef.current);
              messageCallbackRef.current = null;
              currentQueueIdRef.current = null;
            }
          }
          break;
      }
    },
    [unsubscribe, shouldShowNodeProgress, calculateOverallProgress]
  );

  // Generation methods
  const generateImages = useCallback(
    async (request: GenerationSettings) => {
      if (!isConnected) {
        setUiState((prev) => ({
          ...prev,
          error: "WebSocket not connected. Please refresh the page.",
        }));
        return;
      }

      try {
        setUiState((prev) => ({
          ...prev,
          isGenerating: true,
          error: null,
          generatedImages: [],
          progress: 0,
          maxProgress: 100,
          currentMessage: "Submitting request...",
          queueStatus: null,
        }));

        // Subscribe to WebSocket updates for this generation
        messageCallbackRef.current = handleWebSocketMessage;
        subscribe(handleWebSocketMessage);

        const result = await generateApi.generate({
          ...request,
          connectionId: connectionId || undefined,
        });

        // Store the queue ID for WebSocket subscription
        currentQueueIdRef.current = result.queueId;

        // Set initial queue status
        setUiState((prev) => ({
          ...prev,
          queueStatus: {
            queueId: result.queueId,
            queuePosition: result.queuePosition,
            estimatedWaitTime: result.estimatedWaitTime,
            status: result.status,
            message: result.message,
          },
          currentMessage: result.message,
        }));

        currentQueueIdRef.current = result.queueId;
      } catch (err) {
        console.error("❌ Generation request failed:", err);

        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setUiState((prev) => ({
          ...prev,
          error: errorMessage,
          currentMessage: `Error: ${errorMessage}`,
          isGenerating: false,
        }));

        // Clean up any pending subscription
        if (messageCallbackRef.current) {
          unsubscribe(messageCallbackRef.current);
          messageCallbackRef.current = null;
          currentQueueIdRef.current = null;
        }
      }
    },
    [isConnected, handleWebSocketMessage, subscribe, unsubscribe, connectionId]
  );

  const clearResults = useCallback(() => {
    setUiState((prev) => ({
      ...prev,
      generatedImages: [],
      error: null,
      progress: 0,
      maxProgress: 100,
      currentMessage: "",
      currentNode: "",
      nodeState: "",
      queueStatus: null,
      retryCount: 0,
      isRetrying: false,
      workflowNodes: [],
      currentNodeIndex: 0,
      optimizedPrompt: null,
      isOptimizing: false,
      optimizationStream: null,
      optimizationToken: "",
    }));

    // Unsubscribe from any active subscriptions
    if (messageCallbackRef.current) {
      unsubscribe(messageCallbackRef.current);
      messageCallbackRef.current = null;
      currentQueueIdRef.current = null;
    }
  }, [unsubscribe]);

  const stopGeneration = useCallback(() => {
    // Stop the generation by updating state and unsubscribing from WebSocket
    setUiState((prev) => ({
      ...prev,
      isGenerating: false,
      isOptimizing: false,
      currentMessage: "Generation stopped by user",
      showProgressCard: false,
    }));

    // Unsubscribe from any active subscriptions
    if (messageCallbackRef.current) {
      unsubscribe(messageCallbackRef.current);
      messageCallbackRef.current = null;
      currentQueueIdRef.current = null;
    }
  }, [unsubscribe]);

  // Settings methods
  const updateSettings = useCallback(
    (key: keyof GenerationSettings, value: unknown) => {
      setSettings((prev) => ({ ...prev, [key]: value }));

      // If the prompt is being changed manually, clear the optimization cache
      if (key === "prompt") {
        setUiState((prev) => ({
          ...prev,
          optimizedPromptCache: "",
          originalPromptBeforeOptimization: "",
        }));
      }
    },
    []
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // UI state methods
  const setAllGeneratedImages = useCallback(
    (images: Media[] | ((prev: Media[]) => Media[])) => {
      setUiState((prev) => ({
        ...prev,
        allGeneratedImages:
          typeof images === "function"
            ? images(prev.allGeneratedImages)
            : images,
      }));
    },
    []
  );

  const setDeletedImageIds = useCallback(
    (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setUiState((prev) => ({
        ...prev,
        deletedImageIds:
          typeof ids === "function" ? ids(prev.deletedImageIds) : ids,
      }));
    },
    []
  );

  const setLightboxOpen = useCallback((open: boolean) => {
    setUiState((prev) => ({ ...prev, lightboxOpen: open }));
  }, []);

  const setLightboxIndex = useCallback((index: number) => {
    setUiState((prev) => ({ ...prev, lightboxIndex: index }));
  }, []);

  const setShowMagicText = useCallback((show: boolean) => {
    setUiState((prev) => ({ ...prev, showMagicText: show }));
  }, []);

  const setShowProgressCard = useCallback((show: boolean) => {
    setUiState((prev) => ({ ...prev, showProgressCard: show }));
  }, []);

  const setOptimizedPromptCache = useCallback((cache: string) => {
    setUiState((prev) => ({ ...prev, optimizedPromptCache: cache }));
  }, []);

  const setOriginalPromptBeforeOptimization = useCallback((prompt: string) => {
    setUiState((prev) => ({
      ...prev,
      originalPromptBeforeOptimization: prompt,
    }));
  }, []);

  const setIsGenerating = useCallback((generating: boolean) => {
    setUiState((prev) => ({ ...prev, isGenerating: generating }));
  }, []);

  const setIsOptimizing = useCallback((optimizing: boolean) => {
    setUiState((prev) => ({ ...prev, isOptimizing: optimizing }));
  }, []);

  // Utility methods
  const clearAllState = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setUiState(DEFAULT_UI_STATE);
    // Clear localStorage as well
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.UI_STATE);
    }
  }, []);

  const handleDeleteRecentMedia = useCallback(
    (mediaId: string) => {
      setDeletedImageIds((prev) => new Set(prev).add(mediaId));
    },
    [setDeletedImageIds]
  );

  const toggleLora = useCallback(
    (loraId: string) => {
      // Only allow toggling in manual mode
      if (settings.loraSelectionMode === "auto") {
        return;
      }

      setSettings((prev) => {
        const isCurrentlySelected = prev.selectedLoras.includes(loraId);

        if (isCurrentlySelected) {
          // Remove LoRA and its strength settings
          const newLoraStrengths = { ...prev.loraStrengths };
          delete newLoraStrengths[loraId];

          return {
            ...prev,
            selectedLoras: prev.selectedLoras.filter((id) => id !== loraId),
            loraStrengths: newLoraStrengths,
          };
        } else {
          // Add LoRA with default strength settings
          return {
            ...prev,
            selectedLoras: [...prev.selectedLoras, loraId],
            loraStrengths: {
              ...prev.loraStrengths,
              [loraId]: { mode: "auto", value: 1.0 },
            },
          };
        }
      });
    },
    [settings.loraSelectionMode]
  );

  const updateLoraStrength = useCallback(
    (loraId: string, mode: "auto" | "manual", value?: number) => {
      setSettings((prev) => ({
        ...prev,
        loraStrengths: {
          ...prev.loraStrengths,
          [loraId]: {
            mode,
            value:
              value !== undefined
                ? value
                : prev.loraStrengths[loraId]?.value || 1.0,
          },
        },
      }));
    },
    []
  );

  const handleLoraClickInAutoMode = useCallback((loraId: string) => {
    // Switch to manual mode and select the clicked LoRA
    setSettings((prev) => ({
      ...prev,
      loraSelectionMode: "manual",
      selectedLoras: [loraId],
      loraStrengths: {
        ...prev.loraStrengths,
        [loraId]: { mode: "auto", value: 1.0 },
      },
    }));
  }, []);

  const contextValue: GenerationContextType = {
    // Settings
    settings,
    updateSettings,
    resetSettings,

    // UI state
    uiState,
    setAllGeneratedImages,
    setDeletedImageIds,
    setLightboxOpen,
    setLightboxIndex,
    setShowMagicText,
    setShowProgressCard,
    setOptimizedPromptCache,
    setOriginalPromptBeforeOptimization,
    setIsGenerating,
    setIsOptimizing,

    // Generation state getters (for backward compatibility with useGeneration interface)
    queueStatus: uiState.queueStatus,
    generatedImages: uiState.generatedImages,
    error: uiState.error,
    progress: uiState.progress,
    maxProgress: uiState.maxProgress,
    currentMessage: uiState.currentMessage,
    currentNode: uiState.currentNode,
    nodeState: uiState.nodeState,
    retryCount: uiState.retryCount,
    isRetrying: uiState.isRetrying,
    workflowNodes: uiState.workflowNodes,
    currentNodeIndex: uiState.currentNodeIndex,
    optimizedPrompt: uiState.optimizedPrompt,
    optimizationStream: uiState.optimizationStream,
    optimizationToken: uiState.optimizationToken,

    // Generation methods
    generateImages,
    clearResults,
    stopGeneration,

    // Utility methods
    clearAllState,
    handleDeleteRecentMedia,
    toggleLora,
    updateLoraStrength,
    handleLoraClickInAutoMode,
  };

  return (
    <GenerationContext.Provider value={contextValue}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGenerationContext(): GenerationContextType {
  const context = useContext(GenerationContext);
  if (context === undefined) {
    throw new Error(
      "useGenerationContext must be used within a GenerationProvider"
    );
  }
  return context;
}
