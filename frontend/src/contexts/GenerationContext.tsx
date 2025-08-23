"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { GenerationSettings, Media } from "@/types";

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
  allGeneratedImages: Media[];
  deletedImageIds: Set<string>;
  lightboxOpen: boolean;
  lightboxIndex: number;
  showMagicText: boolean;
  showProgressCard: boolean;
  optimizedPromptCache: string;
  originalPromptBeforeOptimization: string;
}

const DEFAULT_UI_STATE: GenerationUIState = {
  allGeneratedImages: [],
  deletedImageIds: new Set(),
  lightboxOpen: false,
  lightboxIndex: 0,
  showMagicText: false,
  showProgressCard: false,
  optimizedPromptCache: "",
  originalPromptBeforeOptimization: "",
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

// Utility functions for localStorage
const saveToStorage = (key: string, value: unknown) => {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    console.warn("Failed to save to localStorage:", error);
  }
};

const loadFromStorage = function <T>(key: string, defaultValue: T): T {
  try {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Handle Set serialization for deletedImageIds
        if (key === STORAGE_KEYS.UI_STATE && parsed.deletedImageIds) {
          parsed.deletedImageIds = new Set(parsed.deletedImageIds);
        }
        return parsed;
      }
    }
  } catch (error) {
    console.warn("Failed to load from localStorage:", error);
  }
  return defaultValue;
};

interface GenerationProviderProps {
  children: ReactNode;
}

export function GenerationProvider({ children }: GenerationProviderProps) {
  // Initialize settings from localStorage or defaults
  const [settings, setSettings] = useState<GenerationSettings>(() =>
    loadFromStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS)
  );

  // Initialize UI state from localStorage or defaults
  const [uiState, setUiState] = useState<GenerationUIState>(() =>
    loadFromStorage(STORAGE_KEYS.UI_STATE, DEFAULT_UI_STATE)
  );

  // Save settings to localStorage whenever they change
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);

  // Save UI state to localStorage whenever it changes
  useEffect(() => {
    // Convert Set to Array for JSON serialization
    const serializedState = {
      ...uiState,
      deletedImageIds: Array.from(uiState.deletedImageIds),
    };
    saveToStorage(STORAGE_KEYS.UI_STATE, serializedState);
  }, [uiState]);

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
