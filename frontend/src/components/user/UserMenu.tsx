"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLogout } from "@/hooks/queries/useUserQuery";
import { useAdminContext } from "@/contexts/AdminContext";
import { useLocaleRouter } from "@/lib/navigation";
import { User } from "@/types";
import { UserPlanBadge } from "@/components/UserPlanBadge";
import Avatar from "@/components/ui/Avatar";
import { DollarSign, Gift, Trophy } from "lucide-react";
import LocaleLink from "../ui/LocaleLink";

interface UserMenuProps {
  user: User;
}

export function UserMenu({ user }: UserMenuProps) {
  const logoutMutation = useLogout();
  const { user: adminUser } = useAdminContext();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useLocaleRouter();

  const loading = logoutMutation.isPending;

  const t = useTranslations("common");
  const tProfile = useTranslations("user.profile");
  const tNav = useTranslations("navigation");

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      setIsOpen(false);
      router.push("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleMenuItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const displayName = user.username || user.email.split("@")[0];

  return (
    <div className="relative" ref={menuRef}>
      {/* User Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-accent transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Avatar user={user} size="small" />
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-foreground">
            {displayName}
          </div>
          {!user.isEmailVerified && (
            <div className="text-xs text-yellow-600 dark:text-yellow-400">
              {tProfile("unverified")}
            </div>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-50">
          <LocaleLink
            href="/user/profile"
            className="block p-4 border-b border-border"
            onClick={() => setIsOpen(false)}
          >
            <div className="flex items-center space-x-3">
              <Avatar user={user} size="small" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {displayName}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {user.email}
                </div>
                <div className="mt-2">
                  <UserPlanBadge plan={user.planInfo.plan} />
                </div>
                {!user.isEmailVerified && (
                  <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    {tProfile("emailNotVerified")}
                  </div>
                )}
              </div>
            </div>
          </LocaleLink>

          <div className="p-2">
            {/* Mobile Navigation Items - Only show on mobile */}
            <div className="md:hidden">
              <button
                onClick={() =>
                  handleMenuItemClick(() => router.push("/pricing"))
                }
                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4" />
                  <span>{t("pricing")}</span>
                </div>
              </button>
            </div>

            <button
              onClick={() =>
                handleMenuItemClick(() => router.push("/user/profile"))
              }
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span>{tProfile("profile")}</span>
              </div>
            </button>

            <button
              onClick={() =>
                handleMenuItemClick(() => router.push("/user/rewards"))
              }
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Gift className="w-4 h-4" />
                <span>{tNav("rewards")}</span>
              </div>
            </button>

            <button
              onClick={() =>
                handleMenuItemClick(() => router.push("/user/pornspotcoin"))
              }
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{t("pornspotcoin")}</span>
              </div>
            </button>

            {/* Inserted: Likes, Bookmarks, Albums navigation moved from Mobile nav */}
            <button
              onClick={() =>
                handleMenuItemClick(() => router.push("/user/likes"))
              }
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                <span>{t("likes")}</span>
              </div>
            </button>
            <button
              onClick={() =>
                handleMenuItemClick(() => router.push("/user/bookmarks"))
              }
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5v16l7-5 7 5V5a2 2 0 00-2-2H7a2 2 0 00-2 2z"
                  />
                </svg>
                <span>{t("bookmarks")}</span>
              </div>
            </button>
            <button
              onClick={() =>
                handleMenuItemClick(() => router.push("/user/albums"))
              }
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7h4l2 2h8l2-2h4v12H3V7z"
                  />
                </svg>
                <span>{t("albums")}</span>
              </div>
            </button>

            <button
              onClick={() =>
                handleMenuItemClick(() => router.push("/leaderboard"))
              }
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Trophy className="w-4 h-4" />
                <span>{tNav("leaderboard")}</span>
              </div>
            </button>

            <button
              onClick={() =>
                handleMenuItemClick(() => router.push("/user/following"))
              }
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span>{t("following")}</span>
              </div>
            </button>

            <button
              onClick={() =>
                handleMenuItemClick(() => router.push("/settings"))
              }
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>{tProfile("settings")}</span>
              </div>
            </button>

            {/* Show Admin menu item if user is logged in as admin */}
            {adminUser && (
              <button
                onClick={() => handleMenuItemClick(() => router.push("/admin"))}
                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span>{t("admin")}</span>
                </div>
              </button>
            )}

            <div className="border-t border-border my-2"></div>

            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>
                  {loading ? tProfile("signingOut") : tProfile("signOut")}
                </span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
