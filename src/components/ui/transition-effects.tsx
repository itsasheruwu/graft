import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function readDuration(name: string, fallback: number) {
  if (typeof window === "undefined") {
    return fallback;
  }
  const value = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(name)
  );
  return Number.isFinite(value) ? value : fallback;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function AnimatedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [displayText, setDisplayText] = React.useState(text);
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (displayText === text) {
      return;
    }

    const element = ref.current;
    if (!element || prefersReducedMotion()) {
      setDisplayText(text);
      return;
    }

    const duration = readDuration("--text-swap-dur", 150);
    element.classList.add("is-exit");
    const timer = window.setTimeout(() => {
      setDisplayText(text);
      window.requestAnimationFrame(() => {
        element.classList.remove("is-exit");
        element.classList.add("is-enter-start");
        void element.offsetHeight;
        element.classList.remove("is-enter-start");
      });
    }, duration);

    return () => {
      window.clearTimeout(timer);
      element.classList.remove("is-exit", "is-enter-start");
    };
  }, [displayText, text]);

  return (
    <span ref={ref} className={cn("t-text-swap", className)}>
      {displayText}
    </span>
  );
}

export function AnimatedStatusText({
  message,
  isError,
  className,
}: {
  message?: string | null;
  isError?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "min-h-[1rem]",
        isError ? "text-destructive" : "text-primary",
        className
      )}
      aria-live="polite"
    >
      <AnimatedText text={message ?? ""} />
    </p>
  );
}

export function AnimatedNumber({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  const text = String(value);
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion()) {
      return;
    }
    element.classList.remove("is-animating");
    void element.offsetHeight;
    element.classList.add("is-animating");
  }, [text]);

  return (
    <span ref={ref} className={cn("t-digit-group is-animating", className)}>
      {text.split("").map((char, index) => {
        const stagger =
          index === text.length - 2 ? "1" : index === text.length - 1 ? "2" : undefined;
        return (
          <span key={`${index}-${char}`} className="t-digit" data-stagger={stagger}>
            {char}
          </span>
        );
      })}
    </span>
  );
}

export function SlidingSegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  disabled,
  className,
}: {
  options: { value: TValue; label: string }[];
  value: TValue;
  onChange: (value: TValue) => void;
  disabled?: boolean;
  className?: string;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const pillRef = React.useRef<HTMLSpanElement>(null);

  const movePill = React.useCallback((animate: boolean) => {
    const root = rootRef.current;
    const pill = pillRef.current;
    const active = root?.querySelector<HTMLButtonElement>(
      '.t-tab[aria-selected="true"]'
    );
    if (!root || !pill || !active) {
      return;
    }

    if (!animate) {
      const previous = pill.style.transition;
      pill.style.transition = "none";
      pill.style.transform = `translateX(${active.offsetLeft}px)`;
      pill.style.width = `${active.offsetWidth}px`;
      void pill.offsetWidth;
      pill.style.transition = previous;
      return;
    }

    pill.style.transform = `translateX(${active.offsetLeft}px)`;
    pill.style.width = `${active.offsetWidth}px`;
  }, []);

  React.useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => movePill(false));
    return () => window.cancelAnimationFrame(frame);
  }, [movePill]);

  React.useLayoutEffect(() => {
    movePill(true);
  }, [movePill, value]);

  React.useEffect(() => {
    const onResize = () => movePill(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [movePill]);

  return (
    <div
      ref={rootRef}
      className={cn("t-tabs", disabled && "opacity-60", className)}
      role="tablist"
    >
      <span ref={pillRef} className="t-tabs-pill" aria-hidden />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="t-tab"
          role="tab"
          aria-selected={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ClearableSearchInput({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [isClearing, setIsClearing] = React.useState(false);
  const [mirrorText, setMirrorText] = React.useState("");
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const glowRef = React.useRef<HTMLDivElement>(null);
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const clear = () => {
    if (!value || isClearing) {
      return;
    }

    const keepFocus = document.activeElement === inputRef.current;
    const duration = prefersReducedMotion() ? 0 : readDuration("--clear-dur", 1000);
    setMirrorText(value);
    setIsClearing(true);
    onChange("");

    if (glowRef.current) {
      glowRef.current.style.background = buildClearGlow(value, wrapRef.current, inputRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      setIsClearing(false);
      setMirrorText("");
      if (glowRef.current) {
        glowRef.current.style.background = "";
      }
      if (keepFocus) {
        inputRef.current?.focus({ preventScroll: true });
      }
    }, duration);
  };

  return (
    <div
      ref={wrapRef}
      className={cn(
        "t-clear flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-within:ring-2 focus-within:ring-ring",
        value && "has-value",
        isClearing && "is-clearing",
        className
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-transparent"
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="t-clear-mirror px-3" aria-hidden>
        {(isClearing ? mirrorText : value).replace(/ /g, "\u00a0")}
      </div>
      <div className="t-clear-placeholder px-3 text-muted-foreground" aria-hidden>
        {placeholder}
      </div>
      <div ref={glowRef} className="t-clear-glow" aria-hidden />
      {value || isClearing ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="t-clear-btn relative z-10 -mr-1 ml-2 size-6 shrink-0"
          aria-label="Clear search"
          onMouseDown={(event) => event.preventDefault()}
          onPointerDown={(event) => event.preventDefault()}
          onClick={clear}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function buildClearGlow(
  text: string,
  wrap: HTMLDivElement | null,
  input: HTMLInputElement | null
) {
  if (typeof document === "undefined") {
    return "";
  }

  const canvas = document.createElement("canvas").getContext("2d");
  if (!canvas) {
    return "";
  }

  const root = document.documentElement;
  const wrapWidth = wrap?.clientWidth || 280;
  const inputStyle = input ? getComputedStyle(input) : null;
  canvas.font = inputStyle?.font || "14px sans-serif";
  const padLeft = Number.parseFloat(inputStyle?.paddingLeft || "12") || 12;
  const spread = readDuration("--glow-spread", 1.5);
  const isDark =
    root.classList.contains("dark") ||
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const rgb = isDark ? "255,255,255" : "0,0,0";
  const layers: string[] = [];
  let x = 0;

  text.split(/(\s+)/).forEach((segment) => {
    const segmentWidth = canvas.measureText(segment).width;
    if (segment.trim()) {
      const center = padLeft + x + segmentWidth / 2;
      const halfWidth = Math.max(segmentWidth * 0.45, 8) * spread;
      [
        [0, 0.8, 7, 0.22],
        [halfWidth * 0.45, 0.55, 8, 0.18],
        [-halfWidth * 0.4, 0.65, 6, 0.16],
        [halfWidth * 0.15, 0.9, 5, 0.14],
      ].forEach(([dx, widthMultiplier, radiusHeight, alpha]) => {
        const left = (((center + dx) / wrapWidth) * 100).toFixed(2);
        layers.push(
          `radial-gradient(ellipse ${Math.max(
            halfWidth * widthMultiplier,
            2
          ).toFixed(1)}px ${radiusHeight}px at ${left}% 100%, rgba(${rgb},${alpha}), transparent)`
        );
      });
    }
    x += segmentWidth;
  });

  return layers.join(", ");
}
