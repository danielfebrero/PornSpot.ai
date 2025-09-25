# API Documentation

This document provides comprehensive API documentation for the PornSpot.ai gallery application, with detailed information about the new 5-size thumbnail system and intelligent responsive image selection.

## Overview

The API follows REST principles and returns JSON responses. All endpoints support the new 5-size thumbnail system while maintaining backward compatibility with legacy clients.

### Base URLs

The API is deployed using AWS API Gateway with the following structure:

- **Production**: `https://{api-gateway-id}.execute-api.{region}.amazonaws.com/prod`
- **Staging**: `https://{api-gateway-id}.execute-api.{region}.amazonaws.com/staging`
- **Development**: `https://{api-gateway-id}.execute-api.{region}.amazonaws.com/dev`

### Authentication

The API supports multiple authentication methods:

1. **Session-based Authentication** - For user operations (login/logout with cookies)
2. **JWT Token Authentication** - For WebSocket connections with time-limited tokens
3. **Admin Authorization** - For administrative operations
4. **User Authorization** - For user-specific operations
5. **Public Access** - For reading public albums and media

```bash
# Public endpoints (no authentication)
curl https://api.pornspot.ai/albums

# User authenticated endpoints (requires session cookie)
curl -H "Cookie: sessionId=..." \
     https://api.pornspot.ai/user/media

# JWT token generation (for WebSocket authentication)
curl -H "Cookie: sessionId=..." \
     -X POST https://api.pornspot.ai/user/auth/generate-jwt

# Admin endpoints (requires admin session)
curl -H "Cookie: adminSessionId=..." \
     https://api.pornspot.ai/admin/stats
```

## Data Models

### Media Entity

```typescript
interface Media {
  id: string; // Unique media identifier
  albumId?: string; // Parent album ID (when part of album context)
  filename: string; // Stored filename
  originalFilename: string; // Original upload filename
  mimeType: string; // MIME type (image/jpeg, image/png, etc.)
  size: number; // File size in bytes
  width?: number; // Image width in pixels
  height?: number; // Image height in pixels
  url: string; // Original file URL

  // Legacy thumbnail support (backward compatibility)
  thumbnailUrl?: string; // Points to 'small' size for compatibility

  // New 5-size thumbnail system
  thumbnailUrls?: {
    cover?: string; // 128×128px (75% quality) - Album covers
    small?: string; // 240×240px (80% quality) - Dense grids
    medium?: string; // 300×300px (85% quality) - General purpose
    large?: string; // 365×365px (85% quality) - High quality
    xlarge?: string; // 600×600px (90% quality) - Small screens
    originalSize?: string; // Original size thumbnail
  };

  status?: "pending" | "uploaded" | "failed"; // Processing status
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
  metadata?: Record<string, any>; // Additional metadata

  // User interaction fields
  likeCount?: number; // Number of likes
  bookmarkCount?: number; // Number of bookmarks
  viewCount?: number; // Number of views

  // Creator tracking
  createdBy?: string; // User ID who uploaded
  createdByType?: "user" | "admin"; // Type of creator
  albums?: string[]; // Array of album IDs (when querying across albums)
}
```

### Album Entity

```typescript
interface Album {
  id: string; // Unique album identifier
  title: string; // Album title
  tags?: string[]; // Optional tags
  coverImageUrl?: string; // Cover image URL (from media)

  // New 5-size thumbnail system for covers
  thumbnailUrls?: {
    cover?: string; // 128×128px (75% quality) - Album covers
    small?: string; // 240×240px (80% quality) - Dense grids
    medium?: string; // 300×300px (85% quality) - General purpose
    large?: string; // 365×365px (85% quality) - High quality
    xlarge?: string; // 600×600px (90% quality) - Small screens
  };

  isPublic: boolean; // Public visibility
  mediaCount: number; // Number of media items
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp

  // User interaction fields
  likeCount?: number; // Number of likes
  bookmarkCount?: number; // Number of bookmarks
  viewCount?: number; // Number of views

  // Creator tracking
  createdBy?: string; // User ID who created the album
  createdByType?: "user" | "admin"; // Type of creator

  media?: Media[]; // Populated media (when requested)
}
```

---

## Albums Endpoint (`/albums`)

Retrieves a paginated list of albums with intelligent filtering based on user permissions and DynamoDB-native pagination.

**Authentication**: Optional - supports both authenticated and anonymous requests

### Request

- **GET** `/albums`
- **Authentication**: Optional (session cookie)
- **Query Parameters**:
  - `isPublic` (optional, boolean): Filter albums by public visibility.
  - `createdBy` (optional, string): Filter albums by creator user ID.
  - `user` (optional, string): Filter albums by creator username (alternative to createdBy).
  - `tag` (optional, string): Filter albums by tag.
  - `limit` (optional, integer): Maximum number of results to return per page (default: 20, max: 100).
  - `cursor` (optional, string): Base64-encoded cursor from the previous response for DynamoDB pagination.

#### Permission Logic

- **Anonymous users**: Only see public albums regardless of other parameters
- **Authenticated users**:
  - **If `user` parameter is provided**: Always show only public albums (public profile view)
  - **If `createdBy` parameter is provided and user IS the creator**: Show all albums (public and private)
  - **If `createdBy` parameter is provided and user is NOT the creator**: Only show public albums
  - **If no `createdBy` or `user` is provided**: Show all public albums from everyone

#### Example

```
GET /albums?isPublic=true&limit=20&createdBy=user123
GET /albums?user=johnsmith&limit=12  // Always public albums only
```

### Response

```json
{
  "success": true,
  "data": {
    "albums": [
      {
        "id": "abc123",
        "title": "Example Album",
        "tags": ["summer", "beach"],
        "coverImageUrl": "...",
        "isPublic": true,
        "mediaCount": 15,
        "createdAt": "2025-06-01T12:05:47.400Z",
        "updatedAt": "2025-06-01T12:05:47.400Z",
        "likeCount": 42,
        "bookmarkCount": 8,
        "viewCount": 256,
        "createdBy": "user123",
        "createdByType": "user"
      }
    ],
    "nextCursor": "eyJpYXQiOjE2...",
    "hasNext": true
  }
}
```

- **albums**: List of album objects (see schema above).
- **nextCursor**: Pass this token to retrieve the next page. Omit or set to null to fetch the first page.
- **hasNext**: Boolean indicating if additional pages are available.

**Notes:**

- Filtering by `isPublic` and `createdBy` is implemented server-side for efficiency.
- Pagination uses DynamoDB's native LastEvaluatedKey system (no traditional offset/limit).
- The response shape is always `{ success, data: { albums, nextCursor, hasNext } }`.

---

### API Response Wrapper

```typescript
interface ApiResponse<T = any> {
  success: boolean; // Operation success status
  data?: T; // Response data
  error?: string; // Error message (if success: false)
  message?: string; // Additional information
}

// Note: The API does NOT use traditional page-based pagination
// Instead, it uses DynamoDB-native cursor-based pagination
interface CursorPaginatedResponse<T = any> extends ApiResponse<T[]> {
  data: {
    items: T[]; // The actual data items
    nextCursor?: string; // Base64-encoded cursor for next page
    hasNext: boolean; // Has next page available
  };
}
```

## Albums API

### List Albums

Get all albums with intelligent filtering and cursor-based pagination. **Authentication required.**

```http
GET /albums?isPublic=true&limit=20&createdBy=user123&tag=nature
Cookie: sessionId=session-token-here
```

**Query Parameters:**

| Parameter   | Type    | Default | Description                          |
| ----------- | ------- | ------- | ------------------------------------ |
| `limit`     | number  | 20      | Items per page (max 100)             |
| `isPublic`  | boolean | -       | Filter by public visibility          |
| `createdBy` | string  | -       | Filter by creator user ID            |
| `tag`       | string  | -       | Filter by tag                        |
| `cursor`    | string  | -       | Base64-encoded cursor for pagination |

