/**
 * @fileoverview Parameter Store Service
 * @description Fetches configuration from AWS SSM Parameter Store with local fallback.
 * @notes
 * - Caches parameters for the Lambda execution.
 * - Environment-specific paths (/prod, /stage, /dev).
 * - Local development uses environment variables.
 * - Methods: getParameter, getRevalidateSecret, getFrontendUrl, getGoogleClientSecret, getSendGridApiKey, getComfyUIApiEndpoint, getOpenRouterApiKey, getJwtEncryptionKey, getJwtSecret.
 * - Handles decryption for secure strings.
 */
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const isLocal =
  process.env["AWS_SAM_LOCAL"] === "true" ||
  process.env["NODE_ENV"] === "development" ||
  process.env["ENVIRONMENT"] === "local";

let ssmClient: SSMClient;
if (!isLocal) {
  ssmClient = new SSMClient({
    region: process.env["AWS_REGION"] || "us-east-1",
  });
}

// Cache for parameters to avoid repeated API calls
const parameterCache = new Map<string, string>();

export class ParameterStoreService {
  /**
   * Get a parameter from AWS Systems Manager Parameter Store
   * @param parameterName The name of the parameter
   * @param decrypt Whether to decrypt the parameter if it's a SecureString
   * @returns The parameter value
   */
  static async getParameter(
    parameterName: string,
    decrypt: boolean = true
  ): Promise<string> {
    // Check cache first
    const cacheKey = `${parameterName}_${decrypt}`;
    if (parameterCache.has(cacheKey)) {
      return parameterCache.get(cacheKey)!;
    }

    try {
      let processedParameterName = parameterName;
      if (
        parameterName.startsWith("/prod") ||
        parameterName.startsWith("/stage") ||
        parameterName.startsWith("/dev")
      ) {
        processedParameterName = `/pornspot-ai${parameterName}`;
      }
      const command = new GetParameterCommand({
        Name: processedParameterName,
        WithDecryption: decrypt,
      });

      const response = await ssmClient.send(command);

      if (!response.Parameter?.Value) {
        throw new Error(
          `Parameter ${processedParameterName} not found or has no value`
        );
      }

      const value = response.Parameter.Value;

      // Cache the value for this Lambda execution
      parameterCache.set(cacheKey, value);

      return value;
    } catch (error) {
      console.error(`Error fetching parameter ${parameterName}:`, error);
      throw new Error(`Failed to fetch parameter ${parameterName}: ${error}`);
    }
  }

  /**
   * Get the revalidation secret from Parameter Store or environment variable
   */
  static async getRevalidateSecret(): Promise<string> {
    // In local development, use environment variable directly
    if (isLocal) {
      const secret = process.env["REVALIDATE_SECRET"];
      if (!secret) {
        throw new Error(
          "REVALIDATE_SECRET environment variable is required in local development"
        );
      }
      console.log("Using local REVALIDATE_SECRET from environment variable");
      return secret;
    }

    // In production, use Parameter Store
    const environment = process.env["ENVIRONMENT"] || "dev";
    return await this.getParameter(`/${environment}/revalidate-secret`, true);
  }

  /**
   * Get the frontend URL from Parameter Store or environment variable
   */
  static async getFrontendUrl(): Promise<string> {
    // In local development, use environment variable directly
    if (isLocal) {
      const url = process.env["FRONTEND_URL"];
      if (!url) {
        throw new Error(
          "FRONTEND_URL environment variable is required in local development"
        );
      }
      console.log("Using local FRONTEND_URL from environment variable:", url);
      return url;
    }

    // In production, use Parameter Store
    const environment = process.env["ENVIRONMENT"] || "dev";
    return await this.getParameter(`/${environment}/frontend-url`, false);
  }

