# Database Schema

This document provides a detailed overview of the DynamoDB database schema for the PornSpot.ai application. The database uses a single-table design, which is a common pattern for DynamoDB that allows for efficient data retrieval with a single request.

## Single-Table Design

All entities in the application are stored in a single DynamoDB table. This design is optimized for the access patterns of the application, and it minimizes the number of requests needed to fetch data. Each item in the table has a `PK` (Partition Key) and a `SK` (Sort Key) that define its identity and relationships with other items.

## Key Schema

- **Partition Key (PK)**: The primary identifier for an item. It is composed of the entity type and a unique ID (e.g., `ALBUM#{albumId}`).
- **Sort Key (SK)**: Used to define relationships between items and to sort items within a partition. For a primary item, the sort key is often `METADATA`. For related items, it can be a combination of the entity type and other attributes.

## Global Secondary Indexes (GSIs)

The table uses Global Secondary Indexes (GSIs) to support additional query patterns. The following GSIs are defined:

- **GSI1**:
  - `GSI1PK`: Used for various entity-specific partitions (e.g., `ALBUM`, `MEDIA_BY_CREATOR`, `COMMENTS_BY_TARGET`).
  - `GSI1SK`: Sort key for chronological or relationship-based sorting.
- **GSI2**:
  - `GSI2PK`: Used for direct lookups (e.g., `MEDIA_ID`).
  - `GSI2SK`: Entity ID for exact matches.
- **GSI3**:
  - `GSI3PK`: Used for user-specific queries (e.g., `MEDIA_BY_USER_true/false`, `USER_USERNAME`).
  - `GSI3SK`: Sort key for chronological ordering by creator.
- **GSI4**:
  - `GSI4PK`: Used for entity lists by date or creator (e.g., `MEDIA`, `ALBUM_BY_CREATOR`).
  - `GSI4SK`: Timestamp-based sorting.
- **GSI5**:
  - `GSI5PK`: Used for visibility-based queries (e.g., `ALBUM`, `MEDIA` with `isPublic`).
  - `GSI5SK`: Boolean string for public/private filtering.
- **GSI6**:
  - `GSI6PK`: `POPULARITY` for ranking entities.
  - `GSI6SK`: Placeholder (0) for sorting by popularity metrics.
- **GSI7**:
  - `GSI7PK`: `CONTENT` for content by creation date.
  - `GSI7SK`: Timestamp for chronological content queries.
- **GSI8**:
  - `GSI8PK`: Used for specialized queries (e.g., `VISIBILITY_UPDATED`, `MEDIA_BY_TYPE_AND_CREATOR`, `I2VJOB_STATUS_USER`).
  - `GSI8SK`: Context-specific sorting (e.g., `{isPublic}#{updatedAt}#{albumId}`, `{type}#{createdBy}#{createdAt}#{mediaId}`).

**Note**: `isPublic` is stored as a string (`"true"` or `"false"`) for GSI compatibility in boolean-based partitions.

## isPublic-createdAt-index (GSI5 Usage)

To efficiently support server-side filtering and pagination for public/private albums and media:

- **Partition Key**: `isPublic` (string: `"true"` or `"false"`).
- **Sort Key**: `createdAt`.

Every album and media **must** have the `isPublic` attribute (string). Album and media inserts/updates must enforce this.

**Migration**: Existing items without `isPublic` must be backfilled using [`backend/scripts/backfill-isPublic.ts`](../backend/scripts/backfill-isPublic.ts:1), defaulting to `"true"`.

## GSI5 for User PSC Leaderboard

To query users by total PornSpotCoin earned (leaderboard):

- **Partition Key**: `GSI5PK = "USER_PSC_TOTAL_EARNED"`.
- **Sort Key**: `GSI5SK = "{pscTotalEarned}#{userId}"` (zero-padded to 23 chars for proper sorting).

Every user **should** have `GSI5PK` and `GSI5SK` set. New users are created with these values, and existing users can be backfilled.

**Migration**: Backfill using [`scripts/backfill-gsi5-user-psc-earned.js`](../scripts/backfill-gsi5-user-psc-earned.js:1).

## GSI4 for Albums by Creator

To query albums by creator:

- **Partition Key**: `GSI4PK = "ALBUM_BY_CREATOR"`.
- **Sort Key**: `GSI4SK = "{createdBy}#{createdAt}#{albumId}"`.

**Migration**: Backfill using [`backend/scripts/backfill-gsi4-albums.ts`](../backend/scripts/backfill-gsi4-albums.ts:1).

## Entity Schemas

### Album Entity

Represents a collection of media items.

