"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useFollowing } from "@/hooks/queries/useUserQuery";
import { cn } from "@/lib/utils";
import { useDevice } from "@/contexts/DeviceContext";
import { useUserContext } from "@/contexts/UserContext";
import Avatar from "@/components/ui/Avatar";
import LocaleLink from "@/components/ui/LocaleLink";
import { MinimalUser } from "@/types";

export default function UserFollowingPage() {
  const { user } = useUserContext();
  const t = useTranslations("user.following");
  const tCommon = useTranslations("common");

  const { isMobile } = useDevice();

  // Use the TanStack Query hook to fetch following data
  const {
    data: followingData,
    isLoading: followingLoading,
    error: followingError,
    fetchNextPage,
    hasNextPage: hasNext,
    isFetchingNextPage: loadingMore,
  } = useFollowing({
    username: user?.username || "",
    limit: 20,
  });

  // Extract following users from paginated data
  const following = useMemo(() => {
    return followingData?.pages.flatMap((page) => page.following) || [];
  }, [followingData]);

  const loadMore = () => {
    if (hasNext && !loadingMore) {
      fetchNextPage();
    }
  };

  // Loading state
  if (followingLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl border border-admin-primary/20 shadow-lg p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted/50 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-muted/50 rounded w-1/2"></div>
          </div>
        </div>

        {/* Following list skeleton */}
        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="bg-card/80 backdrop-blur-sm rounded-xl border border-admin-primary/10 p-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-muted/50 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted/50 rounded w-1/3 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-muted/50 rounded w-1/2 animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (followingError) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl border border-admin-primary/20 shadow-lg p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("following")}
              </h1>
              <p className="text-muted-foreground">{t("usersYouFollow")}</p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-red-200 p-12 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg
              className="h-10 w-10 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-3">
            {tCommon("error")}
          </h3>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            {followingError?.message || "Failed to load following"}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-admin-primary to-admin-secondary hover:from-admin-primary/90 hover:to-admin-secondary/90 text-admin-primary-foreground shadow-lg"
          >
            {tCommon("refreshPage")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl border border-admin-primary/20 shadow-lg p-6">
        {/* Mobile Layout */}
        <div className="block sm:hidden space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {t("following")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("usersYouFollow")}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="bg-admin-primary/20 text-admin-primary text-sm font-semibold px-3 py-1.5 rounded-full">
              {t("count", {
                count: following.length,
                hasNextPage: hasNext ? 1 : 0,
              })}
            </span>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("following")}
              </h1>
              <p className="text-muted-foreground">{t("usersYouFollow")}</p>
            </div>
            <span className="bg-admin-primary/20 text-admin-primary text-sm font-semibold px-3 py-1.5 rounded-full">
              {t("count", {
                count: following.length,
                hasNextPage: hasNext ? 1 : 0,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Following list */}
      <Card
        className="border-admin-primary/10 shadow-lg"
        hideBorder={isMobile}
        hideMargin={isMobile}
      >
        <CardContent className={cn("p-0", !isMobile && "p-6")}>
          {following.length === 0 && !followingLoading ? (
            // Empty state
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-violet-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Users className="h-10 w-10 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("empty.title")}
              </h3>
              <p className="text-muted-foreground">{t("empty.description")}</p>
            </div>
          ) : (
            <div className="space-y-0">
              {following.map((followedUser: MinimalUser, index: number) => (
                <div
                  key={followedUser.userId || followedUser.username || index}
                  className={cn(
                    "flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors",
                    index !== following.length - 1 &&
                      "border-b border-border/50"
                  )}
                >
                  {/* User Avatar */}
                  <LocaleLink href={`/profile/${followedUser.username}`}>
                    <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shadow-md hover:scale-105 transition-transform cursor-pointer">
                      <Avatar user={followedUser} size="medium" />
                    </div>
                  </LocaleLink>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <LocaleLink
                      href={`/profile/${followedUser.username}`}
                      className="hover:underline"
                    >
                      <span className="font-semibold text-foreground truncate">
                        {followedUser.username}
                      </span>
                    </LocaleLink>
                  </div>
                </div>
              ))}

              {/* Load more button */}
              {hasNext && (
                <div className="flex justify-center p-4">
                  <Button
                    onClick={loadMore}
                    disabled={loadingMore}
                    variant="outline"
                    className="min-w-32"
                  >
                    {loadingMore ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {tCommon("loading")}
                      </div>
                    ) : (
                      tCommon("loadMore")
                    )}
                  </Button>
                </div>
              )}

              {/* No more results */}
              {!hasNext && following.length > 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    {t("loading.noMore")}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
