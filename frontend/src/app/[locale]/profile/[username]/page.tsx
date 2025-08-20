"use client";

import { useParams } from "next/navigation";
import ProfileComponent from "@/components/profile/ProfileComponent";
import { usePublicProfile } from "@/hooks/queries/useUserQuery";
import { ViewTracker } from "@/components/ui/ViewTracker";
import { useUserContext } from "@/contexts/UserContext";

export default function PublicProfilePage() {
  const params = useParams();
  const username = params.username as string;

  // Get current user authentication status
  const { user, loading: authLoading } = useUserContext();
  const currentUser = user;

  // Fetch public profile data using TanStack Query
  const {
    data: profileData,
    isLoading: loading,
    error,
  } = usePublicProfile(username);

  const profileUser = profileData;

  // Authentication check: require user to be logged in to view any profile
  if (!currentUser && !authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Authentication Required
          </h2>
          <p className="text-muted-foreground mt-2">
            You must be logged in to view this profile.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Profile not found
          </h2>
          <p className="text-muted-foreground mt-2">
            The user profile you&apos;re looking for doesn&apos;t exist or has
            been made private.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Track profile view when profile is successfully loaded */}
      {profileUser && <ViewTracker targetType="profile" targetId={username} />}
      <ProfileComponent
        user={
          profileUser || {
            userId: "",
            createdAt: new Date().toISOString(),
          }
        }
        isOwner={false}
        loading={loading}
      />
    </>
  );
}