- **PK**: `ALBUM#{albumId}`
- **SK**: `METADATA`
- **GSI1PK**: `ALBUM`
- **GSI1SK**: `{createdAt}#{albumId}`
- **GSI2PK**: `ALBUM_COVER_IMAGE`
- **GSI2SK**: `{coverImageMediaId}#{albumId}`
- **GSI3PK**: `ALBUM_BY_USER_{isPublic}`
- **GSI3SK**: `{createdBy}#{createdAt}#{albumId}`
- **GSI4PK**: `ALBUM_BY_CREATOR`
- **GSI4SK**: `{createdBy}#{createdAt}#{albumId}`
- **GSI5PK**: `ALBUM`
- **GSI5SK**: `{isPublic}`
- **GSI6PK**: `POPULARITY`
- **GSI6SK**: `0`
- **GSI7PK**: `CONTENT`
- **GSI7SK**: `{createdAt}`
- **GSI8PK**: `VISIBILITY_UPDATED` (optional)
- **GSI8SK**: `{isPublic}#{updatedAt}#{albumId}` (optional)
- **EntityType**: `Album`

| Attribute           | Type             | Description                                  |
| ------------------- | ---------------- | -------------------------------------------- |
| `id`                | `string`         | The unique ID of the album.                  |
| `title`             | `string`         | The title of the album.                      |
| `tags`              | `string[]`       | Optional tags for the album.                 |
| `coverImageUrl`     | `string?`        | The URL of the album's cover image.          |
| `thumbnailUrls`     | `ThumbnailUrls?` | URLs for different thumbnail sizes.          |
| `coverImageMediaId` | `string?`        | Media ID of the cover image.                 |
| `createdAt`         | `string`         | The ISO 8601 timestamp of creation.          |
| `updatedAt`         | `string`         | The ISO 8601 timestamp of the last update.   |
| `mediaCount`        | `number`         | The number of media items in the album.      |
| `isPublic`          | `string`         | `"true"` or `"false"` for GSI compatibility. |
| `likeCount`         | `number?`        | Number of likes.                             |
| `bookmarkCount`     | `number?`        | Number of bookmarks.                         |
| `viewCount`         | `number?`        | Number of views.                             |
| `commentCount`      | `number?`        | Number of comments.                          |
| `metadata`          | `Metadata?`      | Additional metadata.                         |
| `type`              | `string`         | "image" or "video".                          |
| `optimizedVideoUrl` | `string?`        | URL of optimized video version.              |
| `createdBy`         | `string?`        | User ID who uploaded this media.             |
| `createdByType`     | `CreatorType?`   | Type of creator ("user" or "admin").         |

### Media Entity

Represents a single media item that can belong to multiple albums (many-to-many via AlbumMediaEntity).

- **PK**: `MEDIA#{mediaId}`
- **SK**: `METADATA`
- **GSI1PK**: `MEDIA_BY_CREATOR`
- **GSI1SK**: `{createdBy}#{createdAt}#{mediaId}`
- **GSI2PK**: `MEDIA_ID`
- **GSI2SK**: `{mediaId}`
- **GSI3PK**: `MEDIA_BY_USER_{isPublic}`
- **GSI3SK**: `{createdBy}#{createdAt}#{mediaId}`
- **GSI4PK**: `MEDIA`
- **GSI4SK**: `{createdAt}#{mediaId}`
- **GSI5PK**: `MEDIA`
- **GSI5SK**: `{isPublic}`
- **GSI6PK**: `POPULARITY`
- **GSI6SK**: `0`
- **GSI7PK**: `CONTENT`
- **GSI7SK**: `{createdAt}`
- **GSI8PK**: `MEDIA_BY_TYPE_AND_CREATOR` (optional)
- **GSI8SK**: `{type}#{createdBy}#{createdAt}#{mediaId}` (optional)
- **EntityType**: `Media`

| Attribute          | Type             | Description                                          |
| ------------------ | ---------------- | ---------------------------------------------------- |
| `id`               | `string`         | The unique ID of the media item.                     |
| `filename`         | `string`         | The name of the file in S3.                          |
| `originalFilename` | `string`         | The original name of the uploaded file.              |
| `mimeType`         | `string`         | The MIME type of the file.                           |
| `size`             | `number?`        | The size of the file in bytes.                       |
| `width`            | `number?`        | The width of the image in pixels.                    |
| `height`           | `number?`        | The height of the image in pixels.                   |
| `url`              | `string?`        | The URL of the original file.                        |
| `thumbnailUrl`     | `string?`        | Legacy thumbnail URL (deprecated).                   |
| `thumbnailUrls`    | `ThumbnailUrls?` | URLs for different thumbnail sizes.                  |
| `status`           | `MediaStatus?`   | Processing status ("pending", "uploaded", "failed"). |
| `createdAt`        | `string`         | The ISO 8601 timestamp of creation.                  |
| `updatedAt`        | `string`         | The ISO 8601 timestamp of the last update.           |
| `isPublic`         | `string?`        | `"true"` or `"false"` for GSI compatibility.         |
| `likeCount`        | `number?`        | Number of likes.                                     |
| `bookmarkCount`    | `number?`        | Number of bookmarks.                                 |
| `viewCount`        | `number?`        | Number of views.                                     |
| `commentCount`     | `number?`        | Number of comments.                                  |
| `metadata`         | `Metadata?`      | Additional metadata.                                 |
| `createdBy`        | `string?`        | User ID who uploaded this media.                     |
| `createdByType`    | `CreatorType?`   | Type of creator ("user" or "admin").                 |

