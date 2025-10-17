"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserMenu } from "./user/UserMenu";
import { NotificationButton } from "@/components/ui/NotificationButton";
import LocaleLink from "@/components/ui/LocaleLink";
import { isActivePath } from "@/lib/navigation";
import {
  Menu,
  X,
  Home,
  Sparkles,
  DollarSign,
  Image as ImageIcon,
  Video as VideoIcon,
  Coins,
} from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";
import { useUnreadNotificationCount } from "@/hooks/queries/useUserQuery";

export function Header() {
  const { user, loading } = useUserContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showMiniHeader, setShowMiniHeader] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("common");
  const tNav = useTranslations("navigation");
  const tSite = useTranslations("site");

  // Get unread notification count
  const { data: notificationCountData } = useUnreadNotificationCount();
  const unreadCount = notificationCountData?.unreadCount || 0;

  // Handle scroll behavior for mini header
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Show mini header when scrolled down more than 100px
          if (currentScrollY > 100) {
            setIsScrolled(true);
            // Show mini header when scrolling down, hide when scrolling up fast
            if (currentScrollY > lastScrollY) {
              setShowMiniHeader(true);
            } else if (currentScrollY < lastScrollY - 50) {
              setShowMiniHeader(false);
            }
          } else {
            setIsScrolled(false);
            setShowMiniHeader(false);
          }

          lastScrollY = currentScrollY;
          ticking = false;
        });

        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mini Sticky Header - Appears on Scroll */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          showMiniHeader && isScrolled
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0"
        }`}
      >
        <div className="bg-gradient-to-r from-background/95 via-card/95 to-background/95 backdrop-blur-xl border-b border-border/50 shadow-lg">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between py-2">
              {/* Mini Logo */}
              <LocaleLink
                href="/"
                className="flex items-center space-x-2 group"
              >
                <img
                  src="/logo.svg"
                  alt="PornSpot.ai"
                  className="w-6 h-6 group-hover:scale-110 transition-transform"
                />
                <span className="text-sm font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                  {tSite("name")}
                </span>
              </LocaleLink>

              {/* Mini Navigation Links */}
              <nav className="hidden md:flex items-center space-x-1">
                <LocaleLink
                  href="/"
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:bg-accent/80 hover:scale-105 ${
                    isActivePath(pathname, "/")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <Home className="h-3.5 w-3.5" />
                  <span>{t("discover")}</span>
                </LocaleLink>
                <LocaleLink
                  href="/generate"
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:bg-accent/80 hover:scale-105 ${
                    isActivePath(pathname, "/generate")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{t("generate")}</span>
                </LocaleLink>
                <LocaleLink
                  href="/pricing"
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:bg-accent/80 hover:scale-105 ${
                    isActivePath(pathname, "/pricing")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>{t("pricing")}</span>
                </LocaleLink>
                {!user && (
                  <LocaleLink
                    href="/pornspotcoin"
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:bg-accent/80 hover:scale-105 ${
                      isActivePath(pathname, "/pornspotcoin")
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Coins className="h-3.5 w-3.5" />
                    <span>{tNav("pornspotcoin")}</span>
                  </LocaleLink>
                )}
                {user && (
                  <>
                    <LocaleLink
                      href="/user/pornspotcoin"
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:bg-accent/80 hover:scale-105 ${
                        isActivePath(pathname, "/user/pornspotcoin")
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      <Coins className="h-3.5 w-3.5" />
                      <span>{tNav("pornspotcoin")}</span>
                    </LocaleLink>
                    <LocaleLink
                      href="/user/videos"
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:bg-accent/80 hover:scale-105 ${
                        isActivePath(pathname, "/user/videos")
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      <VideoIcon className="h-3.5 w-3.5" />
                      <span>{tNav("videos")}</span>
                    </LocaleLink>
                    <LocaleLink
                      href="/user/images"
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:bg-accent/80 hover:scale-105 ${
                        isActivePath(pathname, "/user/images")
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>{tNav("images")}</span>
                    </LocaleLink>
                  </>
                )}
              </nav>

              {/* Mini Auth Section */}
              <div className="flex items-center space-x-2">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-muted border-t-foreground rounded-full animate-spin" />
                ) : user ? (
                  <>
                    <NotificationButton count={unreadCount} />
                    <UserMenu user={user} />
                  </>
                ) : (
                  <div className="flex items-center space-x-1.5">
                    <LocaleLink
                      href="/auth/login"
                      className="h-7 rounded-full px-3 text-xs border border-input bg-background/80 hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center font-medium transition-all hover:scale-105"
                    >
                      {t("login")}
                    </LocaleLink>
                    <LocaleLink
                      href="/auth/register"
                      className="h-7 rounded-full px-3 text-xs bg-gradient-to-r from-primary to-purple-500 text-primary-foreground hover:opacity-90 inline-flex items-center justify-center font-medium transition-all hover:scale-105 shadow-md"
                    >
                      {t("register")}
                    </LocaleLink>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            {/* Logo/Brand - Always visible */}
            <LocaleLink href="/" className="flex items-center space-x-3">
              <img src="/logo.svg" alt="PornSpot.ai" className="w-8 h-8" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                {tSite("name")}
              </h1>
              {/* <p className="text-xs text-muted-foreground">
                {tSite("tagline")}
              </p> */}
            </LocaleLink>

            {/* Desktop Navigation - Hidden on mobile and tablet */}
            <nav className="hidden lg:flex items-center space-x-6">
              <LocaleLink
                href="/"
                className={`flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
                  isActivePath(pathname, "/")
                    ? "border-b-2 border-foreground"
                    : ""
                }`}
              >
                <span>{t("discover")}</span>
              </LocaleLink>
              <LocaleLink
                href="/generate"
                className={`flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
                  isActivePath(pathname, "/generate")
                    ? "border-b-2 border-foreground"
                    : ""
                }`}
              >
                <span>{t("generate")}</span>
              </LocaleLink>
              <LocaleLink
                href="/pricing"
                className={`flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
                  isActivePath(pathname, "/pricing")
                    ? "border-b-2 border-foreground"
                    : ""
                }`}
              >
                <span>{t("pricing")}</span>
              </LocaleLink>
              {!user && (
                <LocaleLink
                  href="/pornspotcoin"
                  className={`flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
                    isActivePath(pathname, "/pornspotcoin")
                      ? "border-b-2 border-foreground"
                      : ""
                  }`}
                >
                  <span>{tNav("pornspotcoin")}</span>
                </LocaleLink>
              )}
              {user && (
                <>
                  <LocaleLink
                    href="/user/pornspotcoin"
                    className={`flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
                      isActivePath(pathname, "/user/pornspotcoin")
                        ? "border-b-2 border-foreground"
                        : ""
                    }`}
                  >
                    <span>{tNav("pornspotcoin")}</span>
                  </LocaleLink>
                  <LocaleLink
                    href="/user/videos"
                    className={`flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
                      isActivePath(pathname, "/user/videos")
                        ? "border-b-2 border-foreground"
                        : ""
                    }`}
                  >
                    <span>{tNav("videos")}</span>
                  </LocaleLink>
                  <LocaleLink
                    href="/user/images"
                    className={`flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
                      isActivePath(pathname, "/user/images")
                        ? "border-b-2 border-foreground"
                        : ""
                    }`}
                  >
                    <span>{tNav("images")}</span>
                  </LocaleLink>
                </>
              )}
            </nav>

            {/* Auth Section / Mobile Menu Button */}
            <div className="flex items-center space-x-3">
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin" />
                </div>
              ) : user ? (
                <>
                  <NotificationButton count={unreadCount} />
                  <UserMenu user={user} />
                </>
              ) : (
                <>
                  <div className="hidden sm:flex items-center space-x-2">
                    <LocaleLink
                      href="/auth/login"
                      className="h-9 rounded-md px-3 text-sm border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {t("login")}
                    </LocaleLink>
                    <LocaleLink
                      href="/auth/register"
                      className="h-9 rounded-md px-3 text-sm bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {t("register")}
                    </LocaleLink>
                  </div>
                  {/* Mobile Menu Button - Show for unauthenticated users for login/register and navigation */}
                  <button
                    onClick={toggleMobileMenu}
                    className="sm:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label={tNav("menu")}
                  >
                    {isMobileMenuOpen ? (
                      <X className="h-5 w-5" />
                    ) : (
                      <Menu className="h-5 w-5" />
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Mobile Navigation Menu - For unauthenticated users */}
          {isMobileMenuOpen && !user && (
            <div className="sm:hidden border-t border-border">
              <nav className="py-4 space-y-2">
                {/* Pricing Link */}
                <LocaleLink
                  href="/pricing"
                  onClick={closeMobileMenu}
                  className="block px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("pricing")}
                </LocaleLink>
                {/* Auth LocaleLinks */}
                <LocaleLink
                  href="/auth/login"
                  onClick={closeMobileMenu}
                  className="block px-4 py-2 text-sm font-medium text-primary hover:bg-accent rounded-md transition-colors"
                >
                  {t("login")}
                </LocaleLink>
                <LocaleLink
                  href="/auth/register"
                  onClick={closeMobileMenu}
                  className="block px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
                >
                  {t("register")}
                </LocaleLink>
              </nav>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