**Response:**

```json
{
  "success": true,
  "data": {
    "albums": [
      {
        "id": "album-123",
        "title": "Nature Photography",
        "tags": ["nature", "landscape"],
        "coverImageUrl": "https://cdn.example.com/covers/album-123.jpg",
        "isPublic": true,
        "mediaCount": 25,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T15:45:00.000Z",
        "likeCount": 42,
        "bookmarkCount": 8,
        "viewCount": 256,
        "createdBy": "user123",
        "createdByType": "user"
      }
    ],
    "nextCursor": "eyJpYXQiOjE2...",
    "hasNext": true
  }
}
```

### Get Album

Get a specific album by ID with optional media inclusion.

```http
GET /albums/{albumId}?includeMedia=true
```

**Path Parameters:**

| Parameter | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `albumId` | string | Yes      | Album identifier |

**Query Parameters:**

| Parameter      | Type    | Default | Description                     |
| -------------- | ------- | ------- | ------------------------------- |
| `includeMedia` | boolean | false   | Include media items in response |
| `mediaLimit`   | number  | 50      | Max media items to include      |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "album-123",
    "title": "Nature Photography",
    "tags": ["nature", "landscape"],
    "coverImageUrl": "https://cdn.example.com/covers/album-123.jpg",
    "isPublic": true,
    "mediaCount": 25,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T15:45:00.000Z",
    "media": [
      {
        "id": "media-456",
        "albumId": "album-123",
        "filename": "sunset-mountain.jpg",
        "originalFilename": "IMG_2024_sunset.jpg",
        "mimeType": "image/jpeg",
        "size": 2847392,
        "width": 3840,
        "height": 2160,
        "url": "https://cdn.example.com/albums/album-123/media/sunset-mountain.jpg",

        // Legacy compatibility
        "thumbnailUrl": "https://cdn.example.com/albums/album-123/thumbnails/sunset-mountain_thumb_small.jpg",

        // New 5-size system
        "thumbnailUrls": {
          "cover": "https://cdn.example.com/albums/album-123/thumbnails/sunset-mountain_thumb_cover.jpg",
          "small": "https://cdn.example.com/albums/album-123/thumbnails/sunset-mountain_thumb_small.jpg",
          "medium": "https://cdn.example.com/albums/album-123/thumbnails/sunset-mountain_thumb_medium.jpg",
          "large": "https://cdn.example.com/albums/album-123/thumbnails/sunset-mountain_thumb_large.jpg",
          "xlarge": "https://cdn.example.com/albums/album-123/thumbnails/sunset-mountain_thumb_xlarge.jpg"
        },

        "status": "uploaded",
        "createdAt": "2024-01-15T11:00:00.000Z",
        "updatedAt": "2024-01-15T11:05:00.000Z"
      }
    ]
  }
}
```

### Create Album

Create a new album.

```http
POST /albums
Content-Type: application/json

{
  "title": "My New Album",
  "tags": ["vacation", "summer"],
  "isPublic": true
}
```

**Request Body:**

| Field      | Type     | Required | Description                        |
| ---------- | -------- | -------- | ---------------------------------- |
| `title`    | string   | Yes      | Album title                        |
| `tags`     | string[] | No       | Optional tags                      |
| `isPublic` | boolean  | No       | Public visibility (default: false) |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "album-789",
    "title": "My New Album",
    "tags": ["vacation", "summer"],
    "coverImageUrl": null,
    "isPublic": true,
    "mediaCount": 0,
    "createdAt": "2024-01-15T16:00:00.000Z",
    "updatedAt": "2024-01-15T16:00:00.000Z"
  }
}
```

### Delete Album

Delete an album and remove all media from it (media is preserved for other albums). Also deletes all comments on the album and their likes.

```http
DELETE /albums/{albumId}
Cookie: sessionId=session-token-here
```

**Path Parameters:**

| Parameter | Type   | Required | Description             |
| --------- | ------ | -------- | ----------------------- |
| `albumId` | string | Yes      | Unique album identifier |

**Authentication:** Required - User must own the album or have admin privileges

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Album deleted successfully, media removed from album but preserved",
    "deletedAlbumId": "album-789",
    "removedMediaCount": 5
  }
}
```

**Error Responses:**

- `400`: Album ID is required
- `401`: User not authenticated
- `403`: User doesn't own the album (non-admin)
- `404`: Album not found
- `500`: Server error

## Media API

### List Media

Get media items for a specific album.

```http
GET /albums/{albumId}/media?limit=50&cursor=...
```

**Path Parameters:**

| Parameter | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `albumId` | string | Yes      | Album identifier |

**Query Parameters:**

| Parameter | Type   | Default | Description                          |
| --------- | ------ | ------- | ------------------------------------ |
| `limit`   | number | 50      | Items per page (max 100)             |
| `cursor`  | string | -       | Base64-encoded cursor for pagination |

**Response:**

```json
{
  "success": true,
  "data": {
    "media": [
      {
        "id": "media-456",
        "filename": "beach-sunset.jpg",
        "originalFilename": "vacation_beach_2024.jpg",
        "mimeType": "image/jpeg",
        "size": 1923840,
        "width": 2560,
        "height": 1440,
        "url": "https://cdn.example.com/albums/album-123/media/beach-sunset.jpg",

        // Legacy thumbnail (points to small size)
        "thumbnailUrl": "https://cdn.example.com/albums/album-123/thumbnails/beach-sunset_thumb_small.jpg",

        // Complete 5-size thumbnail set
        "thumbnailUrls": {
          "cover": "https://cdn.example.com/albums/album-123/thumbnails/beach-sunset_thumb_cover.jpg",
          "small": "https://cdn.example.com/albums/album-123/thumbnails/beach-sunset_thumb_small.jpg",
          "medium": "https://cdn.example.com/albums/album-123/thumbnails/beach-sunset_thumb_medium.jpg",
          "large": "https://cdn.example.com/albums/album-123/thumbnails/beach-sunset_thumb_large.jpg",
          "xlarge": "https://cdn.example.com/albums/album-123/thumbnails/beach-sunset_thumb_xlarge.jpg"
        },

        "status": "uploaded",
        "createdAt": "2024-01-15T12:00:00.000Z",
        "updatedAt": "2024-01-15T12:03:00.000Z",
        "likeCount": 15,
        "bookmarkCount": 3,
        "viewCount": 128,
        "createdBy": "user123",
        "createdByType": "user",
        "metadata": {
          "camera": "Canon EOS R5",
          "lens": "RF 24-70mm F2.8L IS USM"
        }
      }
    ],
    "pagination": {
      "hasNext": false,
      "cursor": null
    }
  }
}
```

### Get All Media

Get all media items across all albums (admin/power user endpoint).

```http
GET /media?limit=50&cursor=...
```

**Query Parameters:**

| Parameter | Type   | Default | Description                          |
| --------- | ------ | ------- | ------------------------------------ |
| `limit`   | number | 50      | Items per page (max 100)             |
| `cursor`  | string | -       | Base64-encoded cursor for pagination |

### Get Media Item

Get a specific media item by ID.

```http
GET /media/{mediaId}
```

**Path Parameters:**

| Parameter | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `mediaId` | string | Yes      | Media identifier |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "media-456",
    "filename": "portrait-session.jpg",
    "originalFilename": "portrait_final_edit.jpg",
    "mimeType": "image/jpeg",
    "size": 3547392,
    "width": 4000,
    "height": 6000,
    "url": "https://cdn.example.com/albums/album-123/media/portrait-session.jpg",

    // Backward compatibility
    "thumbnailUrl": "https://cdn.example.com/albums/album-123/thumbnails/portrait-session_thumb_small.jpg",

    // Full thumbnail set with all 5 sizes
    "thumbnailUrls": {
      "cover": "https://cdn.example.com/albums/album-123/thumbnails/portrait-session_thumb_cover.jpg",
      "small": "https://cdn.example.com/albums/album-123/thumbnails/portrait-session_thumb_small.jpg",
      "medium": "https://cdn.example.com/albums/album-123/thumbnails/portrait-session_thumb_medium.jpg",
      "large": "https://cdn.example.com/albums/album-123/thumbnails/portrait-session_thumb_large.jpg",
      "xlarge": "https://cdn.example.com/albums/album-123/thumbnails/portrait-session_thumb_xlarge.jpg"
    },

    "status": "uploaded",
    "createdAt": "2024-01-15T14:00:00.000Z",
    "updatedAt": "2024-01-15T14:05:00.000Z",
    "likeCount": 89,
    "bookmarkCount": 12,
    "viewCount": 445
  }
}
```