### AlbumMediaEntity (Many-to-Many Relationship)

- **PK**: `ALBUM#{albumId}`
- **SK**: `MEDIA#{mediaId}`
- **GSI1PK**: `MEDIA#{mediaId}`
- **GSI1SK**: `ALBUM#{albumId}#{addedAt}`
- **GSI2PK**: `ALBUM_MEDIA_BY_DATE`
- **GSI2SK**: `{addedAt}#{albumId}#{mediaId}`
- **EntityType**: `AlbumMedia`

| Attribute | Type      | Description                                  |
| --------- | --------- | -------------------------------------------- |
| `albumId` | `string`  | The ID of the album.                         |
| `mediaId` | `string`  | The ID of the media item.                    |
| `addedAt` | `string`  | The ISO 8601 timestamp when media was added. |
| `addedBy` | `string?` | Who added it to this album.                  |

**Note**: Prevents duplicates with condition `attribute_not_exists(PK) AND attribute_not_exists(SK)`.

### AlbumTagEntity (Many-to-Many Tags)

- **PK**: `ALBUM_TAG#{normalizedTag}`
- **SK**: `ALBUM#{albumId}#{createdAt}`
- **GSI1PK**: `ALBUM_TAG`
- **GSI1SK**: `{normalizedTag}#{createdAt}#{albumId}`
- **GSI2PK**: `ALBUM_TAG#{normalizedTag}#{isPublic}`
- **GSI2SK**: `{createdAt}`
- **GSI3PK**: `ALBUM_TAG#{userId}#{isPublic}`
- **GSI3SK**: `{normalizedTag}#{createdAt}`
- **EntityType**: `AlbumTag`

| Attribute       | Type     | Description               |
| --------------- | -------- | ------------------------- |
| `albumId`       | `string` | Album ID.                 |
| `userId`        | `string` | Creator ID.               |
| `tag`           | `string` | Original tag.             |
| `normalizedTag` | `string` | Lowercase, trimmed tag.   |
| `createdAt`     | `string` | Album creation timestamp. |
| `isPublic`      | `string` | `"true"` or `"false"`.    |

### CommentEntity

- **PK**: `COMMENT#{commentId}`
- **SK**: `METADATA`
- **GSI1PK**: `COMMENTS_BY_TARGET`
- **GSI1SK**: `{targetType}#{targetId}#{createdAt}#{commentId}`
- **GSI2PK**: `COMMENTS_BY_USER`
- **GSI2SK**: `{userId}#{createdAt}#{commentId}`
- **GSI3PK**: `INTERACTION#comment`
- **GSI3SK**: `{createdAt}`
- **EntityType**: `Comment`

| Attribute    | Type                | Description            |
| ------------ | ------------------- | ---------------------- |
| `id`         | `string`            | Unique ID.             |
| `content`    | `string`            | Comment text.          |
| `targetType` | `CommentTargetType` | "album" or "media".    |
| `targetId`   | `string`            | Target ID.             |
| `userId`     | `string`            | Commenter ID.          |
| `username`   | `string?`           | Commenter's username.  |
| `createdAt`  | `string`            | Creation timestamp.    |
| `updatedAt`  | `string`            | Last update timestamp. |
| `likeCount`  | `number?`           | Number of likes.       |
| `isEdited`   | `boolean?`          | Whether edited.        |

### UserEntity

- **PK**: `USER#{userId}`
- **SK**: `METADATA`
- **GSI1PK**: `USER_EMAIL`
- **GSI1SK**: `{email}`
- **GSI2PK?**: `USER_GOOGLE`
- **GSI2SK?**: `{googleId}`
- **GSI3PK**: `USER_USERNAME`
- **GSI3SK**: `{username}`
- **GSI4PK**: `USER_PLAN#{plan}`
- **GSI4SK**: `{planEndDate || '9999-12-31T00:00:00.000Z'}#{userId}`
- **GSI5PK**: `USER_PSC_TOTAL_EARNED`
- **GSI5SK**: `{pscTotalEarned}#{userId}` (zero-padded for sorting)
- **EntityType**: `User`

