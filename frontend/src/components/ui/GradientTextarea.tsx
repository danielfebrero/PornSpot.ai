"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";

interface GradientTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const GradientTextarea: React.FC<GradientTextareaProps> = ({
  value,
  onChange,
  placeholder = "",
  className = "",
  disabled = false,
  ...props
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Sync scroll position between textarea and overlay
  const handleScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      const textarea = textareaRef.current;
      const overlay = overlayRef.current;
      const textContent = overlay.firstElementChild as HTMLElement;

      if (textContent) {
        // Use precise scroll positioning with subpixel accuracy
        const scrollLeft = textarea.scrollLeft;
        const scrollTop = textarea.scrollTop;

        // Apply transform with hardware acceleration for smooth scrolling
        textContent.style.transform = `translate3d(-${scrollLeft}px, -${scrollTop}px, 0)`;
        textContent.style.willChange = "transform";
      }
    }
  }, []);

  // Sync dimensions and styling
  useEffect(() => {
    const syncStyles = () => {
      if (textareaRef.current && overlayRef.current) {
        const textarea = textareaRef.current;
        const overlay = overlayRef.current;
        const textContent = overlay.firstElementChild as HTMLElement;

        // Copy computed styles to ensure pixel-perfect alignment
        const computedStyle = window.getComputedStyle(textarea);

        // Update overlay position to match textarea's content area exactly
        const borderTopWidth = parseInt(computedStyle.borderTopWidth, 10);
        const borderLeftWidth = parseInt(computedStyle.borderLeftWidth, 10);

        // Position overlay to match textarea's content area (excluding borders and scrollbars)
        overlay.style.top = `${borderTopWidth}px`;
        overlay.style.left = `${borderLeftWidth}px`;
        overlay.style.width = `${textarea.clientWidth}px`;
        overlay.style.height = `${textarea.clientHeight}px`;
        overlay.style.borderRadius = computedStyle.borderRadius;

        // Apply styles to the text content div
        if (textContent) {
          // Copy all text-related properties that affect layout
          textContent.style.padding = computedStyle.padding;
          textContent.style.paddingTop = computedStyle.paddingTop;
          textContent.style.paddingRight = computedStyle.paddingRight;
          textContent.style.paddingBottom = computedStyle.paddingBottom;
          textContent.style.paddingLeft = computedStyle.paddingLeft;
          textContent.style.margin = "0"; // Reset margin to prevent offset
          textContent.style.boxSizing = computedStyle.boxSizing;

          // Font and text properties
          textContent.style.fontSize = computedStyle.fontSize;
          textContent.style.fontFamily = computedStyle.fontFamily;
          textContent.style.fontWeight = computedStyle.fontWeight;
          textContent.style.fontStyle = computedStyle.fontStyle;
          textContent.style.lineHeight = computedStyle.lineHeight;
          textContent.style.letterSpacing = computedStyle.letterSpacing;
          textContent.style.wordSpacing = computedStyle.wordSpacing;
          textContent.style.textAlign = computedStyle.textAlign;
          textContent.style.textIndent = computedStyle.textIndent;
          textContent.style.textTransform = computedStyle.textTransform;

          // White space and word wrapping
          textContent.style.whiteSpace = "pre-wrap";
          textContent.style.wordWrap = "break-word";
          textContent.style.overflowWrap = "break-word";
          textContent.style.wordBreak = computedStyle.wordBreak;
          textContent.style.hyphens = computedStyle.hyphens;

          // Calculate the actual content width accounting for scrollbars
          // Use the same clientWidth as the overlay to ensure perfect alignment
          textContent.style.width = `${textarea.clientWidth}px`;
          textContent.style.minHeight = computedStyle.minHeight;

          // Position the text content to match scroll offset
          const scrollLeft = textarea.scrollLeft;
          const scrollTop = textarea.scrollTop;
          textContent.style.transform = `translate3d(-${scrollLeft}px, -${scrollTop}px, 0)`;
          textContent.style.willChange = "transform";
        }
      }
    };

    syncStyles();

    // Re-sync on resize and input
    const resizeObserver = new ResizeObserver(syncStyles);
    const currentTextarea = textareaRef.current;

    // Also sync when content changes and on scroll
    const handleInput = () => {
      requestAnimationFrame(syncStyles);
    };

    const handleScrollEvent = () => {
      requestAnimationFrame(handleScroll);
    };

    if (currentTextarea) {
      resizeObserver.observe(currentTextarea);
      currentTextarea.addEventListener("input", handleInput);
      currentTextarea.addEventListener("scroll", handleScrollEvent);
    }

    return () => {
      resizeObserver.disconnect();
      if (currentTextarea) {
        currentTextarea.removeEventListener("input", handleInput);
        currentTextarea.removeEventListener("scroll", handleScrollEvent);
      }
    };
  }, [value, handleScroll]); // Re-run when value or handleScroll changes

  // Process text for display - handle placeholder and content
  const displayText = value || placeholder;
  const isPlaceholder = !value && placeholder;

  // Extract relevant classes for initial styling
  const extractedClasses = className
    .split(" ")
    .filter(
      (cls) =>
        cls.startsWith("text-") ||
        cls.startsWith("p-") ||
        cls.startsWith("font-")
    )
    .join(" ");

  return (
    <div className="relative">
      {/* Invisible textarea for input */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        disabled={disabled}
        placeholder="" // Remove native placeholder
        className={cn(
          "relative z-20 text-transparent bg-transparent caret-primary selection:bg-primary/20 resize-none",
          className
        )}
        style={{
          caretColor: "hsl(var(--primary))",
          color: "transparent",
        }}
        {...props}
      />

      {/* Gradient text overlay */}
      <div
        ref={overlayRef}
        className="absolute z-10 pointer-events-none overflow-hidden"
        style={{
          // Initial positioning - will be updated by syncStyles
          top: 0,
          left: 0,
          width: 0,
          height: 0,
        }}
      >
        <div
          className={cn(
            "whitespace-pre-wrap break-words",
            isPlaceholder ? "opacity-80" : "opacity-100",
            extractedClasses // Apply relevant classes from parent to prevent flash
          )}
          style={{
            background:
              "linear-gradient(to right, hsl(var(--primary)), #9333ea)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            // Ensure consistent text rendering
            textRendering: "optimizeLegibility",
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
          }}
        >
          {displayText}
        </div>
      </div>

      {/* Custom CSS to hide webkit scrollbars */}
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};
