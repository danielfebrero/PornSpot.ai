"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { UserPlanBadge } from "@/components/UserPlanBadge";
import LocaleLink from "@/components/ui/LocaleLink";
import { ContentCard } from "@/components/ui/ContentCard";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { Media } from "@/types";
import { useProfileData } from "@/hooks/useProfileData";
import { useAlbums } from "@/hooks/useAlbums";
import { useComments } from "@/hooks/useComments";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useUserInteractionStatus } from "@/hooks/useUserInteractionStatus";
import { useUser } from "@/hooks/useUser";
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

interface ProfileUser {
  userId: string;
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  createdAt: string;
  lastLoginAt?: string;
  lastActive?: string; // Last time user was seen active
  plan?: string;
  role?: string;
}

interface ProfileComponentProps {
  user: ProfileUser;
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
  const [currentUser, setCurrentUser] = useState<ProfileUser>(user);
  const [formData, setFormData] = useState({
    username: "",
    bio: "",
    location: "",
    website: "",
  });

  const t = useTranslations("common");
  const isMobile = useIsMobile();
  const { user: loggedInUser } = useUser();

  // Use the abstracted username availability hook
  const {
    usernameStatus,
    usernameMessage,
    checkUsernameAvailability,
    resetStatus: resetUsernameStatus,
  } = useUsernameAvailability();

  // Get real profile data
  const {
    recentLikes,
    loading: profileDataLoading,
    error: profileDataError,
  } = useProfileData({
    username: currentUser.username,
    isOwner,
    limit: 6, // Fetch 6 recent likes for the scrollable preview
  });

  // Preload interaction statuses for liked content
  const { preloadStatuses } = useUserInteractionStatus();

  // Effect to preload interaction statuses for liked content
  useEffect(() => {
    if (recentLikes.length > 0 && loggedInUser) {
      const targets = recentLikes.map((item) => ({
        targetType: item.type as "album" | "media",
        targetId: item.id,
      }));

      // Preload the current logged-in user's statuses for these items
      // This will show the actual like/bookmark status of the current viewer,
      // not the profile owner's status
      preloadStatuses(targets).catch(console.error);
    }
  }, [recentLikes, loggedInUser, preloadStatuses]);

  // Debounce username checking when form data changes
  useEffect(() => {
    if (!isEditing) return;

    const timeoutId = setTimeout(() => {
      if (formData.username) {
        checkUsernameAvailability(formData.username, currentUser.username);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    formData.username,
    checkUsernameAvailability,
    isEditing,
    currentUser.username,
  ]);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  // Get real comments data
  const {
    comments: recentComments,
    isLoading: commentsLoading,
    error: commentsError,
  } = useComments(currentUser.username || "", true, 3); // Fetch 6 recent comments for the profile preview

  // Get real recent albums
  const {
    albums: recentAlbums,
    loading: albumsLoading,
    error: albumsError,
  } = useAlbums({
    user: currentUser.username || "",
    isPublic: true,
    limit: 6, // Fetch 6 recent albums for the scrollable preview
  });

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
      username: currentUser.username || "",
      bio: currentUser.bio || "",
      location: currentUser.location || "",
      website: currentUser.website || "",
    });
    // Reset username status when starting to edit
    resetUsernameStatus();
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      console.log("Saving profile:", formData);

      // Check username availability before submission if username changed
      if (
        formData.username !== currentUser.username &&
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

      // Call the API to update the profile
      const result = await userApi.updateProfile(formData);

      if (result.success && result.data?.user) {
        console.log("Profile updated successfully:", result.data.user);

        // Update the current user state with the response data
        setCurrentUser({
          ...currentUser,
          username: result.data.user.username,
          bio: result.data.user.bio,
          location: result.data.user.location,
          website: result.data.user.website,
        });

        // Reset username status since we've successfully saved
        resetUsernameStatus();

        // Optionally show a success message or trigger a refresh
        // For now, we'll just log the success
      } else {
        console.error(
          "Profile update failed:",
          result.data?.message || "Unknown error"
        );
        // In a real app, you'd show an error message to the user
      }
    } catch (error) {
      console.error("Error updating profile:", error);
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSaving) {
      e.preventDefault();
      handleSave();
    }
  };

  const displayName = currentUser.username ?? "Anonymous";
  const initials = displayName.slice(0, 2).toUpperCase();

