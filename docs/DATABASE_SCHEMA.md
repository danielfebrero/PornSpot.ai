# Database Schema

This document provides a detailed overview of the DynamoDB database schema for the PornSpot.ai application. The database uses a single-table design, which is a common pattern for DynamoDB that allows for efficient data retrieval with a single request.

## Single-Table Design

All entities in the application are stored in a single DynamoDB table. This design is optimized for the access patterns of the application, and it minimizes the number of requests needed to fetch data. Each item in the table has a `PK` (Partition Key) and a `SK` (Sort Key) that define its identity and relationships with other items.

## Key Schema

- **Partition Key (PK)**: The primary identifier for an item. It is composed of the entity type and a unique ID (e.g., `ALBUM#<albumId>`).
- **Sort Key (SK)**: Used to define relationships between items and to sort items within a partition. For a primary item, the sort key is often `METADATA`. For related items, it can be a combination of the entity type and other attributes.

## Global Secondary Indexes (GSIs)

The table uses Global Secondary Indexes (GSIs) to support additional query patterns.

- **GSI1**: Used for querying items by type and other attributes.
  - `GSI1PK`: The partition key for GSI1.
  - `GSI1SK`: The sort key for GSI1.
- **GSI2**: Used for querying users by their Google ID.
  - `GSI2PK`: The partition key for GSI2.
  - `GSI2SK`: The sort key for GSI2.
- **GSI3**: Used for querying users by their username.
  - `GSI3PK`: The partition key for GSI3.
  - `GSI3SK`: The sort key for GSI3.
- **GSI4**: Used for querying albums by creator.
  - `GSI4PK`: The partition key for GSI4.
  - `GSI4SK`: The sort key for GSI4.

## New Global Secondary Index: isPublic-createdAt-index

To efficiently support server-side filtering and pagination for public/private albums, the following GSI must be present:

- **isPublic-createdAt-index**
  - **Partition Key**: `isPublic`
  - **Sort Key**: `createdAt`

Every album **must** have the `isPublic` attribute (boolean, required for all records). Album inserts and updates must enforce this requirement.

**Migration:** Existing album items without `isPublic` must be backfilled using the script at [`backend/scripts/backfill-isPublic.ts`](../backend/scripts/backfill-isPublic.ts:1). This script only updates items missing `isPublic`, defaulting them to `true`.

## New Global Secondary Index: GSI4 for Albums by Creator

To efficiently support querying albums by creator, the following GSI has been added:

- **GSI4**
  - **Partition Key**: `GSI4PK = "ALBUM_BY_CREATOR"`
  - **Sort Key**: `GSI4SK = "<createdBy>#<createdAt>#<albumId>"`

**Migration:** Existing album items without GSI4 fields must be backfilled using the script at [`backend/scripts/backfill-gsi4-albums.ts`](../backend/scripts/backfill-gsi4-albums.ts). This script adds the GSI4PK and GSI4SK fields to all existing albums that have a `createdBy` field.

## Entity Schemas

### Album Entity

Represents a collection of media items.

- **PK**: `ALBUM#<albumId>`
- **SK**: `METADATA`
- **GSI1PK**: `ALBUM`
- **GSI1SK**: `<createdAt>#<albumId>`
- **GSI4PK**: `ALBUM_BY_CREATOR`
- **GSI4SK**: `<createdBy>#<createdAt>#<albumId>`
- **EntityType**: `Album`

| Attribute       | Type       | Description                                |
| --------------- | ---------- | ------------------------------------------ |
| `id`            | `string`   | The unique ID of the album.                |
| `title`         | `string`   | The title of the album.                    |
| `tags`          | `string[]` | Optional tags for the album.               |
| `coverImageUrl` | `string`   | The URL of the album's cover image.        |
| `thumbnailUrls` | `object`   | URLs for different thumbnail sizes.        |
| `createdAt`     | `string`   | The ISO 8601 timestamp of creation.        |
| `updatedAt`     | `string`   | The ISO 8601 timestamp of the last update. |
| `mediaCount`    | `number`   | The number of media items in the album.    |
| `isPublic`      | `boolean`  | Whether the album is public.               |
| `createdBy`     | `string`   | User ID or admin ID who created the album. |
| `createdByType` | `string`   | Type of creator: "user" or "admin".        |

### Media Entity

**NEW DESIGN (v2.0)**: Media entities are now independent of albums and support many-to-many relationships through a separate AlbumMedia entity.

Represents a single media item (e.g., an image) that can belong to multiple albums.

