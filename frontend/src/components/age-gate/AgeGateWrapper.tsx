"use client";

import { useEffect, useState } from "react";
import { AgeGateModal } from "./AgeGateModal";
import { KidView } from "./KidView";

// Cookie name constant
const AGE_GATE_COOKIE = "age_verified";

interface AgeGateWrapperProps {
  children: React.ReactNode;
}

// Minimal wrapper: shows modal until accepted; if denied, shows KidView for current session only.
export function AgeGateWrapper({ children }: AgeGateWrapperProps) {
  const [isVerified, setIsVerified] = useState<boolean | null>(null); // null = unknown
  const [denied, setDenied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Ensure runs only client-side
    const cookieVal =
      typeof document !== "undefined" ? getCookie(AGE_GATE_COOKIE) : undefined;
    if (cookieVal === "1") {
      setIsVerified(true);
    } else {
      setIsVerified(false);
    }
    setMounted(true);
  }, []);

  const handleAccept = () => {
    setCookie(AGE_GATE_COOKIE, "1", 365);
    setIsVerified(true);
  };

  const handleDeny = () => {
    // No cookie written; show kid view until reload
    setDenied(true);
  };

  if (!mounted) return null; // avoid hydration mismatch

  if (isVerified) {
    return <>{children}</>;
  }

  if (denied) {
    return <KidView onBack={() => setDenied(false)} />;
  }

  return <AgeGateModal onAccept={handleAccept} onDeny={handleDeny} />;
}

// Minimal cookie helpers (avoid adding new dependency)
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