### Upload Media

Upload a new media file to an album (requires admin authentication).

```http
POST /albums/{albumId}/media
Content-Type: application/json
Cookie: adminSessionId=...

{
  "filename": "new-photo.jpg",
  "mimeType": "image/jpeg",
  "size": 2048000
}
```

**Path Parameters:**

| Parameter | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `albumId` | string | Yes      | Album identifier |

**Request Body:**

| Field      | Type   | Required | Description        |
| ---------- | ------ | -------- | ------------------ |
| `filename` | string | Yes      | Original filename  |
| `mimeType` | string | Yes      | File MIME type     |
| `size`     | number | Yes      | File size in bytes |

**Response:**

```json
{
  "success": true,
  "data": {
    "mediaId": "media-789",
    "uploadUrl": "https://s3.amazonaws.com/bucket/presigned-upload-url",
    "expiresAt": "2024-01-15T17:00:00.000Z"
  }
}
```

**Upload Flow:**

1. **Request upload URL** - POST to `/albums/{albumId}/media`
2. **Upload file** - PUT to the returned `uploadUrl`
3. **Automatic processing** - S3 triggers Lambda to generate 5 thumbnail sizes
4. **Database update** - Media record updated with complete `thumbnailUrls` object

### Add Existing Media to Album

Add existing media items to an album. Supports both single and bulk operations.

**Single Media Addition:**

```http
POST /albums/{albumId}/media
Content-Type: application/json
Cookie: sessionId=session-token-here

{
  "mediaId": "media-456"
}
```

**Bulk Media Addition:**

```http
POST /albums/{albumId}/media
Content-Type: application/json
Cookie: sessionId=session-token-here

{
  "mediaIds": ["media-456", "media-789", "media-012"]
}
```

**Path Parameters:**

| Parameter | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `albumId` | string | Yes      | Album identifier |

**Request Body (Single):**

| Field     | Type   | Required | Description                 |
| --------- | ------ | -------- | --------------------------- |
| `mediaId` | string | Yes      | ID of media to add to album |

**Request Body (Bulk):**

| Field      | Type     | Required | Description                        |
| ---------- | -------- | -------- | ---------------------------------- |
| `mediaIds` | string[] | Yes      | Array of media IDs to add to album |

**Single Response:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Media added to album successfully",
    "albumId": "album-123",
    "mediaId": "media-456"
  }
}
```

**Bulk Response:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "2 media items added successfully, 1 failed",
    "results": {
      "successfullyAdded": ["media-456", "media-789"],
      "failedAdditions": [
        {
          "mediaId": "media-012",
          "error": "Media media-012 is already in album album-123"
        }
      ],
      "totalProcessed": 3,
      "successCount": 2,
      "failureCount": 1
    },
    "albumId": "album-123"
  }
}
```

**Validation:**

- **Single**: Either `mediaId` OR `mediaIds` must be provided, not both
- **Bulk**: Maximum 50 media items per request to prevent timeouts
- **Media Existence**: All media items must exist in the database
- **Duplicates**: Gracefully handles media already in the album (skips with error)

**Authentication:** Required - User must own the album or have admin privileges

**Error Responses:**

- `400`: Invalid request (missing IDs, both fields provided, etc.)
- `401`: User not authenticated
- `403`: User doesn't own the album (non-admin)
- `404`: Album or media not found
- `500`: Server error

### Bulk Remove Media from Album

Remove multiple existing media items from an album in one request.

```http
DELETE /albums/{albumId}/media/bulk-remove
Content-Type: application/json
Cookie: sessionId=session-token-here

{
  "mediaIds": ["media-456", "media-789", "media-012"]
}
```

**Path Parameters:**

| Parameter | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `albumId` | string | Yes      | Album identifier |

**Request Body:**

| Field      | Type     | Required | Description                  |
| ---------- | -------- | -------- | ---------------------------- |
| `mediaIds` | string[] | Yes      | Array of media IDs to remove |

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "3 media items removed successfully",
    "results": {
      "successfullyRemoved": ["media-456", "media-789"],
      "failedRemovals": [
        {
          "mediaId": "media-012",
          "error": "Media not found in album"
        }
      ],
      "totalProcessed": 3,
      "successCount": 2,
      "failureCount": 1
    },
    "albumId": "album-123"
  }
}
```

**Validation:**

- **Bulk Only**: Maximum 50 media items per request to prevent timeouts
- **Media Relationship**: Only removes media-album relationships, preserves media files
- **Graceful Errors**: Continues processing even if some removals fail

**Authentication:** Required - User must own the album or have admin privileges

**Error Responses:**

- `400`: Invalid request (empty array, too many items, etc.)
- `401`: User not authenticated
- `403`: User doesn't own the album (non-admin)
- `404`: Album not found
- `500`: Server error

## Thumbnail System API

### Thumbnail Size Reference

| Size       | Dimensions | Quality | File Size | Primary Use Case              |
| ---------- | ---------- | ------- | --------- | ----------------------------- |
| **cover**  | 128×128px  | 75%     | 8-15KB    | Album covers, small previews  |
| **small**  | 240×240px  | 80%     | 20-40KB   | Dense grids, admin interfaces |
| **medium** | 300×300px  | 85%     | 35-70KB   | General purpose, discover     |
| **large**  | 365×365px  | 85%     | 50-100KB  | High quality grids            |
| **xlarge** | 600×600px  | 90%     | 120-250KB | Mobile/small screens          |

### Intelligent Selection

The frontend automatically selects optimal thumbnail sizes based on:

- **Screen size** - Responsive breakpoints (sm/md/lg/xl/2xl)
- **Context** - Homepage, albums, admin, cover-selector
- **Layout** - Number of columns in grid displays

**Selection Logic Examples:**

```typescript
// Homepage on large screen → medium (300px)
// Albums with 6+ columns on xl screen → small (240px)
// Cover selector always → cover (128px)
// Mobile devices → xlarge (600px) for quality
```

### Backward Compatibility

**Legacy Field Support:**

- `thumbnailUrl` field maintained for backward compatibility
- Points to `small` size (240px) when available
- Falls back to original URL if no thumbnails exist

**Migration Support:**

- New clients should use `thumbnailUrls` object
- Legacy clients continue working with `thumbnailUrl`
- Gradual migration path supported

## User Authentication API

### Login

Authenticate a user and create a session.

```http
POST /user/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "userpassword"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "user123",
      "email": "user@example.com",
      "username": "johndoe",
      "role": "user"
    },
    "sessionId": "session-token-here"
  }
}
```

### Register

Create a new user account.

```http
POST /user/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "userpassword"
}
```

### Logout

End the current user session.

```http
POST /user/logout
Cookie: sessionId=session-token-here
```

### Generate JWT Token

Generate a JWT token for WebSocket authentication. The token contains an encrypted userId and expires after 5 minutes.

```http
POST /user/auth/generate-jwt
Cookie: sessionId=session-token-here
```

**Authentication:** Required - User session

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbmNyeXB0ZWRVc2VySWQiOiIxMjM0NTY3ODkwYWJjZGVmOjEyMzQ1Njc4OTBhYmNkZWY6MTIzNDU2Nzg5MGFiY2RlZiIsImlhdCI6MTY5MTU4NzIwMCwiZXhwIjoxNjkxNTg3NTAwLCJpc3MiOiJwb3Juc3BvdC5haSJ9.signature",
  "expiresIn": 300,
  "tokenType": "Bearer"
}
```

