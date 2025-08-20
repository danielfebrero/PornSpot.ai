"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserMenu } from "./user/UserMenu";
import LocaleLink from "@/components/ui/LocaleLink";
import { isActivePath } from "@/lib/navigation";
import { Menu, X } from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";

export function Header() {
  const { user, loading } = useUserContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("common");
  const tNav = useTranslations("navigation");
  const tSite = useTranslations("site");

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="border-b border-border bg-card shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          {/* Logo/Brand - Always visible */}
          <LocaleLink href="/" className="flex items-center space-x-3">
            <img src="/logo.svg" alt="PornSpot.ai" className="w-8 h-8" />
            <div className="bg-muted/20 rounded-lg px-3 py-2 border border-border/60">
              <h1 className="text-xl font-bold text-foreground">
                {tSite("name")}
              </h1>
              <p className="text-xs text-muted-foreground">
                {tSite("tagline")}
              </p>
            </div>
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
            {user && (
              <>
                <LocaleLink
                  href="/user/medias"
                  className={`flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
                    isActivePath(pathname, "/user/medias")
                      ? "border-b-2 border-foreground"
                      : ""
                  }`}
                >
                  <span>{tNav("medias")}</span>
                </LocaleLink>
                <LocaleLink
                  href="/user/bookmarks"
                  className={`flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
                    isActivePath(pathname, "/user/bookmarks")
                      ? "border-b-2 border-foreground"
                      : ""
                  }`}
                >
                  <span>{tNav("bookmarks")}</span>
                </LocaleLink>
                <LocaleLink
                  href="/user/likes"
                  className={`flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
                    isActivePath(pathname, "/user/likes")
                      ? "border-b-2 border-foreground"
                      : ""
                  }`}
                >
                  <span>{tNav("likes")}</span>
                </LocaleLink>
                <LocaleLink
                  href="/user/albums"
                  className={`flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ${
                    isActivePath(pathname, "/user/albums")
                      ? "border-b-2 border-foreground"
                      : ""
                  }`}
                >
                  <span>{tNav("albums")}</span>
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
  );
}
