"use client";

import { useState } from "react";
import { InvitationWall } from "@/components/ui/InvitationWall";
import { RegisterForm } from "@/components/user/RegisterForm";

export function RegisterFormWithInvitation() {
  const [isCodeValidated, setIsCodeValidated] = useState(false);

  const handleCodeValidated = () => {
    setIsCodeValidated(true);
  };

  if (!isCodeValidated) {
    return <InvitationWall onCodeValidated={handleCodeValidated} />;
  }

  return <RegisterForm />;
}
