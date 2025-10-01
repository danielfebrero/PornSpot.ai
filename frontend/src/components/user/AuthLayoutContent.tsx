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
    // Layout avec deux colonnes pour la page register, seulement si le code est validé
    return (
      // <div className="lg:flex lg:gap-12 lg:items-start">
      <div className="flex justify-center">
        {/* Form Card */}
        <div className="lg:w-96 lg:flex-shrink-0">
          <div className="bg-card border border-border rounded-lg shadow-lg p-6">
            {children}
          </div>
        </div>

        {/* Why Register Section */}
        <div className="lg:flex-1 mt-8 lg:mt-0">
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
