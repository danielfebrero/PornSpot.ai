import React, {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";

interface MagicTextProps {
  originalText: string;
}

export interface MagicTextHandle {
  castSpell: (targetText: string) => void;
  streamToken: (token: string, fullText: string) => void;
  reset: () => void;
}

export const MagicText = forwardRef<MagicTextHandle, MagicTextProps>(
  ({ originalText }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const magicTextRef = useRef<HTMLDivElement>(null);
    const [isInitial, setIsInitial] = useState(true);

    const splitText = useCallback(
      (text: string) => {
        if (containerRef.current) {
          // Set the text content for the background gradient
          const backgroundTextEl = containerRef.current
            .previousElementSibling as HTMLElement;
          if (backgroundTextEl) {
            backgroundTextEl.textContent = text;
          }

          // Create word-based spans with individual letter spans inside for animation
          containerRef.current.innerHTML = "";
          let letterIndex = 0;

          // Split text into words and spaces, preserving whitespace
          const segments = text.split(/(\s+|\n)/);

          segments.forEach((segment) => {
            if (segment.length === 0) return;

            // Create a word container span
            const wordSpan = document.createElement("span");
            wordSpan.classList.add("word");
            wordSpan.style.display = "inline-block";
            wordSpan.style.whiteSpace = segment.match(/^\s+$/)
              ? "pre"
              : "nowrap";

            // Split segment into individual letters
            segment.split("").forEach((char) => {
              const letterSpan = document.createElement("span");
              letterSpan.classList.add("letter");
              letterSpan.textContent = char === " " ? "\u00A0" : char;

              // Handle line breaks
              if (char === "\n") {
                letterSpan.style.whiteSpace = "pre";
              }

              if (text === originalText && isInitial) {
                letterSpan.classList.add("initial-magic");
                // Calculate delay to make full text appear in 1.5 seconds
                const totalInitialTime = 1500; // 1.5 seconds
                const letterDelay = Math.min(
                  50,
                  totalInitialTime / Math.max(text.length, 1)
                );
                letterSpan.style.animationDelay = `${
                  letterIndex * letterDelay
                }ms`;
              }

              wordSpan.appendChild(letterSpan);
              letterIndex++;
            });

            containerRef.current!.appendChild(wordSpan);
          });
        }
      },
      [originalText, isInitial]
    );

    const streamToken = useCallback(
      (token: string, fullText: string) => {
        if (!containerRef.current) return;

        // Update the background text
        const backgroundTextEl = containerRef.current
          .previousElementSibling as HTMLElement;
        if (backgroundTextEl) {
          backgroundTextEl.textContent = fullText;
        }

        // Update the visible text content progressively
        splitText(fullText);
        const letters = containerRef.current.querySelectorAll(
          ".letter"
        ) as NodeListOf<HTMLSpanElement>;

        // Add streaming effect to new letters
        letters.forEach((letter, index) => {
          letter.classList.add("streaming");
          letter.style.opacity = "1";
          letter.style.transform = "translate(0, 0) rotate(0deg)";

          // Add a subtle animation delay for streaming effect
          setTimeout(() => {
            letter.classList.remove("streaming");
          }, index * 20);
        });
      },
      [splitText]
    );

    const reset = () => {
      setIsInitial(true);
    };
    const castSpell = (targetText: string) => {
      if (!containerRef.current || !targetText) return;
      const letters = containerRef.current.querySelectorAll(
        ".letter"
      ) as NodeListOf<HTMLSpanElement>;

      if (isInitial) {
        setIsInitial(false);
      }

      // Remove initial magic if present
      letters.forEach((letter) => {
        letter.classList.remove("initial-magic");
      });

      // Animate out
      letters.forEach((letter, index) => {
        setTimeout(() => {
          letter.classList.add("morphing");
          letter.style.transform = `translate(${Math.random() * 100 - 50}px, ${
            Math.random() * 100 - 50
          }px) rotate(${Math.random() * 360 - 180}deg)`;
          letter.style.opacity = "0";
        }, index * 50);
      });

      // Create particles
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      for (let i = 0; i < 30; i++) {
        const particle = document.createElement("div");
        particle.classList.add("particle");
        document.body.appendChild(particle);
        particle.style.left = `${centerX}px`;
        particle.style.top = `${centerY}px`;
        particle.style.opacity = "0";

        setTimeout(() => {
          particle.style.opacity = "1";
          particle.style.transform = `translate(${
            Math.random() * 120 - 60
          }px, ${Math.random() * 120 - 60}px) scale(${
            Math.random() * 0.8 + 0.4
          })`;
          setTimeout(() => {
            particle.style.opacity = "0";
            setTimeout(() => particle.remove(), 300);
          }, 400);
        }, Math.random() * 300);
      }

      // After out animation, animate in new text
      setTimeout(() => {
        // Update background text first
        const backgroundTextEl = containerRef.current!
          .previousElementSibling as HTMLElement;
        if (backgroundTextEl) {
          backgroundTextEl.textContent = targetText;
        }

        splitText(targetText);
        const newLetters = containerRef.current!.querySelectorAll(
          ".letter"
        ) as NodeListOf<HTMLSpanElement>;

        // Calculate delay to make full text appear in 1.5 seconds
        const totalAnimationTime = 1500; // 1.5 seconds
        const letterDelay = Math.min(
          50,
          totalAnimationTime / Math.max(newLetters.length, 1)
        );

        newLetters.forEach((letter, index) => {
          letter.classList.add("morphing");
          letter.style.transform = `translate(${Math.random() * 100 - 50}px, ${
            Math.random() * 100 - 50
          }px) rotate(${Math.random() * 360 - 180}deg)`;
          letter.style.opacity = "0";
          setTimeout(() => {
            letter.style.transform = "translate(0, 0) rotate(0deg)";
            letter.style.opacity = "1";
            setTimeout(() => {
              letter.classList.remove("morphing");

              // Start gradual disappearance after animation completes
              letter.style.transition = "opacity 300ms ease-out";
              letter.style.opacity = "0";

              const mtr = magicTextRef.current;
              if (mtr) {
                mtr.style.transition = "opacity 300ms ease-out";
                mtr.style.opacity = "0";
              }
            }, 500);
          }, index * letterDelay);
        });
      }, letters.length * 50 + 500);
    };

    useEffect(() => {
      splitText(originalText);
    }, [originalText, splitText]);

    useImperativeHandle(ref, () => ({
      castSpell,
      streamToken,
      reset,
    }));

    const css = `
      .magic-text-overlay {
        position: absolute;
        top: 2px;
        left: 2px;
        right: 2px;
        bottom: 2px;
        pointer-events: none;
        z-index: 30;
        overflow: hidden;
        border-radius: inherit;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      }
      .magic-text-content {
        width: 100%;
        height: 100%;
        padding: 1.5rem;
        margin: 0;
        box-sizing: border-box;
        font-size: 1.125rem;
        line-height: 1.75rem;
        font-family: inherit;
        font-weight: inherit;
        letter-spacing: inherit;
        text-align: left;
        white-space: pre-wrap;
        word-break: normal;
        overflow-wrap: normal;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      }
      .magic-text-inner {
        width: 100%;
        min-height: 100%;
        display: block;
        position: relative;
      }
      .magic-text-background {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(to right, hsl(var(--primary)), #9333ea);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        color: transparent;
        white-space: pre-wrap;
        word-break: normal;
        overflow-wrap: normal;
        z-index: 1;
      }
      .magic-text-letters {
        position: relative;
        z-index: 2;
        background: hsl(var(--background));
      }
      .word {
        display: inline-block;
      }
      .letter {
        display: inline-block;
        transition: transform 0.5s ease, opacity 0.5s ease, text-shadow 0.3s ease;
        vertical-align: baseline;
      }
      .letter.morphing {
        background: linear-gradient(to right, hsl(var(--primary)), #9333ea);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 0 10px hsl(var(--primary));
      }
      .letter.streaming {
        background: linear-gradient(to right, hsl(var(--primary)), #9333ea);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 0 5px hsl(var(--primary));
        animation: streamingGlow 0.5s ease-in-out;
      }
      .letter.initial-magic {
        animation: magicalFloat 2s infinite ease-in-out;
      }
      @keyframes streamingGlow {
        0% {
          filter: drop-shadow(0 0 2px hsl(var(--primary)));
          transform: scale(1.05);
        }
        50% {
          filter: drop-shadow(0 0 8px hsl(var(--primary)));
          transform: scale(1.1);
        }
        100% {
          filter: drop-shadow(0 0 3px hsl(var(--primary)));
          transform: scale(1);
        }
      }
      @keyframes magicalFloat {
        0%, 100% {
          transform: translateY(0px);
          filter: drop-shadow(0 0 3px hsl(var(--primary)));
        }
        50% {
          transform: translateY(-1px);
          filter: drop-shadow(0 0 6px hsl(var(--primary)));
        }
      }
      .particle {
        position: fixed;
        width: 3px;
        height: 3px;
        background: hsl(var(--primary));
        border-radius: 50%;
        pointer-events: none;
        transition: transform 0.5s ease-out, opacity 0.5s ease;
        z-index: 9999;
      }
    `;

    return (
      <div className="magic-text-overlay bg-background" ref={magicTextRef}>
        <style>{css}</style>
        <div className="magic-text-content">
          <div className="magic-text-inner">
            <div className="magic-text-background">{originalText}</div>
            <div className="magic-text-letters" ref={containerRef}></div>
          </div>
        </div>
      </div>
    );
  }
);

MagicText.displayName = "MagicText";
