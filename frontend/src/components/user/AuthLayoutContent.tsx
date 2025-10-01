"use client";

import { usePathname } from "next/navigation";
import { ConditionalWhyRegisterSection } from "./ConditionalWhyRegisterSection";

interface AuthLayoutContentProps {
  children: React.ReactNode;
}

export function AuthLayoutContent({ children }: AuthLayoutContentProps) {
  const pathname = usePathname();
  const isRegisterPage = pathname.includes("/register");
  const isLoginPage = pathname.includes("/login");

  // Utiliser le contexte d'invitation pour savoir si on doit afficher la section Why Register

  if (isRegisterPage) {
    // Layout with responsive design: stacked on mobile, side-by-side on desktop
    return (
      <div className="flex flex-col lg:flex-row lg:gap-12 lg:items-start lg:justify-center">
        {/* Form Card */}
        <div className="w-full max-w-md lg:w-96 lg:flex-shrink-0 mx-auto lg:mx-0">
          <div className="bg-card border border-border rounded-lg shadow-lg p-6">
            {children}
          </div>
        </div>

        {/* Why Register Section - appears below form on mobile, beside on desktop */}
        <div className="w-full max-w-md lg:max-w-none lg:flex-1 mt-8 lg:mt-0 mx-auto lg:mx-0">
          <ConditionalWhyRegisterSection />
        </div>
      </div>
    );
  }

  // if (isLoginPage) {
  //   return <>{children}</>;
  // }

  // Layout centré pour les autres pages (login, etc.)
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg shadow-lg p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