| Attribute                            | Type                   | Description                           |
| ------------------------------------ | ---------------------- | ------------------------------------- |
| `userId`                             | `string`               | Unique ID.                            |
| `email`                              | `string`               | Email address.                        |
| `username`                           | `string`               | Required unique username.             |
| `firstName`                          | `string?`              | First name.                           |
| `lastName`                           | `string?`              | Last name.                            |
| `passwordHash`                       | `string?`              | Hashed password (optional for OAuth). |
| `salt`                               | `string?`              | Salt (optional for OAuth).            |
| `provider`                           | `AuthProvider`         | "email" or "google".                  |
| `createdAt`                          | `string`               | Creation timestamp.                   |
| `isActive`                           | `boolean`              | Active status.                        |
| `isEmailVerified`                    | `boolean`              | Email verified.                       |
| `lastLoginAt`                        | `string?`              | Last login.                           |
| `lastActive`                         | `string?`              | Last activity.                        |
| `googleId`                           | `string?`              | Google ID.                            |
| `bio`                                | `string?`              | Biography.                            |
| `location`                           | `string?`              | Location.                             |
| `website`                            | `string?`              | Website.                              |
| `preferredLanguage`                  | `string?`              | Preferred language (ISO 639-1).       |
| `avatarUrl`                          | `string?`              | Avatar URL.                           |
| `avatarThumbnails`                   | `ThumbnailUrls?`       | Avatar thumbnails.                    |
| `role`                               | `string`               | "user", "admin", or "moderator".      |
| `plan`                               | `UserPlan`             | Current plan.                         |
| `subscriptionId`                     | `string?`              | Subscription ID.                      |
| `subscriptionStatus`                 | `SubscriptionStatus?`  | Status.                               |
| `planStartDate`                      | `string?`              | Plan start.                           |
| `planEndDate`                        | `string?`              | Plan end.                             |
| `imagesGeneratedThisMonth`           | `number?`              | Monthly generations.                  |
| `imagesGeneratedToday`               | `number?`              | Daily generations.                    |
| `lastGenerationAt`                   | `string?`              | Last generation.                      |
| `bonusGenerationCredits`             | `number?`              | Remaining bonus credits.              |
| `profileInsights`                    | `UserProfileInsights?` | Profile metrics.                      |
| `followerCount`                      | `number?`              | Follower count.                       |
| `pscBalance`                         | `number?`              | Current PSC balance (off-chain).      |
| `pscTotalEarned`                     | `number?`              | Total PSC earned from rewards.        |
| `pscTotalSpent`                      | `number?`              | Total PSC spent.                      |
| `pscTotalWithdrawn`                  | `number?`              | Total PSC withdrawn to wallet.        |
| `pscLastTransactionAt`               | `string?`              | Last PSC transaction timestamp.       |
| `lastSentUnreadNotificationsEmailAt` | `string?`              | Last unread notifications email sent. |
| `lastSentPscBalanceEmailAt`          | `string?`              | Last PSC balance email sent.          |
| `emailPreferences`                   | `EmailPreferences`     | Email notification preferences.       |
| `i2vCreditsSecondsPurchased`         | `number`               | Image-to-video credits purchased.     |
| `i2vCreditsSecondsFromPlan`          | `number`               | Credits granted by subscription.      |

### UserSessionEntity

- **PK**: `SESSION#{sessionId}`
- **SK**: `METADATA`
- **GSI1PK**: `USER_SESSION_EXPIRY`
- **GSI1SK**: `{expiresAt}#{sessionId}`
- **GSI2PK**: `USER#{userId}#SESSION`
- **GSI2SK**: `{createdAt}#{sessionId}`
- **EntityType**: `UserSession`

| Attribute        | Type     | Description           |
| ---------------- | -------- | --------------------- |
| `sessionId`      | `string` | Unique session ID.    |
| `userId`         | `string` | User ID.              |
| `userEmail`      | `string` | User email.           |
| `createdAt`      | `string` | Creation timestamp.   |
| `expiresAt`      | `string` | Expiration timestamp. |
| `lastAccessedAt` | `string` | Last access.          |
| `ttl`            | `number` | DynamoDB TTL.         |

### UserInteractionEntity

- **PK**: `USER#{userId}`
- **SK**: `INTERACTION#{interactionType}#{targetId}`
- **GSI1PK**: `INTERACTION#{interactionType}#{targetId}`
- **GSI1SK**: `{userId}`
- **GSI2PK?**: `USER#{userId}#INTERACTIONS#{interactionType}`
- **GSI2SK?**: `{createdAt}`
- **GSI3PK?**: `INTERACTION#{interactionType}`
- **GSI3SK?**: `{createdAt}`
- **EntityType**: `UserInteraction`

| Attribute         | Type              | Description                     |
| ----------------- | ----------------- | ------------------------------- |
| `userId`          | `string`          | User ID.                        |
| `interactionType` | `InteractionType` | "like" or "bookmark".           |
| `targetType`      | `TargetType`      | "album", "media", or "comment". |
| `targetId`        | `string`          | Target ID.                      |
| `createdAt`       | `string`          | Creation timestamp.             |

### EmailVerificationTokenEntity

- **PK**: `EMAIL_VERIFICATION#{token}`
- **SK**: `METADATA`
- **GSI1PK**: `EMAIL_VERIFICATION_EXPIRY`
- **GSI1SK**: `{expiresAt}#{token}`
- **EntityType**: `EmailVerificationToken`

