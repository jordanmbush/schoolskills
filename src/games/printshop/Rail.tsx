/**
 * The rail's steps: numbered, in the order a stranger needs them, each showing
 * what was chosen in it (§14).
 *
 * A step is a disclosure button rather than a tab, because a tab list always
 * has one tab selected and the state this rail has to be able to show is
 * "nothing open". Each says with `aria-expanded` whether its section is the
 * one in the tray, and with `aria-current` that it is where the process is.
 *
 * The number says there is an order, the value line says what is set without
 * opening anything, and any step can be opened at any time. The tray's own
 * "Next" (App.tsx) is what walks the order; the rail only shows it.
 *
 * "My sheets" is not a step in making a sheet, so it is not numbered and sits
 * apart at the end.
 */
import { useEffect, type RefObject } from "react";

import { Button } from "@/components/ui/kit";

/** What the tray under the rail can hold. */
export type Section =
  "sheet" | "family" | "paper" | "lettering" | "heading" | "mine";

/** One numbered step: its name, and the line that says what is set in it. */
export type Step = { id: Section; name: string; value: string };

/** The tray every button on the rail controls. */
export const TRAY_ID = "bench-tray";

export function Rail({
  steps,
  open,
  onToggle,
}: {
  steps: Step[];
  open: Section | null;
  onToggle: (section: Section) => void;
}) {
  return (
    <div className="rail wrap">
      <ol className="rail__steps" aria-label="Steps">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Button
              variant="bare"
              className="step"
              aria-expanded={open === step.id}
              aria-current={open === step.id ? "step" : undefined}
              aria-controls={TRAY_ID}
              onClick={() => onToggle(step.id)}
            >
              <span className="step__num" aria-hidden="true">
                {index + 1}
              </span>
              <span className="step__name">
                <span className="u-sr">Step {index + 1}: </span>
                {step.name}
              </span>
              <span className="step__value">{step.value}</span>
            </Button>
          </li>
        ))}
      </ol>

      <Button
        variant="bare"
        className="step step--aside"
        aria-expanded={open === "mine"}
        aria-controls={TRAY_ID}
        onClick={() => onToggle("mine")}
      >
        <span className="step__name">My sheets</span>
        <span className="step__value">Saved on this device</span>
      </Button>
    </div>
  );
}

/**
 * Pins the rail under the masthead by measuring it.
 *
 * The masthead's height is measured rather than assumed because it wraps to two
 * rows on a narrow screen before it stops being sticky (chrome.css), and a rail
 * pinned at a guessed height either hides behind it or floats over a strip of
 * scrolling page. The number lands as `--mast-height` on the rail's own
 * element, and printshop.css decides when it applies.
 */
export function useUnderMasthead(rail: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const mast = document.querySelector<HTMLElement>(".mast");
    const element = rail.current;
    if (!mast || !element) return;

    const observer = new ResizeObserver(() => {
      element.style.setProperty("--mast-height", `${mast.offsetHeight}px`);
    });
    observer.observe(mast);
    return () => observer.disconnect();
  }, [rail]);
}
