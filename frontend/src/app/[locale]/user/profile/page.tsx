"use client";

import { useUser } from "@/hooks/useUser";
import ProfileComponent from "@/components/profile/ProfileComponent";

export default function ProfilePage() {
  const { user, loading } = useUser();

  // No user state
  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Not authenticated
          </h2>
          <p className="text-muted-foreground mt-2">
            Please log in to view your profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProfileComponent
      user={
        user || {
          userId: "",
          createdAt: new Date().toISOString(),
        }
      }
      isOwner={true}
      loading={loading}
    />
  );
}
