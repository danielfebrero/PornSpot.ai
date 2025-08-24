"use client";

import ProfileComponent from "@/components/profile/ProfileComponent";
import { useUserContext } from "@/contexts/UserContext";
import { useTranslations } from "next-intl";

export default function ProfilePage() {
  const { user, loading } = useUserContext();
  const t = useTranslations("user.profile");

  // No user state
  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {t("notAuthenticated")}
          </h2>
          <p className="text-muted-foreground mt-2">{t("pleaseLogin")}</p>
        </div>
      </div>
    );
  }

  return <ProfileComponent user={user} isOwner={true} loading={loading} />;
}
