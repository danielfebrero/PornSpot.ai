"use client";

import { ReactNode, useState, useEffect } from "react";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { createMockUser } from "@/lib/userUtils";
import { useUserContext } from "@/contexts/UserContext";
import { User } from "@/types";

interface PermissionsWrapperProps {
  children: ReactNode;
}

export function PermissionsWrapper({ children }: PermissionsWrapperProps) {
  const userContext = useUserContext();

  const user = userContext?.user || null;
  const [userWithPermissions, setUserWithPermissions] = useState<User | null>(
    null
  );
  const [lastProcessedUserId, setLastProcessedUserId] = useState<string | null>(
    null
  );

  // Convert the current user to a permissions-compatible format
  // If no user is logged in, create a mock free user for permissions
  useEffect(() => {
    // Don't load permissions until user context is fully initialized
    if (userContext.loading) {
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
        const userWithPerms = user ? user : await createMockUser("free");
        setUserWithPermissions(userWithPerms);
      } catch (error) {
        console.error("Failed to load user permissions:", error);
        // Fallback to a basic free user
        const fallbackUser = await createMockUser("free");
        setUserWithPermissions(fallbackUser);
      }
    };

    loadUserPermissions();
  }, [user, userContext.loading, lastProcessedUserId, userWithPermissions]);

  return (
    <PermissionsProvider user={userWithPermissions}>
      {children}
    </PermissionsProvider>
  );
}
