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
  startStreaming: () => void;
}

interface LetterState {
  char: string;
  element?: HTMLSpanElement;
  isNew?: boolean;
  animationComplete?: boolean;
}

export const MagicText = forwardRef<MagicTextHandle, MagicTextProps>(
  ({ originalText }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const magicTextRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isInitial, setIsInitial] = useState(true);
    const [isStreaming, setIsStreaming] = useState(false);
    const lettersStateRef = useRef<LetterState[]>([]);
    const currentTextRef = useRef<string>("");

    // Smooth scroll to keep the latest content visible
    const scrollToLatest = useCallback(() => {
      if (!scrollContainerRef.current) return;

      const scrollContainer = scrollContainerRef.current;
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;

      // Only scroll if content overflows
      if (scrollHeight > clientHeight) {
        scrollContainer.scrollTo({
          top: scrollHeight - clientHeight,
          behavior: "smooth",
        });
      }
    }, []);

    const applyGradientToLetter = useCallback(
      (letterSpan: HTMLSpanElement, index: number, textLength: number) => {
        const hueStart = 280; // Purple
        const hueEnd = 320; // Pink/Purple
        const hue =
          hueStart + (index / Math.max(textLength, 1)) * (hueEnd - hueStart);

        // Apply styles in the correct order for proper text gradient
        letterSpan.style.background = `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${
          hue + 20
        }, 70%, 70%))`;
        letterSpan.style.webkitBackgroundClip = "text";
        letterSpan.style.backgroundClip = "text";
        letterSpan.style.webkitTextFillColor = "transparent";
        letterSpan.style.color = "transparent";

        // Fallback for browsers that don't support text gradients
        if (
          !CSS.supports("background-clip", "text") &&
          !CSS.supports("-webkit-background-clip", "text")
        ) {
          letterSpan.style.color = `hsl(${hue}, 70%, 60%)`;
          letterSpan.style.background = "none";
        }
      },
      []
    );

    const createLetterElement = useCallback(
      (char: string, index: number, isNewLetter: boolean = false) => {
        const letterSpan = document.createElement("span");
        letterSpan.classList.add("letter");

        // Set the text content
        if (char === " ") {
          letterSpan.innerHTML = "&nbsp;";
        } else if (char === "\n") {
          letterSpan.textContent = "\n";
          letterSpan.style.whiteSpace = "pre";
        } else {
          letterSpan.textContent = char;
        }

        // Apply gradient styling
        const textLength = currentTextRef.current.length || 1;
        applyGradientToLetter(letterSpan, index, textLength);

        if (isNewLetter) {
          // Start with invisible state for magic entrance
          letterSpan.style.opacity = "0";
          letterSpan.style.transform = `translate(${
            Math.random() * 60 - 30
          }px, ${Math.random() * 60 - 30}px) rotate(${
            Math.random() * 360 - 180
          }deg) scale(0.5)`;
          letterSpan.classList.add("morphing-in");

          // Force reflow to ensure initial styles are applied
          letterSpan.offsetHeight;

          // Animate in with magic effect
          requestAnimationFrame(() => {
            letterSpan.style.transform =
              "translate(0, 0) rotate(0deg) scale(1)";
            letterSpan.style.opacity = "1";
            letterSpan.classList.add("magic-glow");

            setTimeout(() => {
              letterSpan.classList.remove("morphing-in");
              letterSpan.classList.remove("magic-glow");
            }, 600);
          });
        }

        return letterSpan;
      },
      [applyGradientToLetter]
    );

    const updateGradients = useCallback(() => {
      // Update all existing letters' gradients based on their position in the full text
      const textLength = currentTextRef.current.length || 1;
      lettersStateRef.current.forEach((letterState, index) => {
        if (
          letterState.element &&
          !letterState.element.classList.contains("morphing-out")
        ) {
          applyGradientToLetter(letterState.element, index, textLength);
        }
      });
    }, [applyGradientToLetter]);

    const initializeText = useCallback(
      (text: string) => {
        if (!containerRef.current) return;

        currentTextRef.current = text;

        // Update background text
        const backgroundTextEl = containerRef.current
          .previousElementSibling as HTMLElement;
        if (backgroundTextEl) {
          backgroundTextEl.textContent = text;
        }

        // Clear existing content
        containerRef.current.innerHTML = "";
        lettersStateRef.current = [];

        // Create initial letters
        text.split("").forEach((char, index) => {
          const letterSpan = createLetterElement(char, index, false);

          if (text === originalText && isInitial) {
            letterSpan.classList.add("initial-magic");
            const totalInitialTime = 1500;
            const letterDelay = Math.min(
              50,
              totalInitialTime / Math.max(text.length, 1)
            );
            letterSpan.style.animationDelay = `${index * letterDelay}ms`;
          }

          containerRef.current!.appendChild(letterSpan);
          lettersStateRef.current.push({ char, element: letterSpan });
        });
      },
      [originalText, isInitial, createLetterElement]
    );

    const streamToken = useCallback(
      (token: string, fullText: string) => {
        if (!containerRef.current) return;

        // If this is the first streaming token, clear existing content
        if (!isStreaming) {
          setIsStreaming(true);
          containerRef.current.innerHTML = "";
          lettersStateRef.current = [];
          currentTextRef.current = "";
        }

        currentTextRef.current = fullText;

        // Update background text
        const backgroundTextEl = containerRef.current
          .previousElementSibling as HTMLElement;
        if (backgroundTextEl) {
          backgroundTextEl.textContent = fullText;
        }

        // Calculate how many new characters to add
        const currentLength = lettersStateRef.current.length;
        const newChars = fullText.slice(currentLength);

        if (newChars.length === 0) return;

        // Add new letters with magic effect
        newChars.split("").forEach((char, localIndex) => {
          const globalIndex = currentLength + localIndex;
          const letterSpan = createLetterElement(char, globalIndex, true);

          containerRef.current!.appendChild(letterSpan);
          lettersStateRef.current.push({
            char,
            element: letterSpan,
            isNew: true,
          });
        });

        // Update all gradients to reflect new text length
        requestAnimationFrame(() => {
          updateGradients();
          // Smooth scroll to show the latest content after a short delay to allow for animation
          setTimeout(() => {
            scrollToLatest();
          }, 100);
        });
      },
      [createLetterElement, updateGradients, scrollToLatest, isStreaming]
    );

    const reset = useCallback(() => {
      setIsInitial(true);
      setIsStreaming(false);
      lettersStateRef.current = [];
      currentTextRef.current = "";
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    }, []);

    const startStreaming = useCallback(() => {
      setIsStreaming(false); // Reset streaming state to prepare for new stream
    }, []);

    const castSpell = useCallback(
      (targetText: string) => {
        if (!containerRef.current || !targetText) return;

        if (isInitial) {
          setIsInitial(false);
        }

        const currentLetters = lettersStateRef.current;

        // Animate out existing letters
        currentLetters.forEach((letterState, index) => {
          if (letterState.element) {
            letterState.element.classList.remove("initial-magic");

            setTimeout(() => {
              if (letterState.element) {
                letterState.element.classList.add("morphing-out");
                letterState.element.style.transform = `translate(${
                  Math.random() * 100 - 50
                }px, ${Math.random() * 100 - 50}px) rotate(${
                  Math.random() * 360 - 180
                }deg) scale(0)`;
                letterState.element.style.opacity = "0";
              }
            }, index * 30);
          }
        });

        // Create magical particles
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

        // After out animation, create new text
        setTimeout(() => {
          // Clear old letters
          containerRef.current!.innerHTML = "";
          lettersStateRef.current = [];
          currentTextRef.current = targetText;

          // Update background text
          const backgroundTextEl = containerRef.current!
            .previousElementSibling as HTMLElement;
          if (backgroundTextEl) {
            backgroundTextEl.textContent = targetText;
          }

          // Create new letters with magical entrance
          const totalAnimationTime = 1500;
          const letterDelay = Math.min(
            50,
            totalAnimationTime / Math.max(targetText.length, 1)
          );

          targetText.split("").forEach((char, index) => {
            const letterSpan = createLetterElement(char, index, false);
            letterSpan.classList.add("morphing-in");
            letterSpan.style.transform = `translate(${
              Math.random() * 100 - 50
            }px, ${Math.random() * 100 - 50}px) rotate(${
              Math.random() * 360 - 180
            }deg) scale(0)`;
            letterSpan.style.opacity = "0";

            containerRef.current!.appendChild(letterSpan);
            lettersStateRef.current.push({ char, element: letterSpan });

            setTimeout(() => {
              letterSpan.style.transform =
                "translate(0, 0) rotate(0deg) scale(1)";
              letterSpan.style.opacity = "1";
              letterSpan.classList.add("magic-glow");

              setTimeout(() => {
                letterSpan.classList.remove("morphing-in");
                letterSpan.classList.remove("magic-glow");
              }, 500);
            }, index * letterDelay);
          });

          // Update gradients for new text
          requestAnimationFrame(() => {
            updateGradients();
          });
        }, currentLetters.length * 30 + 500);
      },
      [isInitial, createLetterElement, updateGradients]
    );

    useEffect(() => {
      initializeText(originalText);
    }, [originalText, initializeText]);

    useImperativeHandle(ref, () => ({
      castSpell,
      streamToken,
      reset,
      startStreaming,
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
        overflow-y: auto;
        overflow-x: hidden;
        scroll-behavior: smooth;
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
        opacity: 0.1;
      }
      .magic-text-letters {
        position: relative;
        z-index: 2;
      }
      .letter {
        display: inline-block;
        transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), 
                    opacity 0.6s ease,
                    filter 0.3s ease;
        vertical-align: baseline;
        will-change: transform, opacity;
        /* Ensure text is visible even if gradient fails */
        color: hsl(var(--primary));
      }
      .letter.morphing-in {
        filter: drop-shadow(0 0 15px hsl(var(--primary) / 0.5)) brightness(1.5);
      }
      .letter.morphing-out {
        filter: blur(2px);
      }
      .letter.magic-glow {
        animation: magicGlow 0.6s ease-in-out;
      }
      .letter.initial-magic {
        animation: magicalFloat 2s infinite ease-in-out;
      }
      @keyframes magicGlow {
        0% {
          filter: drop-shadow(0 0 5px hsl(var(--primary) / 0.3)) brightness(1);
        }
        50% {
          filter: drop-shadow(0 0 20px hsl(var(--primary) / 0.6)) brightness(1.8) contrast(1.2);
          transform: scale(1.15);
        }
        100% {
          filter: drop-shadow(0 0 8px hsl(var(--primary) / 0.4)) brightness(1.2);
          transform: scale(1);
        }
      }
      @keyframes magicalFloat {
        0%, 100% {
          transform: translateY(0px);
          filter: drop-shadow(0 0 3px hsl(var(--primary) / 0.3)) brightness(1.1);
        }
        50% {
          transform: translateY(-2px);
          filter: drop-shadow(0 0 8px hsl(var(--primary) / 0.5)) brightness(1.3);
        }
      }
      .particle {
        position: fixed;
        width: 4px;
        height: 4px;
        background: radial-gradient(circle, hsl(var(--primary)), transparent);
        border-radius: 50%;
        pointer-events: none;
        transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), 
                    opacity 0.6s ease;
        z-index: 9999;
        filter: blur(0.5px);
      }
    `;

    return (
      <div className="magic-text-overlay bg-background" ref={magicTextRef}>
        <style>{css}</style>
        <div className="magic-text-content" ref={scrollContainerRef}>
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
