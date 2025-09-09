"use client";

import { useTranslations } from "next-intl";
import Head from "next/head";
import ProfileComponent from "@/components/profile/ProfileComponent";
import { useUserContext } from "@/contexts/UserContext";

export default function ProfilePage() {
  const { user, loading } = useUserContext();
  const t = useTranslations("user.profile");

  // No user state
  if (!user && !loading) {
    return (
      <>
        <Head>
          <title>{t("meta.title")}</title>
          <meta name="description" content={t("meta.description")} />
        </Head>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">
              {t("notAuthenticated")}
            </h2>
            <p className="text-muted-foreground mt-2">{t("pleaseLogin")}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{t("meta.title")}</title>
        <meta name="description" content={t("meta.description")} />
      </Head>
      <ProfileComponent user={user} isOwner={true} loading={loading} />
    </>
  );
}
