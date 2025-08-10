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
    steps = 20,
    cfgScale = 7.0,
    sampler = "euler",
    scheduler = "normal",
  } = params;

  // Base workflow template for SDXL text-to-image generation
  const workflow: ComfyUIWorkflow = {
    // Checkpoint loader
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: {
        ckpt_name: "sd_xl_base_1.0.safetensors", // Default SDXL model
      },
    },

    // Positive prompt text encode
    "6": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: prompt,
        clip: ["4", 1],
      },
    },

    // Negative prompt text encode
    "7": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: negativePrompt,
        clip: ["4", 1],
      },
    },

    // Empty latent image
    "5": {
      class_type: "EmptyLatentImage",
      inputs: {
        width: width,
        height: height,
        batch_size: batchSize,
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
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },

    // VAE Decoder
    "8": {
      class_type: "VAEDecode",
      inputs: {
        samples: ["3", 0],
        vae: ["4", 2],
      },
    },

    // Save Image
    "9": {
      class_type: "SaveImage",
      inputs: {
        filename_prefix: "ComfyUI_Generated",
        images: ["8", 0],
      },
    },
  };

  // Add LoRA support if specified
  if (params.selectedLoras && params.selectedLoras.length > 0) {
    // For each LoRA, we need to modify the workflow
    // This is a simplified implementation - in practice you'd chain LoRA loaders
    params.selectedLoras.forEach((lora, index) => {
      const loraNodeId = `lora_${index + 10}`;
      workflow[loraNodeId] = {
        class_type: "LoraLoader",
        inputs: {
          lora_name: `${lora.name}.safetensors`,
          strength_model: lora.strength,
          strength_clip: lora.strength,
          model: index === 0 ? ["4", 0] : [`lora_${index + 9}`, 0],
          clip: index === 0 ? ["4", 1] : [`lora_${index + 9}`, 1],
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
  extra_data?: Record<string, any>;
} {
  return {
    prompt: workflow,
    client_id: clientId,
    extra_data: {
      extra_pnginfo: {
        workflow: workflow,
      },
    },
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
  steps: 20,
  cfgScale: 7.0,
  sampler: "euler",
  scheduler: "normal",
  negativePrompt: "nsfw, nude, explicit, low quality, blurry, artifacts",
};
