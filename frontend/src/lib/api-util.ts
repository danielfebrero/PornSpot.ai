/**
 * Shared API utilities to reduce duplication in frontend API calls
 */

import { ApiResponse, PaginationRequest } from "@/types/shared-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}

// Use PaginationRequest from shared-types but alias for clearer naming in this context
export type PaginationParams = PaginationRequest;

export interface ApiRequestConfig {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  credentials?: RequestCredentials;
}

/**
 * Shared utilities for making API requests with consistent patterns
 */
export class ApiUtil {
  /**
   * Build URL with query parameters
   */
  static buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(`${API_URL}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Make a standard API request with error handling
   */
  static async request<T = any>(
    endpoint: string,
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = "GET",
      headers = {},
      params,
      body,
      credentials = "include",
    } = config;

    const url = this.buildUrl(endpoint, params);

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    const requestConfig: RequestInit = {
      method,
      headers: requestHeaders,
      credentials,
    };

    if (body && method !== "GET") {
      requestConfig.body =
        typeof body === "string" ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestConfig);

      if (!response.ok) {
        // Try to parse error response
        try {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
          );
        } catch {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      // Handle 204 No Content responses
      if (response.status === 204) {
        return { success: true };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API request failed for ${method} ${url}:`, error);
      throw error;
    }
  }

  /**
   * GET request helper
   */
  static async get<T = any>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET", params });
  }

  /**
   * POST request helper
   */
  static async post<T = unknown>(
    endpoint: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "POST", body, params });
  }

  /**
   * PUT request helper
   */
  static async put<T = unknown>(
    endpoint: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "PUT", body, params });
  }

  /**
   * DELETE request helper
   */
  static async delete<T = any>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE", params });
  }

  /**
   * PATCH request helper
   */
  static async patch<T = unknown>(
    endpoint: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "PATCH", body, params });
  }

  /**
   * Helper for paginated requests
   */
  static async getPaginated<T = unknown>(
    endpoint: string,
    paginationParams?: PaginationParams,
    additionalParams?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    const params = {
      ...additionalParams,
      ...paginationParams,
    };

    return this.get<T>(endpoint, params);
  }

  /**
   * Helper for building search parameters consistently
   */
  static buildSearchParams(params: Record<string, any>): URLSearchParams {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item) => searchParams.append(key, String(item)));
        } else {
          searchParams.set(key, String(value));
        }
      }
    });

    return searchParams;
  }

  /**
   * Helper for form data uploads
   */
  static async uploadFormData<T = any>(
    endpoint: string,
    formData: FormData
  ): Promise<ApiResponse<T>> {
    const url = `${API_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include",
        // Don't set Content-Type header for FormData - browser will set it with boundary
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
          );
        } catch {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Upload failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Helper for handling common error scenarios
   */
  static handleApiError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    if (
      error &&
      typeof error === "object" &&
      "error" in error &&
      typeof error.error === "string"
    ) {
      return error.error;
    }

    return "An unexpected error occurred";
  }

  /**
   * Helper for extracting data from API response
   */
  static extractData<T>(response: ApiResponse<T>): T {
    if (!response.success) {
      throw new Error(response.error || "API request failed");
    }

    if (response.data === undefined) {
      throw new Error("No data in successful response");
    }

    return response.data;
  }

  /**
   * Helper for batch operations
   */
  static async batch<T>(
    requests: Array<() => Promise<T>>,
    batchSize: number = 5
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((request) => request()));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Helper for retrying failed requests
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          break;
        }

        // Wait before retrying
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * Math.pow(2, attempt))
        );
      }
    }

    throw lastError;
  }

  /**
   * Stream data from a server-sent events endpoint
   */
  static async *streamRequest<T = any>(
    endpoint: string,
    config: ApiRequestConfig = {}
  ): AsyncGenerator<T, void, unknown> {
    const {
      method = "POST",
      headers = {},
      params,
      body,
      credentials = "include",
    } = config;

    const url = this.buildUrl(endpoint, params);

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    const requestConfig: RequestInit = {
      method,
      headers: requestHeaders,
      credentials,
    };

    if (body && method !== "GET") {
      requestConfig.body =
        typeof body === "string" ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestConfig);

      if (!response.ok) {
        // Try to parse error response
        try {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
          );
        } catch {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.trim() === "") continue;

            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") return;

              try {
                const event: T = JSON.parse(data);
                yield event;
              } catch (parseError) {
                console.warn("Failed to parse stream event:", parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error(`Stream request failed for ${method} ${url}:`, error);
      throw error;
    }
  }
}
