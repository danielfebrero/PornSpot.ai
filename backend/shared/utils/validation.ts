/**
 * Shared validation utilities to reduce duplication across Lambda functions
 */
export class ValidationUtil {
  /**
   * Common validation error messages
   */
  static readonly MESSAGES = {
    REQUIRED_BODY: "Request body is required",
    REQUIRED_TITLE: "Title is required",
    EMPTY_TITLE: "Title cannot be empty",
    INVALID_JSON: "Invalid JSON in request body",
    ALBUM_ID_REQUIRED: "Album ID is required",
    MEDIA_ID_REQUIRED: "Media ID is required",
    USER_ID_REQUIRED: "User ID is required",
    COMMENT_ID_REQUIRED: "Comment ID is required",
    INVALID_EMAIL: "Invalid email format",
    INVALID_UUID: "Invalid UUID format",
    PASSWORD_TOO_SHORT: "Password must be at least 8 characters",
    UNAUTHORIZED_ACCESS: "You don't have permission to access this resource",
  } as const;

  /**
   * Validate required string field
   */
  static validateRequiredString(
    value: unknown,
    fieldName: string
  ): string {
    if (!value || typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`${fieldName} is required and cannot be empty`);
    }
    return value.trim();
  }

  /**
   * Validate optional string field (if provided, must be non-empty)
   */
  static validateOptionalString(
    value: unknown,
    fieldName: string
  ): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    
    if (typeof value !== "string") {
      throw new Error(`${fieldName} must be a string`);
    }
    
    if (value.trim().length === 0) {
      throw new Error(`${fieldName} cannot be empty`);
    }
    
    return value.trim();
  }

  /**
   * Validate boolean field
   */
  static validateBoolean(
    value: unknown,
    fieldName: string
  ): boolean {
    if (typeof value !== "boolean") {
      throw new Error(`${fieldName} must be a boolean`);
    }
    return value;
  }

  /**
   * Validate optional boolean field
   */
  static validateOptionalBoolean(
    value: unknown,
    fieldName: string
  ): boolean | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return this.validateBoolean(value, fieldName);
  }

  /**
   * Validate array field
   */
  static validateArray<T>(
    value: unknown,
    fieldName: string,
    itemValidator?: (item: unknown, index: number) => T
  ): T[] {
    if (!Array.isArray(value)) {
      throw new Error(`${fieldName} must be an array`);
    }

    if (itemValidator) {
      return value.map((item, index) => itemValidator(item, index));
    }

    return value;
  }

  /**
   * Validate optional array field
   */
  static validateOptionalArray<T>(
    value: unknown,
    fieldName: string,
    itemValidator?: (item: unknown, index: number) => T
  ): T[] | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return this.validateArray(value, fieldName, itemValidator);
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): string {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error(this.MESSAGES.INVALID_EMAIL);
    }
    return email.toLowerCase();
  }

  /**
   * Validate UUID format
   */
  static validateUUID(value: string, fieldName: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error(`${fieldName} must be a valid UUID`);
    }
    return value;
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): string {
    if (password.length < 8) {
      throw new Error(this.MESSAGES.PASSWORD_TOO_SHORT);
    }
    return password;
  }

  /**
   * Validate username format and requirements
   */
  static validateUsername(username: string): string {
    if (!username || username.trim().length === 0) {
      throw new Error("Username is required");
    }

    const trimmedUsername = username.trim();
    const errors: string[] = [];

    if (trimmedUsername.length < 3) {
      errors.push("Username must be at least 3 characters long");
    }

    if (trimmedUsername.length > 30) {
      errors.push("Username must be at most 30 characters long");
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      errors.push(
        "Username can only contain letters, numbers, underscores, and hyphens"
      );
    }

    if (/^[_-]/.test(trimmedUsername) || /[_-]$/.test(trimmedUsername)) {
      errors.push("Username cannot start or end with underscore or hyphen");
    }

    if (errors.length > 0) {
      throw new Error(`Username validation failed: ${errors.join(", ")}`);
    }

    return trimmedUsername;
  }

  /**
   * Validate file MIME type
   */
  static validateImageMimeType(mimeType: string): string {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg", 
      "image/png",
      "image/webp",
      "image/gif"
    ];
    
    if (!allowedTypes.includes(mimeType.toLowerCase())) {
      throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(", ")}`);
    }
    
    return mimeType.toLowerCase();
  }

  /**
   * Validate positive integer
   */
  static validatePositiveInteger(
    value: unknown,
    fieldName: string,
    max?: number
  ): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      throw new Error(`${fieldName} must be a positive integer`);
    }
    
    if (max && value > max) {
      throw new Error(`${fieldName} cannot exceed ${max}`);
    }
    
    return value;
  }

  /**
   * Validate pagination limit
   */
  static validatePaginationLimit(limit?: unknown): number {
    if (limit === undefined) {
      return 20; // Default limit
    }
    
    const numericLimit = typeof limit === "string" ? parseInt(limit, 10) : limit;
    return this.validatePositiveInteger(numericLimit, "limit", 100);
  }

  /**
   * Validate tags array
   */
  static validateTags(tags: unknown): string[] {
    if (!Array.isArray(tags)) {
      throw new Error("Tags must be an array");
    }
    
    const validatedTags = tags.map((tag, index) => {
      if (typeof tag !== "string") {
        throw new Error(`Tag at index ${index} must be a string`);
      }
      
      const trimmedTag = tag.trim();
      if (trimmedTag.length === 0) {
        throw new Error(`Tag at index ${index} cannot be empty`);
      }
      
      if (trimmedTag.length > 50) {
        throw new Error(`Tag at index ${index} cannot exceed 50 characters`);
      }
      
      return trimmedTag;
    });
    
    // Remove duplicates
    return [...new Set(validatedTags)];
  }

  /**
   * Validate sort order
   */
  static validateSortOrder(order?: unknown): "asc" | "desc" {
    if (order === undefined) {
      return "desc"; // Default to descending
    }
    
    if (order !== "asc" && order !== "desc") {
      throw new Error("Sort order must be 'asc' or 'desc'");
    }
    
    return order;
  }

  /**
   * Validate enum value
   */
  static validateEnum<T extends string>(
    value: unknown,
    validValues: readonly T[],
    fieldName: string
  ): T {
    if (typeof value !== "string" || !validValues.includes(value as T)) {
      throw new Error(`${fieldName} must be one of: ${validValues.join(", ")}`);
    }
    return value as T;
  }

  /**
   * Validate object with required fields
   */
  static validateObject<T>(
    value: unknown,
    fieldName: string,
    validator: (obj: Record<string, unknown>) => T
  ): T {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${fieldName} must be an object`);
    }
    
    return validator(value as Record<string, unknown>);
  }

  /**
   * Common album validation
   */
  static validateAlbumTitle(title: unknown): string {
    const validatedTitle = this.validateRequiredString(title, "title");
    
    if (validatedTitle.length > 200) {
      throw new Error("Album title cannot exceed 200 characters");
    }
    
    return validatedTitle;
  }

  /**
   * Common media validation
   */
  static validateMediaFilename(filename: unknown): string {
    const validatedFilename = this.validateRequiredString(filename, "filename");
    
    if (validatedFilename.length > 255) {
      throw new Error("Filename cannot exceed 255 characters");
    }
    
    return validatedFilename;
  }

  /**
   * Validate user role
   */
  static validateUserRole(role: unknown): "user" | "admin" | "moderator" {
    return this.validateEnum(role, ["user", "admin", "moderator"], "role");
  }

  /**
   * Validate interaction type
   */
  static validateInteractionType(type: unknown): "like" | "bookmark" {
    return this.validateEnum(type, ["like", "bookmark"], "interaction type");
  }
}