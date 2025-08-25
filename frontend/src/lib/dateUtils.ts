/**
 * Date utility functions for formatting dates and time distances
 */

interface DateTimeTranslations {
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  daysAgo: string;
}

/**
 * Format a date string to a relative time display (e.g., "2h ago", "3d ago")
 */
export function formatDistanceToNow(
  date: Date | string,
  t?: DateTimeTranslations
): string {
  const now = new Date();
  const dateObj = new Date(date);
  const diffInMs = now.getTime() - dateObj.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) {
    return t?.justNow ?? "just now";
  } else if (diffInMinutes < 60) {
    return (
      t?.minutesAgo.replace("{count}", diffInMinutes.toString()) ??
      `${diffInMinutes}m ago`
    );
  } else if (diffInHours < 24) {
    return (
      t?.hoursAgo.replace("{count}", diffInHours.toString()) ??
      `${diffInHours}h ago`
    );
  } else if (diffInDays < 7) {
    return (
      t?.daysAgo.replace("{count}", diffInDays.toString()) ??
      `${diffInDays}d ago`
    );
  } else {
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: dateObj.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

/**
 * Format a date to a readable format (January 1, 2024)
 */
export function formatDate(date: Date | string): string {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a date with time (January 1, 2024 at 3:30 PM)
 */
export function formatDateTime(date: Date | string): string {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
