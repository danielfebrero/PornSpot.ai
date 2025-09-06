import { useEffect, useRef, useCallback } from "react";

// NoSleep types - nosleep.js provides its own types
interface NoSleep {
  enable(): Promise<void>;
  disable(): void;
  isEnabled: boolean;
}

/**
 * Hook to prevent device sleep using both nosleep.js and native Wake Lock API
 * This provides comprehensive sleep prevention across different devices and browsers
 */
export const useSleepPrevention = () => {
  const noSleepRef = useRef<NoSleep | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isPreventingRef = useRef(false);

  // Initialize NoSleep instance
  useEffect(() => {
    const initNoSleep = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const NoSleepModule = await import("nosleep.js");
        const NoSleepClass = NoSleepModule.default;
        noSleepRef.current = new NoSleepClass();
      } catch (error) {
        console.warn("Failed to initialize NoSleep:", error);
      }
    };

    initNoSleep();
  }, []);

  const enableSleepPrevention = useCallback(async () => {
    if (isPreventingRef.current) return;

    console.log("Enabling sleep prevention...");
    isPreventingRef.current = true;

    // Method 1: Use native Wake Lock API (modern browsers)
    if ("wakeLock" in navigator && "request" in navigator.wakeLock) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        console.log("Screen Wake Lock acquired");

        // Handle wake lock release events
        wakeLockRef.current.addEventListener("release", () => {
          console.log("Screen Wake Lock released");
          wakeLockRef.current = null;
        });
      } catch (error) {
        console.warn("Failed to acquire Wake Lock:", error);
      }
    } else {
      console.log("Wake Lock API not supported");
    }

    // Method 2: Use NoSleep.js as fallback/additional protection
    if (noSleepRef.current) {
      try {
        await noSleepRef.current.enable();
        console.log("NoSleep enabled");
      } catch (error) {
        console.warn("Failed to enable NoSleep:", error);
      }
    }
  }, []);

  const disableSleepPrevention = useCallback(() => {
    if (!isPreventingRef.current) return;

    console.log("Disabling sleep prevention...");
    isPreventingRef.current = false;

    // Release native Wake Lock
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log("Screen Wake Lock released manually");
    }

    // Disable NoSleep.js
    if (noSleepRef.current && noSleepRef.current.isEnabled) {
      noSleepRef.current.disable();
      console.log("NoSleep disabled");
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disableSleepPrevention();
    };
  }, [disableSleepPrevention]);

  // Handle page visibility changes (when user switches tabs/apps)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPreventingRef.current) {
        // Page is hidden, wake lock might be released automatically
        // We'll re-enable when page becomes visible again
        console.log("Page hidden, wake lock may be released");
      } else if (!document.hidden && isPreventingRef.current) {
        // Page is visible again, re-enable if we were preventing sleep
        console.log("Page visible, re-enabling sleep prevention");
        enableSleepPrevention();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enableSleepPrevention]);

  return {
    enableSleepPrevention,
    disableSleepPrevention,
    isPreventingSleep: isPreventingRef.current,
  };
};
