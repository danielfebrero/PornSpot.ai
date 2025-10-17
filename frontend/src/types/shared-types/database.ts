/**
 * @fileoverview Database Entity Types
 * @description Core database entity interfaces for AlbumEntity, MediaEntity, UserEntity, etc.
 * @notes
 * - EntityType enum.
 * - AlbumEntity, MediaEntity, UserEntity, UserSessionEntity, CommentEntity, AlbumMediaEntity, AlbumTagEntity, EmailVerificationTokenEntity, PasswordResetTokenEntity, AnalyticsEntity, MetricsCacheEntity, GenerationSettingsEntity, FollowEntity.
 * - ThumbnailUrls, Metadata.
 * - ViewCountTarget, ViewCountItem, ViewCountResponse.
 * - ViewTrackingRequest.
 */
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
import type { UserProfileInsights, EmailPreferences } from "./user";

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
  GSI2PK: string; // ALBUM_COVER_IMAGE
  GSI2SK: string; // {coverImageMediaId}#{albumId}
  GSI3PK: string; // ALBUM_BY_USER_{isPublic}
  GSI3SK: string; // {createdBy}#{createdAt}#{albumId}
  GSI4PK: string; // ALBUM_BY_CREATOR
  GSI4SK: string; // {createdBy}#{createdAt}#{albumId}
  GSI5PK: string; // ALBUM
  GSI5SK: string; // {isPublic}#{createdAt}
  GSI6PK: string; // POPULARITY
  GSI6SK: number; // 0
  GSI7PK: string; // CONTENT
  GSI7SK: string; // {createdAt}
  GSI8PK?: string; // VISIBILITY_UPDATED
  GSI8SK?: string; // {isPublic}#{updatedAt}#{albumId}
  EntityType: "Album";
  id: string;
  title: string;
  tags?: string[];
  coverImageUrl?: string;
  thumbnailUrls?: ThumbnailUrls;
  coverImageMediaId?: string; // Media ID of the cover image
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
  GSI5SK: string; // {isPublic}#{createdAt}
  GSI6PK: string; // POPULARITY
  GSI6SK: number; // 0
  GSI7PK: string; // CONTENT
  GSI7SK: string; // {createdAt}
  GSI8PK?: string; // MEDIA_BY_TYPE_AND_CREATOR
  GSI8SK?: string; // {type}#{createdBy}#{createdAt}#{mediaId}
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
  type: "image" | "video";
  optimizedVideoUrl?: string; // for videos, URL of the optimized version
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
  GSI3PK: string; // INTERACTION#comment
  GSI3SK: string; // {createdAt}
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
  GSI4PK?: string; // USER_PLAN#{plan} (partition per plan for efficient querying)
  GSI4SK?: string; // {planEndDate || '9999-12-31T00:00:00.000Z'}#{userId} (date sorts; suffix ensures uniqueness)
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
  bonusGenerationCredits?: number; // Remaining bonus credits granted on signup

  // Real-time profile insights/metrics
  profileInsights?: UserProfileInsights;
  followerCount?: number;

  // PornSpotCoin balance information
  pscBalance?: number; // Current PSC balance (off-chain tracking)
  pscTotalEarned?: number; // Total PSC earned from rewards
  pscTotalSpent?: number; // Total PSC spent on subscriptions/purchases
  pscTotalWithdrawn?: number; // Total PSC withdrawn to wallet
  pscLastTransactionAt?: string; // Last PSC transaction timestamp

  // emails
  lastSentUnreadNotificationsEmailAt?: string; // when the last unread notifications email was sent
  lastSentPscBalanceEmailAt?: string; // when the last PSC balance email was sent

  // email notification preferences
  emailPreferences: EmailPreferences; // per-user email notification preferences

  // video generation
  i2vCreditsSecondsPurchased: number; // image-to-video generation credits in seconds
  i2vCreditsSecondsFromPlan: number; // credits granted by subscription plan
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
  GSI3PK?: string; // INTERACTION#{interactionType}
  GSI3SK?: string; // {createdAt} - for chronological sorting
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

// Analytics Entity - for pre-calculated metrics
export interface AnalyticsEntity extends BaseEntity {
  PK: string; // ANALYTICS#{metricType}#{granularity}
  SK: string; // {timestamp}
  GSI1PK: string; // ANALYTICS (reusing existing GSI1)
  GSI1SK: string; // {granularity}#{timestamp}#{metricType}
  GSI2PK: string; // ANALYTICS_TYPE#{metricType} (reusing existing GSI2)
  GSI2SK: string; // {timestamp}
  EntityType: "Analytics";

  // Core fields
  metricType: string; // e.g., "users", "media", "albums", "interactions"
  granularity: "hourly" | "daily" | "weekly" | "monthly";
  timestamp: string; // ISO 8601 timestamp (start of period)
  endTimestamp: string; // ISO 8601 timestamp (end of period)

  // Metric data (flexible JSON object for extensibility)
  metrics: {
    // User metrics
    totalUsers?: number;
    newUsers?: number;
    activeUsers?: number;

    // Media metrics
    totalMedia?: number;
    newMedia?: number;
    publicMedia?: number;
    privateMedia?: number;

    // Album metrics
    totalAlbums?: number;
    newAlbums?: number;
    publicAlbums?: number;
    privateAlbums?: number;

    // Interaction metrics
    totalLikes?: number;
    totalBookmarks?: number;
    totalComments?: number;
    totalViews?: number;

    // Generation metrics
    totalGenerations?: number;
    successfulGenerations?: number;
    failedGenerations?: number;

    // Business metrics
    MRR?: number; // Monthly Recurring Revenue
    totalRevenue?: number;
    newRevenue?: number;

    // Additional metrics can be added here
    [key: string]: any;
  };

