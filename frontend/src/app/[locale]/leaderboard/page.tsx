"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Trophy, Medal, Crown, Loader2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import LocaleLink from "@/components/ui/LocaleLink";
import { useDocumentHeadAndMeta } from "@/hooks/useDocumentHeadAndMeta";
import { useDevice } from "@/contexts/DeviceContext";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { cn } from "@/lib/utils";
import type { LeaderboardUserEntry } from "@/types";
import {
  useLeaderboard,
  getAllLeaderboardUsers,
} from "@/hooks/queries/useLeaderboardQuery";

export default function LeaderboardPage() {
  const t = useTranslations("leaderboard");
  const { isMobileInterface } = useDevice();

  // Set document title and meta description
  useDocumentHeadAndMeta(t("meta.title"), t("meta.description"));

  // Fetch leaderboard data with infinite scroll
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useLeaderboard({ limit: 50 });

  // Get all users from all pages
  const users = getAllLeaderboardUsers(data);

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver({
    enabled: hasNextPage && !isFetchingNextPage,
    rootMargin: "200px", // Trigger 200px before reaching the bottom
  });

  // Trigger fetchNextPage when intersection observer detects the sentinel
  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Get trophy/medal icon based on rank
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-4 h-4 md:w-8 md:h-8 text-yellow-500" />;
      case 2:
        return <Medal className="w-4 h-4 md:w-8 md:h-8 text-gray-400" />;
      case 3:
        return <Medal className="w-4 h-4 md:w-8 md:h-8 text-amber-600" />;
      default:
        return null;
    }
  };

  // Get rank styling
  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border-yellow-500/50";
      case 2:
        return "bg-gradient-to-br from-gray-400/20 to-gray-500/20 border-gray-400/50";
      case 3:
        return "bg-gradient-to-br from-amber-600/20 to-orange-500/20 border-amber-600/50";
      default:
        return "bg-card border-border/50";
    }
  };

  // Format score with commas
  const formatScore = (score: number) => {
    return new Intl.NumberFormat().format(Math.floor(score));
  };

  // Loading state
  if (isLoading && !users.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t("loading")}</p>
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
            {t("error.title")}
          </h2>
          <p className="text-muted-foreground mt-2">{t("error.message")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Crown className="w-8 h-8 md:w-10 md:h-10 text-yellow-500" />
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 bg-clip-text text-transparent">
              {t("title")}
            </h1>
          </div>
          <p className="text-muted-foreground text-sm md:text-base">
            {t("subtitle")}
          </p>
        </div>

        {/* Top 3 Podium - Desktop Only */}
        {!isMobileInterface && users.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 mb-8 items-end">
            {/* Second Place */}
            {users[1] && (
              <div className="relative">
                <div className="bg-gradient-to-br from-gray-400/20 to-gray-500/20 border-2 border-gray-400/50 rounded-xl p-4 text-center">
                  <div className="flex justify-center mb-3">
                    <Medal className="w-12 h-12 text-gray-400" />
                  </div>
                  <LocaleLink href={`/profile/${users[1].username}`}>
                    <div className="mb-3">
                      <Avatar
                        user={users[1]}
                        size="custom"
                        customSizeClasses="w-16 h-16 mx-auto"
                        customTextClasses="text-xl"
                      />
                    </div>
                    <p className="font-semibold text-foreground truncate mb-1">
                      {users[1].username || "Anonymous"}
                    </p>
                  </LocaleLink>
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <span className="font-mono">
                      {formatScore(users[1].score)}
                    </span>
                  </div>
                </div>
                <div className="bg-gray-400/20 h-20 rounded-b-lg mt-2"></div>
              </div>
            )}

            {/* First Place */}
            {users[0] && (
              <div className="relative">
                <div className="bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border-2 border-yellow-500/50 rounded-xl p-6 text-center shadow-lg shadow-yellow-500/20">
                  <div className="flex justify-center mb-3">
                    <Trophy className="w-16 h-16 text-yellow-500 animate-pulse" />
                  </div>
                  <LocaleLink href={`/profile/${users[0].username}`}>
                    <div className="mb-3">
                      <Avatar
                        user={users[0]}
                        size="custom"
                        customSizeClasses="w-20 h-20 mx-auto ring-4 ring-yellow-500/50"
                        customTextClasses="text-2xl"
                      />
                    </div>
                    <p className="font-bold text-lg text-foreground truncate mb-2">
                      {users[0].username || "Anonymous"}
                    </p>
                  </LocaleLink>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <span className="font-mono text-lg font-semibold">
                      {formatScore(users[0].score)}
                    </span>
                  </div>
                </div>
                <div className="bg-yellow-500/20 h-32 rounded-b-lg mt-2"></div>
              </div>
            )}

            {/* Third Place */}
            {users[2] && (
              <div className="relative">
                <div className="bg-gradient-to-br from-amber-600/20 to-orange-500/20 border-2 border-amber-600/50 rounded-xl p-4 text-center">
                  <div className="flex justify-center mb-3">
                    <Medal className="w-12 h-12 text-amber-600" />
                  </div>
                  <LocaleLink href={`/profile/${users[2].username}`}>
                    <div className="mb-3">
                      <Avatar
                        user={users[2]}
                        size="custom"
                        customSizeClasses="w-16 h-16 mx-auto"
                        customTextClasses="text-xl"
                      />
                    </div>
                    <p className="font-semibold text-foreground truncate mb-1">
                      {users[2].username || "Anonymous"}
                    </p>
                  </LocaleLink>
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <span className="font-mono">
                      {formatScore(users[2].score)}
                    </span>
                  </div>
                </div>
                <div className="bg-amber-600/20 h-16 rounded-b-lg mt-2"></div>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard List */}
        <div
          className={cn(
            isMobileInterface
              ? ""
              : "border border-border/50 shadow-lg rounded-lg"
          )}
        >
          <div className={cn(isMobileInterface ? "" : "p-0")}>
            <div className="divide-y divide-border/50">
              {users.map((user: LeaderboardUserEntry) => (
                <div
                  key={user.userId}
                  className={cn(
                    "flex items-center gap-3 md:gap-4 p-3 md:p-4 hover:bg-muted/50 transition-colors",
                    getRankStyle(user.rank)
                  )}
                >
                  {/* Rank */}
                  <div className="flex items-center justify-center min-w-[2rem] md:min-w-[4rem]">
                    {getRankIcon(user.rank) || (
                      <span className="text-sm md:text-xl font-bold text-muted-foreground">
                        #{user.rank}
                      </span>
                    )}
                  </div>

                  {/* User Info */}
                  <LocaleLink
                    href={`/profile/${user.username}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <Avatar
                      user={user}
                      size={isMobileInterface ? "small" : "medium"}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {user.username || "Anonymous"}
                      </p>
                      {user.rank <= 3 && (
                        <p className="text-xs text-muted-foreground">
                          {user.rank === 1 && t("rank.champion")}
                          {user.rank === 2 && t("rank.runner_up")}
                          {user.rank === 3 && t("rank.third_place")}
                        </p>
                      )}
                    </div>
                  </LocaleLink>

                  {/* Score */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full">
                      <span className="font-mono font-semibold text-sm md:text-base text-foreground">
                        {formatScore(user.score)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Infinite scroll sentinel - triggers loading when visible */}
            {hasNextPage && (
              <div ref={loadMoreRef} className="p-4 border-t border-border/50">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">{t("loadingMore")}</span>
                </div>
              </div>
            )}

            {/* Show loading indicator when fetching but not at the sentinel */}
            {isFetchingNextPage && !hasNextPage && (
              <div className="p-4 border-t border-border/50">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">{t("loadingMore")}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Empty State */}
        {!isLoading && users.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t("empty.title")}
            </h3>
            <p className="text-muted-foreground">{t("empty.description")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
