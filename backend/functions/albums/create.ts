import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { RevalidationService } from "@shared/utils/revalidation";
import { CreateAlbumRequest, AlbumEntity, Album } from "@shared/types";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return ResponseUtil.noContent(event);
  }

  try {
    if (!event.body) {
      return ResponseUtil.badRequest(event, "Request body is required");
    }

    const request: CreateAlbumRequest = JSON.parse(event.body);

    if (!request.title || request.title.trim().length === 0) {
      return ResponseUtil.badRequest(event, "Album title is required");
    }

    const albumId = uuidv4();
    const now = new Date().toISOString();

    const albumEntity: AlbumEntity = {
      PK: `ALBUM#${albumId}`,
      SK: "METADATA",
      GSI1PK: "ALBUM",
      GSI1SK: `${now}#${albumId}`,
      EntityType: "Album",
      id: albumId,
      title: request.title.trim(),
      tags: request.tags,
      createdAt: now,
      updatedAt: now,
      mediaCount: 0,
      isPublic: (request.isPublic ?? false).toString(),
      likeCount: 0,
      bookmarkCount: 0,
      viewCount: 0,
    };

    await DynamoDBService.createAlbum(albumEntity);

    const album: Album = {
      id: albumEntity.id,
      title: albumEntity.title,
      createdAt: albumEntity.createdAt,
      updatedAt: albumEntity.updatedAt,
      mediaCount: albumEntity.mediaCount,
      isPublic: albumEntity.isPublic === "true",
      likeCount: albumEntity.likeCount || 0,
      bookmarkCount: albumEntity.bookmarkCount || 0,
      viewCount: albumEntity.viewCount || 0,
    };

    if (albumEntity.tags !== undefined) {
      album.tags = albumEntity.tags;
    }

    if (albumEntity.coverImageUrl !== undefined) {
      album.coverImageUrl = albumEntity.coverImageUrl;
    }

    // Trigger revalidation
    await RevalidationService.revalidateAlbums();

    return ResponseUtil.created(event, album);
  } catch (error) {
    console.error("Error creating album:", error);
    return ResponseUtil.internalError(event, "Failed to create album");
  }
};
