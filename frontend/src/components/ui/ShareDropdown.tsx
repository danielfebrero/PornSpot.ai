import React, { useState, useRef, useEffect, ReactNode } from "react";

interface ShareDropdownProps {
  /** Render prop for the trigger button/icon, gets 'toggleOpen' function */
  trigger: (opts: { open: boolean; toggle: () => void }) => ReactNode;
  /** Dropdown menu: rendered when open, receives 'close' handler */
  children: (opts: { close: () => void }) => ReactNode;
  /**
   * Optional: additional className for outer container
   */
  className?: string;
  /**
   * Optional: control alignment (e.g. 'right', 'left')
   */
  align?: "right" | "left";
}

/**
 * A wrapper for share dropdown buttons/menus, with outside click handling and open state.
 */
export const ShareDropdown: React.FC<ShareDropdownProps> = ({
  trigger,
  children,
  className = "",
  align = "right",
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

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-2 w-max bg-card border border-border rounded-lg shadow-lg z-50`}
        >
          <div className="p-2">{children({ close: () => setOpen(false) })}</div>
        </div>
      )}
    </div>
  );
};
