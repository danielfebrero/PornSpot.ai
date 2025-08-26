"use client";

import { useState, useMemo, useEffect } from "react";
import { RichTagsFunction, useTranslations } from "next-intl";
import {
  Bell,
  Clock,
  Heart,
  MessageCircle,
  Bookmark,
  Loader2,
} from "lucide-react";
import { useNotifications } from "@/hooks/queries/useUserQuery";
import { useDateUtils } from "@/hooks/useDateUtils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import LocaleLink from "@/components/ui/LocaleLink";
import type {
  NotificationWithDetails,
  UnifiedNotificationsResponse,
} from "@/types";

// Notification icon mapping
const getNotificationIcon = (type: string) => {
  switch (type) {
    case "like":
      return <Heart className="h-4 w-4 text-red-500" />;
    case "comment":
      return <MessageCircle className="h-4 w-4 text-blue-500" />;
    case "bookmark":
      return <Bookmark className="h-4 w-4 text-yellow-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
};

// Notification item component
interface NotificationItemProps {
  notification: NotificationWithDetails;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
}) => {
  const t = useTranslations("user.notifications");
  const { formatRelativeTime } = useDateUtils();

  const isUnread = notification.status === "unread";
  const icon = getNotificationIcon(notification.notificationType);

  // Format time ago using useDateUtils hook
  const timeAgo = formatRelativeTime(notification.createdAt);

  // Generate notification message and links
  const getNotificationContent = () => {
    const {
      notificationType,
      sourceUsername,
      targetType,
      targetId,
      targetTitle,
      commentTargetType,
      commentTargetId,
    } = notification;

    const username = sourceUsername || t("unknownUser");
    let typeKey = targetType;
    let contentHref = "";
    const userHref = `/user/${sourceUsername}`;

    // Determine content link
    switch (notificationType) {
      case "like":
      case "bookmark":
        contentHref =
          targetType === "album" ? `/albums/${targetId}` : `/media/${targetId}`;
        break;
      case "comment":
        if (commentTargetType && commentTargetId) {
          contentHref =
            commentTargetType === "album"
              ? `/albums/${commentTargetId}`
              : `/media/${commentTargetId}`;
          typeKey = commentTargetType;
        } else {
          contentHref =
            targetType === "album"
              ? `/albums/${targetId}`
              : `/media/${targetId}`;
        }
        break;
    }

    // Determine the translation key based on whether we have a title
    const messageKey = targetTitle
      ? notificationType
      : `${notificationType}NoTitle`;

    return {
      username,
      typeKey,
      contentHref,
      userHref,
      messageKey,
      targetTitle,
    };
  };

  const { username, typeKey, contentHref, userHref, messageKey, targetTitle } =
    getNotificationContent();

  const typeText = t(`types.${typeKey}`);

  // Create the notification message using rich format
  const messageContent: Record<
    string,
    string | number | Date | RichTagsFunction
  > = {
    username,
    type: typeText,
    userLink: (chunks) => (
      <LocaleLink
        href={userHref}
        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
      >
        {chunks}
      </LocaleLink>
    ),
    contentLink: (chunks) => (
      <LocaleLink
        href={contentHref}
        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
      >
        {chunks}
      </LocaleLink>
    ),
  };

  // Add title only if it exists
  if (targetTitle) {
    messageContent.title = targetTitle;
  }

  return (
    <div
      className={`group transition-all duration-200 ${
        isUnread
          ? "bg-blue-50/80 hover:bg-blue-100/80 border-l-4 border-l-blue-500"
          : "bg-card hover:bg-accent/50"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Notification Icon */}
        <div
          className={`flex-shrink-0 p-2 rounded-full ${
            isUnread ? "bg-blue-100" : "bg-muted"
          }`}
        >
          {icon}
        </div>

        {/* Notification Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {/* Notification message with clickable elements using rich format */}
              <p
                className={`text-sm ${
                  isUnread
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {t.rich(messageKey, {
                  ...messageContent,
                  userLink: (chunks) => (
                    <LocaleLink
                      href={userHref}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {chunks}
                    </LocaleLink>
                  ),
                  contentLink: (chunks) => (
                    <LocaleLink
                      href={contentHref}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {chunks}
                    </LocaleLink>
                  ),
                })}
              </p>
            </div>

            {/* Status and Time */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {isUnread && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Loading skeleton for notifications
const NotificationSkeleton: React.FC = () => (
  <div className="flex items-start gap-3 p-4 bg-card">
    <Skeleton className="w-10 h-10 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
    <Skeleton className="w-8 h-3" />
  </div>
);

/**
 * UserNotificationsPage - Displays user's notifications with infinite scroll
 *
 * Features:
 * - ✅ Infinite scroll with automatic loading when reaching bottom
 * - ✅ Unread/read status differentiation
 * - ✅ Responsive design for mobile and desktop
 * - ✅ Automatic read marking when fetched
 * - ✅ Stylish notification items with icons
 * - ✅ Real-time relative timestamps
 * - ✅ Internationalization support
 */
const UserNotificationsPage: React.FC = () => {
  const t = useTranslations("user.notifications");
  const tCommon = useTranslations("common");

  const [limit] = useState(20);

  // Fetch notifications with automatic read marking
  const {
    data: notificationsData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications({ limit });

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver({
    enabled: hasNextPage && !isFetchingNextPage,
    rootMargin: "100px", // Trigger 100px before reaching the bottom
  });

  // Trigger fetchNextPage when intersection observer detects the sentinel
  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Extract notifications from response
  const notifications = useMemo(() => {
    return (
      notificationsData?.pages.flatMap(
        (page: UnifiedNotificationsResponse) => page?.notifications || []
      ) || []
    );
  }, [notificationsData]);

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {t("error.title")}
            </h2>
            <p className="text-muted-foreground mb-4">{t("error.message")}</p>
            <Button onClick={() => window.location.reload()}>
              {tCommon("retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Bell className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {t("title")}
              </h1>
              <p className="text-muted-foreground">{t("description")}</p>
            </div>
          </div>

          {notifications.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t("count", { count: notifications.length })}
              </p>
            </div>
          )}
        </div>

        {/* Notifications List */}
        <div className="space-y-1">
          {/* Loading state */}
          {isLoading && (
            <div className="space-y-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <NotificationSkeleton key={index} />
              ))}
            </div>
          )}

          {/* Notifications */}
          {notifications.map((notification, index) => (
            <NotificationItem
              key={`${notification.notificationId}-${index}`}
              notification={notification}
            />
          ))}

          {/* Load more trigger (infinite scroll sentinel) */}
          {hasNextPage && (
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t("loadingMore")}</span>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && notifications.length === 0 && (
            <div className="text-center py-12">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4">
                <Bell className="h-8 w-8 text-muted-foreground mx-auto" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {t("empty.title")}
              </h2>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                {t("empty.description")}
              </p>
              <LocaleLink href="/discover">
                <Button variant="outline">{tCommon("discover")}</Button>
              </LocaleLink>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserNotificationsPage;
