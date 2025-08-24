import { getTranslations } from "next-intl/server";
import { AuthLayoutContent } from "@/components/user/AuthLayoutContent";
import { InvitationProvider } from "@/contexts/InvitationContext";
import {
  PageErrorBoundary,
  AuthErrorBoundary,
} from "@/components/ErrorBoundaries";

interface AuthLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export default async function AuthLayout({ children }: AuthLayoutProps) {
  const t = await getTranslations("site");

  return (
    <PageErrorBoundary context="Auth Layout">
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="w-full max-w-md lg:max-w-6xl">
              <AuthErrorBoundary>
                <InvitationProvider>
                  <AuthLayoutContent>{children}</AuthLayoutContent>
                </InvitationProvider>
              </AuthErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
