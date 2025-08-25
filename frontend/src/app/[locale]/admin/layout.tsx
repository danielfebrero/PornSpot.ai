"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { AdminProvider } from "@/contexts/AdminContext";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import { DesktopNavigation } from "@/components/ui/DesktopNavigation";
import { MobileNavigation } from "@/components/ui/MobileNavigation";
import {
  PageErrorBoundary,
  AdminErrorBoundary,
  SectionErrorBoundary,
} from "@/components/ErrorBoundaries";
import { LayoutDashboard, FolderOpen, Image, Users } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export default function AdminLayout({
  children,
  params: { locale },
}: AdminLayoutProps) {
  return (
    <PageErrorBoundary context={`Admin Layout (${locale})`}>
      <AdminProvider>
        <div className="min-h-screen">
          <AdminLayoutContent locale={locale}>{children}</AdminLayoutContent>
        </div>
      </AdminProvider>
    </PageErrorBoundary>
  );
}

function AdminLayoutContent({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const t = useTranslations("admin.navigation");
  const pathname = usePathname();
  const isLoginPage = pathname === `/${locale}/admin/login`;

  const adminNavigationItems = [
    {
      href: "/admin",
      label: t("dashboard"),
      icon: LayoutDashboard,
      exactPath: true,
    },
    {
      href: "/admin/albums",
      label: t("albums"),
      icon: FolderOpen,
    },
    {
      href: "/admin/media",
      label: t("media"),
      icon: Image,
    },
    {
      href: "/admin/users",
      label: t("users"),
      icon: Users,
    },
  ];

  // Render login page without protection
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Render protected admin content with layout
  return (
    <ProtectedRoute>
      <AdminErrorBoundary>
        <div className="min-h-screen">
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 md:py-8">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Navigation */}
              <DesktopNavigation navigationItems={adminNavigationItems} />
              <MobileNavigation navigationItems={adminNavigationItems} />

              {/* Main Content */}
              <SectionErrorBoundary context="Admin Main Content">
                <main className="flex-1 pb-20 lg:pb-6">{children}</main>
              </SectionErrorBoundary>
            </div>
          </div>
        </div>
      </AdminErrorBoundary>
    </ProtectedRoute>
  );
}