- **PK**: `MEDIA#<mediaId>`
- **SK**: `METADATA`
- **GSI1PK**: `MEDIA_BY_CREATOR`
- **GSI1SK**: `<createdBy>#<createdAt>#<mediaId>`
- **GSI2PK**: `MEDIA_ID`
- **GSI2SK**: `<mediaId>`
- **EntityType**: `Media`

| Attribute          | Type     | Description                                  |
| ------------------ | -------- | -------------------------------------------- |
| `id`               | `string` | The unique ID of the media item.             |
| `filename`         | `string` | The name of the file in S3.                  |
| `originalFilename` | `string` | The original name of the uploaded file.      |
| `mimeType`         | `string` | The MIME type of the file.                   |
| `size`             | `number` | The size of the file in bytes.               |
| `width`            | `number` | The width of the image in pixels.            |
| `height`           | `number` | The height of the image in pixels.           |
| `url`              | `string` | The URL of the original file.                |
| `thumbnailUrls`    | `object` | URLs for different thumbnail sizes.          |
| `status`           | `string` | The processing status of the media item.     |
| `createdAt`        | `string` | The ISO 8601 timestamp of creation.          |
| `updatedAt`        | `string` | The ISO 8601 timestamp of the last update.   |
| `createdBy`        | `string` | User ID or admin ID who uploaded this media. |
| `createdByType`    | `string` | Type of creator: "user" or "admin".          |
| `metadata`         | `object` | Additional metadata for the media item.      |

### Album-Media Relationship Entity

**NEW**: Junction table entity for many-to-many relationships between albums and media.

Represents the relationship between an album and a media item, allowing one media item to belong to multiple albums.

- **PK**: `ALBUM#<albumId>`
- **SK**: `MEDIA#<mediaId>`
- **GSI1PK**: `MEDIA#<mediaId>`
- **GSI1SK**: `ALBUM#<albumId>#<addedAt>`
- **GSI2PK**: `ALBUM_MEDIA_BY_DATE`
- **GSI2SK**: `<addedAt>#<albumId>#<mediaId>`
- **EntityType**: `AlbumMedia`

| Attribute | Type     | Description                                  |
| --------- | -------- | -------------------------------------------- |
| `albumId` | `string` | The ID of the album.                         |
| `mediaId` | `string` | The ID of the media item.                    |
| `addedAt` | `string` | The ISO 8601 timestamp when media was added. |
| `addedBy` | `string` | Optional: who added the media to this album. |

**Important**: The PK+SK combination ensures duplicate prevention. The condition expression `attribute_not_exists(PK) AND attribute_not_exists(SK)` prevents the same media from being added to the same album twice.

## Access Patterns

### Album Access Patterns

1. **Get all albums (chronological)**: Use GSI1 with `GSI1PK = "ALBUM"` sorted by `GSI1SK = "<createdAt>#<albumId>"`
2. **Get albums by creator**: Use GSI4 with `GSI4PK = "ALBUM_BY_CREATOR"` and `GSI4SK begins_with "<createdBy>#"`
3. **Get public/private albums**: Use `isPublic-createdAt-index` with `isPublic = "true"` or `"false"`

### Media Access Patterns

1. **Get media by ID**: Use GSI2 with `GSI2PK = "MEDIA_ID"` and `GSI2SK = <mediaId>`
2. **Get all media for an album**: Query main table with `PK = "ALBUM#<albumId>"` and `SK begins_with "MEDIA#"`
3. **Get all albums for a media**: Use GSI1 with `GSI1PK = "MEDIA#<mediaId>"`
4. **Get all media by creator**: Use GSI1 with `GSI1PK = "MEDIA_BY_CREATOR"` and `GSI1SK begins_with "<createdBy>#"`
5. **Get all public media**:
   - First: Query albums with `isPublic-createdAt-index` where `isPublic = "true"`
   - Then: For each album, query media relationships
   - Finally: Fetch unique media records

### Migration from v1.0

The old schema stored media with:

- **PK**: `ALBUM#<albumId>`
- **SK**: `MEDIA#<mediaId>`
- **albumId**: Direct reference

The new schema separates concerns:

- Media entities are independent (no albumId field)
- Album-Media relationships are separate entities
- One media can belong to multiple albums
- Better scalability and flexibility

**Breaking Changes**:

- `albumId` field removed from Media entity
- Media endpoints no longer require albumId parameter
- Album-media relationships managed separately

### Admin User Entity

Represents an administrative user.

- **PK**: `ADMIN#<adminId>`
- **SK**: `METADATA`
- **GSI1PK**: `ADMIN_USERNAME`
- **GSI1SK**: `<username>`
- **EntityType**: `AdminUser`

