import { User, UserWithPlanInfo } from "@/types";
import { UserWithPlan, UserPlan, UserRole } from "@/types/permissions";
import { getAllPlanDefinitions } from "@/utils/permissions";

// Utility to convert API user to permissions-compatible user
export async function createUserWithPlan(
  user: User | UserWithPlanInfo
): Promise<UserWithPlan> {
  const baseUser = user as UserWithPlanInfo;

  // Extract plan info from the nested structure
  const plan: UserPlan = (baseUser.planInfo?.plan as UserPlan) || "free";
  const role: UserRole = (baseUser.role as UserRole) || "user";

  const planDefinitions = await getAllPlanDefinitions();
  const permissions = planDefinitions[plan];

  return {
    ...user,
    role,
    planInfo: {
      plan,
      isActive: baseUser.planInfo?.isActive || plan === "free",
      subscriptionId: baseUser.planInfo?.subscriptionId,
      startDate: baseUser.planInfo?.planStartDate || user.createdAt,
      endDate: baseUser.planInfo?.planEndDate,
      permissions,
    },
    usageStats: baseUser.usageStats || {
      imagesGeneratedThisMonth: 0,
      imagesGeneratedToday: 0,
    },
  };
}

// Mock user data for development/testing
export async function createMockUser(
  plan: UserPlan = "free",
  overrides?: Partial<UserWithPlan>
): Promise<UserWithPlan> {
  const baseUser: User = {
    userId: "mock-user-123",
    email: "test@example.com",
    username: "testuser",
    createdAt: new Date().toISOString(),
    isActive: true,
    isEmailVerified: true,
    lastLoginAt: new Date().toISOString(),
  };

  const mockUsage = {
    free: { month: 25, day: 0, storage: 0.1 },
    starter: { month: 150, day: 5, storage: 2.5 },
    unlimited: { month: 1200, day: 40, storage: 15.8 },
    pro: { month: 2500, day: 80, storage: 45.2 },
  };

  const usage = mockUsage[plan];

  const userWithPlan = await createUserWithPlan({
    ...baseUser,
    role: "user",
    planInfo: {
      plan,
      isActive: true,
      subscriptionStatus: plan === "free" ? undefined : "active",
      planStartDate: new Date().toISOString(),
    },
    usageStats: {
      imagesGeneratedThisMonth: usage.month,
      imagesGeneratedToday: usage.day,
      storageUsedGB: usage.storage,
      lastGenerationAt: new Date().toISOString(),
    },
    ...overrides,
  });

  return userWithPlan;
}
