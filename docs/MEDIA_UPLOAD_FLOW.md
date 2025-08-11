# Media Upload Flow

This document describes the complete media upload flow for the PornSpot.ai application, from the frontend to the final processing and storage in S3.

## Upload Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend (Upload Endpoint)
    participant S3
    participant Backend (Processing Lambda)
    participant DynamoDB

    User->>Frontend: Selects a file to upload
    Frontend->>Backend (Upload Endpoint): Requests a presigned URL
    Backend (Upload Endpoint)->>DynamoDB: Creates a 'pending' media record
    Backend (Upload Endpoint)--)S3: Generates a presigned URL
    S3-->>Backend (Upload Endpoint): Returns the presigned URL
    Backend (Upload Endpoint)-->>Frontend: Returns the presigned URL and media ID
    Frontend->>S3: Uploads the file directly to S3 using the presigned URL
    S3-->>Backend (Processing Lambda): Triggers the processing Lambda upon successful upload
    Backend (Processing Lambda)->>S3: Downloads the original image
    Backend (Processing Lambda)->>Backend (Processing Lambda): Generates thumbnails
    Backend (Processing Lambda)-->>S3: Uploads the thumbnails
    S3-->>Backend (Processing Lambda): Confirms thumbnail uploads
    Backend (Processing Lambda)-->>DynamoDB: Updates the media record with thumbnail URLs and 'uploaded' status
    DynamoDB-->>Backend (Processing Lambda): Confirms the update
```

## Backend Implementation

### 1. **Presigned URL Generation**

- **Endpoint**: `POST /albums/{albumId}/media/upload`
- **Handler**: [`backend/functions/media/upload.ts`](../backend/functions/media/upload.ts)
- **Process**:
  1.  The frontend sends a request with the filename, MIME type, and size of the file to be uploaded.
  2.  The backend verifies that the album exists.
  3.  A new media record is created in DynamoDB with a `pending` status.
  4.  A presigned URL is generated using the AWS S3 SDK. This URL grants the frontend temporary permission to upload a file directly to our S3 bucket.
  5.  The presigned URL and the new media ID are returned to the frontend.

### 2. **Media Processing**

- **Trigger**: An S3 event is configured to trigger a Lambda function whenever a new object is created in the S3 bucket. The function handles three types of uploads:
  - **Album media**: `albums/{albumId}/media/{filename}`
  - **User avatars**: `users/{userId}/avatar/{filename}`
  - **Generated media**: `generated/{generationId}/{filename}` (AI-generated images)
- **Lambda Handler**: [`backend/functions/media/process-upload.ts`](../backend/functions/media/process-upload.ts)
- **Process**:
  1. The Lambda function is triggered by the S3 event.
  2. It determines the upload type based on the S3 key pattern.
  3. It downloads the original image from S3.
  4. For images, it uses the **Sharp** library to generate multiple thumbnail sizes (see [`THUMBNAIL_SYSTEM.md`](THUMBNAIL_SYSTEM.md) for details).
  5. The generated thumbnails are uploaded to the `thumbnails/` directory in the same S3 bucket.
  6. For album media and generated media, the Media record in DynamoDB is updated with thumbnail URLs and status is changed to `uploaded`.
  7. For avatars, the User entity is updated with avatar thumbnail information.

### 3. **Generated Media Processing**

AI-generated media follows a special workflow:

- **Creation**: Generated images are created via the image generation endpoint and stored as Media entities with status `pending`.
- **Upload**: The job completion handler downloads generated images from ComfyUI and uploads them to S3 with keys like `generated/{generationId}/{imageId}_{index}.jpg`.
- **Processing**: The process-upload function detects the `generated/` prefix and:
  1. Extracts the media ID from the filename pattern (`{generationId}_{index}`).
  2. Finds the corresponding Media entity using `DynamoDBService.findMediaById()`.
  3. Generates thumbnails and WebP display versions like regular media.
  4. Updates the Media entity status from `pending` to `uploaded`.

## Frontend Implementation

### 1. **File Selection**

- The user selects a file to upload using a file input or a drag-and-drop component.

### 2. **Requesting the Presigned URL**

- The frontend sends a request to the backend's upload endpoint with the file details.

### 3. **Uploading to S3**

- The frontend receives the presigned URL and media ID from the backend.
- It then uses the presigned URL to upload the file directly to S3 using a `PUT` request. This is done on the client-side, so the file does not pass through our backend servers.
- An `onUploadProgress` handler is used to display the upload progress to the user.

### 4. **Handling the Upload Completion**

- Once the upload to S3 is complete, the frontend can either poll the API to check the status of the media item, or it can be updated via a real-time mechanism like WebSockets (if implemented). The current implementation relies on the user refreshing the page or navigating to the album to see the new media.

## Error Handling

- **Upload to S3 Fails**: If the upload to S3 fails, the frontend should notify the user and provide an option to retry.
- **Processing Fails**: If the backend processing fails, the media record in DynamoDB will remain in a `pending` state or be marked as `failed`. A separate clean-up process can be implemented to handle these failed uploads.
