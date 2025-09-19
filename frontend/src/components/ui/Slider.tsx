"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number[];
  onValueChange: (_value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    { className, value, onValueChange, min = 0, max = 100, step = 1, ...props },
    ref
  ) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const sliderRef = React.useRef<HTMLDivElement>(null);

    const currentValue = value[0] || min;
    const percentage = ((currentValue - min) / (max - min)) * 100;

    const updateValueFromClientX = React.useCallback(
      (clientX: number) => {
        if (!sliderRef.current) return;

        const rect = sliderRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const width = rect.width;
        const percentage = Math.max(0, Math.min(100, (x / width) * 100));

        const rawValue = min + (percentage / 100) * (max - min);
        const steppedValue = Math.round(rawValue / step) * step;
        const clampedValue = Math.max(min, Math.min(max, steppedValue));

        onValueChange([clampedValue]);
      },
      [min, max, step, onValueChange]
    );

    const handlePointerDown = (e: React.PointerEvent) => {
      // Ensure we control the gesture and receive subsequent events
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch (_) {
        // ignore if not supported
      }
      setIsDragging(true);
      updateValueFromClientX(e.clientX);
      e.preventDefault();
    };

    const handlePointerMove = React.useCallback(
      (e: PointerEvent) => {
        if (!isDragging) return;
        updateValueFromClientX(e.clientX);
      },
      [isDragging, updateValueFromClientX]
    );

    const handlePointerUp = React.useCallback(() => {
      setIsDragging(false);
    }, []);
    const handlePointerCancel = React.useCallback(() => {
      setIsDragging(false);
    }, []);

    React.useEffect(() => {
      if (isDragging) {
        // Use pointer events so it works on both mouse and touch
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp, { once: true });
        window.addEventListener("pointercancel", handlePointerCancel, {
          once: true,
        });
        return () => {
          window.removeEventListener("pointermove", handlePointerMove);
          window.removeEventListener("pointerup", handlePointerUp);
          window.removeEventListener("pointercancel", handlePointerCancel);
        };
      }
    }, [isDragging, handlePointerMove, handlePointerUp, handlePointerCancel]);

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          className
        )}
        {...props}
      >
        <div
          ref={sliderRef}
          className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200 cursor-pointer touch-none"
          onPointerDown={handlePointerDown}
        >
          <div
            className="absolute h-full bg-blue-600 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div
          className="absolute block h-5 w-5 rounded-full border-2 border-blue-600 bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          style={{ left: `calc(${percentage}% - 10px)` }}
          onPointerDown={handlePointerDown}
        />
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };
