// DynamoDB Entity Types
import type {
  EntityType,
  CreatorType,
  MediaStatus,
  ThumbnailUrls,
  Metadata,
  TargetType,
  CommentTargetType,
  InteractionType,
  AuthProvider,
  SubscriptionStatus,
} from "./core";
import { UserPlan } from "./permissions";
import type { UserProfileInsights } from "./user";

// DynamoDB Entity base interface
interface BaseEntity {
  PK: string;
  SK: string;
  EntityType: EntityType;
}

// Album Entity
export interface AlbumEntity extends BaseEntity {
  PK: string; // ALBUM#{albumId}
  SK: string; // METADATA
  GSI1PK: string; // ALBUM
  GSI1SK: string; // {createdAt}#{albumId}
  GSI4PK: string; // ALBUM_BY_CREATOR
  GSI4SK: string; // {createdBy}#{createdAt}#{albumId}
  GSI5PK: string; // ALBUM
  GSI5SK: string; // {isPublic}
  EntityType: "Album";
  id: string;
  title: string;
  tags?: string[];
  coverImageUrl?: string;
  thumbnailUrls?: ThumbnailUrls;
  createdAt: string;
  updatedAt: string;
  mediaCount: number;
  isPublic: string; // "true" or "false" - stored as string for GSI compatibility
  likeCount?: number;
  bookmarkCount?: number;
  viewCount?: number;
  commentCount?: number;
  metadata?: Metadata;
  createdBy?: string; // User ID who created the album
  createdByType?: CreatorType; // Type of creator
}

// Media Entity
export interface MediaEntity extends BaseEntity {
  PK: string; // MEDIA#{mediaId}
  SK: string; // METADATA
  GSI1PK: string; // MEDIA_BY_CREATOR
  GSI1SK: string; // {createdBy}#{createdAt}#{mediaId}
  GSI2PK: string; // MEDIA_ID
  GSI2SK: string; // {mediaId}
  GSI3PK: string; // MEDIA_BY_USER_{isPublic}
  GSI3SK: string; // {createdBy}#{createdAt}#{mediaId}
  GSI4PK: string; // MEDIA
  GSI4SK: string; // {createdAt}#{mediaId}
  GSI5PK: string; // MEDIA
  GSI5SK: string; // {isPublic}
  EntityType: "Media";
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size?: number;
  width?: number;
  height?: number;
  url?: string;
  thumbnailUrl?: string;
  thumbnailUrls?: ThumbnailUrls;
  status?: MediaStatus;
  createdAt: string;
  updatedAt: string;
  isPublic?: string; // "true" or "false" - stored as string for GSI compatibility
  likeCount?: number;
  bookmarkCount?: number;
  viewCount?: number;
  commentCount?: number;
  metadata?: Metadata;
  // User tracking fields
  createdBy?: string; // userId or adminId who uploaded this media
  createdByType?: CreatorType; // type of creator
}

// Album-Media relationship entity (many-to-many)
export interface AlbumMediaEntity extends BaseEntity {
  PK: string; // ALBUM#{albumId}
  SK: string; // MEDIA#{mediaId}
  GSI1PK: string; // MEDIA#{mediaId}
  GSI1SK: string; // ALBUM#{albumId}#{addedAt}
  GSI2PK: string; // ALBUM_MEDIA_BY_DATE
  GSI2SK: string; // {addedAt}#{albumId}#{mediaId}
  EntityType: "AlbumMedia";
  albumId: string;
  mediaId: string;
  addedAt: string; // when media was added to this album
  addedBy?: string; // who added it to this album
}

// Album-Tag relationship entity (many-to-many)
export interface AlbumTagEntity extends BaseEntity {
  PK: string; // ALBUM_TAG#{normalizedTag}
  SK: string; // ALBUM#{albumId}#{createdAt}
  GSI1PK: string; // ALBUM_TAG
  GSI1SK: string; // {normalizedTag}#{createdAt}#{albumId}
  GSI2PK: string; // ALBUM_TAG#{normalizedTag}#{isPublic}
  GSI2SK: string; // {createdAt}
  GSI3PK: string; // ALBUM_TAG#{userId}#{isPublic}
  GSI3SK: string; // {normalizedTag}#{createdAt}
  EntityType: "AlbumTag";
  albumId: string; // Album ID for easy retrieval
  userId: string; // Creator ID for GSI3 queries
  tag: string; // Original tag (with case)
  normalizedTag: string; // Normalized tag (lowercase, trimmed)
  createdAt: string; // When album was created (for chronological sorting)
  isPublic: string; // "true" or "false" for GSI compatibility
}

// Comment Entity
export interface CommentEntity extends BaseEntity {
  PK: string; // COMMENT#{commentId}
  SK: string; // METADATA
  GSI1PK: string; // COMMENTS_BY_TARGET
  GSI1SK: string; // {targetType}#{targetId}#{createdAt}#{commentId}
  GSI2PK: string; // COMMENTS_BY_USER
  GSI2SK: string; // {userId}#{createdAt}#{commentId}
  EntityType: "Comment";
  id: string;
  content: string;
  targetType: CommentTargetType;
  targetId: string;
  userId: string;
  username?: string;
  createdAt: string;
  updatedAt: string;
  likeCount?: number;
  isEdited?: boolean;
}

// User Entity
export interface UserEntity extends BaseEntity {
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
  provider: AuthProvider; // Authentication provider
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
  avatarThumbnails?: ThumbnailUrls;

  // Plan and subscription information
  role: "user" | "admin" | "moderator"; // User role
  plan: UserPlan; // Current plan
  subscriptionId?: string; // Stripe/payment provider subscription ID
  subscriptionStatus?: SubscriptionStatus; // Subscription status
  planStartDate?: string; // When current plan started
  planEndDate?: string; // When current plan expires (for paid plans)

  // Usage statistics
  imagesGeneratedThisMonth?: number; // Current month usage
  imagesGeneratedToday?: number; // Today's usage
  lastGenerationAt?: string; // Last generation timestamp

  // Real-time profile insights/metrics
  profileInsights?: UserProfileInsights;
}

// User Session Entity
export interface UserSessionEntity extends BaseEntity {
  PK: string; // SESSION#{sessionId}
  SK: string; // METADATA
  GSI1PK: string; // USER_SESSION_EXPIRY
  GSI1SK: string; // {expiresAt}#{sessionId}
  GSI2PK: string; // USER#{userId}#SESSION
  GSI2SK: string; // {createdAt}#{sessionId}
  EntityType: "UserSession";
  sessionId: string;
  userId: string;
  userEmail: string;
  createdAt: string;
  expiresAt: string;
  lastAccessedAt: string;
  ttl: number; // For DynamoDB TTL
}

// User Interaction Entity
export interface UserInteractionEntity extends BaseEntity {
  PK: string; // USER#{userId}
  SK: string; // INTERACTION#{interactionType}#{targetId}
  GSI1PK: string; // INTERACTION#{interactionType}#{targetId}
  GSI1SK: string; // {userId}
  GSI2PK?: string; // USER#{userId}#INTERACTIONS#{interactionType} - for chronological sorting
  GSI2SK?: string; // {createdAt} - for chronological sorting
  EntityType: "UserInteraction";
  userId: string;
  interactionType: InteractionType;
  targetType: TargetType;
  targetId: string;
  createdAt: string;
}

// Email Verification Token Entity
export interface EmailVerificationTokenEntity extends BaseEntity {
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

// Password Reset Token Entity
export interface PasswordResetTokenEntity extends BaseEntity {
  PK: string; // PASSWORD_RESET#{token}
  SK: string; // TOKEN
  GSI1PK: string; // PASSWORD_RESET_EXPIRY
  GSI1SK: string; // {expiresAt}#{token}
  EntityType: "PasswordResetToken";
  token: string;
  userId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  ttl: number; // For DynamoDB TTL
}