| Attribute   | Type     | Description           |
| ----------- | -------- | --------------------- |
| `token`     | `string` | Verification token.   |
| `userId`    | `string` | User ID.              |
| `email`     | `string` | Email.                |
| `createdAt` | `string` | Creation timestamp.   |
| `expiresAt` | `string` | Expiration timestamp. |
| `ttl`       | `number` | DynamoDB TTL.         |

### PasswordResetTokenEntity

- **PK**: `PASSWORD_RESET#{token}`
- **SK**: `TOKEN`
- **GSI1PK**: `PASSWORD_RESET_EXPIRY`
- **GSI1SK**: `{expiresAt}#{token}`
- **EntityType**: `PasswordResetToken`

| Attribute   | Type     | Description           |
| ----------- | -------- | --------------------- |
| `token`     | `string` | Reset token.          |
| `userId`    | `string` | User ID.              |
| `email`     | `string` | Email.                |
| `createdAt` | `string` | Creation timestamp.   |
| `expiresAt` | `string` | Expiration timestamp. |
| `ttl`       | `number` | DynamoDB TTL.         |

### AnalyticsEntity

- **PK**: `ANALYTICS#{metricType}#{granularity}`
- **SK**: `{timestamp}`
- **GSI1PK**: `ANALYTICS`
- **GSI1SK**: `{granularity}#{timestamp}#{metricType}`
- **GSI2PK**: `ANALYTICS_TYPE#{metricType}`
- **GSI2SK**: `{timestamp}`
- **EntityType**: `Analytics`

| Attribute      | Type     | Description                  |
| -------------- | -------- | ---------------------------- |
| `metricType`   | `string` | Metric type (e.g., "users"). |
| `granularity`  | `string` | "hourly", "daily", etc.      |
| `timestamp`    | `string` | Start timestamp.             |
| `endTimestamp` | `string` | End timestamp.               |
| `metrics`      | `object` | Flexible metrics object.     |
| `calculatedAt` | `string` | Calculation timestamp.       |
| `version`      | `number` | Schema version.              |

### MetricsCacheEntity

- **PK**: `METRICS_CACHE`
- **SK**: `{metricKey}`
- **EntityType**: `MetricsCache`

| Attribute     | Type     | Description   |
| ------------- | -------- | ------------- |
| `metricKey`   | `string` | Cache key.    |
| `value`       | `any`    | Cached value. |
| `lastUpdated` | `string` | Last update.  |
| `ttl`         | `number` | DynamoDB TTL. |

### GenerationSettingsEntity

- **PK**: `GEN_SETTINGS#{userId}`
- **SK**: `METADATA`
- **EntityType**: `GenerationSettings`

| Attribute        | Type     | Description            |
| ---------------- | -------- | ---------------------- |
| `userId`         | `string` | User ID.               |
| `imageSize`      | `string` | Image size.            |
| `customWidth`    | `number` | Custom width.          |
| `customHeight`   | `number` | Custom height.         |
| `batchCount`     | `number` | Batch count.           |
| `isPublic`       | `string` | `"true"` or `"false"`. |
| `cfgScale`       | `number` | CFG scale.             |
| `steps`          | `number` | Steps.                 |
| `negativePrompt` | `string` | Negative prompt.       |
| `createdAt`      | `string` | Creation timestamp.    |
| `updatedAt`      | `string` | Last update.           |

### FollowEntity

- **PK**: `FOLLOW#{followerId}#{followedId}`
- **SK**: `METADATA`
- **GSI1PK**: `FOLLOWING#{followerId}`
- **GSI1SK**: `{createdAt}#{followedId}`
- **GSI2PK**: `FOLLOWERS#{followedId}`
- **GSI2SK**: `{createdAt}#{followerId}`
- **EntityType**: `Follow`

| Attribute    | Type     | Description         |
| ------------ | -------- | ------------------- |
| `followerId` | `string` | Follower ID.        |
| `followedId` | `string` | Followed ID.        |
| `createdAt`  | `string` | Creation timestamp. |

### I2VJobEntity

Tracks image-to-video job submissions to Runpod.

- **PK**: `I2VJOB#{jobId}`
- **SK**: `METADATA`
- **GSI1PK**: `I2VJOB_BY_USER#{userId}`
- **GSI1SK**: `{createdAt}#{jobId}`
- **GSI2PK**: `I2VJOB_BY_MEDIA#{mediaId}`
- **GSI2SK**: `{createdAt}#{jobId}`
- **GSI3PK**: `I2VJOB_STATUS#{status}`
- **GSI3SK**: `{createdAt}#{jobId}`
- **GSI4PK**: `I2VJOB_STATUS_USER#{userId}#{status}`
- **GSI4SK**: `{createdAt}#{jobId}`
- **EntityType**: `I2VJob`