  // Mock data for content - in real app, this would be passed as props or fetched
  const mockData = {
    insights: {
      likesReceived: 1247,
      contentBookmarked: 89,
      totalMediaViews: 15632,
      profileViews: 324,
      totalUploads: 156,
      totalAlbums: 23,
    },
    recentGeneratedMedias: [
      {
        id: "media4",
        filename: "my-latest-shot.jpg",
        originalName: "My Latest Shot",
        mimeType: "image/jpeg",
        size: 3024000,
        width: 2560,
        height: 1440,
        url: "/media/media4/my-latest-shot.jpg",
        thumbnailUrls: {
          cover:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_cover.webp",
          small:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_small.webp",
          medium:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_medium.webp",
          large:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_large.webp",
          xlarge:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_xlarge.webp",
        },
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        likeCount: 23,
        viewCount: 87,
        title: "My Latest Shot",
      } as Media,
      {
        id: "media6",
        filename: "street-photography.jpg",
        originalName: "Street Photography",
        mimeType: "image/jpeg",
        size: 2256000,
        width: 1800,
        height: 1200,
        url: "/media/media6/street-photography.jpg",
        thumbnailUrls: {
          cover:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_cover.webp",
          small:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_small.webp",
          medium:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_medium.webp",
          large:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_large.webp",
          xlarge:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_xlarge.webp",
        },
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        likeCount: 67,
        viewCount: 145,
        title: "Street Photography",
      } as Media,
      {
        id: "media7",
        filename: "ai-generated-art.jpg",
        originalName: "AI Generated Art",
        mimeType: "image/jpeg",
        size: 1856000,
        width: 1600,
        height: 900,
        url: "/media/media7/ai-generated-art.jpg",
        thumbnailUrls: {
          cover:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_cover.webp",
          small:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_small.webp",
          medium:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_medium.webp",
          large:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_large.webp",
          xlarge:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_xlarge.webp",
        },
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
        updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        likeCount: 45,
        viewCount: 123,
        title: "AI Generated Art",
      } as Media,
      {
        id: "media8",
        filename: "nature-landscape.jpg",
        originalName: "Nature Landscape",
        mimeType: "image/jpeg",
        size: 2856000,
        width: 2400,
        height: 1350,
        url: "/media/media8/nature-landscape.jpg",
        thumbnailUrls: {
          cover:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_cover.webp",
          small:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_small.webp",
          medium:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_medium.webp",
          large:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_large.webp",
          xlarge:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_xlarge.webp",
        },
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        likeCount: 89,
        viewCount: 234,
        title: "Nature Landscape",
      } as Media,
      {
        id: "media9",
        filename: "portrait-studio.jpg",
        originalName: "Portrait Studio",
        mimeType: "image/jpeg",
        size: 2456000,
        width: 1920,
        height: 1280,
        url: "/media/media9/portrait-studio.jpg",
        thumbnailUrls: {
          cover:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_cover.webp",
          small:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_small.webp",
          medium:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_medium.webp",
          large:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_large.webp",
          xlarge:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_xlarge.webp",
        },
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
        updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        likeCount: 134,
        viewCount: 378,
        title: "Portrait Studio",
      } as Media,
      {
        id: "media10",
        filename: "macro-flowers.jpg",
        originalName: "Macro Flowers",
        mimeType: "image/jpeg",
        size: 1956000,
        width: 1600,
        height: 1200,
        url: "/media/media10/macro-flowers.jpg",
        thumbnailUrls: {
          cover:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_cover.webp",
          small:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_small.webp",
          medium:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_medium.webp",
          large:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_large.webp",
          xlarge:
            "/albums/57cbfb3a-178d-47be-996f-286ee0917ca3/cover/thumbnails/cover_thumb_xlarge.webp",
        },
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        likeCount: 76,
        viewCount: 198,
        title: "Macro Flowers",
      } as Media,
    ],
    recentComments: [
      {
        id: "comment1",
        content: "Amazing composition and lighting!",
        contentTitle: "Sunset Beach",
        timestamp: "5 hours ago",
        targetType: "media",
        targetId: "media1",
      },
      {
        id: "comment2",
        content: "Love the colors in this series.",
        contentTitle: "Abstract Art",
        timestamp: "1 day ago",
        targetType: "album",
        targetId: "album2",
      },
      {
        id: "comment3",
        content: "Great perspective on urban life.",
        contentTitle: "City Streets",
        timestamp: "2 days ago",
        targetType: "media",
        targetId: "media3",
      },
    ],
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
                <div className="relative inline-block w-fit">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl sm:text-3xl font-bold shadow-lg">
                    {initials}
                  </div>
                  {isOwner && isEditing && (
                    <button className="absolute -top-1 -right-1 w-8 h-8 bg-background text-foreground border-2 border-primary rounded-full flex items-center justify-center hover:bg-muted transition-colors shadow-lg z-10">
                      <Camera className="w-4 h-4" />
                    </button>
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
                              label="Username"
                              value={formData.username}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  username: e.target.value,
                                }))
                              }
                              onKeyDown={handleKeyDown}
                              placeholder="Enter username"
                              className="text-lg font-semibold"
                            />

                            {/* Username availability indicator */}
                            {formData.username &&
                              formData.username.length >= 3 &&
                              formData.username !== currentUser.username && (
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
                              formData.username !== currentUser.username && (
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
                            label="Bio"
                            value={formData.bio}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                bio: e.target.value,
                              }))
                            }
                            onKeyDown={handleKeyDown}
                            placeholder="Tell us about yourself"
                            className="text-sm"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                              label="Location"
                              value={formData.location}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  location: e.target.value,
                                }))
                              }
                              onKeyDown={handleKeyDown}
                              placeholder="City, Country"
                              className="text-sm"
                            />
                            <Input
                              label="Website"
                              value={formData.website}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  website: e.target.value,
                                }))
                              }
                              onKeyDown={handleKeyDown}
                              placeholder="https://yoursite.com"
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
                            <UserPlanBadge />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span>
                                Joined{" "}
                                {new Date(
                                  currentUser.createdAt
                                ).toLocaleDateString()}
                              </span>
                            </div>

                            {currentUser.lastActive && (
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
                              {currentUser.location && (
                                <div className="flex items-center gap-2 text-sm">
                                  <MapPin className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-foreground">
                                    {currentUser.location}
                                  </span>
                                </div>
                              )}

                              {/* Website - only show if user has website */}
                              {currentUser.website && (
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
                                {currentUser.bio ? (
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
                                usernameStatus === "checking" ||
                                usernameStatus === "taken"
                              }
                            >
                              <Save className="w-4 h-4" />
                              {isSaving
                                ? "Saving..."
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
                              disabled={isSaving}
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
                value: mockData.insights.likesReceived,
                color: "text-red-600",
              },
              {
                icon: Bookmark,
                label: "Content Bookmarked",
                value: mockData.insights.contentBookmarked,
                color: "text-purple-600",
              },
              {
                icon: Eye,
                label: "Total Media Views",
                value: mockData.insights.totalMediaViews,
                color: "text-blue-600",
              },
              {
                icon: User,
                label: "Profile Views",
                value: mockData.insights.profileViews,
                color: "text-green-600",
              },
              {
                icon: ImageIcon,
                label: "Total Uploads",
                value: mockData.insights.totalUploads,
                color: "text-orange-600",
              },
              {
                icon: FolderOpen,
                label: "Total Albums",
                value: mockData.insights.totalAlbums,
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
                      {profileDataError}
                    </p>
                  </div>
                ) : recentLikes.length > 0 ? (
                  <HorizontalScroll
                    itemWidth="200px"
                    gap="medium"
                    showArrows={true}
                    className="w-full"
                  >
                    {recentLikes.map((item) => (
                      <ContentCard
                        key={item.id}
                        item={item}
                        type={"filename" in item ? "media" : "album"}
                        showTags={false}
                        context="albums"
                        columns={1}
                        className="w-full"
                        canAddToAlbum={item.type !== "album"} // Disable for albums
                        canFullscreen={item.type !== "album"} // Disable for albums
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
                <HorizontalScroll
                  itemWidth="200px"
                  gap="medium"
                  showArrows={true}
                  className="w-full"
                >
                  {mockData.recentGeneratedMedias.map((item) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      type={"filename" in item ? "media" : "album"}
                      showTags={false}
                      context="albums"
                      columns={1}
                      className="w-full"
                    />
                  ))}
                </HorizontalScroll>
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
                      {albumsError}
                    </p>
                  </div>
                ) : recentAlbums.length > 0 ? (
                  <HorizontalScroll
                    itemWidth="200px"
                    gap="medium"
                    showArrows={true}
                    className="w-full"
                  >
                    {recentAlbums.map((album) => (
                      <ContentCard
                        key={album.id}
                        item={album}
                        type="album"
                        canFullscreen={false}
                        canAddToAlbum={false}
                        showTags={false}
                        context="albums"
                        columns={1}
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
                    recentComments.slice(0, 3).map((comment) => (
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
