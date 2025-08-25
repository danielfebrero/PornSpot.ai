"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import ProfileComponent from "@/components/profile/ProfileComponent";
import { usePublicProfile } from "@/hooks/queries/useUserQuery";
import { ViewTracker } from "@/components/ui/ViewTracker";
import { useUserContext } from "@/contexts/UserContext";

export default function PublicProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const t = useTranslations("user.profile.public");

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
            {t("authRequired.title")}
          </h2>
          <p className="text-muted-foreground mt-2">
            {t("authRequired.message")}
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
            {t("notFound.title")}
          </h2>
          <p className="text-muted-foreground mt-2">{t("notFound.message")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Track profile view when profile is successfully loaded */}
      {profileUser && <ViewTracker targetType="profile" targetId={username} />}
      <ProfileComponent
        user={profileUser || null}
        isOwner={false}
        loading={loading}
      />
    </>
  );
}
