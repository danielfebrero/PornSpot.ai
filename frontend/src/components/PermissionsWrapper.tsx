"use client";

import { ReactNode, useState, useEffect } from "react";
import { useUserProfile } from "@/hooks/queries/useUserQuery";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { createUserWithPlan, createMockUser } from "@/lib/userUtils";
import { UserWithPlan } from "@/types/permissions";
import {
  Skeleton,
  HeaderSkeleton,
  GridSkeleton,
} from "@/components/ui/Skeleton";

interface PermissionsWrapperProps {
  children: ReactNode;
}

export function PermissionsWrapper({ children }: PermissionsWrapperProps) {
  const { data: userResponse, isLoading: loading } = useUserProfile();
  const user = userResponse?.user || null;
  const [userWithPermissions, setUserWithPermissions] =
    useState<UserWithPlan | null>(null);
  const [lastProcessedUserId, setLastProcessedUserId] = useState<string | null>(
    null
  );

  // Convert the current user to a permissions-compatible format
  // If no user is logged in, create a mock free user for permissions
  useEffect(() => {
    // Don't load permissions until user context is fully initialized
    if (loading) {
      return;
    }

    // Only process if user has actually changed (prevent unnecessary re-processing)
    const currentUserId = user?.userId || null;
    if (currentUserId === lastProcessedUserId && userWithPermissions !== null) {
      return;
    }
    setLastProcessedUserId(currentUserId);

    const loadUserPermissions = async () => {
      try {
        const userWithPerms = user
          ? await createUserWithPlan(user)
          : await createMockUser("free");
        setUserWithPermissions(userWithPerms);
      } catch (error) {
        console.error("Failed to load user permissions:", error);
        // Fallback to a basic free user
        const fallbackUser = await createMockUser("free");
        setUserWithPermissions(fallbackUser);
      }
    };

    loadUserPermissions();
  }, [user, loading, lastProcessedUserId, userWithPermissions]);

  // Show skeleton placeholders while user context is initializing or permissions are being loaded
  // if (loading || !userWithPermissions) {
  //   return (
  //     <div className="min-h-screen bg-background">
  //       {/* Header Skeleton */}
  //       <header className="border-b border-border bg-card shadow-sm">
  //         <div className="container mx-auto px-4">
  //           <div className="flex items-center justify-between py-4">
  //             {/* Logo skeleton */}
  //             <div className="flex items-center space-x-3">
  //               <Skeleton className="w-8 h-8" />
  //               <div>
  //                 <Skeleton className="h-5 w-24 mb-1" />
  //                 <Skeleton className="h-3 w-20" />
  //               </div>
  //             </div>

  //             {/* Navigation skeleton */}
  //             <div className="hidden sm:flex items-center space-x-6">
  //               {[...Array(4)].map((_, i) => (
  //                 <Skeleton key={i} className="h-4 w-16" />
  //               ))}
  //             </div>

  //             {/* Auth section skeleton */}
  //             <div className="flex items-center space-x-3">
  //               <Skeleton className="h-9 w-16" />
  //               <Skeleton className="h-9 w-20" />
  //             </div>
  //           </div>
  //         </div>
  //       </header>

  //       {/* Main content skeleton */}
  //       <div className="container mx-auto px-4 py-8">
  //         <div className="space-y-6">
  //           <HeaderSkeleton />
  //           <GridSkeleton itemCount={8} itemType="card" />
  //         </div>
  //       </div>

  //       {/* Footer skeleton */}
  //       <footer className="border-t border-border mt-16">
  //         <div className="container mx-auto px-4 py-8">
  //           <div className="text-center">
  //             <Skeleton className="h-4 w-48 mx-auto" />
  //           </div>
  //         </div>
  //       </footer>
  //     </div>
  //   );
  // }

  return (
    <PermissionsProvider user={userWithPermissions}>
      {children}
    </PermissionsProvider>
  );
}
