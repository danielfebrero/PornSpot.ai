import { Media, MediaEntity, UploadMediaRequest } from "@shared";
import { mockAlbumId, mockTimestamp } from "./albums";

export const mockMediaId = "test-media-456";
export const mockS3Key = `albums/${mockAlbumId}/media/test-file.jpg`;
export const mockThumbnailKey = `albums/${mockAlbumId}/media/thumbnails/test-file_thumb.jpg`;

export const mockUploadMediaRequest: UploadMediaRequest = {
  filename: "test-image.jpg",
  mimeType: "image/jpeg",
  size: 1024000,
};

export const mockMediaEntity: MediaEntity = {
  PK: `MEDIA#${mockMediaId}`,
  SK: "METADATA",
  GSI1PK: "MEDIA_BY_CREATOR",
  GSI1SK: `admin-user-123#${mockTimestamp}#${mockMediaId}`,
  GSI2PK: "MEDIA_ID",
  GSI2SK: mockMediaId,
  EntityType: "Media",
  id: mockMediaId,
  filename: mockS3Key,
  originalFilename: "test-image.jpg",
  mimeType: "image/jpeg",
  size: 1024000,
  width: 1920,
  height: 1080,
  url: `https://test.cloudfront.net/${mockS3Key}`,
  thumbnailUrl: `https://test.cloudfront.net/${mockThumbnailKey}`,
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
  createdBy: "admin-user-123",
  createdByType: "admin",
  metadata: {
    camera: "Canon EOS R5",
    iso: 100,
    aperture: "f/2.8",
    shutterSpeed: "1/125",
  },
};

export const mockMedia: Media = {
  id: mockMediaId,
  filename: mockS3Key,
  type: "media",
  originalFilename: "test-image.jpg",
  mimeType: "image/jpeg",
  size: 1024000,
  width: 1920,
  height: 1080,
  url: `https://test.cloudfront.net/${mockS3Key}`,
  thumbnailUrl: `https://test.cloudfront.net/${mockThumbnailKey}`,
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
  metadata: {
    camera: "Canon EOS R5",
    iso: 100,
    aperture: "f/2.8",
    shutterSpeed: "1/125",
  },
};

export const mockMediaEntityMinimal: MediaEntity = {
  PK: `MEDIA#${mockMediaId}`,
  SK: "METADATA",
  GSI1PK: "MEDIA_BY_CREATOR",
  GSI1SK: `admin-user-123#${mockTimestamp}#${mockMediaId}`,
  GSI2PK: "MEDIA_ID",
  GSI2SK: mockMediaId,
  EntityType: "Media",
  id: mockMediaId,
  filename: mockS3Key,
  originalFilename: "simple.jpg",
  mimeType: "image/jpeg",
  size: 512000,
  url: `https://test.cloudfront.net/${mockS3Key}`,
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};

export const mockMediaMinimal: Media = {
  id: mockMediaId,
  type: "media",
  filename: mockS3Key,
  originalFilename: "simple.jpg",
  mimeType: "image/jpeg",
  size: 512000,
  url: `https://test.cloudfront.net/${mockS3Key}`,
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};

export const mockMediaList: MediaEntity[] = [
  mockMediaEntity,
  {
    ...mockMediaEntity,
    id: "media-2",
    SK: "MEDIA#media-2",
    GSI1SK: "2023-01-02T00:00:00.000Z#media-2",
    filename: `albums/${mockAlbumId}/media/test-file-2.jpg`,
    originalFilename: "second-image.jpg",
    url: `https://test.cloudfront.net/albums/${mockAlbumId}/media/test-file-2.jpg`,
    width: 1280,
    height: 720,
    metadata: undefined,
  },
  {
    ...mockMediaEntity,
    id: "media-3",
    SK: "MEDIA#media-3",
    GSI1SK: "2023-01-03T00:00:00.000Z#media-3",
    filename: `albums/${mockAlbumId}/media/test-file-3.png`,
    originalFilename: "third-image.png",
    mimeType: "image/png",
    url: `https://test.cloudfront.net/albums/${mockAlbumId}/media/test-file-3.png`,
    width: undefined,
    height: undefined,
    thumbnailUrl: undefined,
    metadata: undefined,
  },
];

export const mockMediaPaginationResponse = {
  media: mockMediaList,
  lastEvaluatedKey: {
    PK: `ALBUM#${mockAlbumId}`,
    SK: "MEDIA#media-3",
    GSI1PK: `MEDIA#${mockAlbumId}`,
    GSI1SK: "2023-01-03T00:00:00.000Z#media-3",
  },
};

export const mockPresignedUploadResponse = {
  uploadUrl: "https://test-bucket.s3.amazonaws.com/presigned-upload-url",
  key: mockS3Key,
};