**Response Fields:**

- `token` (string): JWT token with encrypted userId for WebSocket authentication
- `expiresIn` (number): Token expiry time in seconds (300 = 5 minutes)
- `tokenType` (string): Token type identifier ("Bearer")

**Error Responses:**

- `401 Unauthorized`: User session invalid or expired
- `500 Internal Server Error`: Token generation failed

**Usage:**

This endpoint is primarily used for WebSocket authentication. The generated token should be included as a query parameter when establishing WebSocket connections:

```javascript
const { token } = await userApi.generateJwt();
const ws = new WebSocket(
  `wss://api.pornspot.ai/ws?token=${encodeURIComponent(token)}`
);
```

**Security Features:**

- Token expires after 5 minutes for security
- UserId is encrypted using AES-256-GCM within the JWT payload
- JWT signed with HMAC-SHA256 for integrity verification
- Secrets managed through AWS Parameter Store

**See also:** [JWT WebSocket Authentication Documentation](./JWT_WEBSOCKET_AUTHENTICATION.md)

### Email Verification

Verify a user's email address using a verification token. Supports both GET (link-based) and POST (form-based) verification. **Automatically signs the user in upon successful verification.**

#### GET Request (Link-based verification)

```http
GET /user/verify-email?token={verification-token}
```

**Query Parameters:**

- `token` (string, required): The verification token received via email

#### POST Request (Form-based verification)

```http
POST /user/verify-email
Content-Type: application/json

{
  "token": "verification-token-here"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Email verified successfully! Welcome to PornSpot.ai",
  "user": {
    "userId": "user123",
    "email": "user@example.com",
    "username": "johndoe",
    "isEmailVerified": true
  },
  "sessionId": "session-uuid-here"
}
```

**Cookies Set:**

- `user_session`: HTTP-only, Secure session cookie (30-day expiration)

**Auto Sign-In:** The user is automatically signed in with a new session upon successful email verification.

### Resend Verification Email

Request a new email verification to be sent. Returns the same response regardless of email existence for security.

```http
POST /user/resend-verification
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Security Note:** This endpoint always returns the same response to prevent email enumeration attacks, regardless of whether the email exists, account status, or verification state.

**Response:**

```json
{
  "success": true,
  "message": "If the email exists in our system, a verification email has been sent."
}
```

### Get Current User

Get the currently authenticated user's information.

```http
GET /user/me
Cookie: sessionId=session-token-here
```

### Update User Profile

Update the current user's profile information.

```http
PUT /user/profile/edit
Cookie: sessionId=session-token-here
Content-Type: application/json

{
  "username": "newusername",
  "bio": "Updated bio information",
  "location": "New York, USA",
  "website": "https://example.com"
}
```

**Request Body:**

All fields are optional. Only provided fields will be updated.

- `username` (string, optional): New username (3-30 characters, alphanumeric + underscore/hyphen)
- `bio` (string, optional): User biography (max 500 characters)
- `location` (string, optional): User location (max 100 characters)
- `website` (string, optional): User website URL (max 200 characters, auto-prefixes https:// if needed)

**Response:**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "userId": "user123",
    "email": "user@example.com",
    "username": "newusername",
    "bio": "Updated bio information",
    "location": "New York, USA",
    "website": "https://example.com",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "lastLoginAt": "2023-01-02T00:00:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Validation errors (username taken, invalid format, etc.)
- `401 Unauthorized`: User session required
- `405 Method Not Allowed`: Only PUT method allowed
- `500 Internal Server Error`: Server error

### Upload Profile Avatar

Upload or update the user's profile avatar image.

```http
POST /user/profile/avatar/upload
Content-Type: application/json
Authorization: User session required

{
  "filename": "avatar.jpg",
  "mimeType": "image/jpeg",
  "size": 524288
}
```

**Request Body:**

| Field      | Type   | Required | Description                  |
| ---------- | ------ | -------- | ---------------------------- |
| `filename` | string | Yes      | Original filename            |
| `mimeType` | string | Yes      | Image MIME type              |
| `size`     | number | Yes      | File size in bytes (max 5MB) |

**Response:**

```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://s3.amazonaws.com/bucket/presigned-upload-url",
    "avatarId": "avatar-123",
    "expiresAt": "2024-01-15T17:00:00.000Z"
  }
}
```

**Upload Flow:**

1. **Request upload URL** - POST to `/user/profile/avatar/upload`
2. **Upload file** - PUT to the returned `uploadUrl`
3. **Automatic processing** - Avatar is resized and optimized
4. **Profile update** - User profile updated with new avatar URL

**Error Responses:**

- `400 Bad Request`: Invalid file type or size
- `401 Unauthorized`: User session required
- `413 Payload Too Large`: File exceeds 5MB limit
- `500 Internal Server Error`: Server error

### Get Public User Profile

Get public profile information for a user by username.

```http
GET /user/profile/get?username={username}
Cookie: sessionId=session-token-here
```

**Query Parameters:**

- `username` (string, required): The username of the user to fetch

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "user123",
      "email": "user@example.com",
      "username": "johndoe",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "isActive": true,
      "isEmailVerified": true,
      "lastLoginAt": "2023-01-02T00:00:00.000Z",
      "bio": "User biography",
      "location": "New York, USA",
      "website": "https://example.com",
      "insights": {
        "totalLikesReceived": 150,
        "totalBookmarksReceived": 45,
        "totalMediaViews": 2380,
        "totalProfileViews": 89,
        "totalGeneratedMedias": 67,
        "totalAlbums": 12,
        "lastUpdated": "2023-01-02T00:00:00.000Z"
      }
    }
  }
}
```

**User Insights Fields:**

- `totalLikesReceived`: Total number of likes received across all user's content
- `totalBookmarksReceived`: Total number of bookmarks received across all user's content
- `totalMediaViews`: Total number of views across all user's media and albums
- `totalProfileViews`: Total number of times the user's profile has been viewed
- `totalGeneratedMedias`: Total number of media items created by the user
- `totalAlbums`: Total number of albums created by the user
- `lastUpdated`: Timestamp when insights were last calculated or updated

**Notes:**

- Insights are calculated in real-time and cached for performance
- All metrics are public and visible to any authenticated user
- View tracking automatically increments relevant creator metrics

**Error Responses:**

- `400 Bad Request`: Missing username parameter
- `401 Unauthorized`: User session required
- `404 Not Found`: User not found or inactive
- `405 Method Not Allowed`: Only GET method allowed
- `500 Internal Server Error`: Server error

## AI Image Generation API

### Generate Images

Generate AI images using the ComfyUI integration.

```http
POST /generation/generate
Content-Type: application/json
Cookie: sessionId=session-token-here

{
  "prompt": "A beautiful landscape with mountains",
  "negativePrompt": "blurry, low quality",
  "width": 512,
  "height": 512,
  "model": "stable-diffusion-xl"
}
```

**Request Body:**

| Field            | Type   | Required | Description                           |
| ---------------- | ------ | -------- | ------------------------------------- |
| `prompt`         | string | Yes      | Text description of desired image     |
| `negativePrompt` | string | No       | What to exclude from generation (Pro) |
| `width`          | number | No       | Image width (Pro only for custom)     |
| `height`         | number | No       | Image height (Pro only for custom)    |
| `model`          | string | No       | AI model to use                       |

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "gen-123456",
    "status": "queued",
    "estimatedTime": "30-60 seconds"
  }
}
```

