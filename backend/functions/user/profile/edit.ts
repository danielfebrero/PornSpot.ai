/**
 * @fileoverview User Profile Edit Handler
 * @description Updates user profile fields like username, bio, location, website, preferredLanguage.
 * @auth Requires authentication via LambdaHandlerUtil.withAuth.
 * @notes
 * - PUT method only.
 * - Validates each field: username availability, lengths, URL for website, supported languages.
 * - Updates GSI indexes for username change.
 * - Removes empty fields.
 * - Returns updated user data excluding sensitive info.
 * - Logs validation errors.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import {
  UserEntity,
  UserProfileUpdateRequest,
  UserProfileUpdateResponse,
  EmailPreferences,
  EmailPreferenceMode,
} from "@shared";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

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
  const updateData: UserProfileUpdateRequest = JSON.parse(event.body!);
  console.log("📝 Profile update data:", updateData);

  const fieldsToRemove: (keyof UserEntity)[] = [];

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
        const supportedLanguages = [
          "",
          "de",
          "en",
          "es",
          "fr",
          "hi",
          "ru",
          "zh",
        ];
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

  // Email preferences validation
  if (updateData.emailPreferences !== undefined) {
    try {
      const prefs = updateData.emailPreferences as EmailPreferences;
      const validModes: EmailPreferenceMode[] = [
        "intelligently",
        "always",
        "never",
      ];
      if (prefs.pscBalance && !validModes.includes(prefs.pscBalance)) {
        validationErrors.push("Invalid email preference for PSC balance");
      }
      if (
        prefs.unreadNotifications &&
        !validModes.includes(prefs.unreadNotifications)
      ) {
        validationErrors.push(
          "Invalid email preference for unread notifications"
        );
      }
      if (prefs.newFollowers && !validModes.includes(prefs.newFollowers)) {
        validationErrors.push("Invalid email preference for new followers");
      }
    } catch (error) {
      validationErrors.push(
        error instanceof Error
          ? error.message
          : "Email preferences validation failed"
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
    const trimmedBio = updateData.bio.trim();
    if (trimmedBio) {
      if (trimmedBio !== (currentUserEntity.bio || "")) {
        updates.bio = trimmedBio;
      }
    } else if (currentUserEntity.bio) {
      fieldsToRemove.push("bio");
    }
  }

  if (updateData.location !== undefined) {
    const trimmedLocation = updateData.location.trim();
    if (trimmedLocation) {
      if (trimmedLocation !== (currentUserEntity.location || "")) {
        updates.location = trimmedLocation;
      }
    } else if (currentUserEntity.location) {
      fieldsToRemove.push("location");
    }
  }

  if (updateData.website !== undefined) {
    let website = updateData.website.trim();
    if (website) {
      if (!website.startsWith("http://") && !website.startsWith("https://")) {
        website = `https://${website}`;
      }
      if (website !== (currentUserEntity.website || "")) {
        updates.website = website;
      }
    } else if (currentUserEntity.website) {
      fieldsToRemove.push("website");
    }
  }

  if (updateData.preferredLanguage !== undefined) {
    // Always set the preferredLanguage field to support "auto" mode
    // Empty string means automatic language detection
    updates.preferredLanguage = updateData.preferredLanguage.trim();
  }

  if (updateData.emailPreferences !== undefined) {
    // Merge with existing preferences to avoid overwriting other keys in future
    const existingPrefs = currentUserEntity.emailPreferences || {};
    const newPrefs = updateData.emailPreferences || {};
    updates.emailPreferences = {
      ...existingPrefs,
      ...newPrefs,
    } as EmailPreferences;
  }

  // Only proceed if there are actually changes to make
  if (Object.keys(updates).length === 0 && fieldsToRemove.length === 0) {
    console.log("ℹ️ No changes to apply");
    const response: UserProfileUpdateResponse = {
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
  await DynamoDBService.updateUser(currentUserEntity.userId, updates, {
    removeFields: fieldsToRemove,
  });

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
  const responseUser: NonNullable<UserProfileUpdateResponse["user"]> = {
    userId: updatedUser.userId,
    email: updatedUser.email,
    username: updatedUser.username,
    createdAt: updatedUser.createdAt,
  };

  if (updatedUser.bio) {
    responseUser.bio = updatedUser.bio;
  } else if (fieldsToRemove.includes("bio")) {
    responseUser.bio = "";
  }

  if (updatedUser.location) {
    responseUser.location = updatedUser.location;
  } else if (fieldsToRemove.includes("location")) {
    responseUser.location = "";
  }

  if (updatedUser.website) {
    responseUser.website = updatedUser.website;
  } else if (fieldsToRemove.includes("website")) {
    responseUser.website = "";
  }

  if (updatedUser.preferredLanguage) {
    responseUser.preferredLanguage = updatedUser.preferredLanguage;
  }

  if (updatedUser.emailPreferences) {
    responseUser.emailPreferences = updatedUser.emailPreferences;
  }

  if (updatedUser.lastLoginAt) {
    responseUser.lastLoginAt = updatedUser.lastLoginAt;
  }

  if (updatedUser.avatarUrl) {
    responseUser.avatarUrl = updatedUser.avatarUrl;
  }

  if (updatedUser.avatarThumbnails) {
    responseUser.avatarThumbnails = updatedUser.avatarThumbnails;
  }

  const response: UserProfileUpdateResponse = {
    message: "Profile updated successfully",
    user: responseUser,
  };

  return ResponseUtil.success(event, response);
};

export const handler = LambdaHandlerUtil.withAuth(handleEditProfile, {
  requireBody: true,
});
