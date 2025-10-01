"use client";

import { LoginForm } from "@/components/user/LoginForm";

export function LoginFormWithInvitation() {
  // Check if current date is after September 30, 2025
  const currentDate = new Date();
  const invitationEndDate = new Date("2025-09-30T23:59:59");
  const isInvitationPeriodActive = currentDate <= invitationEndDate;

  // If invitation period has ended, bypass the invitation wall
  if (!isInvitationPeriodActive) {
    return <LoginForm />;
  }

  // During invitation period, show the invitation wall if code not validated
  // return <InvitationWall onCodeValidated={handleCodeValidated} />;
}
