import React, { useState, useRef, useEffect, ReactNode } from "react";
import { removeLocaleFromPathname } from "@/lib/navigation";
import { useTranslations } from "next-intl";

interface ShareDropdownProps {
  /** Render prop for the trigger button/icon, gets 'toggleOpen' function */
  trigger: ({
    open,
    toggle,
  }: {
    open: boolean;
    toggle: () => void;
  }) => ReactNode;
  /** Dropdown menu: rendered when open, receives 'close' handler */
  children?: ({ close }: { close: () => void }) => ReactNode;
  /**
   * Optional: additional className for outer container
   */
  className?: string;
  /**
   * Optional: control alignment (e.g. 'right', 'left')
   */
  align?: "right" | "left";
  /**
   * Optional: title for share links (used in Reddit/X share)
   */
  title?: string;
  /**
   * Optional: use default share menu (copy link, Reddit, X)
   * If true, renders default menu. If false or children provided, uses children.
   */
  useDefaultMenu?: boolean;
}

interface ShareMenuItemsProps {
  close: () => void;
  title?: string;
}

/**
 * Default share menu items (copy link, Reddit, X)
 */
export const ShareMenuItems: React.FC<ShareMenuItemsProps> = ({
  close,
  title = "",
}) => {
  const t = useTranslations("shareDropdown");

  const handleCopyLink = () => {
    const urlWithoutLocale = getShareUrl();
    navigator.clipboard.writeText(urlWithoutLocale);
    close();
  };

  const getShareUrl = () => {
    return (
      window.location.origin +
      removeLocaleFromPathname(window.location.pathname) +
      window.location.search +
      window.location.hash
    );
  };

  const getShareUrlWithoutProtocol = () => {
    const fullUrl = getShareUrl();
    const withoutProtocol = fullUrl.replace(/^https?:\/\//, "");
    return withoutProtocol.replace(/^www\.pornspot\.ai/i, "PornSpot.ai");
  };

  const getXShareText = () => {
    const urlWithoutProtocol = getShareUrlWithoutProtocol();
    const emojis = [
      "🥵",
      "😈",
      "🍆",
      "🔥",
      "💥",
      "🛑",
      "❤️‍🔥",
      "⛔️",
      "📛",
      "🔞",
    ];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    return `${randomEmoji} ${title} ${randomEmoji}

---- Made with PornSpot.ai ----
NSFW Video & Image Generator

${urlWithoutProtocol}`;
  };

  return (
    <>
      <button
        className="flex items-center w-full px-4 py-2.5 text-sm hover:bg-accent transition-colors"
        onClick={handleCopyLink}
      >
        {t("copyLink")}
      </button>
      <a
        className="flex items-center w-full px-4 py-2.5 text-sm hover:bg-accent transition-colors"
        href={`https://www.reddit.com/submit?url=${encodeURIComponent(
          getShareUrl()
        )}&title=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={close}
      >
        {t("shareToReddit")}
      </a>
      <a
        className="flex items-center w-full px-4 py-2.5 text-sm hover:bg-accent transition-colors"
        href={`https://x.com/intent/tweet?text=${encodeURIComponent(
          getXShareText()
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={close}
      >
        {t("shareToX")}
      </a>
    </>
  );
};

/**
 * A wrapper for share dropdown buttons/menus, with outside click handling and open state.
 */
export const ShareDropdown: React.FC<ShareDropdownProps> = ({
  trigger,
  children,
  className = "",
  align = "right",
  title = "",
  useDefaultMenu = false,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: Event) {
      if (
        containerRef.current &&
        event.target &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [open]);

  const closeDropdown = () => setOpen(false);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-2 w-max bg-card border border-border rounded-lg shadow-lg z-50`}
        >
          <div className="p-2">
            {useDefaultMenu ? (
              <ShareMenuItems close={closeDropdown} title={title} />
            ) : children ? (
              children({ close: closeDropdown })
            ) : (
              <ShareMenuItems close={closeDropdown} title={title} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
