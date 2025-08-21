"use client";

import { UserPlan } from "@/types";
import { Crown, Star, Zap, User } from "lucide-react";

interface UserPlanBadgeProps {
  plan: UserPlan;
}

export function UserPlanBadge({ plan }: UserPlanBadgeProps) {
  const planConfig = {
    free: {
      name: "Free",
      icon: User,
      className:
        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    },
    starter: {
      name: "Starter",
      icon: Star,
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    },
    unlimited: {
      name: "Unlimited",
      icon: Zap,
      className:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    pro: {
      name: "Pro",
      icon: Crown,
      className:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    },
  };

  const config = planConfig[plan];
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}
    >
      <Icon className="h-3 w-3" />
      <span>{config.name}</span>
    </div>
  );
}
