"use client";

import { useEffect, useState } from "react";
import { AgeGateModal } from "./AgeGateModal";
import { KidView } from "./KidView";

// Cookie name constant
const AGE_GATE_COOKIE = "age_verified";

interface AgeGateWrapperProps {
  children: React.ReactNode;
}

export function AgeGateWrapper({ children }: AgeGateWrapperProps) {
  const [isVerified, setIsVerified] = useState(true); // Default TRUE pour SSR : bots voient tout
  const [denied, setDenied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Client-only : check cookie post-mount
    setMounted(true);
    const cookieVal = getCookie(AGE_GATE_COOKIE);
    setIsVerified(cookieVal === "1");
  }, []);

  const handleAccept = () => {
    setCookie(AGE_GATE_COOKIE, "1", 365);
    setIsVerified(true);
  };

  const handleDeny = () => {
    setDenied(true); // Switch to KidView pour la session
  };

  // SSR fallback (mounted false) : rend children direct, sans modal
  if (!mounted) {
    return <>{children}</>;
  }

  // Si denied : KidView remplace (post-interaction client-side)
  if (denied) {
    return <KidView onBack={() => setDenied(false)} />;
  }

  // Si pas verified : children + overlay modal (bloque visuellement/interactivement)
  if (!isVerified) {
    return (
      <>
        {children}
        <AgeGateModal onAccept={handleAccept} onDeny={handleDeny} />
      </>
    );
  }

  // Verified : children pur
  return <>{children}</>;
}

// Tes helpers cookie inchangés (bravo, minimalistes)
function setCookie(name: string, value: string, days: number) {
  try {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = "; expires=" + date.toUTCString();
    document.cookie = `${name}=${value || "1"}${expires}; path=/; SameSite=Lax`;
  } catch (e) {
    // ignore
  }
}

function getCookie(name: string): string | undefined {
  try {
    const match = document.cookie.match(
      new RegExp(
        "(?:^|; )" +
          name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, "\\$1") +
          "=([^;]*)"
      )
    );
    return match ? decodeURIComponent(match[1]) : undefined;
  } catch (e) {
    return undefined;
  }
}
