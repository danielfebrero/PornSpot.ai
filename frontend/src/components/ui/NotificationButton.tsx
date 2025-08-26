"use client";

import { Bell } from "lucide-react";
import LocaleLink from "@/components/ui/LocaleLink";
import { cn } from "@/lib/utils";

interface NotificationButtonProps {
  count?: number;
  className?: string;
}

export function NotificationButton({
  count = 0,
  className,
}: NotificationButtonProps) {
  const hasNotifications = count > 0;

  return (
    <LocaleLink
      href="/user/notifications"
      className={cn(
        "relative flex items-center justify-center p-2 rounded-lg hover:bg-accent transition-colors",
        className
      )}
      aria-label={`Notifications${hasNotifications ? ` (${count})` : ""}`}
    >
      <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />

      {hasNotifications && (
        <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-background">
          {count > 99 ? "99+" : count}
        </div>
      )}
    </LocaleLink>
  );
}
