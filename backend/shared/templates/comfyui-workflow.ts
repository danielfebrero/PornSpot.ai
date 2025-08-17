/*
File objective: ComfyUI workflow template for text-to-image generation with dynamic parameter injection
Auth: Used by generation service to create API-format workflows
Special notes:
- Supports dynamic prompt, dimensions, batch count, and LoRA injection
- Based on standard SDXL text-to-image workflow
- Uses placeholder COMFYUI_API_ENDPOINT for configuration
*/

export interface WorkflowParameters {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  batchSize?: number;
  seed?: number;
  steps?: number;
  cfgScale?: number;
  sampler?: string;
  scheduler?: string;
  selectedLoras?: Array<{
    id: string;
    name: string;
    strength: number;
  }>;
}

export interface ComfyUIWorkflow {
  [nodeId: string]: {
    class_type: string;
    inputs: Record<string, any>;
    _meta?: {
      title: string;
      estTimeUnits: number;
    };
  };
}

/**
 * Creates a ComfyUI API workflow from parameters
 * This is a basic SDXL text-to-image workflow that can be extended
 */
export function createComfyUIWorkflow(
  params: WorkflowParameters
): ComfyUIWorkflow {
  const {
    prompt,
    negativePrompt = DEFAULT_WORKFLOW_PARAMS.negativePrompt!,
    width = DEFAULT_WORKFLOW_PARAMS.width!,
    height = DEFAULT_WORKFLOW_PARAMS.height!,
    batchSize = DEFAULT_WORKFLOW_PARAMS.batchSize!,
    seed = Math.floor(Math.random() * 1000000),
    steps = DEFAULT_WORKFLOW_PARAMS.steps!,
    cfgScale = DEFAULT_WORKFLOW_PARAMS.cfgScale!,
    sampler = "dpmpp_3m_sde_gpu",
    scheduler = "exponential",
  } = params;

  // Base workflow template for SDXL text-to-image generation with LoRA chain
  const workflow: ComfyUIWorkflow = {
    // Load Checkpoint
    "11": {
      class_type: "CheckpointLoaderSimple",
      inputs: {
        ckpt_name: "lustifySDXLNSFW_oltFIXEDTEXTURES.safetensors",
      },
      _meta: {
        title: "Load Checkpoint",
        estTimeUnits: 1,
      },
    },

    // Default LoRA chain (will be modified based on selectedLoras)
    "23": {
      class_type: "LoraLoader",
      inputs: {
        lora_name: "Harness_Straps_sdxl.safetensors",
        strength_model: 0,
        strength_clip: 1,
        model: ["11", 0],
        clip: ["11", 1],
      },
      _meta: {
        title: "Load LoRA",
        estTimeUnits: 1,
      },
    },

    "21": {
      class_type: "LoraLoader",
      inputs: {
        lora_name: "add-detail-xl.safetensors",
        strength_model: 0,
        strength_clip: 1.0000000000000002,
        model: ["23", 0],
        clip: ["23", 1],
      },
      _meta: {
        title: "Load LoRA",
        estTimeUnits: 1,
      },
    },

    "20": {
      class_type: "LoraLoader",
      inputs: {
        lora_name: "Pierced_Nipples_XL_Barbell_Edition-000013.safetensors",
        strength_model: 0,
        strength_clip: 1.0000000000000002,
        model: ["21", 0],
        clip: ["21", 1],
      },
      _meta: {
        title: "Load LoRA",
        estTimeUnits: 1,
      },
    },

    "10": {
      class_type: "LoraLoader",
      inputs: {
        lora_name: "leaked_nudes_style_v1_fixed.safetensors",
        strength_model: 0,
        strength_clip: 1.0000000000000002,
        model: ["20", 0],
        clip: ["20", 1],
      },
      _meta: {
        title: "Load LoRA",
        estTimeUnits: 1,
      },
    },

    // CLIP Text Encode (Positive Prompt)
    "6": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: prompt,
        clip: ["10", 1],
      },
      _meta: {
        title: "CLIP Text Encode (Prompt)",
        estTimeUnits: 2,
      },
    },

    // CLIP Text Encode (Negative Prompt)
    "7": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: negativePrompt,
        clip: ["10", 1],
      },
      _meta: {
        title: "CLIP Text Encode (Negative Prompt)",
        estTimeUnits: 2,
      },
    },

    // Empty Latent Image
    "5": {
      class_type: "EmptyLatentImage",
      inputs: {
        width: width,
        height: height,
        batch_size: batchSize,
      },
      _meta: {
        title: "Empty Latent Image",
        estTimeUnits: 1,
      },
    },

    // KSampler
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: seed,
        steps: steps,
        cfg: cfgScale,
        sampler_name: sampler,
        scheduler: scheduler,
        denoise: 1,
        model: ["10", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
      _meta: {
        title: "KSampler",
        estTimeUnits: 100,
      },
    },

    // VAE Decode
    "8": {
      class_type: "VAEDecode",
      inputs: {
        samples: ["3", 0],
        vae: ["11", 2],
      },
      _meta: {
        title: "VAE Decode",
        estTimeUnits: 2,
      },
    },

    // Save Image
    "9": {
      class_type: "SaveImage",
      inputs: {
        filename_prefix: "ComfyUI_Generated",
        images: ["8", 0],
      },
      _meta: {
        title: "Save Image",
        estTimeUnits: 5,
      },
    },
  };

  // Apply LoRA strengths if specified
  if (params.selectedLoras && params.selectedLoras.length > 0) {
    // Map LoRA names to node IDs based on the template structure
    const loraNodeMap: { [key: string]: string } = {
      Harness_Straps_sdxl: "23",
      "add-detail-xl": "21",
      "Pierced_Nipples_XL_Barbell_Edition-000013": "20",
      leaked_nudes_style_v1_fixed: "10",
    };

    // Apply strengths to matching LoRAs
    params.selectedLoras.forEach((lora) => {
      // Find matching node by lora name (without .safetensors extension)
      const loraBaseName = lora.name.replace(".safetensors", "");
      const nodeId = loraNodeMap[loraBaseName];

      if (nodeId && workflow[nodeId]) {
        workflow[nodeId].inputs["strength_model"] = lora.strength;
        console.log("Found node: ", workflow[nodeId]);
        // workflow[nodeId].inputs["strength_clip"] = lora.strength;
      } else {
        // Replace with proper logging framework in production
        // Example using winston:
        // import { logger } from '../../utils/logger';
        // logger.warn(`LoRA "${lora.name}" not found in workflow template`);
        console.warn(`LoRA "${lora.name}" not found in workflow template`);
      }
    });
  }

  return workflow;
}

