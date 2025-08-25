"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { UserPlanBadge } from "@/components/UserPlanBadge";
import LocaleLink from "@/components/ui/LocaleLink";
import { ContentCard } from "@/components/ui/ContentCard";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { Avatar } from "@/components/ui/Avatar";
import {
  CommentWithTarget as CommentType,
  InteractionTarget,
  PublicUserProfile,
  ThumbnailUrls,
  User as UserType,
} from "@/types";
import { useProfileDataQuery } from "@/hooks/queries/useProfileDataQuery";
import { useAlbums } from "@/hooks/queries/useAlbumsQuery";
import { useCommentsQuery } from "@/hooks/queries/useCommentsQuery";
import { useUserMedia } from "@/hooks/queries/useMediaQuery";
import { usePrefetchInteractionStatus } from "@/hooks/queries/useInteractionsQuery";
import { useUsernameAvailability } from "@/hooks/useUsernameAvailability";
import { formatDistanceToNow } from "@/lib/dateUtils";
import { userApi } from "@/lib/api/user";
import {
  User,
  Mail,
  Calendar,
  Shield,
  Edit2,
  Save,
  X,
  Camera,
  Heart,
  Bookmark,
  Image as ImageIcon,
  FolderOpen,
  Eye,
  MapPin,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDevice } from "@/contexts/DeviceContext";
import { useUserContext } from "@/contexts/UserContext";

interface ProfileComponentProps {
  user: UserType | PublicUserProfile | null;
  isOwner?: boolean; // Whether the current user is viewing their own profile
  loading?: boolean;
}

