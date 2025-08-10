// Main exports for the shared layer
// Re-export types from shared-types package
export * from "@shared/shared-types";

// Export backend-specific utilities
export * from "./utils/dynamodb";
export * from "./utils/s3";
export * from "./utils/response";
export * from "./utils/user";
export * from "./utils/thumbnail";
export * from "./utils/email";
export * from "./utils/parameters";
export * from "./utils/revalidation";
export * from "./utils/lambda-handler";
export * from "./utils/validation";
export * from "./utils/counter";
export * from "./auth/admin-middleware";
export * from "./auth/user-middleware";
