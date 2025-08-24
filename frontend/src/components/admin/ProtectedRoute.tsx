"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLocaleRouter } from "@/lib/navigation";
import { useAdminContext } from "../../contexts/AdminContext";
import { useUserContext } from "@/contexts/UserContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAdminContext();
  const userContext = useUserContext();
  const router = useLocaleRouter();
  const t = useTranslations("common");

  useEffect(() => {
    if (
      !loading &&
      !user &&
      !userContext?.initializing &&
      !userContext?.loading
    ) {
      router.push("/auth/login?returnTo=/admin");
    }
  }, [user, loading, router, userContext?.initializing, userContext?.loading]);

  // Show loading spinner while checking authentication
  if (loading || userContext?.initializing || userContext?.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  // Don't render children if user is not authenticated
  if (!user) {
    return null;
  }

  return <>{children}</>;
}