  /**
   * Get the Google Client Secret from Parameter Store or environment variable
   */
  static async getGoogleClientSecret(): Promise<string> {
    // In local development, use environment variable directly
    if (isLocal) {
      console.log(
        "Local environment detected. Google/Environment vars:",
        Object.keys(process.env).filter(
          (key) => key.includes("GOOGLE") || key.includes("ENVIRONMENT")
        )
      );
      console.log(
        "Total environment variables loaded:",
        Object.keys(process.env).length
      );
      console.log(
        "ALL ENVIRONMENT VARIABLES:",
        JSON.stringify(process.env, null, 2)
      );
      console.log(
        "GOOGLE_CLIENT_SECRET value:",
        process.env["GOOGLE_CLIENT_SECRET"]
      );
      const secret = process.env["GOOGLE_CLIENT_SECRET"];
      if (!secret) {
        throw new Error(
          "GOOGLE_CLIENT_SECRET environment variable is required in local development"
        );
      }
      console.log("Using local GOOGLE_CLIENT_SECRET from environment variable");
      return secret;
    }

    // In production, use Parameter Store
    const environment = process.env["ENVIRONMENT"] || "dev";
    return await this.getParameter(
      `/${environment}/google-client-secret`,
      true
    );
  }

  /**
   * Get the SendGrid API Key from Parameter Store or environment variable
   */
  static async getSendGridApiKey(): Promise<string> {
    // In local development, use environment variable directly
    if (isLocal) {
      const apiKey = process.env["SENDGRID_API_KEY"];
      if (!apiKey) {
        throw new Error(
          "SENDGRID_API_KEY environment variable is required in local development"
        );
      }
      console.log("Using local SENDGRID_API_KEY from environment variable");
      return apiKey;
    }

    // In production, use Parameter Store
    const environment = process.env["ENVIRONMENT"] || "dev";
    return await this.getParameter(`/${environment}/sendgrid-api-key`, true);
  }

  /**
   * Get the ComfyUI API Endpoint from Parameter Store or environment variable
   */
  static async getComfyUIApiEndpoint(): Promise<string> {
    // In local development, use environment variable directly
    if (isLocal) {
      const endpoint = process.env["COMFYUI_API_ENDPOINT"];
      if (!endpoint) {
        console.log(
          "COMFYUI_API_ENDPOINT not found in environment, using default localhost endpoint"
        );
        return "http://localhost:8188";
      }
      console.log("Using local COMFYUI_API_ENDPOINT from environment variable");
      return endpoint;
    }

    // In production, use Parameter Store
    const environment = process.env["ENVIRONMENT"] || "dev";
    return await this.getParameter(
      `/${environment}/comfyui-api-endpoint`,
      false
    );
  }

  /**
   * Get the OpenRouter API Key from Parameter Store or environment variable
   */
  static async getOpenRouterApiKey(): Promise<string> {
    // In local development, use environment variable directly
    if (isLocal) {
      const apiKey = process.env["OPENROUTER_API_KEY"];
      if (!apiKey) {
        throw new Error(
          "OPENROUTER_API_KEY not found in environment variables"
        );
      }
      console.log("Using local OPENROUTER_API_KEY from environment variable");
      return apiKey;
    }

    // In production, use Parameter Store
    const environment = process.env["ENVIRONMENT"] || "dev";
    return await this.getParameter(`/${environment}/openrouter-api-key`, true);
  }

  /**
   * Get the JWT Encryption Key from Parameter Store or environment variable
   */
  static async getJwtEncryptionKey(): Promise<string> {
    // In local development, use environment variable directly
    if (isLocal) {
      const key = process.env["JWT_ENCRYPTION_KEY"];
      if (!key) {
        throw new Error(
          "JWT_ENCRYPTION_KEY environment variable is required in local development"
        );
      }
      console.log("Using local JWT_ENCRYPTION_KEY from environment variable");
      return key;
    }

    // In production, use Parameter Store
    const environment = process.env["ENVIRONMENT"] || "dev";
    return await this.getParameter(`/${environment}/jwt-encryption-key`, true);
  }

  /**
   * Get the JWT Secret from Parameter Store or environment variable
   */
  static async getJwtSecret(): Promise<string> {
    // In local development, use environment variable directly
    if (isLocal) {
      const secret = process.env["JWT_SECRET"];
      if (!secret) {
        throw new Error(
          "JWT_SECRET environment variable is required in local development"
        );
      }
      console.log("Using local JWT_SECRET from environment variable");
      return secret;
    }

    // In production, use Parameter Store
    const environment = process.env["ENVIRONMENT"] || "dev";
    return await this.getParameter(`/${environment}/jwt-secret`, true);
  }
}
