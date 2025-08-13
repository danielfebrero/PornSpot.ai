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
    negativePrompt = "",
    width = 1024,
    height = 1024,
    batchSize = 1,
    seed = Math.floor(Math.random() * 1000000),
    steps = 30,
    cfgScale = 4.5,
    sampler = "dpmpp_3m_sde_gpu",
    scheduler = "exponential",
  } = params;

  // Base workflow template for SDXL text-to-image generation
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

    // CLIP Text Encode (Positive Prompt)
    "6": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: prompt,
        clip: ["11", 1],
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
        clip: ["11", 1],
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
        denoise: 1.0,
        model: ["11", 0],
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

  // Add LoRA support if specified
  if (params.selectedLoras && params.selectedLoras.length > 0) {
    // For each LoRA, we need to modify the workflow
    // This is a simplified implementation - in practice you'd chain LoRA loaders
    params.selectedLoras.forEach((lora, index) => {
      const loraNodeId = `lora_${index + 12}`;
      workflow[loraNodeId] = {
        class_type: "LoraLoader",
        inputs: {
          lora_name: `${lora.name}.safetensors`,
          strength_model: lora.strength,
          strength_clip: lora.strength,
          model: index === 0 ? ["11", 0] : [`lora_${index + 11}`, 0],
          clip: index === 0 ? ["11", 1] : [`lora_${index + 11}`, 1],
        },
        _meta: {
          title: `LoRA Loader ${index + 1}`,
          estTimeUnits: 10,
        },
      };

      // Update the KSampler to use the last LoRA's model output
      if (params.selectedLoras && index === params.selectedLoras.length - 1) {
        if (workflow["3"] && workflow["3"].inputs) {
          workflow["3"].inputs["model"] = [loraNodeId, 0];
        }
        if (workflow["6"] && workflow["6"].inputs) {
          workflow["6"].inputs["clip"] = [loraNodeId, 1];
        }
        if (workflow["7"] && workflow["7"].inputs) {
          workflow["7"].inputs["clip"] = [loraNodeId, 1];
        }
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
  width: 1504,
  height: 1504,
  batchSize: 1,
  steps: 55,
  cfgScale: 6.0,
  sampler: "dpmpp_3m_sde_gpu",
  scheduler: "exponential",
  negativePrompt:
    "ugly,distorted bad teeth, bad hands, distorted face, missing fingers, multiple limbs, distorted arms, distorted legs, low quality, distorted fingers, weird legs, distorted eyes,pixelated, extra fingers, watermark",
};
