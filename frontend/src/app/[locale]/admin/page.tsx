"use client";

import { useAdminContext } from "@/contexts/AdminContext";
import { useTranslations } from "next-intl";

export default function AdminDashboard() {
  const { user } = useAdminContext();
  const t = useTranslations("admin.dashboard");

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Section */}
      <div className="px-4 sm:px-0 py-4 sm:py-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          {t("welcomeBack", { username: user?.username || "" })}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t("manageGalleryContent")}
        </p>
      </div>
    </div>
  );
}