**Authentication:** Required - User session with generation permissions
**Plan Restrictions:** Features limited by subscription plan

## User Account Management API

### Delete Account

Permanently delete a user account (soft delete). This anonymizes the user's personal information but preserves their content, which will be attributed to "[deleted]" user.

```http
DELETE /user/account/delete
Authorization: User session required
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Account deleted successfully. Your content will remain but show as '[deleted]' user"
  }
}
```

**Behavior:**

- User account is marked as inactive and anonymized
- Personal information (name, email, etc.) is removed
- Content (albums, media, comments) remains but shows "[deleted]" as username
- User sessions are invalidated
- Account cannot be recovered

**Error Responses:**

- `401 Unauthorized`: User session required
- `405 Method Not Allowed`: Only DELETE method allowed
- `500 Internal Server Error`: Server error

### Change Password

Change the current user's password (only available for email-authenticated users).

```http
PUT /user/auth/change-password
Content-Type: application/json
Authorization: User session required

{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Validation errors (weak password, incorrect current password)
- `401 Unauthorized`: User session required
- `403 Forbidden`: Not available for OAuth users
- `405 Method Not Allowed`: Only PUT method allowed
- `500 Internal Server Error`: Server error

### Cancel Subscription

Cancel the current user's subscription (keeps access until end of billing period).

```http
POST /user/subscription/cancel
Authorization: User session required
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Subscription canceled successfully. You will retain access to your current plan until the end of your billing period."
  }
}
```

**Behavior:**

- Subscription is marked as canceled but remains active until billing period ends
- User retains all plan features until expiration
- No prorated refund (depends on payment provider policies)

**Error Responses:**

- `400 Bad Request`: No active subscription or already canceled
- `401 Unauthorized`: User session required
- `405 Method Not Allowed`: Only POST method allowed
- `500 Internal Server Error`: Server error

## User Interactions API

### Like Media

Like or unlike a media item.

```http
POST /user/interactions/like
Content-Type: application/json
Cookie: sessionId=session-token-here

{
  "mediaId": "media123",
  "action": "like" // or "unlike"
}
```

### Bookmark Media

Bookmark or unbookmark a media item.

```http
POST /user/interactions/bookmark
Content-Type: application/json
Cookie: sessionId=session-token-here

{
  "mediaId": "media123",
  "action": "bookmark" // or "unbookmark"
}
```

### Track Views

Track views for media, albums, or user profiles.

```http
POST /user/interactions/view
Content-Type: application/json
Cookie: sessionId=session-token-here

{
  "targetType": "media", // "media", "album", or "profile"
  "targetId": "media123" // media ID, album ID, or username for profiles
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "viewTracked": true,
    "message": "View tracked successfully"
  }
}
```

**Target Types:**

- `media`: Track views for individual media items (targetId = media ID)
- `album`: Track views for album pages (targetId = album ID)
- `profile`: Track profile page views (targetId = username)

**Notes:**

- View tracking automatically increments relevant metrics for content creators
- Profile views increment the `totalProfileViews` metric for the profile owner
- Media and album views increment the `totalMediaViews` metric for the creator

### Get User Likes

Get all media items liked by the current user.

```http
GET /user/interactions/likes?limit=20&cursor=...
Cookie: sessionId=session-token-here
```

### Get User Bookmarks

Get all media items bookmarked by the current user.

```http
GET /user/interactions/bookmarks?limit=20&cursor=...
Cookie: sessionId=session-token-here
```

### Get Interaction Status

Get the current user's interaction status for multiple media items.

```http
POST /user/interactions/status
Content-Type: application/json
Cookie: sessionId=session-token-here

{
  "mediaIds": ["media123", "media456", "media789"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "media123": {
      "liked": true,
      "bookmarked": false
    },
    "media456": {
      "liked": false,
      "bookmarked": true
    }
  }
}
```

## User Media API

### List User Media

Get all media uploaded by the current user.

```http
GET /user/media?limit=50&cursor=...
Cookie: sessionId=session-token-here
```

**Response:**

```json
{
  "success": true,
  "data": {
    "media": [
      {
        "id": "media123",
        "filename": "my-photo.jpg",
        "originalFilename": "vacation.jpg",
        "url": "https://...",
        "thumbnailUrls": { ... },
        "albums": ["album1", "album2"]
      }
    ],
    "pagination": {
      "hasNext": true,
      "cursor": "next-page-cursor"
    }
  }
}
```

## Admin API

### Admin Authentication

#### Admin Login

### Admin User Management

#### List Users

Get a paginated list of all users for administrative management.

**Authentication**: Admin authentication required

**GET** `/admin/users`

**Query Parameters:**

- `limit` (optional, integer): Maximum number of results (default: 20, max: 100)
- `cursor` (optional, string): Pagination cursor

**Response:**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userId": "user123",
        "username": "johndoe",
        "email": "user@example.com",
        "role": "user",
        "isActive": true,
        "createdAt": "2023-01-01T00:00:00.000Z"
      }
    ],
    "nextCursor": "eyJpYXQiOjE2...",
    "hasNext": false
  }
}
```

#### Disable User

Disable a user account, setting `isActive` to false and deleting all active sessions.

**Authentication**: Admin authentication required

**POST** `/admin/users/disable`

**Request Body:**

```json
{
  "userId": "user123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "User has been disabled successfully",
    "user": {
      "userId": "user123",
      "username": "johndoe",
      "email": "user@example.com",
      "isActive": false
    }
  }
}
```

#### Enable User

Enable a previously disabled user account.

**Authentication**: Admin authentication required

**POST** `/admin/users/enable`

**Request Body:**

```json
{
  "userId": "user123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "User has been enabled successfully",
    "user": {
      "userId": "user123",
      "username": "johndoe",
      "email": "user@example.com",
      "isActive": true
    }
  }
}
```

### Moderator Authentication

#### Moderator Authorizer

Lambda authorizer for moderator endpoints (allows admin and moderator roles).

**Note**: This is an internal AWS Lambda authorizer, not a direct API endpoint.

### Admin Album Management

#### Get Admin Statistics

Get comprehensive platform statistics.

**Authentication**: Admin authentication required

**GET** `/admin/stats`

**Response:**

```json
{
  "success": true,
  "data": {
    "totalAlbums": 1234,
    "publicAlbums": 890,
    "totalMedia": 5678,
    "storageUsed": "12.4 GB",
    "storageUsedBytes": 13312345678
  }
}
```

#### List Admin Albums

Get all albums (public and private) for administrative purposes.

**Authentication**: Admin authentication required

**GET** `/admin/albums`

**Query Parameters:**

- `limit` (optional, integer): Maximum number of results (default: 20, max: 100)
- `cursor` (optional, string): Pagination cursor

**Response:**

```json
{
  "success": true,
  "data": {
    "albums": [
      {
        "id": "album123",
        "title": "Admin Album",
        "isPublic": false,
        "mediaCount": 15,
        "createdAt": "2023-01-01T00:00:00.000Z"
      }
    ],
    "nextCursor": "eyJpYXQiOjE2...",
    "hasNext": false
  }
}
```

#### Update Album (Admin)

Update album metadata.

**Authentication**: Admin authentication required

**PUT** `/admin/albums/{albumId}`

**Path Parameters:**

- `albumId` (string, required): Album identifier

**Request Body:**

```json
{
  "title": "Updated Title",
  "tags": ["tag1", "tag2"],
  "isPublic": true,
  "coverImageUrl": "https://example.com/cover.jpg"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "album123",
    "title": "Updated Title",
    "tags": ["tag1", "tag2"],
    "isPublic": true,
    "mediaCount": 15
  }
}
```

#### Delete Album (Admin)

Delete an album and remove media associations (media preserved).

**Authentication**: Admin authentication required

**DELETE** `/admin/albums/{albumId}`