  // Metadata
  calculatedAt: string; // When this metric was calculated
  version: number; // Schema version for future migrations
}

// Metrics Cache Entity - for real-time metrics (optional)
export interface MetricsCacheEntity extends BaseEntity {
  PK: string; // METRICS_CACHE
  SK: string; // {metricKey}
  EntityType: "MetricsCache";

  metricKey: string; // e.g., "total_users", "total_media"
  value: number | string | object;
  lastUpdated: string;
  ttl: number; // DynamoDB TTL for cache expiration
}

// Generation Settings Entity - for storing user generation preferences
export interface GenerationSettingsEntity extends BaseEntity {
  PK: string; // GEN_SETTINGS#{userId}
  SK: string; // METADATA
  EntityType: "GenerationSettings";
  userId: string;
  imageSize: string;
  customWidth: number;
  customHeight: number;
  batchCount: number;
  isPublic: string; // "true" or "false" - stored as string for GSI compatibility
  cfgScale: number;
  steps: number;
  negativePrompt: string;
  createdAt: string;
  updatedAt: string;
}

// Follow Entity - for user following relationships
export interface FollowEntity extends BaseEntity {
  PK: string; // FOLLOW#{followerId}#{followedId}
  SK: string; // METADATA
  GSI1PK: string; // FOLLOWING#{followerId} - to query users that followerId follows
  GSI1SK: string; // {createdAt}#{followedId}
  GSI2PK: string; // FOLLOWERS#{followedId} - to query users that follow followedId
  GSI2SK: string; // {createdAt}#{followerId}
  EntityType: "Follow";
  followerId: string; // User who is following
  followedId: string; // User being followed
  createdAt: string; // When the follow relationship was created
}

// I2V Job Entity - track image-to-video job submissions to Runpod
export interface I2VJobEntity extends BaseEntity {
  PK: string; // I2VJOB#{jobId}
  SK: string; // METADATA
  // Global Secondary Indexes for flexible querying
  GSI1PK: string; // I2VJOB_BY_USER#{userId}
  GSI1SK: string; // {createdAt}#{jobId}
  GSI2PK: string; // I2VJOB_BY_MEDIA#{mediaId}
  GSI2SK: string; // {createdAt}#{jobId}
  GSI3PK: string; // I2VJOB_STATUS#{status}
  GSI3SK: string; // {createdAt}#{jobId}
  GSI4PK: string; // I2VJOB_STATUS_USER#{userId}#{status}
  GSI4SK: string; // {createdAt}#{jobId}
  EntityType: "I2VJob";
  // Core identifiers
  jobId: string; // Runpod job ID
  userId: string; // Submitting user
  mediaId: string; // Source image media ID
  // Request parameters snapshot
  request: {
    videoLength: 5 | 8 | 10 | 15 | 20 | 25 | 30;
    prompt: string;
    negativePrompt: string;
    seed: string;
    flowShift: number; // 1-10
    inferenceSteps: number; // 20-40
    cfgScale: number; // 1-10
    optimizePrompt: boolean;
    isPublic?: boolean;
    enableLoras?: boolean;
    width: number;
    height: number;
    selectedLoras?: string[];
    loraTriggerWords?: string[];
    loraHighNoise?: Array<{
      id: string;
      scale: number;
      mode: "auto" | "manual";
    }>;
    loraLowNoise?: Array<{
      id: string;
      scale: number;
      mode: "auto" | "manual";
    }>;
  };
  // Submission and status
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | string; // store Runpod-like statuses
  submittedAt: string; // ISO
  updatedAt: string; // ISO
  completedAt?: string; // ISO
  estimatedCompletionTimeAt?: string; // ISO
  estimatedSeconds?: number; // estimated time to complete in seconds

  // Resolved fields
  sourceImageUrl: string; // Full CDN URL used
  runpodModel: string; // e.g., wan-2-2-i2v-720
  delayTime?: number;
  executionTime?: number;
  resultMediaId?: string; // Created Media ID for result video
  refundedAt?: string; // When credits were refunded for a failed job
  refundedSeconds?: number; // Number of seconds refunded to the user
  retryJobId?: string; // Newly created job id when this job is retried
  retryOfJobId?: string; // Original job id if this job is created via retry
}

export interface OrderEntity extends BaseEntity {
  PK: string; // ORDER#{orderId}
  SK: string; // METADATA
  GSI1PK: string; // ORDERS_BY_USER#{userId}
  GSI1SK: string; // {createdAt}#{orderId}
  GSI2PK: string; // ORDERS_BY_STATUS#{status}
  GSI2SK: string; // {createdAt}#{orderId}
  GSI3PK: string; // ORDER_BY_ITEM#{item}
  GSI3SK: string; // {createdAt}#{orderId}
  EntityType: "Order";
  orderId: string;
  userId: string;
  item: string; // e.g., "starter-monthly", "pro-yearly"
  amount: string; // 10.00
  currency: string; // e.g., "USD"
  status: "initiated" | "completed" | "cancelled" | "failed";
  paymentProvider: "trustpay" | string;
  paymentRequestId?: string; // e.g., TrustPay request ID
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  metadata?: Metadata; // Flexible JSON for any extra data
}
