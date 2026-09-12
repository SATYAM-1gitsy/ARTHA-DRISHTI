/**
 * The accessibility / utility strip — GIGW's most recognisable signal.
 *
 * The two controls here do real work rather than standing in for it:
 *
 * - **Text size** sets a class on <html>, and every font-size in the
 *   stylesheet is expressed in rem, so the whole interface actually grows.
 *   Paddings stay in px so the layout gives the larger type room instead of
 *   scaling into it.
 * - **High contrast** sets a second class on <html> which redefines the
 *   design tokens. Because nothing in the app hard-codes a colour any more,
 *   one class reaches the chrome and the data views alike.
 *
 * Both preferences persist, because an officer who needs 19px text needs it on
 * every visit; storage is wrapped because a locked-down browser will throw on
 * access rather than return null.
 */

import { useEffect, useState } from "react";

import { MINISTRY_CONTEXT, PROTOTYPE_TAG } from "./disclaimers";

type TextSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<TextSize, string> = {
  sm: "text-sm",
  md: "",
  lg: "text-lg",
};

const SIZES: { key: TextSize; label: string; title: string }[] = [
  { key: "sm", label: "A−", title: "Decrease text size" },
  { key: "md", label: "A", title: "Normal text size" },
  { key: "lg", label: "A+", title: "Increase text size" },
];

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A browser with site data blocked still gets a working control for the
    // length of the session; only the memory of it is lost.
  }
}

export default function AccessibilityBar() {
  const [size, setSize] = useState<TextSize>(
    () => (readStored("drishti.textSize") as TextSize | null) ?? "md",
  );
  const [contrast, setContrast] = useState(
    () => readStored("drishti.highContrast") === "on",
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("text-sm", "text-lg");
    if (SIZE_CLASS[size]) root.classList.add(SIZE_CLASS[size]);
    writeStored("drishti.textSize", size);
  }, [size]);

  useEffect(() => {
    document.documentElement.classList.toggle("hc", contrast);
    writeStored("drishti.highContrast", contrast ? "on" : "off");
  }, [contrast]);

  return (
    <div className="gov-utility">
      <div className="gov-container">
        <span className="gov-utility__context">{MINISTRY_CONTEXT}</span>

        <div className="gov-utility__controls">
          <div className="gov-utility__group" role="group" aria-label="Text size">
            <span className="gov-utility__grouplabel" aria-hidden="true">
              Text size
            </span>
            {SIZES.map((option) => (
              <button
                key={option.key}
                type="button"
                className="a11y-btn"
                aria-pressed={size === option.key}
                aria-label={option.title}
                title={option.title}
                onClick={() => setSize(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="a11y-btn"
            aria-pressed={contrast}
            onClick={() => setContrast((on) => !on)}
            title="Toggle high contrast"
          >
            High contrast
          </button>

          {/* Never conditional, never dismissible. */}
          <span className="gov-tag">{PROTOTYPE_TAG}</span>
        </div>
      </div>
    </div>
  );
}