**Path Parameters:**

- `albumId` (string, required): Album identifier

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Album deleted successfully, media removed from album but preserved",
    "deletedAlbumId": "album123",
    "removedMediaCount": 15
  }
}
```

#### Delete Media from Album (Admin)

Permanently delete a specific media item from an album and the system.

**Authentication**: Admin authentication required

**DELETE** `/admin/albums/{albumId}/media/{mediaId}`

**Path Parameters:**

- `albumId` (string, required): Album identifier
- `mediaId` (string, required): Media identifier

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Media deleted successfully",
    "deletedMediaId": "media123",
    "albumId": "album123"
  }
}
```

### Admin Media Management

#### List All Media (Admin)

Get all media items across the platform.

**Authentication**: Admin authentication required

**GET** `/admin/media`

**Query Parameters:**

- `limit` (optional, integer): Maximum number of results (default: 20, max: 100)
- `cursor` (optional, string): Pagination cursor

**Response:**

```json
{
  "success": true,
  "data": {
    "media": [
      {
        "id": "media123",
        "filename": "example.jpg",
        "url": "https://example.com/media.jpg",
        "createdAt": "2023-01-01T00:00:00.000Z"
      }
    ],
    "nextCursor": "eyJpYXQiOjE2...",
    "hasNext": false
  }
}
```

#### Delete Media (Admin)

Permanently delete a media item system-wide.

**Authentication**: Admin authentication required

**DELETE** `/admin/media/{mediaId}`

**Path Parameters:**

- `mediaId` (string, required): Media identifier

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Media deleted successfully",
    "deletedMediaId": "media123",
    "affectedAlbums": ["album1", "album2"]
  }
}
```

### Analytics API

#### Get Metrics

Retrieve pre-aggregated analytics data.

**Authentication**: Admin authentication required

**GET** `/analytics/get-metrics`

**Query Parameters:**

- `metricType` (required, string): "users", "media", "albums", "interactions", "storage", "generations", or "all"
- `granularity` (required, string): "hourly", "daily", "weekly", "monthly"
- `startDate` (required, string): ISO 8601 date (e.g., "2024-01-01T00:00:00.000Z")
- `endDate` (required, string): ISO 8601 date
- `metrics` (optional, string): Comma-separated list of specific metrics to return

**Response (Single Metric Type):**

```json
{
  "success": true,
  "data": {
    "metricType": "users",
    "granularity": "daily",
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-31T23:59:59.999Z",
    "dataPoints": [
      {
        "timestamp": "2024-01-01T00:00:00.000Z",
        "endTimestamp": "2024-01-01T23:59:59.999Z",
        "metrics": {
          "totalUsers": 1234,
          "newUsers": 45,
          "activeUsers": 890
        },
        "calculatedAt": "2024-02-01T00:05:00.000Z"
      }
    ],
    "summary": {
      "totalDataPoints": 31,
      "averages": {
        "totalUsers": 1250,
        "newUsers": 40
      },
      "trends": {
        "totalUsers": "upward",
        "newUsers": "stable"
      }
    }
  }
}
```

**Response (All Metrics):**

```json
{
  "success": true,
  "data": {
    "metricType": "all",
    "granularity": "daily",
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-31T23:59:59.999Z",
    "allMetrics": [
      {
        "metricType": "users",
        "dataPoints": [...],
        "summary": {...}
      },
      {
        "metricType": "media",
        "dataPoints": [...],
        "summary": {...}
      }
    ]
  }
}
```

#### Get Dashboard Stats

Get real-time visitor statistics for the admin dashboard.

**Authentication**: Admin authentication required

**GET** `/analytics/dashboard`

**Response:**

```json
{
  "success": true,
  "data": {
    "requestedBy": "admin",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "timeRange": {
      "last5Minutes": "2024-01-15T10:25:00.000Z",
      "last30Minutes": "2024-01-15T10:00:00.000Z",
      "current": "2024-01-15T10:30:00.000Z"
    },
    "visitorCounts": {
      "visitorsLast5Minutes": 23,
      "visitorsLast30Minutes": 156
    },
    "summary": {
      "visitorsLast5Minutes": 23,
      "visitorsLast30Minutes": 156,
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

### Config API

#### Get Permissions

Get the current permissions configuration.

**Authentication**: None required (public endpoint)

**GET** `/config/permissions`

**Response:**

```json
{
  "success": true,
  "data": {
    "free": {
      "monthlyGenerations": 30,
      "dailyGenerations": 1,
      "canUseLoRAModels": false,
      "canUseNegativePrompt": false,
      "canCreatePrivateContent": false
    },
    "starter": {
      "monthlyGenerations": 300,
      "dailyGenerations": 50,
      "canUseLoRAModels": false,
      "canUseNegativePrompt": false,
      "canCreatePrivateContent": true
    },
    "pro": {
      "monthlyGenerations": "unlimited",
      "dailyGenerations": "unlimited",
      "canUseLoRAModels": true,
      "canUseNegativePrompt": true,
      "canCreatePrivateContent": true
    }
  }
}
```

### Content API

#### Get View Counts

Get view counts for multiple albums and media items in bulk.

**Authentication**: None required (public endpoint)

**POST** `/content/get-view-count`

**Request Body:**

```json
{
  "targets": [
    {
      "targetType": "album",
      "targetId": "album123"
    },
    {
      "targetType": "media",
      "targetId": "media456"
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "viewCounts": [
      {
        "targetType": "album",
        "targetId": "album123",
        "viewCount": 1256
      },
      {
        "targetType": "media",
        "targetId": "media456",
        "viewCount": 89
      }
    ]
  }
}
```

### Discover API

#### Get Discover Content

Get diversified public content with time-weighted popularity and user following options.

**Authentication**: Optional (anonymous supported)

**GET** `/discover/get`

**Query Parameters:**

- `limit` (optional, integer): Maximum number of items (default: 20, max: 100)
- `cursorAlbums` (optional, string): Album pagination cursor
- `cursorMedia` (optional, string): Media pagination cursor
- `tag` (optional, string): Filter by tag (albums only)
- `sort` (optional, string): "popular", "following", or default (time-based)
- `maxPerUser` (optional, integer): Maximum items per user (default: 2)
- `depth` (optional, integer): Pagination depth for time window

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "album123",
        "title": "Popular Album",
        "mediaCount": 15,
        "isPublic": true,
        "createdAt": "2023-12-01T00:00:00.000Z",
        "contentPreview": [
          {
            "id": "media123",
            "url": "https://example.com/media.jpg",
            "thumbnailUrls": {...}
          }
        ]
      },
      {
        "id": "media456",
        "filename": "image.jpg",
        "url": "https://example.com/image.jpg",
        "thumbnailUrls": {...},
        "createdAt": "2023-12-01T00:00:00.000Z"
      }
    ],
    "cursors": {
      "albums": "eyJpYXQiOjE2...",
      "media": "eyJpYXQiOjE2..."
    },
    "metadata": {
      "totalItems": 20,
      "albumCount": 8,
      "mediaCount": 12,
      "diversificationApplied": true,
      "timeWindow": "0-2 days ago"
    }
  }
}
```

### Generation API

#### Generate Images

Submit an AI image generation request to the queue.

**Authentication**: Optional (anonymous supported with limits)

**POST** `/generation/generate`

**Request Body:**

```json
{
  "prompt": "A beautiful landscape with mountains",
  "negativePrompt": "blurry, low quality",
  "imageSize": "1024x1024",
  "customWidth": 1024,
  "customHeight": 1024,
  "batchCount": 1,
  "selectedLoras": ["DynaPoseV1", "RealDownblouseXLv3"],
  "loraSelectionMode": "auto",
  "loraStrengths": {
    "DynaPoseV1": 0.8
  },
  "optimizePrompt": true,
  "cfgScale": 7.5,
  "steps": 30,
  "seed": 12345,
  "isPublic": true,
  "connectionId": "ws-connection-id"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "queueId": "gen-123456",
    "queuePosition": 3,
    "estimatedWaitTime": 45,
    "status": "pending",
    "message": "Your request has been added to the queue. Position: 3",
    "workflowData": {
      "nodes": [...],
      "totalNodes": 25,
      "currentNodeIndex": 0,
      "nodeOrder": [...]
    },
    "optimizedPrompt": "Enhanced landscape with detailed mountains and vibrant colors"
  }
}
```

#### Get Usage Stats

Get current usage statistics and quota information.

**Authentication**: Optional

**GET** `/generation/usage-stats`

**Response:**

```json
{
  "success": true,
  "data": {
    "allowed": true,
    "reason": null,
    "remaining": 25,
    "userId": "user123",
    "plan": "pro"
  }
}
```

### User Follow API

#### Follow User

Follow or unfollow a user.

**Authentication**: User authentication required

**POST** `/user/follow/follow`

**Request Body:**

```json
{
  "targetUserId": "user456",
  "action": "follow" // or "unfollow"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Successfully followed user456",
    "action": "follow",
    "targetUserId": "user456"
  }
}
```

#### Get Followers

Get list of users following the target user.

**Authentication**: Optional

**GET** `/user/follow/followers?userId=user456&limit=20&cursor=...`

**Response:**

```json
{
  "success": true,
  "data": {
    "followers": [
      {
        "userId": "user123",
        "username": "johndoe",
        "followedAt": "2023-12-01T00:00:00.000Z"
      }
    ],
    "nextCursor": "eyJpYXQiOjE2...",
    "hasNext": false
  }
}
```

#### Get Following

Get list of users the target user is following.

**Authentication**: Optional

**GET** `/user/follow/following?userId=user456&limit=20&cursor=...`

**Response:**
Similar to followers response.

### User Interactions API

#### Comment on Media/Album

Add a comment to media or album.

**Authentication**: User authentication required

**POST** `/user/interactions/comment`

**Request Body:**

```json
{
  "targetType": "media", // or "album"
  "targetId": "media123",
  "content": "Great photo!"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "commentId": "comment789",
    "message": "Comment added successfully"
  }
}
```

#### Get Comments

Get comments for media or album.

**Authentication**: Optional

**GET** `/user/interactions/comments?targetType=media&targetId=media123&limit=20&cursor=...`

**Response:**

```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "comment789",
        "content": "Great photo!",
        "userId": "user123",
        "username": "johndoe",
        "createdAt": "2023-12-01T00:00:00.000Z",
        "likeCount": 5,
        "isEdited": false
      }
    ],
    "nextCursor": "eyJpYXQiOjE2...",
    "hasNext": false
  }
}
```

### User Media API

#### List User Media

Get all media uploaded by a user.

**Authentication**: Optional (public profile)

**GET** `/user/media/list?userId=user123&limit=20&cursor=...`

**Response:**

```json
{
  "success": true,
  "data": {
    "media": [
      {
        "id": "media123",
        "filename": "photo.jpg",
        "url": "https://example.com/photo.jpg",
        "thumbnailUrls": {...},
        "createdAt": "2023-12-01T00:00:00.000Z",
        "albums": ["album1"]
      }
    ],
    "nextCursor": "eyJpYXQiOjE2...",
    "hasNext": false
  }
}
```

### User Profile API

#### Edit Profile

Update user profile information.

**Authentication**: User authentication required

**PUT** `/user/profile/edit`

**Request Body:**

```json
{
  "username": "newusername",
  "bio": "Updated bio",
  "location": "New York"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Profile updated successfully",
    "user": {
      "userId": "user123",
      "username": "newusername",
      "bio": "Updated bio"
    }
  }
}
```

#### Get Profile

Get user profile information.

**Authentication**: User authentication required

**GET** `/user/profile/get`

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "user123",
      "username": "johndoe",
      "bio": "User bio",
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  }
}
```