| Attribute                   | Type      | Description                               |
| --------------------------- | --------- | ----------------------------------------- |
| `jobId`                     | `string`  | Runpod job ID.                            |
| `userId`                    | `string`  | Submitting user ID.                       |
| `mediaId`                   | `string`  | Source image media ID.                    |
| `request`                   | `object`  | Request parameters snapshot (see below).  |
| `status`                    | `string`  | Job status (IN_QUEUE, IN_PROGRESS, etc.). |
| `submittedAt`               | `string`  | Submission timestamp (ISO 8601).          |
| `updatedAt`                 | `string`  | Last update timestamp (ISO 8601).         |
| `completedAt`               | `string?` | Completion timestamp (ISO 8601).          |
| `estimatedCompletionTimeAt` | `string?` | Estimated completion time (ISO 8601).     |
| `estimatedSeconds`          | `number?` | Estimated time to complete in seconds.    |
| `sourceImageUrl`            | `string`  | Full CDN URL used.                        |
| `runpodModel`               | `string`  | Model identifier (e.g., wan-2-2-i2v-720). |
| `delayTime`                 | `number?` | Delay time in seconds.                    |
| `executionTime`             | `number?` | Execution time in seconds.                |
| `resultMediaId`             | `string?` | Created Media ID for result video.        |
| `refundedAt`                | `string?` | When credits were refunded.               |
| `refundedSeconds`           | `number?` | Number of seconds refunded.               |
| `retryJobId`                | `string?` | Newly created job ID when retried.        |
| `retryOfJobId`              | `string?` | Original job ID if this is a retry.       |

**Request Object Fields**:

- `videoLength`: 5 | 8 | 10 | 15 | 20 | 25 | 30
- `prompt`: string
- `negativePrompt`: string
- `seed`: string
- `flowShift`: number (1-10)
- `inferenceSteps`: number (20-40)
- `cfgScale`: number (1-10)
- `optimizePrompt`: boolean
- `isPublic`: boolean (optional)
- `enableLoras`: boolean (optional)
- `width`: number
- `height`: number
- `selectedLoras`: string[] (optional)
- `loraTriggerWords`: string[] (optional)
- `loraHighNoise`: Array of {id, scale, mode} (optional)
- `loraLowNoise`: Array of {id, scale, mode} (optional)

### OrderEntity

Tracks user orders for subscriptions and purchases.

- **PK**: `ORDER#{orderId}`
- **SK**: `METADATA`
- **GSI1PK**: `ORDERS_BY_USER#{userId}`
- **GSI1SK**: `{createdAt}#{orderId}`
- **GSI2PK**: `ORDERS_BY_STATUS#{status}`
- **GSI2SK**: `{createdAt}#{orderId}`
- **GSI3PK**: `ORDER_BY_ITEM#{item}`
- **GSI3SK**: `{createdAt}#{orderId}`
- **EntityType**: `Order`

| Attribute          | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `orderId`          | `string`    | Unique order ID.                                    |
| `userId`           | `string`    | User ID.                                            |
| `item`             | `string`    | Item purchased (e.g., "starter-monthly").           |
| `amount`           | `string`    | Amount (e.g., "10.00").                             |
| `currency`         | `string`    | Currency code (e.g., "USD").                        |
| `status`           | `string`    | "initiated", "completed", "cancelled", or "failed". |
| `paymentProvider`  | `string`    | Payment provider (e.g., "trustpay").                |
| `paymentRequestId` | `string?`   | Payment provider request ID.                        |
| `createdAt`        | `string`    | Creation timestamp.                                 |
| `updatedAt`        | `string`    | Last update timestamp.                              |
| `completedAt`      | `string?`   | Completion timestamp.                               |
| `metadata`         | `Metadata?` | Additional metadata.                                |

### NotificationEntity

- **PK**: `NOTIFICATION#{notificationId}`
- **SK**: `METADATA`
- **GSI1PK**: `USER#{targetUserId}#NOTIFICATIONS`
- **GSI1SK**: `{status}#{createdAt}#{notificationId}`
- **GSI2PK**: `USER#{targetUserId}#NOTIFICATIONS#{status}`
- **GSI2SK**: `{createdAt}#{notificationId}`
- **EntityType**: `Notification`

| Attribute          | Type                     | Description          |
| ------------------ | ------------------------ | -------------------- |
| `notificationId`   | `string`                 | Unique ID.           |
| `targetUserId`     | `string`                 | Recipient ID.        |
| `sourceUserId`     | `string`                 | Sender ID.           |
| `notificationType` | `NotificationType`       | Type (e.g., "like"). |
| `targetType`       | `NotificationTargetType` | Target type.         |
| `targetId`         | `string`                 | Target ID.           |
| `status`           | `NotificationStatus`     | "unread" or "read".  |
| `createdAt`        | `string`                 | Creation timestamp.  |
| `readAt`           | `string?`                | Read timestamp.      |

## Access Patterns

### Album Access Patterns

1. **Get all albums (chronological)**: GSI1 with `GSI1PK = "ALBUM"`, sorted by `GSI1SK`.
2. **Get albums by creator**: GSI4 with `GSI4PK = "ALBUM_BY_CREATOR"`, `GSI4SK begins_with "{createdBy}#"`.
3. **Get public/private albums**: GSI5 with `GSI5PK = "ALBUM"`, `GSI5SK = "{isPublic}"`.
4. **Get popular albums**: GSI6 with `GSI6PK = "POPULARITY"`.
5. **Get content by date**: GSI7 with `GSI7PK = "CONTENT"`.

