"use client";

import { usePathname } from "next/navigation";
import React from "react";

interface MainContentWrapperProps {
  children: React.ReactNode;
}

export function MainContentWrapper({ children }: MainContentWrapperProps) {
  const pathname = usePathname();

  const locale = pathname.split("/")[1] || "en";

  // Routes that don't need padding (admin routes handle their own padding)
  const noPaddingRoutes = ["/admin", "/user"];

  // Check if current route should have no padding
  const shouldHaveNoPadding = noPaddingRoutes.some((route) =>
    pathname.startsWith(`${locale}${route}`)
  );

  if (shouldHaveNoPadding) {
    return <main className="flex-1">{children}</main>;
  }

  // Auth routes need a flex parent to vertically center content
  if (pathname.startsWith(`/${locale}/auth`)) {
    return (
      <main className="container mx-auto px-4 py-4 md:py-8 flex-1 flex">
        {children}
      </main>
    );
  }

  // Default: apply padding for discover page, albums, etc.
  return (
    <main className="container mx-auto px-4 py-4 md:py-8 flex-1">
      {children}
    </main>
  );
}