### User Subscription API

#### Cancel Subscription

Cancel user's subscription.

**Authentication**: User authentication required

**POST** `/user/subscription/cancel`

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Subscription canceled successfully"
  }
}
```

### WebSocket API

#### Connect

WebSocket connection handler.

**Authentication**: JWT token in query parameter

**WebSocket** `wss://api.pornspot.ai/websocket?token=...`

#### Disconnect

WebSocket disconnection handler.

#### Route Messages

Handle WebSocket messages (internal routing).

### Scheduled Functions (Non-API)

#### Analytics Aggregation

- `aggregate-hourly.ts`: Scheduled hourly aggregation
- `aggregate-daily.ts`: Scheduled daily aggregation
- `aggregate-weekly.ts`: Scheduled weekly aggregation
- `aggregate-monthly.ts`: Scheduled monthly aggregation

**Note**: These are EventBridge scheduled functions, not direct API endpoints.

### Permissions and Validation

All endpoints use shared validation and permission checking through:

- `LambdaHandlerUtil.withAdminAuth()` - Admin-only endpoints
- `LambdaHandlerUtil.withAuth()` - User-authenticated endpoints
- `LambdaHandlerUtil.withoutAuth()` - Public endpoints
- `ValidationUtil` for parameter validation
- `PlanUtil` for plan-based permissions
- `ResponseUtil` for consistent responses

### Error Handling and Rate Limiting

See existing documentation sections for comprehensive error handling and rate limiting information.

This documentation covers all endpoints from the backend/functions/\*\* .ts files. Additional endpoints may be added as new functions are implemented.

#### Admin Login

```http
POST /admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "adminpassword"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "admin": {
      "adminId": "admin123",
      "username": "admin",
      "isActive": true
    },
    "sessionId": "admin-session-token"
  }
}
```

### Get Admin Statistics

Get comprehensive statistics about the system.

```http
GET /admin/stats
Cookie: adminSessionId=admin-session-token
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalAlbums": 1234,
    "totalMedia": 5678,
    "publicAlbums": 890,
    "storageUsed": "12.4 GB",
    "storageUsedBytes": 13312345678,
    "thumbnails": {
      "totalMedia": 5678,
      "withThumbnails": 5432,
      "withComplete5Sizes": 5100,
      "withLegacyOnly": 332,
      "processingFailed": 246,
      "sizesGenerated": {
        "cover": 5100,
        "small": 5432,
        "medium": 5200,
        "large": 5150,
        "xlarge": 5120
      }
    }
  }
}
```

### Admin Media Management

#### Add Media to Album (Admin)

```http
DELETE /admin/albums/{albumId}/media/{mediaId}
Cookie: adminSessionId=admin-session-token
```

#### Remove Media from Album (Admin)

```http
DELETE /admin/albums/{albumId}/media/{mediaId}
Cookie: adminSessionId=admin-session-token
```

### Regenerate Thumbnails

Trigger thumbnail regeneration for specific media or albums.

```http
POST /admin/thumbnails/regenerate
Content-Type: application/json

{
  "mediaIds": ["media-123", "media-456"],
  "sizes": ["cover", "small", "medium", "large", "xlarge"]
}
```

**Request Body:**

