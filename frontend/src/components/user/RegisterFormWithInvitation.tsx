"use client";

import { InvitationWall } from "@/components/ui/InvitationWall";
import { RegisterForm } from "@/components/user/RegisterForm";
import { useInvitation } from "@/contexts/InvitationContext";

export function RegisterFormWithInvitation() {
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
    return <RegisterForm />;
  }

  // During invitation period, show the invitation wall if code not validated
  return <InvitationWall onCodeValidated={handleCodeValidated} />;
}