### Media Access Patterns

1. **Get media by ID**: GSI2 with `GSI2PK = "MEDIA_ID"`, `GSI2SK = "{mediaId}"`.
2. **Get all media for an album**: Main table with `PK = "ALBUM#{albumId}"`, `SK begins_with "MEDIA#"`.
3. **Get all albums for a media**: GSI1 with `GSI1PK = "MEDIA#{mediaId}"`.
4. **Get all media by creator**: GSI1 with `GSI1PK = "MEDIA_BY_CREATOR"`, `GSI1SK begins_with "{createdBy}#"`.
5. **Get all media (chronological)**: GSI4 with `GSI4PK = "MEDIA"`, sorted by `GSI4SK`.
6. **Get public/private media by user**: GSI3 with `GSI3PK = "MEDIA_BY_USER_{isPublic}"`, `GSI3SK begins_with "{userId}#"`.
7. **Get public media**: GSI5 with `GSI5PK = "MEDIA"`, `GSI5SK = "true"`.

### Comment Access Patterns

1. **Get comments by target**: GSI1 with `GSI1PK = "COMMENTS_BY_TARGET"`, `GSI1SK begins_with "{targetType}#{targetId}#"`.
2. **Get comments by user**: GSI2 with `GSI2PK = "COMMENTS_BY_USER"`, `GSI2SK begins_with "{userId}#"`.
3. **Get all comments (chronological)**: GSI3 with `GSI3PK = "INTERACTION#comment"`.

### User Access Patterns

1. **Get user by email**: GSI1 with `GSI1PK = "USER_EMAIL"`, `GSI1SK = "{email}"`.
2. **Get user by Google ID**: GSI2 with `GSI2PK = "USER_GOOGLE"`, `GSI2SK = "{googleId}"`.
3. **Get user by username**: GSI3 with `GSI3PK = "USER_USERNAME"`, `GSI3SK = "{username}"`.

### Session Access Patterns

1. **Get sessions by expiry**: GSI1 with `GSI1PK = "USER_SESSION_EXPIRY"`.
2. **Get sessions by user**: GSI2 with `GSI2PK = "USER#{userId}#SESSION"`.

### Token Access Patterns

1. **Get verification tokens by expiry**: GSI1 for `EMAIL_VERIFICATION_EXPIRY`.
2. **Get reset tokens by expiry**: GSI1 for `PASSWORD_RESET_EXPIRY`.

### Analytics Access Patterns

1. **Get all analytics by granularity/time**: GSI1 with `GSI1PK = "ANALYTICS"`, `GSI1SK begins_with "{granularity}#"`.
2. **Get analytics by type**: GSI2 with `GSI2PK = "ANALYTICS_TYPE#{metricType}"`.

### Follow Access Patterns

1. **Get following for user**: GSI1 with `GSI1PK = "FOLLOWING#{followerId}"`.
2. **Get followers for user**: GSI2 with `GSI2PK = "FOLLOWERS#{followedId}"`.

### Notification Access Patterns

1. **Get notifications by user/status**: GSI1 with `GSI1PK = "USER#{targetUserId}#NOTIFICATIONS"`.
2. **Get unread notifications**: GSI2 with `GSI2PK = "USER#{targetUserId}#NOTIFICATIONS#unread"`.

### I2VJob Access Patterns

1. **Get jobs by user**: GSI1 with `GSI1PK = "I2VJOB_BY_USER#{userId}"`.
2. **Get jobs by media**: GSI2 with `GSI2PK = "I2VJOB_BY_MEDIA#{mediaId}"`.
3. **Get jobs by status**: GSI3 with `GSI3PK = "I2VJOB_STATUS#{status}"`.
4. **Get user jobs by status**: GSI4 with `GSI4PK = "I2VJOB_STATUS_USER#{userId}#{status}"`.

### Order Access Patterns

1. **Get orders by user**: GSI1 with `GSI1PK = "ORDERS_BY_USER#{userId}"`.
2. **Get orders by status**: GSI2 with `GSI2PK = "ORDERS_BY_STATUS#{status}"`.
3. **Get orders by item**: GSI3 with `GSI3PK = "ORDER_BY_ITEM#{item}"`.

### User Plan Access Patterns

1. **Get users by plan**: GSI4 with `GSI4PK = "USER_PLAN#{plan}"`, sorted by plan expiration date.

## Migration from v1.0

The old schema stored media with PK: `ALBUM#{albumId}`, SK: `MEDIA#{mediaId}`. New schema separates media as independent entities with relationships via AlbumMediaEntity. Update endpoints to handle new patterns.

**Breaking Changes**:

- Removed `albumId` from MediaEntity.
- Media endpoints no longer require albumId.
- Use separate relationship management.

