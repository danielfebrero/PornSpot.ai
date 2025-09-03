"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import LocaleLink from "@/components/ui/LocaleLink";
import { useFollowers } from "@/hooks/queries/useUserQuery";
import { cn } from "@/lib/utils";
import { useDevice } from "@/contexts/DeviceContext";
import { useGetMinimalUser } from "@/hooks/queries/useUserQuery";
import Avatar from "@/components/ui/Avatar";
import { MinimalUser } from "@/types";

export default function UserFollowersPage() {
  const params = useParams();
  const username = params.username as string;
  const t = useTranslations("profile.followers");
  const tCommon = useTranslations("common");

  const { isMobile } = useDevice();

  // Use the TanStack Query hook to fetch followers data
  const {
    data: followersData,
    isLoading: followersLoading,
    error: followersError,
    fetchNextPage,
    hasNextPage: hasNext,
    isFetchingNextPage: loadingMore,
  } = useFollowers({
    username,
    limit: 20,
  });

  const { data: userData } = useGetMinimalUser({ username });

  // Extract followers from paginated data
  const followers = useMemo(() => {
    return followersData?.pages.flatMap((page) => page.followers) || [];
  }, [followersData]);

  const loadMore = () => {
    if (hasNext && !loadingMore) {
      fetchNextPage();
    }
  };

  const displayName = username;
  const initials = displayName.slice(0, 2).toUpperCase();

  // Loading state
  if (followersLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto md:px-4 sm:px-6 lg:px-8 md:py-8">
          <div className="animate-pulse space-y-6">
            {/* Header skeleton */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-6 bg-muted rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            </div>

            {/* Followers list skeleton */}
            <div className="space-y-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-xl border border-border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-muted rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (followersError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {tCommon("error")}
          </h2>
          <p className="text-muted-foreground mt-2">
            {followersError?.message || "Failed to load followers"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto md:px-4 sm:px-6 lg:px-8 md:py-8">
        <div className="space-y-6">
          {/* Header */}
          <Card
            className="border-border/50 shadow-lg"
            hideBorder={isMobile}
            hideMargin={isMobile}
          >
            <CardHeader className={cn("pb-4", isMobile && "p-0")}>
              {isMobile ? (
                // Mobile layout - simplified design
                <div className="flex items-center gap-3">
                  <LocaleLink href={`/profile/${displayName}`}>
                    <Button variant="ghost" size="sm" className="p-2">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  </LocaleLink>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary shrink-0" />
                    <h1 className="text-lg font-bold text-foreground">
                      {t("title", { username: displayName })}
                    </h1>
                  </div>
                </div>
              ) : (
                // Desktop layout - original horizontal design
                <div className="flex items-center gap-4">
                  {/* Back button */}
                  <LocaleLink href={`/profile/${displayName}`}>
                    <Button variant="ghost" size="sm" className="p-2">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  </LocaleLink>

                  {/* User avatar and info */}
                  <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                    {userData ? (
                      <Avatar user={userData} size="medium" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      <h1 className="text-2xl font-bold text-foreground">
                        {t("title", { username: displayName })}
                      </h1>
                    </div>
                    <p className="text-muted-foreground">
                      {t("count", {
                        count: followers.length,
                        hasNextPage: hasNext ? 1 : 0,
                      })}
                    </p>
                  </div>
                </div>
              )}
            </CardHeader>
          </Card>

          {/* Followers list */}
          <Card
            className="border-border/50"
            hideBorder={isMobile}
            hideMargin={isMobile}
          >
            <CardContent className={cn("p-0", !isMobile && "p-6")}>
              {followers.length === 0 && !followersLoading ? (
                // Empty state
                <div className="text-center py-12">
                  <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {t("empty.title")}
                  </h3>
                  <p className="text-muted-foreground">
                    {t("empty.description", { username: displayName })}
                  </p>
                </div>
              ) : (
                <div className="space-y-0">
                  {followers.map((follower: MinimalUser, index: number) => (
                    <div
                      key={follower.userId || follower.username || index}
                      className={cn(
                        "flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors",
                        index !== followers.length - 1 &&
                          "border-b border-border/50"
                      )}
                    >
                      {/* User Avatar */}
                      <LocaleLink href={`/profile/${follower.username}`}>
                        <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shadow-md hover:scale-105 transition-transform cursor-pointer">
                          <Avatar user={follower} size="medium" />
                        </div>
                      </LocaleLink>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <LocaleLink
                          href={`/profile/${follower.username}`}
                          className="hover:underline"
                        >
                          <span className="font-semibold text-foreground truncate">
                            {follower.username}
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
                  {!hasNext && followers.length > 0 && (
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
      </div>
    </div>
  );
}
