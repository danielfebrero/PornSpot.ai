import { MediaEntity, MediaWithSiblings } from "@shared/shared-types";
import { DynamoDBService } from "./dynamodb";

export const enhanceMediaWithSiblingsAndCreatorName = async (
  mediaResponse: MediaWithSiblings,
  mediaEntity: MediaEntity
) => {
  // Fetch creator username if createdBy exists
  if (mediaEntity.createdBy) {
    try {
      let creator = null;

      // Try to get user by ID first (new unified system)
      creator = await DynamoDBService.getUserById(mediaEntity.createdBy);

      if (creator && creator.username) {
        // Add creator information to metadata if it doesn't exist
        if (!mediaResponse.metadata) {
          mediaResponse.metadata = {};
        }
        mediaResponse.metadata["creatorUsername"] = creator.username;
      }
    } catch (error) {
      console.error("Failed to fetch creator info:", error);
      // Don't fail the request if creator info can't be fetched
    }
  }

  // Fetch siblings if bulkSiblings metadata exists
  if (mediaResponse.metadata?.["bulkSiblings"]) {
    const siblingIds = mediaResponse.metadata["bulkSiblings"] as string[];
    const siblings = await Promise.all(
      siblingIds.map((id) => DynamoDBService.findMediaById(id))
    );
    mediaResponse.bulkSiblings = siblings
      .filter(Boolean)
      .map((entity) => DynamoDBService.convertMediaEntityToMedia(entity!));
  }

  return mediaResponse;
};
