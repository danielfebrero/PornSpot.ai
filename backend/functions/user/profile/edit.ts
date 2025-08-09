import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { UserEntity } from "@shared";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

interface UpdateProfileRequest {
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  preferredLanguage?: string;
}

interface UpdateProfileResponse {
  message: string;
  user?: {
    userId: string;
    email: string;
    username: string;
    bio?: string;
    location?: string;
    website?: string;
    preferredLanguage?: string;
    createdAt: string;
    lastLoginAt?: string;

    // Avatar information
    avatarUrl?: string;
    avatarThumbnails?: {
      originalSize?: string;
      small?: string;
      medium?: string;
      large?: string;
    };
  };
}

const handleEditProfile = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /user/profile/edit handler called");

  // Only allow PUT method
  if (event.httpMethod !== "PUT") {
    console.log("❌ Method not allowed:", event.httpMethod);
    return ResponseUtil.methodNotAllowed(event, "Only PUT method allowed");
  }

  const userId = auth.userId;
  console.log("👤 Authenticated user:", userId);

  // Get the full user entity to access profile fields
  const currentUserEntity = await DynamoDBService.getUserById(userId);
  if (!currentUserEntity) {
    console.log("❌ User entity not found");
    return ResponseUtil.notFound(event, "User not found");
  }

  // Parse request body
  const updateData: UpdateProfileRequest = JSON.parse(event.body!);
  console.log("📝 Profile update data:", updateData);

  // Validate input data using shared validation utilities
  const validationErrors: string[] = [];

  // Username validation
  if (updateData.username !== undefined) {
    try {
      ValidationUtil.validateUsername(updateData.username);
    } catch (error) {
      validationErrors.push(
        error instanceof Error ? error.message : "Username validation failed"
      );
    }
  }

  // Bio validation
  if (updateData.bio !== undefined) {
    try {
      if (updateData.bio) {
        ValidationUtil.validateOptionalString(updateData.bio, "Bio");
        if (updateData.bio.length > 500) {
          validationErrors.push("Bio cannot be longer than 500 characters");
        }
      }
    } catch (error) {
      validationErrors.push(
        error instanceof Error ? error.message : "Bio validation failed"
      );
    }
  }

  // Location validation
  if (updateData.location !== undefined) {
    try {
      if (updateData.location) {
        ValidationUtil.validateOptionalString(updateData.location, "Location");
        if (updateData.location.length > 100) {
          validationErrors.push(
            "Location cannot be longer than 100 characters"
          );
        }
      }
    } catch (error) {
      validationErrors.push(
        error instanceof Error ? error.message : "Location validation failed"
      );
    }
  }

  // Website validation
  if (updateData.website !== undefined) {
    try {
      if (updateData.website) {
        ValidationUtil.validateOptionalString(updateData.website, "Website");
        if (updateData.website.length > 200) {
          validationErrors.push("Website cannot be longer than 200 characters");
        }
        // Simple URL validation
        const urlRegex =
          /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
        if (!urlRegex.test(updateData.website.trim())) {
          validationErrors.push("Website must be a valid URL");
        }
      }
    } catch (error) {
      validationErrors.push(
        error instanceof Error ? error.message : "Website validation failed"
      );
    }
  }

  // Preferred language validation
  if (updateData.preferredLanguage !== undefined) {
    try {
      if (updateData.preferredLanguage) {
        ValidationUtil.validateOptionalString(
          updateData.preferredLanguage,
          "Preferred language"
        );
        // Validate against supported locales (empty string is allowed for auto mode)
        const supportedLanguages = ["", "de", "en", "es", "fr", "ru", "zh"];
        if (!supportedLanguages.includes(updateData.preferredLanguage.trim())) {
          validationErrors.push(
            `Preferred language must be one of: ${supportedLanguages.join(
              ", "
            )}`
          );
        }
      }
    } catch (error) {
      validationErrors.push(
        error instanceof Error
          ? error.message
          : "Preferred language validation failed"
      );
    }
  }

  if (validationErrors.length > 0) {
    console.log("❌ Validation errors:", validationErrors);
    return ResponseUtil.badRequest(
      event,
      `Validation failed: ${validationErrors.join(", ")}`
    );
  }

  // Check if username is being changed and if it's already taken
  if (
    updateData.username &&
    updateData.username.trim().toLowerCase() !==
      (currentUserEntity.username || "").toLowerCase()
  ) {
    console.log("🔍 Checking username availability...");
    const existingUser = await DynamoDBService.getUserByUsername(
      updateData.username.trim()
    );
    if (existingUser && existingUser.userId !== currentUserEntity.userId) {
      console.log("❌ Username already taken:", updateData.username);
      return ResponseUtil.badRequest(event, "Username is already taken");
    }
  }

  // Prepare update data
  const updates: Partial<UserEntity> = {};

  if (
    updateData.username !== undefined &&
    updateData.username.trim() !== currentUserEntity.username
  ) {
    // Username is being changed, update GSI3 fields as well
    updates.username = updateData.username.trim();
    updates.GSI3SK = updateData.username.trim().toLowerCase();
  }

  if (updateData.bio !== undefined) {
    if (updateData.bio.trim()) {
      updates.bio = updateData.bio.trim();
    } else {
      delete updates.bio; // Remove the field entirely if empty
    }
  }

  if (updateData.location !== undefined) {
    if (updateData.location.trim()) {
      updates.location = updateData.location.trim();
    } else {
      delete updates.location; // Remove the field entirely if empty
    }
  }

  if (updateData.website !== undefined) {
    let website = updateData.website.trim();
    if (website) {
      if (!website.startsWith("http://") && !website.startsWith("https://")) {
        website = `https://${website}`;
      }
      updates.website = website;
    } else {
      delete updates.website; // Remove the field entirely if empty
    }
  }

  if (updateData.preferredLanguage !== undefined) {
    // Always set the preferredLanguage field to support "auto" mode
    // Empty string means automatic language detection
    updates.preferredLanguage = updateData.preferredLanguage.trim();
  }

  // Only proceed if there are actually changes to make
  if (Object.keys(updates).length === 0) {
    console.log("ℹ️ No changes to apply");
    const response: UpdateProfileResponse = {
      message: "No changes to apply",
      user: {
        userId: currentUserEntity.userId,
        email: currentUserEntity.email,
        username: currentUserEntity.username,
        ...(currentUserEntity.bio && { bio: currentUserEntity.bio }),
        ...(currentUserEntity.location && {
          location: currentUserEntity.location,
        }),
        ...(currentUserEntity.website && {
          website: currentUserEntity.website,
        }),
        ...(currentUserEntity.preferredLanguage && {
          preferredLanguage: currentUserEntity.preferredLanguage,
        }),
        createdAt: currentUserEntity.createdAt,
        ...(currentUserEntity.lastLoginAt && {
          lastLoginAt: currentUserEntity.lastLoginAt,
        }),
      },
    };

    return ResponseUtil.success(event, response);
  }

  console.log("💾 Updating user profile with:", updates);

  // Update the user in the database
  await DynamoDBService.updateUser(currentUserEntity.userId, updates);

  // Fetch the updated user data
  const updatedUser = await DynamoDBService.getUserById(
    currentUserEntity.userId
  );
  if (!updatedUser) {
    console.log("❌ Failed to fetch updated user");
    return ResponseUtil.internalError(
      event,
      "Failed to fetch updated user data"
    );
  }

  console.log("✅ Profile updated successfully");

  // Return the updated user data using ResponseUtil.success
  const response: UpdateProfileResponse = {
    message: "Profile updated successfully",
    user: {
      userId: updatedUser.userId,
      email: updatedUser.email,
      username: updatedUser.username,
      ...(updatedUser.bio && { bio: updatedUser.bio }),
      ...(updatedUser.location && { location: updatedUser.location }),
      ...(updatedUser.website && { website: updatedUser.website }),
      ...(updatedUser.preferredLanguage && {
        preferredLanguage: updatedUser.preferredLanguage,
      }),
      createdAt: updatedUser.createdAt,
      ...(updatedUser.lastLoginAt && {
        lastLoginAt: updatedUser.lastLoginAt,
      }),
      ...(updatedUser.avatarUrl && { avatarUrl: updatedUser.avatarUrl }),
      ...(updatedUser.avatarThumbnails && {
        avatarThumbnails: updatedUser.avatarThumbnails,
      }),
    },
  };

  return ResponseUtil.success(event, response);
};

export const handler = LambdaHandlerUtil.withAuth(handleEditProfile, {
  requireBody: true,
});
