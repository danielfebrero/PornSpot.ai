/**
 * Hook for using date utilities with translations
 */
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "@/lib/dateUtils";

export function useDateUtils() {
  const t = useTranslations("common.dateTime");

  const formatRelativeTime = (date: Date | string) => {
    return formatDistanceToNow(date, {
      justNow: t("justNow"),
      minutesAgo: t("minutesAgo"),
      hoursAgo: t("hoursAgo"),
      daysAgo: t("daysAgo"),
    });
  };

  return {
    formatRelativeTime,
  };
}
