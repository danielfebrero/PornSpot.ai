"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface InvitationContextType {
  isCodeValidated: boolean;
  setIsCodeValidated: (validated: boolean) => void;
}

const InvitationContext = createContext<InvitationContextType | undefined>(
  undefined
);

export function InvitationProvider({ children }: { children: ReactNode }) {
  const [isCodeValidated, setIsCodeValidated] = useState(false);

  return (
    <InvitationContext.Provider value={{ isCodeValidated, setIsCodeValidated }}>
      {children}
    </InvitationContext.Provider>
  );
}

export function useInvitation() {
  const context = useContext(InvitationContext);
  if (context === undefined) {
    throw new Error("useInvitation must be used within an InvitationProvider");
  }
  return context;
}
