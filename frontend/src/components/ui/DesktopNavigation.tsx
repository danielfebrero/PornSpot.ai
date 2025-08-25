"use client";

import { usePathname } from "next/navigation";
import LocaleLink from "@/components/ui/LocaleLink";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { SectionErrorBoundary } from "@/components/ErrorBoundaries";
import { isActivePath } from "@/lib/navigation";

interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exactPath?: boolean; // Optional for exact path matching
}

interface DesktopNavigationProps {
  navigationItems: NavigationItem[];
  className?: string;
}

export function DesktopNavigation({
  navigationItems,
  className,
}: DesktopNavigationProps) {
  const pathname = usePathname();

  return (
    <SectionErrorBoundary context="Desktop Navigation">
      <aside className={cn("hidden lg:block lg:w-64 flex-shrink-0", className)}>
        <nav className="md:bg-card/80 md:backdrop-blur-sm md:rounded-xl md:shadow-lg md:border md:border-admin-primary/10">
          <ul className="space-y-2 p-4">
            {navigationItems.map((item) => {
              const isActive = item.exactPath
                ? isActivePath(pathname, item.href)
                : pathname.includes(item.href);

              return (
                <li key={item.href}>
                  <LocaleLink
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-admin-primary to-admin-secondary text-admin-primary-foreground shadow-lg"
                        : "text-muted-foreground hover:bg-admin-primary/10 hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </LocaleLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </SectionErrorBoundary>
  );
}