## Entity Relationship Diagram

```mermaid
erDiagram
    ALBUM ||--o{ ALBUM_MEDIA : contains
    MEDIA ||--o{ ALBUM_MEDIA : belongs_to
    USER ||--o{ COMMENT : creates
    ALBUM ||--o{ COMMENT : receives
    MEDIA ||--o{ COMMENT : receives
    USER ||--o{ USER_INTERACTION : performs
    ALBUM ||--o{ USER_INTERACTION : receives
    MEDIA ||--o{ USER_INTERACTION : receives
    USER ||--o{ FOLLOW : follows
    USER ||--o{ FOLLOW : followed_by
    USER ||--o{ USER_SESSION : has
    ADMIN ||--o{ ADMIN_SESSION : has
    USER ||--o{ EMAIL_VERIFICATION_TOKEN : has
    USER ||--o{ PASSWORD_RESET_TOKEN : has
    USER ||--o{ GENERATION_SETTINGS : has
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ I2VJOB : submits
    USER ||--o{ ORDER : places
    MEDIA ||--o{ I2VJOB : sources

    ALBUM {
        string PK "ALBUM#{albumId}"
        string SK "METADATA"
        string GSI1PK "ALBUM"
        string GSI1SK "{createdAt}#{albumId}"
    }

    MEDIA {
        string PK "MEDIA#{mediaId}"
        string SK "METADATA"
        string GSI1PK "MEDIA_BY_CREATOR"
        string GSI1SK "{createdBy}#{createdAt}#{mediaId}"
    }

    ALBUM_MEDIA {
        string PK "ALBUM#{albumId}"
        string SK "MEDIA#{mediaId}"
        string GSI1PK "MEDIA#{mediaId}"
        string GSI1SK "ALBUM#{albumId}#{addedAt}"
    }

    COMMENT {
        string PK "COMMENT#{commentId}"
        string SK "METADATA"
        string GSI1PK "COMMENTS_BY_TARGET"
        string GSI1SK "{targetType}#{targetId}#{createdAt}#{commentId}"
    }

    USER {
        string PK "USER#{userId}"
        string SK "METADATA"
        string GSI1PK "USER_EMAIL"
        string GSI1SK "{email}"
        string GSI3PK "USER_USERNAME"
        string GSI3SK "{username}"
    }

    USER_SESSION {
        string PK "SESSION#{sessionId}"
        string SK "METADATA"
        string GSI1PK "USER_SESSION_EXPIRY"
        string GSI1SK "{expiresAt}#{sessionId}"
    }

    EMAIL_VERIFICATION_TOKEN {
        string PK "EMAIL_VERIFICATION#{token}"
        string SK "METADATA"
    }

    PASSWORD_RESET_TOKEN {
        string PK "PASSWORD_RESET#{token}"
        string SK "TOKEN"
    }

    ANALYTICS {
        string PK "ANALYTICS#{metricType}#{granularity}"
        string SK "{timestamp}"
        string GSI1PK "ANALYTICS"
        string GSI1SK "{granularity}#{timestamp}#{metricType}"
    }

    FOLLOW {
        string PK "FOLLOW#{followerId}#{followedId}"
        string SK "METADATA"
        string GSI1PK "FOLLOWING#{followerId}"
        string GSI1SK "{createdAt}#{followedId}"
    }

    NOTIFICATION {
        string PK "NOTIFICATION#{notificationId}"
        string SK "METADATA"
        string GSI1PK "USER#{targetUserId}#NOTIFICATIONS"
        string GSI1SK "{status}#{createdAt}#{notificationId}"
    }

    I2VJOB {
        string PK "I2VJOB#{jobId}"
        string SK "METADATA"
        string GSI1PK "I2VJOB_BY_USER#{userId}"
        string GSI1SK "{createdAt}#{jobId}"
        string GSI3PK "I2VJOB_STATUS#{status}"
        string GSI3SK "{createdAt}#{jobId}"
    }

    ORDER {
        string PK "ORDER#{orderId}"
        string SK "METADATA"
        string GSI1PK "ORDERS_BY_USER#{userId}"
        string GSI1SK "{createdAt}#{orderId}"
        string GSI2PK "ORDERS_BY_STATUS#{status}"
        string GSI2SK "{createdAt}#{orderId}"
    }
```

## Troubleshooting

### Admin Authorization Issues

**Problem**: "User is not authorized" despite login.

**Cause**: Missing `role: "admin"` in UserEntity.

**Solution**: Use `node scripts/set-admin-role.js <sessionId> admin` or update DynamoDB directly: Set `role` to `"admin"` on `PK = "USER#{userId}"`, `SK = "METADATA"`.

### Media Upload Issues

**Problem**: Upload fails post-migration.

**Solution**:

1. Create media with `PK = "MEDIA#{mediaId}"`.
2. Use AlbumMediaEntity for relationships.
3. Call `addMediaToAlbum()` for linking.
