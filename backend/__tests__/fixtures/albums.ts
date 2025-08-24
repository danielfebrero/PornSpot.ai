import { Album, AlbumEntity, CreateAlbumRequest } from "@shared";

export const mockAlbumId = "test-album-123";
export const mockTimestamp = "2023-01-01T00:00:00.000Z";
export const mockUserId = "test-user-123";
export const mockUserId2 = "test-user-456";
export const mockAdminId = "test-user-789";

export const mockCreateAlbumRequest: CreateAlbumRequest = {
  title: "Test Album",
  tags: ["test", "unit-testing", "photography"],
  isPublic: true,
};

export const mockAlbumEntity: AlbumEntity = {
  PK: `ALBUM#${mockAlbumId}`,
  SK: "METADATA",
  GSI1PK: "ALBUM",
  GSI1SK: `${mockTimestamp}#${mockAlbumId}`,
  GSI4PK: "ALBUM_BY_CREATOR",
  GSI4SK: `${mockUserId}#${mockTimestamp}#${mockAlbumId}`,
  GSI5PK: "ALBUM",
  GSI5SK: "true",
  GSI6PK: "POPULARITY",
  GSI6SK: 0,
  GSI7PK: "CONTENT",
  GSI7SK: mockTimestamp,
  EntityType: "Album",
  id: mockAlbumId,
  title: "Test Album",
  tags: ["test", "unit-testing", "photography"],
  coverImageUrl: "https://test.cloudfront.net/albums/test-album-123/cover.jpg",
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
  mediaCount: 5,
  isPublic: "true",
  createdBy: mockUserId,
  createdByType: "user",
};

export const mockAlbum: Album = {
  id: mockAlbumId,
  type: "album",
  title: "Test Album",
  tags: ["test", "unit-testing", "photography"],
  coverImageUrl: "https://test.cloudfront.net/albums/test-album-123/cover.jpg",
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
  mediaCount: 5,
  isPublic: true,
};

export const mockAlbumEntityMinimal: AlbumEntity = {
  PK: `ALBUM#${mockAlbumId}`,
  SK: "METADATA",
  GSI1PK: "ALBUM",
  GSI1SK: `${mockTimestamp}#${mockAlbumId}`,
  GSI4PK: "ALBUM_BY_CREATOR",
  GSI4SK: `${mockUserId2}#${mockTimestamp}#${mockAlbumId}`,
  GSI5PK: "ALBUM",
  GSI5SK: "false",
  GSI6PK: "POPULARITY",
  GSI6SK: 0,
  GSI7PK: "CONTENT",
  GSI7SK: mockTimestamp,
  EntityType: "Album",
  id: mockAlbumId,
  title: "Minimal Album",
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
  mediaCount: 0,
  isPublic: "false",
  createdBy: mockUserId2,
  createdByType: "user",
};

export const mockAlbumMinimal: Album = {
  id: mockAlbumId,
  title: "Minimal Album",
  createdAt: mockTimestamp,
  type: "album",
  updatedAt: mockTimestamp,
  mediaCount: 0,
  isPublic: false,
};

export const mockAlbumsListForAPI: Album[] = [
  mockAlbum,
  {
    id: "album-2",
    title: "Second Album",
    tags: ["test", "second"],
    type: "album",
    coverImageUrl:
      "https://test.cloudfront.net/albums/test-album-123/cover.jpg",
    createdAt: "2023-01-02T00:00:00.000Z",
    updatedAt: "2023-01-02T00:00:00.000Z",
    mediaCount: 3,
    isPublic: true,
  },
  {
    id: "album-3",
    title: "Third Album",
    createdAt: "2023-01-03T00:00:00.000Z",
    updatedAt: "2023-01-03T00:00:00.000Z",
    mediaCount: 0,
    type: "album",
    isPublic: false,
  },
];

export const mockAlbumsList: AlbumEntity[] = [
  mockAlbumEntity,
  {
    ...mockAlbumEntity,
    id: "album-2",
    PK: "ALBUM#album-2",
    GSI1SK: "2023-01-02T00:00:00.000Z#album-2",
    GSI4SK: `${mockUserId}#2023-01-02T00:00:00.000Z#album-2`,
    title: "Second Album",
    tags: ["test", "second"],
    mediaCount: 3,
    createdAt: "2023-01-02T00:00:00.000Z",
  },
  {
    ...mockAlbumEntity,
    id: "album-3",
    PK: "ALBUM#album-3",
    GSI1SK: "2023-01-03T00:00:00.000Z#album-3",
    GSI4SK: `${mockAdminId}#2023-01-03T00:00:00.000Z#album-3`,
    title: "Third Album",
    mediaCount: 0,
    isPublic: "false",
    tags: undefined,
    coverImageUrl: undefined,
    createdAt: "2023-01-03T00:00:00.000Z",
    createdBy: mockAdminId,
    createdByType: "admin" as const,
  },
];

export const mockPaginationResponse = {
  albums: mockAlbumsList,
  lastEvaluatedKey: {
    PK: "ALBUM#album-3",
    SK: "METADATA",
    GSI1PK: "ALBUM",
    GSI1SK: "2023-01-03T00:00:00.000Z#album-3",
    GSI4PK: "ALBUM_BY_CREATOR",
    GSI4SK: `${mockAdminId}#2023-01-03T00:00:00.000Z#album-3`,
  },
};
