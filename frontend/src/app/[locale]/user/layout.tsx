"use client";

import { useEffect } from "react";
import { useLocaleRouter } from "@/lib/navigation";
import { useTranslations } from "next-intl";
import {
  Heart,
  Bookmark,
  Image,
  FolderOpen,
  User,
  Users,
  Coins,
} from "lucide-react";
import {
  Skeleton,
  HeaderSkeleton,
  GridSkeleton,
} from "@/components/ui/Skeleton";
import {
  PageErrorBoundary,
  SectionErrorBoundary,
} from "@/components/ErrorBoundaries";
import { DesktopNavigation } from "@/components/ui/DesktopNavigation";
import { useUserContext } from "@/contexts/UserContext";

interface UserLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

const UserLayout: React.FC<UserLayoutProps> = ({
  children,
  params: { locale },
}) => {
  const { user, loading } = useUserContext();
  const userContext = useUserContext();
  const router = useLocaleRouter();
  const t = useTranslations("navigation");

  // Redirect to login if not authenticated
  useEffect(() => {
    // Wait for both UserContext initialization and useUserProfile query to complete
    const isUserContextReady =
      !userContext?.initializing && !userContext?.loading;

    // Only redirect if both are ready and no user is found
    if (isUserContextReady && !user) {
      router.push(`/${locale}/auth/login`);
    }
  }, [
    user,
    loading,
    router,
    locale,
    userContext?.initializing,
    userContext?.loading,
  ]);

  // Show loading state while either UserContext is initializing or useUserProfile is loading
  if (loading || userContext?.initializing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Desktop Sidebar Skeleton - Hidden on mobile/tablet */}
            <aside className="hidden lg:block lg:w-64 flex-shrink-0">
              <nav className="md:bg-card/80 md:backdrop-blur-sm md:rounded-xl md:shadow-lg md:border md:border-admin-primary/10 p-4">
                <ul className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <li key={i}>
                      <div className="flex items-center space-x-3 px-3 py-2 rounded-lg">
                        <Skeleton className="h-5 w-5" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            {/* Main Content Skeleton */}
            <main className="flex-1 pb-20 lg:pb-0">
              <div className="space-y-6">
                <HeaderSkeleton />
                <GridSkeleton itemCount={8} itemType="card" />
              </div>
            </main>
          </div>
        </div>

        {/* Mobile/Tablet Sticky Footer Skeleton */}
        <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg lg:hidden z-40">
          <div className="flex items-center justify-around py-2 px-4 max-w-screen-sm mx-auto">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center space-y-1 py-2 px-1 min-w-0 flex-1"
              >
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-3 w-12 hidden md:block lg:hidden" />
              </div>
            ))}
          </div>
        </nav>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const navigationItems = [
    {
      href: `/user/profile`,
      label: t("profile"),
      icon: User,
    },
    {
      href: `/user/pornspotcoin`,
      label: t("pornspotcoin"),
      icon: Coins,
    },
    {
      href: `/user/following`,
      label: t("following"),
      icon: Users,
    },
    {
      href: `/user/likes`,
      label: t("likes"),
      icon: Heart,
    },
    {
      href: `/user/bookmarks`,
      label: t("bookmarks"),
      icon: Bookmark,
    },
    {
      href: `/user/medias`,
      label: t("medias"),
      icon: Image,
    },
    {
      href: `/user/albums`,
      label: t("albums"),
      icon: FolderOpen,
    },
  ];

  return (
    <PageErrorBoundary context={`User Layout (${locale})`}>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 md:py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Navigation */}
            <DesktopNavigation navigationItems={navigationItems} />

            {/* Main Content */}
            <SectionErrorBoundary context="User Main Content">
              <main className="flex-1">{children}</main>
            </SectionErrorBoundary>
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
};

export default UserLayout;