| Field      | Type     | Required | Description                       |
| ---------- | -------- | -------- | --------------------------------- |
| `mediaIds` | string[] | No       | Specific media IDs (omit for all) |
| `albumIds` | string[] | No       | Specific album IDs                |
| `sizes`    | string[] | No       | Sizes to generate (default: all)  |
| `force`    | boolean  | No       | Regenerate existing thumbnails    |

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "regen-job-789",
    "itemsQueued": 234,
    "estimatedTime": "15-20 minutes"
  }
}
```

## Error Handling

### HTTP Status Codes

| Status | Description           | Usage                         |
| ------ | --------------------- | ----------------------------- |
| 200    | OK                    | Successful operation          |
| 201    | Created               | Resource created successfully |
| 400    | Bad Request           | Invalid request parameters    |
| 401    | Unauthorized          | Authentication required       |
| 403    | Forbidden             | Insufficient permissions      |
| 404    | Not Found             | Resource not found            |
| 409    | Conflict              | Resource already exists       |
| 422    | Unprocessable Entity  | Validation errors             |
| 500    | Internal Server Error | Server error                  |

### Error Response Format

```json
{
  "success": false,
  "error": "MEDIA_NOT_FOUND",
  "message": "Media item with ID 'media-123' not found",
  "details": {
    "mediaId": "media-123",
    "timestamp": "2024-01-15T16:30:00.000Z"
  }
}
```

### Common Error Codes

| Code                          | Description                | HTTP Status |
| ----------------------------- | -------------------------- | ----------- |
| `ALBUM_NOT_FOUND`             | Album does not exist       | 404         |
| `MEDIA_NOT_FOUND`             | Media item does not exist  | 404         |
| `INVALID_MIME_TYPE`           | Unsupported file type      | 400         |
| `FILE_TOO_LARGE`              | File exceeds size limit    | 413         |
| `THUMBNAIL_GENERATION_FAILED` | Thumbnail processing error | 500         |
| `UPLOAD_EXPIRED`              | Upload URL expired         | 410         |
| `VALIDATION_ERROR`            | Request validation failed  | 422         |

## Rate Limiting

### Current Limits

| Endpoint Type | Rate Limit    | Window   |
| ------------- | ------------- | -------- |
| Public API    | 100 requests  | 1 minute |
| Upload API    | 10 uploads    | 1 minute |
| Admin API     | 1000 requests | 1 minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642262400
```

## Client SDKs and Examples

### JavaScript/TypeScript

```typescript
// Example using fetch API with session authentication
const response = await fetch("https://api-gateway-url/albums/album-123", {
  credentials: "include", // Include cookies
  headers: {
    "Content-Type": "application/json",
  },
});

const { success, data } = await response.json();

if (success && data.media) {
  data.media.forEach((media) => {
    // Use new thumbnail system
    const thumbnailUrl =
      media.thumbnailUrls?.medium || media.thumbnailUrl || media.url;

    console.log(`Displaying ${media.originalFilename} at ${thumbnailUrl}`);
  });
}

// User authentication example
const loginResponse = await fetch("https://api-gateway-url/user/login", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "user@example.com",
    password: "password",
  }),
});

const { success, data: userData } = await loginResponse.json();
if (success) {
  console.log("Logged in as:", userData.user.username);
  // Session cookie is now set automatically
}
```

### cURL Examples

```bash
# List public albums (no authentication)
curl "https://api-gateway-url/albums?limit=10&isPublic=true"

# Get album by ID
curl "https://api-gateway-url/albums/album-123"

# User login (sets session cookie)
curl -c cookies.txt \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","password":"password"}' \
     "https://api-gateway-url/user/login"

# List user's bookmarks (requires authentication)
curl -b cookies.txt \
     "https://api-gateway-url/user/interactions/bookmarks?limit=20"

# Admin login
curl -c admin-cookies.txt \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"adminpassword"}' \
     "https://api-gateway-url/admin/login"

# Get admin stats
curl -b admin-cookies.txt \
     "https://api-gateway-url/admin/stats"
```

## Migration Notes

### From Legacy API

**Changes in Current Version:**

1. **Authentication**: Moved from AWS IAM to session-based authentication
2. **Pagination**: Uses DynamoDB-native cursors instead of page-based pagination
3. **Response Format**: Consistent `{success, data, error}` wrapper for all responses
4. **User System**: Added comprehensive user authentication and interactions
5. **New Fields**: Added user interaction fields (`likeCount`, `bookmarkCount`, `viewCount`)
6. **Creator Tracking**: Added `createdBy` and `createdByType` fields
7. **Intelligent Filtering**: Album queries respect user permissions automatically

**Migration Checklist:**

- [ ] Update authentication from IAM to session cookies
- [ ] Replace page-based pagination with cursor-based pagination
- [ ] Update response parsing to handle `{success, data}` wrapper
- [ ] Implement user authentication flows
- [ ] Update album queries to use new filtering parameters
- [ ] Handle new user interaction fields in UI
- [ ] Test permission-based album visibility

### API Endpoint Changes

**Updated Endpoints:**

- `GET /albums` - Now supports `createdBy`, `tag`, and cursor pagination
- `GET /albums/{id}/media` - Uses cursor pagination instead of pages
- `POST /albums/{id}/media` - Now requires admin authentication
- `GET /media` - New endpoint for cross-album media queries

**New Endpoints:**

- `POST /user/login` - User authentication
- `GET /user/interactions/likes` - User's liked media
- `GET /user/interactions/bookmarks` - User's bookmarked media
- `POST /user/interactions/like` - Like/unlike media
- `POST /user/interactions/bookmark` - Bookmark/unbookmark media
- `GET /admin/stats` - System statistics
- `POST /admin/login` - Admin authentication

## Payments & Subscriptions

### Finby

Finby powers credit purchases and subscription upgrades. The integration exposes two endpoints:

- **POST `/finby/initiatePayment`** – Authenticated users request a Finby checkout by passing the desired `item` (see `@shared/utils/order-items` for the catalog). An `Order` entity is created with status `initiated`, and the response returns the Finby gateway URL signed with the account secret.
- **GET `/finby/result`** (alias: `/result`) – Finby calls this callback after processing a payment. The request includes query parameters such as `AccountId`, `Amount`, `Currency`, `ResultCode`, `Reference`, and `Signature`, plus optional fields (`Type`, `CounterAccount`, `CounterAccountName`, `OrderId`, `PaymentId`, `PaymentRequestId`, `RefuseReason`, `CardId`).

`Reference` maps to the internal `orderId`. The backend verifies the signature by concatenating the available parameters in the order specified by Finby (`AccountId/Amount/Currency/Type/ResultCode/CounterAccount/CounterAccountName/OrderId/PaymentId/Reference/RefuseReason`) and comparing the HMAC-SHA256 hash against `Signature`. Requests with an unexpected `AccountId` or invalid signature return `401`.

On success (`ResultCode === "0"`):

1. The `Order` is updated to `completed`, storing `paymentRequestId` and Finby metadata while refreshing the status GSI keys.
2. If the purchased item is **video credits**, `i2vCreditsSecondsPurchased` is incremented for the user.
3. Otherwise, the user’s subscription is activated with a new `plan`, `subscriptionStatus`, `planStartDate`, `planEndDate`, and corresponding `USER_PLAN` GSI keys.

Failed callbacks (`ResultCode !== "0"`) mark the order as `failed` without altering user data. All responses follow the standard `{ success, data }` / `{ success: false, error }` JSON contract and attach the platform CORS headers to satisfy Finby’s browser-based redirects.

### Best Practices

1. **Always handle the response wrapper** - Check `success` field before accessing `data`
2. **Use cursor pagination** - Store and pass `nextCursor` for pagination
3. **Implement proper authentication** - Handle session cookies for user operations
4. **Respect permissions** - Use `createdBy` parameter appropriately for user-specific queries
5. **Cache thumbnails** - Use appropriate thumbnail sizes based on display context
6. **Handle errors gracefully** - All endpoints return consistent error format
7. **Monitor rate limits** - Respect API usage limits and implement backoff strategies

## Support

For API support and integration assistance:

- **Documentation**: [Thumbnail System Guide](THUMBNAIL_SYSTEM.md)
- **Migration Guide**: [Thumbnail Migration](THUMBNAIL_MIGRATION.md)
- **Scripts**: [Repair and Cleanup Tools](../scripts/README.md)

---

**Last Updated**: January 2024  
**API Version**: 2.0 (5-Size Thumbnail System)  
**Compatibility**: Maintains backward compatibility with v1.x clients
