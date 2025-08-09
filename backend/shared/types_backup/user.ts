// User Authentication Types
export interface User {
  userId: string;
  email: string;
  username?: string; // Now required
  firstName?: string;
  lastName?: string;
  createdAt: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  lastActive?: string; // Last time user was seen active (updated on each request)
  googleId?: string; // For future Google OAuth integration
  preferredLanguage?: string; // User's preferred language (ISO 639-1 code: en, fr, de, etc.)

  // Avatar information
  avatarUrl?: string; // Original avatar image URL
  avatarThumbnails?: {
    originalSize?: string; // WebP optimized version of original (full resolution)
    small?: string; // Small size (max 32px, preserves aspect ratio)
    medium?: string; // Medium size (max 96px, preserves aspect ratio)
    large?: string; // Large size (max 128px, preserves aspect ratio)
  };
}

export interface UserSession {
  sessionId: string;
  userId: string;
  userEmail: string;
  createdAt: string;
  expiresAt: string;
  lastAccessedAt: string;
}

export interface UserRegistrationRequest {
  email: string;
  password: string;
  username: string; // Now required
}

export interface UserLoginRequest {
  email: string;
  password: string;
}

export interface UserLoginResponse {
  success: boolean;
  user: User;
  sessionId: string;
}

export interface UserSessionValidationResult {
  isValid: boolean;
  user?: User;
  session?: UserSession;
}

export interface UsernameAvailabilityRequest {
  username: string;
}

export interface UsernameAvailabilityResponse {
  success: boolean;
  available: boolean;
  message?: string;
  error?: string;
}

// User Interaction Types
export interface UserInteraction {
  userId: string;
  interactionType: "like" | "bookmark";
  targetType: "album" | "media" | "comment";
  targetId: string;
  createdAt: string;
}

export interface InteractionRequest {
  targetType: "album" | "media" | "comment";
  targetId: string;
  action: "add" | "remove";
}

export interface InteractionResponse {
  success: boolean;
  data?: UserInteraction;
  error?: string;
}

export interface InteractionCountsResponse {
  success: boolean;
  data?: {
    targetId: string;
    targetType: "album" | "media";
    likeCount: number;
    bookmarkCount: number;
    userLiked: boolean;
    userBookmarked: boolean;
  };
  error?: string;
}

export interface UserInteractionsResponse {
  success: boolean;
  data?: {
    interactions: UserInteraction[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
  error?: string;
}

// User DynamoDB Entity Types
export interface UserEntity {
  PK: string; // USER#{userId}
  SK: string; // METADATA
  GSI1PK: string; // USER_EMAIL
  GSI1SK: string; // {email}
  GSI2PK?: string; // USER_GOOGLE (for Google OAuth)
  GSI2SK?: string; // {googleId}
  GSI3PK: string; // USER_USERNAME
  GSI3SK: string; // {username}
  EntityType: "User";
  userId: string;
  email: string;
  username: string; // Now required
  firstName?: string;
  lastName?: string;
  passwordHash?: string; // Optional for OAuth users
  salt?: string; // Optional for OAuth users
  provider: "email" | "google"; // Authentication provider
  createdAt: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  lastActive?: string; // Last time user was seen active (updated on each request)
  googleId?: string; // For Google OAuth integration

  // Profile information
  bio?: string; // User biography/description
  location?: string; // User location (city, country)
  website?: string; // User website URL
  preferredLanguage?: string; // User's preferred language (ISO 639-1 code: en, fr, de, etc.)

  // Avatar information
  avatarUrl?: string; // Original avatar image URL
  avatarThumbnails?: {
    originalSize?: string; // WebP optimized version of original (full resolution)
    small?: string; // Small size (max 32px, preserves aspect ratio)
    medium?: string; // Medium size (max 96px, preserves aspect ratio)
    large?: string; // Large size (max 128px, preserves aspect ratio)
  };

  // Plan and subscription information
  role?: "user" | "admin" | "moderator"; // User role
  plan?: "free" | "starter" | "unlimited" | "pro"; // Current plan
  subscriptionId?: string; // Stripe/payment provider subscription ID
  subscriptionStatus?: "active" | "canceled" | "expired"; // Subscription status
  planStartDate?: string; // When current plan started
  planEndDate?: string; // When current plan expires (for paid plans)

  // Usage statistics
  imagesGeneratedThisMonth?: number; // Current month usage
  imagesGeneratedToday?: number; // Today's usage
  lastGenerationAt?: string; // Last generation timestamp

  // Real-time profile insights/metrics
  profileInsights?: {
    totalLikesReceived: number; // Total likes received on user's content (albums + media)
    totalBookmarksReceived: number; // Total bookmarks received on user's content
    totalMediaViews: number; // Total views on user's generated media
    totalProfileViews: number; // Total views of user's profile page
    totalGeneratedMedias: number; // Total number of media items generated by user
    totalAlbums: number; // Total number of albums created by user
    lastUpdated: string; // When these metrics were last updated
  };
}

export interface UserSessionEntity {
  PK: string; // SESSION#{sessionId}
  SK: string; // METADATA
  GSI1PK: string; // USER_SESSION_EXPIRY
  GSI1SK: string; // {expiresAt}#{sessionId}
  EntityType: "UserSession";
  sessionId: string;
  userId: string;
  userEmail: string;
  createdAt: string;
  expiresAt: string;
  lastAccessedAt: string;
  ttl: number; // For DynamoDB TTL
}

export interface UserInteractionEntity extends UserInteraction {
  PK: string; // USER#{userId}
  SK: string; // INTERACTION#{interactionType}#{targetId}
  GSI1PK: string; // INTERACTION#{interactionType}#{targetId}
  GSI1SK: string; // {userId}
  EntityType: "UserInteraction";
  userId: string;
  interactionType: "like" | "bookmark";
  targetType: "album" | "media" | "comment";
  targetId: string;
  createdAt: string;
}

export interface EmailVerificationTokenEntity {
  PK: string; // EMAIL_VERIFICATION#{token}
  SK: string; // METADATA
  GSI1PK: string; // EMAIL_VERIFICATION_EXPIRY
  GSI1SK: string; // {expiresAt}#{token}
  EntityType: "EmailVerificationToken";
  token: string;
  userId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  ttl: number; // For DynamoDB TTL
}

// Google OAuth Types
export interface GoogleOAuthUserInfo {
  googleId: string;
  email: string;
  profilePicture?: string;
}

export interface GoogleOAuthRequest {
  code: string;
  state?: string;
}

export interface GoogleOAuthResponse {
  success: boolean;
  user?: User;
  sessionId?: string;
  redirectUrl: string;
  error?: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
}

// User insights/profile metrics types
export interface UserProfileInsights {
  totalLikesReceived: number;
  totalBookmarksReceived: number;
  totalMediaViews: number;
  totalProfileViews: number;
  totalGeneratedMedias: number;
  totalAlbums: number;
  lastUpdated: string;
}

export interface UserInsightsResponse {
  success: boolean;
  data?: UserProfileInsights;
  error?: string;
}