export default function ProfileComponent({
  user,
  isOwner = false,
  loading = false,
}: ProfileComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<
    UserType | PublicUserProfile | null
  >(user);
  const [formData, setFormData] = useState({
    username: "",
    bio: "",
    location: "",
    website: "",
  });

  // Avatar management state
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(
    null
  );
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const t = useTranslations("common");
  const tProfile = useTranslations("common.profile");
  const { isMobile } = useDevice();
  const { user: loggedInUser, refetch } = useUserContext();

  // Use the abstracted username availability hook
  const {
    usernameStatus,
    usernameMessage,
    checkUsernameAvailability,
    resetStatus: resetUsernameStatus,
  } = useUsernameAvailability();

  // Get real profile data
  const {
    data: profileData,
    isLoading: profileDataLoading,
    error: profileDataError,
  } = useProfileDataQuery({
    username: currentUser?.username,
    isOwner,
    limit: 6, // Fetch 6 recent likes for the scrollable preview
    includeContentPreview: true,
  });

  const recentLikes = useMemo(
    () => profileData?.recentLikes || [],
    [profileData?.recentLikes]
  );

  // Get real recent albums using TanStack Query
  const {
    data: albumsData,
    isLoading: albumsLoading,
    error: albumsError,
  } = useAlbums({
    user: currentUser?.username || "",
    isPublic: true,
    limit: 6, // Fetch 6 recent albums for the scrollable preview
    includeContentPreview: true,
  });

  // Get real user media using TanStack Query
  const {
    data: userMediaData,
    isLoading: userMediaLoading,
    error: userMediaError,
  } = useUserMedia({
    username: currentUser?.username,
    limit: 6, // Fetch 6 recent media for the scrollable preview
  });

  // Extract albums from paginated data (only need first page for profile preview)
  const recentAlbums = useMemo(
    () => albumsData?.pages[0]?.albums || [],
    [albumsData]
  );

  // Extract media from paginated data (only need first page for profile preview)
  const recentMedia = useMemo(
    () => userMediaData?.pages[0]?.media || [],
    [userMediaData]
  );

  // Preload interaction statuses for liked content
  const { prefetch } = usePrefetchInteractionStatus();

  // Effect to preload interaction statuses for all content
  useEffect(() => {
    if (loggedInUser) {
      const likeTargets = recentLikes
        .filter((item) => item && item.targetType && item.targetId)
        .map((item) => ({
          targetType: item.targetType as "album" | "media",
          targetId: item.targetId,
        }));

      const albumTargets = recentAlbums
        .filter((item) => item && item.id)
        .map((item) => ({
          targetType: "album",
          targetId: item.id,
        }));

      const mediaTargets = recentMedia
        .filter((item) => item && item.id)
        .map((item) => ({
          targetType: "media",
          targetId: item.id,
        }));

      // Preload the current logged-in user's statuses for these items
      // This will show the actual like/bookmark status of the current viewer,
      // not the profile owner's status
      prefetch([
        ...likeTargets,
        ...albumTargets,
        ...mediaTargets,
      ] as InteractionTarget[]).catch((error) => {
        console.error(
          "Failed to prefetch profile recent likes interaction status:",
          error
        );
      });
    }
  }, [recentLikes, recentAlbums, recentMedia, loggedInUser, prefetch]);

  // Debounce username checking when form data changes
  useEffect(() => {
    if (!isEditing) return;

    const timeoutId = setTimeout(() => {
      if (formData.username) {
        checkUsernameAvailability(formData.username, currentUser?.username);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    formData.username,
    checkUsernameAvailability,
    isEditing,
    currentUser?.username,
  ]);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  // Avatar handling functions
  const handleAvatarFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type || !file.type.startsWith("image/")) {
      console.error("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.error("File size must be less than 10MB");
      return;
    }

    // Clean up previous preview URL if it exists
    if (previewAvatarUrl) {
      URL.revokeObjectURL(previewAvatarUrl);
    }

    setSelectedAvatarFile(file);

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setPreviewAvatarUrl(previewUrl);
  };

  const handleAvatarUpload = async (
    file: File
  ): Promise<{
    success: boolean;
    avatarUrl?: string;
    avatarThumbnails?: ThumbnailUrls;
  }> => {
    try {
      setIsUploadingAvatar(true);

      // Validate file parameter
      if (!file || !file.type || !file.name) {
        throw new Error("Invalid file provided");
      }

      // Step 1: Get presigned upload URL
      const { data } = await userApi.uploadAvatar(file.name, file.type);

      // Step 2: Upload file to S3
      const uploadResponse = await fetch(data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Return success with the avatar key (thumbnails will be processed by S3 notifications)
      return {
        success: true,
        avatarUrl: data.avatarKey,
        avatarThumbnails: {}, // Thumbnails will be available after S3 processing
      };
    } catch (error) {
      console.error("❌ Avatar upload failed:", error);
      return { success: false };
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCameraClick = () => {
    if (avatarFileInputRef.current) {
      avatarFileInputRef.current.click();
    }
  };

  // Get real comments data
  // Get real comments data using TanStack Query
  const {
    data: commentsData,
    isLoading: commentsLoading,
    error: commentsError,
  } = useCommentsQuery({ username: currentUser?.username || "", limit: 3 });

  // Extract recent comments from paginated data (only need first page for profile preview)
  const recentComments: CommentType[] = (commentsData?.pages[0]?.comments ||
    []) as unknown as CommentType[];

  // Check if user is online (last active less than 5 minutes ago)
  const isUserOnline = useMemo(() => {
    if (!currentUser?.lastActive) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const lastActiveDate = new Date(currentUser.lastActive);
    return lastActiveDate > fiveMinutesAgo;
  }, [currentUser?.lastActive]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="w-24 h-24 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-6 bg-muted rounded w-1/3"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Initialize form data when user is available and editing starts
  const handleEditStart = () => {
    setFormData({
      username: currentUser?.username || "",
      bio: currentUser?.bio || "",
      location: currentUser?.location || "",
      website: currentUser?.website || "",
    });
    // Reset username status when starting to edit
    resetUsernameStatus();
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Check username availability before submission if username changed
      if (
        formData.username !== currentUser?.username &&
        usernameStatus === "taken"
      ) {
        console.error("Username is already taken");
        // In a real app, you'd show an error message to the user
        return;
      }

      if (usernameStatus === "checking") {
        console.error("Still checking username availability");
        // In a real app, you'd show a message asking user to wait
        return;
      }

      // Handle avatar upload if a new file was selected
      let avatarUpdateData = {};
      if (selectedAvatarFile) {
        const avatarResult = await handleAvatarUpload(selectedAvatarFile);
        if (avatarResult.success) {
          avatarUpdateData = {
            avatarUrl: avatarResult.avatarUrl,
            avatarThumbnails: avatarResult.avatarThumbnails,
          };
        } else {
          console.error("❌ Avatar upload failed");
          // Continue with profile update even if avatar upload fails
        }
      }

      // Call the API to update the profile

      try {
        const result = await userApi.updateProfile(formData);

        refetch();
        // Update the current user state with the response data
        setCurrentUser({
          ...currentUser,
          ...result.user,
          ...avatarUpdateData,
        } as UserType);

        // Reset username status since we've successfully saved
        resetUsernameStatus();

        // Reset avatar selection state
        setSelectedAvatarFile(null);
        if (previewAvatarUrl) {
          URL.revokeObjectURL(previewAvatarUrl);
          setPreviewAvatarUrl(null);
        }

        // Optionally show a success message or trigger a refresh
        // For now, we'll just log the success
      } catch (error) {
        console.error("Error updating profile:", error);
      }
    } catch (error) {
      console.error("Error uploading profile avatar:", error);
      // In a real app, you'd show an error message to the user
    } finally {
      setIsSaving(false);
      setIsEditing(false); // Always exit edit mode after save attempt
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      username: "",
      bio: "",
      location: "",
      website: "",
    });
    // Reset username status
    resetUsernameStatus();

    // Reset avatar state
    setSelectedAvatarFile(null);
    if (previewAvatarUrl) {
      URL.revokeObjectURL(previewAvatarUrl);
      setPreviewAvatarUrl(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSaving) {
      e.preventDefault();
      handleSave();
    }
  };

  const displayName = currentUser?.username ?? "Anonymous";
  const initials = displayName.slice(0, 2).toUpperCase();

  // Create a user object for the Avatar component with preview support
  const avatarUser = {
    ...currentUser,
    // Override avatarUrl with preview when editing
    ...(isEditing && previewAvatarUrl && { avatarUrl: previewAvatarUrl }),
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
          {/* Profile Header Card */}
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="pb-6">
              <div className="flex flex-col sm:flex-row gap-6">
                {/* Avatar Section */}
                <div className="relative inline-block w-fit h-fit">
                  <Avatar
                    user={avatarUser}
                    size="custom"
                    customSizeClasses="w-24 h-24 sm:w-32 sm:h-32"
                    customTextClasses="text-2xl sm:text-3xl font-bold"
                    className="shadow-lg"
                    showOnlineIndicator={isUserOnline}
                  />
                  {isOwner && isEditing && (
                    <>
                      <button
                        onClick={handleCameraClick}
                        className="absolute -top-1 -right-1 w-8 h-8 bg-background text-foreground border-2 border-primary rounded-full flex items-center justify-center hover:bg-muted transition-colors shadow-lg z-10"
                      >
                        <Camera className="w-4 h-4" />
                      </button>

                      {/* Hidden file input */}
                      <input
                        ref={avatarFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileSelect}
                        className="hidden"
                      />
                    </>
                  )}

                  {/* Loading indicator for avatar upload */}
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>

                {/* Profile Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {isSaving ? (
                        // Loading state while saving
                        <div className="space-y-3 animate-pulse">
                          <div className="flex items-center gap-3">
                            <div className="h-8 bg-muted rounded w-1/3"></div>
                            <div className="w-16 h-6 bg-muted rounded"></div>
                          </div>
                          <div className="space-y-2">
                            <div className="h-4 bg-muted rounded w-1/4"></div>
                            <div className="h-4 bg-muted rounded w-1/4"></div>
                            <div className="mt-4 space-y-2">
                              <div className="h-4 bg-muted rounded w-1/3"></div>
                              <div className="h-4 bg-muted rounded w-1/2"></div>
                              <div className="h-16 bg-muted rounded w-full"></div>
                            </div>
                          </div>
                        </div>
                      ) : isOwner && isEditing ? (
                        <div className="space-y-4">
                          <div className="relative">
                            <Input
                              label={tProfile("username")}
                              value={formData.username}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  username: e.target.value,
                                }))
                              }
                              onKeyDown={handleKeyDown}
                              placeholder={tProfile("enterUsername")}
                              className="text-lg font-semibold"
                            />

                            {/* Username availability indicator */}
                            {formData.username &&
                              formData.username.length >= 3 &&
                              formData.username !== currentUser?.username && (
                                <div className="absolute right-3 top-8 flex items-center h-10">
                                  {usernameStatus === "checking" && (
                                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                                  )}
                                  {usernameStatus === "available" && (
                                    <svg
                                      className="w-4 h-4 text-green-600"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  )}
                                  {usernameStatus === "taken" && (
                                    <svg
                                      className="w-4 h-4 text-red-600"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  )}
                                  {usernameStatus === "error" && (
                                    <svg
                                      className="w-4 h-4 text-yellow-600"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                      />
                                    </svg>
                                  )}
                                </div>
                              )}

                            {/* Username status message */}
                            {usernameMessage &&
                              formData.username !== currentUser?.username && (
                                <div
                                  className={`text-xs mt-1 ${
                                    usernameStatus === "available"
                                      ? "text-green-600"
                                      : usernameStatus === "taken"
                                      ? "text-red-600"
                                      : usernameStatus === "error"
                                      ? "text-yellow-600"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {usernameMessage}
                                </div>
                              )}
                          </div>
                          <Input
                            label={tProfile("bio")}
                            value={formData.bio}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                bio: e.target.value,
                              }))
                            }
                            onKeyDown={handleKeyDown}
                            placeholder={tProfile("tellUsAboutYourself")}
                            className="text-sm"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                              label={tProfile("location")}
                              value={formData.location}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  location: e.target.value,
                                }))
                              }
                              onKeyDown={handleKeyDown}
                              placeholder={tProfile("cityCountry")}
                              className="text-sm"
                            />
                            <Input
                              label={tProfile("website")}
                              value={formData.website}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  website: e.target.value,
                                }))
                              }
                              onKeyDown={handleKeyDown}
                              placeholder={tProfile("websitePlaceholder")}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">
                              {displayName}
                            </h1>
                            <UserPlanBadge
                              plan={currentUser?.planInfo.plan || "free"}
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span>
                                Joined{" "}
                                {new Date(
                                  currentUser?.createdAt ||
                                    new Date().toISOString()
                                ).toLocaleDateString()}
                              </span>
                            </div>

                            {currentUser?.lastActive && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Shield className="w-4 h-4" />
                                <span>
                                  Last active{" "}
                                  {new Date(
                                    currentUser.lastActive
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            )}

                            {/* User Information */}
                            <div className="mt-4 space-y-2">
                              {/* Location - only show if user has location */}
                              {currentUser?.location && (
                                <div className="flex items-center gap-2 text-sm">
                                  <MapPin className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-foreground">
                                    {currentUser.location}
                                  </span>
                                </div>
                              )}

                              {/* Website - only show if user has website */}
                              {currentUser?.website && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Globe className="w-4 h-4 text-muted-foreground" />
                                  <a
                                    href={
                                      currentUser.website?.startsWith("http")
                                        ? currentUser.website
                                        : `https://${currentUser.website}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    {currentUser.website}
                                  </a>
                                </div>
                              )}

                              {/* Bio - moved after location and website */}
                              <div>
                                {currentUser?.bio ? (
                                  <p className="text-sm text-foreground">
                                    {currentUser.bio}
                                  </p>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">
                                    {isOwner
                                      ? "No bio yet. Add one by editing your profile!"
                                      : "This user hasn't added a bio yet."}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons - Only show for profile owner */}
                    {isOwner && (
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              onClick={handleSave}
                              size="sm"
                              className="flex items-center gap-2"
                              disabled={
                                isSaving ||
                                isUploadingAvatar ||
                                usernameStatus === "checking" ||
                                usernameStatus === "taken"
                              }
                            >
                              <Save className="w-4 h-4" />
                              {isSaving
                                ? selectedAvatarFile
                                  ? "Saving profile & avatar..."
                                  : "Saving..."
                                : isUploadingAvatar
                                ? "Uploading avatar..."
                                : usernameStatus === "checking"
                                ? "Checking username..."
                                : usernameStatus === "taken"
                                ? "Username taken"
                                : t("save")}
                            </Button>
                            <Button
                              onClick={handleCancel}
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                              disabled={isSaving || isUploadingAvatar}
                            >
                              <X className="w-4 h-4" />
                              {t("cancel")}
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={handleEditStart}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            {t("edit")}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Content Insights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              {
                icon: Heart,
                label: "Likes Received",
                value: user?.profileInsights?.totalLikesReceived ?? 0,
                color: "text-red-600",
              },
              {
                icon: Bookmark,
                label: "Content Bookmarked",
                value: user?.profileInsights?.totalBookmarksReceived ?? 0,
                color: "text-purple-600",
              },
              {
                icon: Eye,
                label: "Total Media Views",
                value: user?.profileInsights?.totalMediaViews ?? 0,
                color: "text-blue-600",
              },
              {
                icon: User,
                label: "Profile Views",
                value: user?.profileInsights?.totalProfileViews ?? 0,
                color: "text-green-600",
              },
              {
                icon: ImageIcon,
                label: "Total Medias",
                value: user?.profileInsights?.totalGeneratedMedias ?? 0,
                color: "text-orange-600",
              },
              {
                icon: FolderOpen,
                label: "Total Albums",
                value: user?.profileInsights?.totalAlbums ?? 0,
                color: "text-indigo-600",
              },
            ].map((insight, index) => (
              <Card
                key={index}
                className="border-border/50 hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[120px]">
                  <insight.icon className={cn("w-8 h-8 mb-2", insight.color)} />
                  <div className="text-2xl font-bold text-foreground mb-1">
                    {insight.value.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground leading-tight">
                    {insight.label}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Activity Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Last Liked Content */}
            <Card
              className="border-border/50"
              hideBorder={isMobile}
              hideMargin={isMobile}
            >
              <CardHeader hidePadding={isMobile}>
                <div
                  className={cn("flex items-center gap-2", isMobile && "mb-4")}
                >
                  <Heart className="w-5 h-5 text-red-500" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Last Liked Content
                  </h2>
                </div>
              </CardHeader>
              <CardContent hidePadding={isMobile}>
                {profileDataLoading ? (
                  <HorizontalScroll
                    itemWidth="200px"
                    gap="medium"
                    showArrows={true}
                    className="w-full"
                  >
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="aspect-square bg-muted rounded-lg"></div>
                        <div className="mt-2 h-4 bg-muted rounded w-3/4"></div>
                      </div>
                    ))}
                  </HorizontalScroll>
                ) : profileDataError ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">
                      {profileDataError.message}
                    </p>
                  </div>
                ) : recentLikes.length > 0 ? (
                  <HorizontalScroll
                    itemWidth="200px"
                    gap="medium"
                    showArrows={true}
                    className="w-full"
                  >
                    {recentLikes
                      .filter(
                        (item) =>
                          item &&
                          item.target &&
                          item.targetType &&
                          item.targetId
                      )
                      .map((item) => (
                        <ContentCard
                          key={item.targetId}
                          item={item.target!}
                          showTags={false}
                          context="albums"
                          className="w-full"
                          canAddToAlbum={item.targetType !== "album"} // Disable for albums
                          canFullscreen={item.targetType !== "album"} // Disable for albums
                        />
                      ))}
                  </HorizontalScroll>
                ) : (
                  <div className="text-center py-8">
                    <Heart className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">
                      {isOwner
                        ? "You haven't liked any content yet."
                        : "This user hasn't liked any content yet."}
                    </p>
                  </div>
                )}
                <div className="text-center pt-4">
                  <LocaleLink href={`/profile/${displayName}/likes`}>
                    <Button variant="outline" size="sm" className="text-xs">
                      View All Liked Content
                    </Button>
                  </LocaleLink>
                </div>
              </CardContent>
            </Card>

            {/* Last Generated Medias */}
            <Card
              className="border-border/50"
              hideBorder={isMobile}
              hideMargin={isMobile}
            >
              <CardHeader hidePadding={isMobile}>
                <div
                  className={cn("flex items-center gap-2", isMobile && "mb-4")}
                >
                  <ImageIcon className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Last Generated Medias
                  </h2>
                </div>
              </CardHeader>
              <CardContent hidePadding={isMobile}>
                {userMediaLoading ? (
                  <HorizontalScroll
                    itemWidth="200px"
                    gap="medium"
                    showArrows={true}
                    className="w-full"
                  >
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="aspect-square bg-muted rounded-lg"></div>
                        <div className="mt-2 h-4 bg-muted rounded w-3/4"></div>
                      </div>
                    ))}
                  </HorizontalScroll>
                ) : userMediaError ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">
                      {userMediaError.message}
                    </p>
                  </div>
                ) : recentMedia.length > 0 ? (
                  <HorizontalScroll
                    itemWidth="200px"
                    gap="medium"
                    showArrows={true}
                    className="w-full"
                  >
                    {recentMedia
                      .filter((item) => item && item.id)
                      .map((item) => (
                        <ContentCard
                          key={item.id}
                          item={item}
                          showTags={false}
                          context="albums"
                          className="w-full"
                        />
                      ))}
                  </HorizontalScroll>
                ) : (
                  <div className="text-center py-8">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">
                      {isOwner
                        ? "You haven't generated any media yet."
                        : "This user hasn't generated any media yet."}
                    </p>
                  </div>
                )}
                <div className="text-center pt-4">
                  <LocaleLink href={`/profile/${displayName}/media`}>
                    <Button variant="outline" size="sm" className="text-xs">
                      View All Generated Medias
                    </Button>
                  </LocaleLink>
                </div>
              </CardContent>
            </Card>

            {/* Last Created Albums */}
            <Card
              className="border-border/50"
              hideBorder={isMobile}
              hideMargin={isMobile}
            >
              <CardHeader hidePadding={isMobile}>
                <div
                  className={cn("flex items-center gap-2", isMobile && "mb-4")}
                >
                  <FolderOpen className="w-5 h-5 text-green-500" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Last Created Albums
                  </h2>
                </div>
              </CardHeader>
              <CardContent hidePadding={isMobile}>
                {albumsLoading ? (
                  <HorizontalScroll
                    itemWidth="200px"
                    gap="medium"
                    showArrows={true}
                    className="w-full"
                  >
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="aspect-square bg-muted rounded-lg"></div>
                        <div className="mt-2 h-4 bg-muted rounded w-3/4"></div>
                      </div>
                    ))}
                  </HorizontalScroll>
                ) : albumsError ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">
                      {albumsError.message}
                    </p>
                  </div>
                ) : recentAlbums.length > 0 ? (
                  <HorizontalScroll
                    itemWidth="200px"
                    gap="medium"
                    showArrows={true}
                    className="w-full"
                  >
                    {recentAlbums
                      .filter((album) => album && album.id)
                      .map((album) => (
                        <ContentCard
                          key={album.id}
                          item={album}
                          canFullscreen={false}
                          canAddToAlbum={false}
                          showTags={false}
                          context="albums"
                          className="w-full"
                        />
                      ))}
                  </HorizontalScroll>
                ) : (
                  <div className="text-center py-8">
                    <FolderOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">
                      {isOwner
                        ? "You haven't created any albums yet."
                        : "This user hasn't created any albums yet."}
                    </p>
                  </div>
                )}
                <div className="text-center pt-4">
                  <LocaleLink href={`/profile/${displayName}/albums`}>
                    <Button variant="outline" size="sm" className="text-xs">
                      View All Albums
                    </Button>
                  </LocaleLink>
                </div>
              </CardContent>
            </Card>

            {/* Last Comments */}
            <Card
              className="border-border/50"
              hideBorder={isMobile}
              hideMargin={isMobile}
            >
              <CardHeader hidePadding={isMobile}>
                <div
                  className={cn("flex items-center gap-2", isMobile && "mb-4")}
                >
                  <Mail className="w-5 h-5 text-purple-500" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Last Comments
                  </h2>
                </div>
              </CardHeader>
              <CardContent hidePadding={isMobile}>
                <div className="space-y-3">
                  {commentsLoading ? (
                    // Loading state
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-3 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-muted rounded-full animate-pulse"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                              <div className="h-3 bg-muted rounded w-1/2 animate-pulse"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : commentsError ? (
                    <div className="text-center py-4 text-muted-foreground">
                      Failed to load comments
                    </div>
                  ) : recentComments.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No comments yet
                    </div>
                  ) : (
                    recentComments
                      .filter(
                        (comment) =>
                          comment &&
                          comment.id &&
                          comment.content &&
                          comment.targetType &&
                          comment.targetId
                      )
                      .slice(0, 3)
                      .map((comment) => (
                        <LocaleLink
                          key={comment.id}
                          href={
                            comment.targetType === "media"
                              ? `/media/${comment.targetId}`
                              : `/albums/${comment.targetId}`
                          }
                        >
                          <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                                {initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground">
                                  &ldquo;{comment.content}&rdquo;
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(
                                    new Date(comment.createdAt)
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </LocaleLink>
                      ))
                  )}
                  <div className="text-center pt-2">
                    <LocaleLink href={`/profile/${displayName}/comments`}>
                      <Button variant="outline" size="sm" className="text-xs">
                        View All Comments
                      </Button>
                    </LocaleLink>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
