"use client";

import { InvitationWall } from "@/components/ui/InvitationWall";
import { RegisterForm } from "@/components/user/RegisterForm";
import { useInvitation } from "@/contexts/InvitationContext";

export function RegisterFormWithInvitation() {
  const { isCodeValidated, setIsCodeValidated } = useInvitation();

  const handleCodeValidated = () => {
    setIsCodeValidated(true);
  };

  if (!isCodeValidated) {
    // Le mur d'invitation gère son propre layout full-screen
    return <InvitationWall onCodeValidated={handleCodeValidated} />;
  }

  // Une fois le code validé, on retourne au layout standard avec le RegisterForm
  return <RegisterForm />;
}