| Attribute      | Type      | Description                             |
| -------------- | --------- | --------------------------------------- |
| `adminId`      | `string`  | The unique ID of the admin user.        |
| `username`     | `string`  | The username of the admin user.         |
| `passwordHash` | `string`  | The hashed password.                    |
| `salt`         | `string`  | The salt used for hashing the password. |
| `createdAt`    | `string`  | The ISO 8601 timestamp of creation.     |
| `isActive`     | `boolean` | Whether the admin user is active.       |

### Admin Session Entity

Represents a session for an administrative user.

- **PK**: `SESSION#<sessionId>`
- **SK**: `METADATA`
- **GSI1PK**: `SESSION_EXPIRY`
- **GSI1SK**: `<expiresAt>#<sessionId>`
- **EntityType**: `AdminSession`

| Attribute        | Type     | Description                                      |
| ---------------- | -------- | ------------------------------------------------ |
| `sessionId`      | `string` | The unique ID of the session.                    |
| `adminId`        | `string` | The ID of the admin user this session is for.    |
| `adminUsername`  | `string` | The username of the admin user.                  |
| `createdAt`      | `string` | The ISO 8601 timestamp of creation.              |
| `expiresAt`      | `string` | The ISO 8601 timestamp when the session expires. |
| `lastAccessedAt` | `string` | The ISO 8601 timestamp of the last access.       |
| `ttl`            | `number` | The Time To Live value for DynamoDB TTL.         |

### User Entity

Represents a regular user.

- **PK**: `USER#<userId>`
- **SK**: `METADATA`
- **GSI1PK**: `USER_EMAIL`
- **GSI1SK**: `<email>`
- **GSI2PK**: `USER_GOOGLE`
- **GSI2SK**: `<googleId>`
- **GSI3PK**: `USER_USERNAME`
- **GSI3SK**: `<username>`
- **EntityType**: `User`

| Attribute       | Type      | Description                                 |
| --------------- | --------- | ------------------------------------------- |
| `userId`        | `string`  | The unique ID of the user.                  |
| `email`         | `string`  | The email of the user.                      |
| `username`      | `string`  | The unique username of the user.            |
| `passwordHash`  | `string`  | The hashed password.                        |
| `googleId`      | `string`  | The user's Google ID for OAuth.             |
| `role`          | `string`  | User role: "user", "admin", or "moderator". |
| `createdAt`     | `string`  | The ISO 8601 timestamp of creation.         |
| `emailVerified` | `boolean` | Whether the user's email is verified.       |

### User Session Entity

Represents a session for a regular user.

- **PK**: `USER_SESSION#<sessionId>`
- **SK**: `METADATA`
- **GSI1PK**: `USER_SESSION_EXPIRY`
- **GSI1SK**: `<expiresAt>#<sessionId>`
- **EntityType**: `UserSession`

| Attribute        | Type     | Description                                      |
| ---------------- | -------- | ------------------------------------------------ |
| `sessionId`      | `string` | The unique ID of the session.                    |
| `userId`         | `string` | The ID of the user this session is for.          |
| `createdAt`      | `string` | The ISO 8601 timestamp of creation.              |
| `expiresAt`      | `string` | The ISO 8601 timestamp when the session expires. |
| `lastAccessedAt` | `string` | The ISO 8601 timestamp of the last access.       |

### Email Verification Token Entity

Represents a token for verifying a user's email.

- **PK**: `EMAIL_VERIFICATION_TOKEN#<token>`
- **SK**: `METADATA`
- **EntityType**: `EmailVerificationToken`

| Attribute   | Type     | Description                                    |
| ----------- | -------- | ---------------------------------------------- |
| `token`     | `string` | The verification token.                        |
| `userId`    | `string` | The ID of the user this token is for.          |
| `expiresAt` | `string` | The ISO 8601 timestamp when the token expires. |

### User Interaction Entity

Represents a user's interaction with a media item (e.g., a like or a bookmark).

- **PK**: `USER#<userId>`
- **SK**: `INTERACTION#<interactionType>#<mediaId>`
- **GSI1PK**: `MEDIA_INTERACTION#<mediaId>`
- **GSI1SK**: `<interactionType>#<userId>`
- **EntityType**: `UserInteraction`

| Attribute         | Type     | Description                                         |
| ----------------- | -------- | --------------------------------------------------- |
| `userId`          | `string` | The ID of the user who made the interaction.        |
| `mediaId`         | `string` | The ID of the media item.                           |
| `interactionType` | `string` | The type of interaction (e.g., `like`, `bookmark`). |
| `createdAt`       | `string` | The ISO 8601 timestamp of the interaction.          |