/**
 * Creates a prompt request for ComfyUI API
 */
export function createPromptRequest(
  workflow: ComfyUIWorkflow,
  clientId: string
): {
  prompt: ComfyUIWorkflow;
  client_id: string;
} {
  return {
    prompt: workflow,
    client_id: clientId,
  };
}

/**
 * Validates workflow parameters
 */
export function validateWorkflowParameters(params: WorkflowParameters): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!params.prompt || params.prompt.trim().length === 0) {
    errors.push("Prompt is required");
  }

  if (params.prompt && params.prompt.length > 1000) {
    errors.push("Prompt is too long (max 1000 characters)");
  }

  if (params.negativePrompt && params.negativePrompt.length > 500) {
    errors.push("Negative prompt is too long (max 500 characters)");
  }

  if (params.width < 256 || params.width > 2048) {
    errors.push("Width must be between 256 and 2048 pixels");
  }

  if (params.height < 256 || params.height > 2048) {
    errors.push("Height must be between 256 and 2048 pixels");
  }

  if (params.batchSize && (params.batchSize < 1 || params.batchSize > 8)) {
    errors.push("Batch size must be between 1 and 8");
  }

  if (params.steps && (params.steps < 1 || params.steps > 50)) {
    errors.push("Steps must be between 1 and 50");
  }

  if (params.cfgScale && (params.cfgScale < 1 || params.cfgScale > 20)) {
    errors.push("CFG scale must be between 1 and 20");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Default workflow parameters
 */
export const DEFAULT_WORKFLOW_PARAMS: Partial<WorkflowParameters> = {
  width: 1024,
  height: 1024,
  batchSize: 1,
  steps: 30,
  cfgScale: 4.5,
  sampler: "dpmpp_3m_sde_gpu",
  scheduler: "exponential",
  negativePrompt:
    "ugly, distorted bad teeth, bad hands, distorted face, missing fingers, multiple limbs, distorted arms, distorted legs, low quality, distorted fingers, weird legs, distorted eyes,pixelated, extra fingers, watermark",
};
