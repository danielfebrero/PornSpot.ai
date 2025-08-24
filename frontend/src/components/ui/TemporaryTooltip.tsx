"use client";

import { cn } from "@/lib/utils";

interface TemporaryTooltipProps {
  children: React.ReactNode;
  content: string;
  isVisible: boolean;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export const TemporaryTooltip: React.FC<TemporaryTooltipProps> = ({
  children,
  content,
  isVisible,
  position = "top",
  className,
}) => {
  const positionClasses = {
    top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2",
    left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
    right: "left-full top-1/2 transform -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900",
    bottom:
      "bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900",
    left: "left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900",
    right:
      "right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900",
  };

  return (
    <div className={cn("relative inline-block", className)}>
      {children}
      {isVisible && (
        <div
          className={cn(
            "absolute z-50 whitespace-nowrap",
            "px-3 py-2 text-sm text-white bg-gray-900 rounded-md shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-200",
            positionClasses[position]
          )}
        >
          {content}
          {/* Arrow */}
          <div
            className={cn("absolute w-0 h-0 border-4", arrowClasses[position])}
          />
        </div>
      )}
    </div>
  );
};
