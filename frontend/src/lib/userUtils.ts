import { User } from "@/types";
import { UserPlan } from "@/types/permissions";

// Mock user data for development/testing
export async function createMockUser(
  plan: UserPlan = "anonymous",
  overrides?: Partial<User>
): Promise<User> {
  const mockUsage = {
    anonymous: { month: 0, day: 0, storage: 0.1 },
    free: { month: 0, day: 0, storage: 0.1 },
    starter: { month: 150, day: 5, storage: 2.5 },
    unlimited: { month: 1200, day: 40, storage: 15.8 },
    pro: { month: 2500, day: 80, storage: 45.2 },
  };

  const usage = mockUsage[plan];
  const baseUser: User = {
    userId: "mock-user-id",
    email: "test@example.com",
    username: "testuser",
    createdAt: new Date().toISOString(),
    isActive: true,
    isEmailVerified: true,
    lastLoginAt: new Date().toISOString(),

    role: "user",
    planInfo: {
      plan,
      isActive: true,
      subscriptionStatus:
        plan === "free" || plan === "anonymous" ? undefined : "active",
      planStartDate: new Date().toISOString(),
    },
    usageStats: {
      imagesGeneratedThisMonth: usage.month,
      imagesGeneratedToday: usage.day,
      storageUsedGB: usage.storage,
      lastGenerationAt: new Date().toISOString(),
    },
    ...overrides,
  };

  return baseUser;
}

/**
 * Check if the current user is the owner of the media
 * @param user - Current user object
 * @param mediaCreatedBy - The user ID who created the media
 * @returns boolean indicating if user is the owner
 */
export function isMediaOwner(
  user: User | null,
  mediaCreatedBy?: string
): boolean {
  if (!user || !mediaCreatedBy) {
    return false;
  }

  return user.userId === mediaCreatedBy;
}