### ComfyUI Monitor Entity

Represents the system configuration for the ComfyUI monitor client connection.

- **PK**: `SYSTEM#COMFYUI_MONITOR`
- **SK**: `METADATA`
- **EntityType**: `ComfyUIMonitor`

| Attribute         | Type     | Description                                            |
| ----------------- | -------- | ------------------------------------------------------ |
| `clientId`        | `string` | The WebSocket client ID of the ComfyUI monitor.        |
| `comfyui_host`    | `string` | The hostname of the ComfyUI server being monitored.    |
| `version`         | `string` | The version of the monitor script.                     |
| `lastConnectedAt` | `string` | The ISO 8601 timestamp of the last monitor connection. |
| `updatedAt`       | `string` | The ISO 8601 timestamp of the last update.             |

**Purpose**: This entity stores the client_id used by the ComfyUI monitor WebSocket connection. The backend retrieves this client_id when submitting prompts to ComfyUI, ensuring that the monitor receives real-time updates for queued jobs.

## Entity Relationship Diagram

```mermaid
erDiagram
    ALBUM ||--o{ MEDIA : contains
    USER ||--o{ USER_INTERACTION : "interacts with"
    MEDIA ||--o{ USER_INTERACTION : "is interacted with by"
    USER ||--o{ USER_SESSION : "has"
    ADMIN_USER ||--o{ ADMIN_SESSION : "has"
    USER ||--o{ EMAIL_VERIFICATION_TOKEN : "has"

    ALBUM {
        string PK "ALBUM#<albumId>"
        string SK "METADATA"
        string GSI1PK "ALBUM"
        string GSI1SK "<createdAt>#<albumId>"
    }

    MEDIA {
        string PK "ALBUM#<albumId>"
        string SK "MEDIA#<mediaId>"
        string GSI1PK "MEDIA#<albumId>"
        string GSI1SK "<createdAt>#<mediaId>"
    }

    ADMIN_USER {
        string PK "ADMIN#<adminId>"
        string SK "METADATA"
        string GSI1PK "ADMIN_USERNAME"
        string GSI1SK "<username>"
    }

    ADMIN_SESSION {
        string PK "SESSION#<sessionId>"
        string SK "METADATA"
        string GSI1PK "SESSION_EXPIRY"
        string GSI1SK "<expiresAt>#<sessionId>"
    }

    USER {
        string PK "USER#<userId>"
        string SK "METADATA"
        string GSI1PK "USER_EMAIL"
        string GSI1SK "<email>"
        string GSI2PK "USER_GOOGLE"
        string GSI2SK "<googleId>"
        string GSI3PK "USER_USERNAME"
        string GSI3SK "<username>"
    }

    USER_SESSION {
        string PK "USER_SESSION#<sessionId>"
        string SK "METADATA"
        string GSI1PK "USER_SESSION_EXPIRY"
        string GSI1SK "<expiresAt>#<sessionId>"
    }

    EMAIL_VERIFICATION_TOKEN {
        string PK "EMAIL_VERIFICATION_TOKEN#<token>"
        string SK "METADATA"
    }

    USER_INTERACTION {
        string PK "USER#<userId>"
        string SK "INTERACTION#<type>#<mediaId>"
        string GSI1PK "MEDIA_INTERACTION#<mediaId>"
        string GSI1SK "<type>#<userId>"
    }
```

## Troubleshooting

### Admin Authorization Issues

**Problem**: Getting "User is not authorized to access this resource" when accessing admin endpoints despite being logged in.

**Cause**: The user account doesn't have the `role` field set to "admin" in the database.

**Solution**: Use the admin role script to set the role:

```bash
# Find your session ID from browser cookies (user_session value)
cd backend
node scripts/set-admin-role.js <your-session-id> admin
```

Example:

```bash
node scripts/set-admin-role.js dcf48ce9-d13b-46d0-a6c1-bcd6ffa08edc admin
```

**Manual Fix**: Update the user record directly in DynamoDB:

1. Find the user record: `PK = "USER#<userId>"`, `SK = "METADATA"`
2. Add/update the `role` attribute to `"admin"`
3. Update the `updatedAt` timestamp

### Media Upload Issues

**Problem**: Media upload fails after schema migration.

**Cause**: The upload function still uses old schema patterns.

**Solution**: Update media upload functions to:

1. Create media entity with new PK pattern: `MEDIA#<mediaId>`
2. Create album-media relationship separately
3. Use `addMediaToAlbum()` method for linking
