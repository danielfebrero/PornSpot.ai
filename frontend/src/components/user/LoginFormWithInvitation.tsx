"use client";

import { InvitationWall } from "@/components/ui/InvitationWall";
import { LoginForm } from "@/components/user/LoginForm";
import { useInvitation } from "@/contexts/InvitationContext";

export function LoginFormWithInvitation() {
  const { isCodeValidated, setIsCodeValidated } = useInvitation();

  const handleCodeValidated = () => {
    setIsCodeValidated(true);
  };

  // Check if current date is after September 30, 2025
  const currentDate = new Date();
  const invitationEndDate = new Date("2025-09-30T23:59:59");
  const isInvitationPeriodActive = currentDate <= invitationEndDate;

  // If invitation period has ended, bypass the invitation wall
  if (!isInvitationPeriodActive || isCodeValidated) {
    return <LoginForm />;
  }

  // During invitation period, show the invitation wall if code not validated
  return <InvitationWall onCodeValidated={handleCodeValidated} />;
}
