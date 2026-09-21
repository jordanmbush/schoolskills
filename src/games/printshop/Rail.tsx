/**
 * The rail: one strip across the top of the bench holding everything a parent
 * reaches for, in the order they reach for it (§14).
 *
 * Above, the sheet's name, which opens the chooser, and at the other end what
 * leaves the bench as paper. Below, a tab for each section of options; the one
 * that is open is pressed again to close, so the paper can have the whole
 * screen.
 *
 * Disclosure buttons rather than a tab list, because a tab list always has one
 * tab selected and the state this rail has to be able to show is "nothing
 * open". Each button says with `aria-expanded` whether its section is the one
 * in the tray.
 */
import { useEffect, type RefObject } from "react";

import { Button } from "@/components/ui/kit";

import { PrintBar } from "./PrintBar";

/** What the tray under the rail can hold. */
export type Section =
  "sheet" | "family" | "paper" | "lettering" | "heading" | "mine";

/** The tray every button on the rail controls. */
export const TRAY_ID = "bench-tray";

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: "paper", label: "Paper" },
  { id: "lettering", label: "Lettering" },
  { id: "heading", label: "Heading" },
  { id: "mine", label: "My sheets" },
];

export function Rail({
  sheet,
  tab,
  open,
  onToggle,
  variants,
  answers,
  onVariants,
  onAnswers,
}: {
  /** The family on the bench, as it reads. */
  sheet: string;
  /** What the family's own tab is called, or nothing for a family with no options. */
  tab: string | undefined;
  open: Section | null;
  onToggle: (section: Section) => void;
  variants: number;
  answers: boolean;
  onVariants: (count: number) => void;
  onAnswers: (on: boolean) => void;
}) {
  const tabs = tab
    ? [{ id: "family" as const, label: tab }, ...SECTIONS]
    : SECTIONS;

  return (
    <div className="rail wrap">
      <Button
        variant="bare"
        className="rail__sheet"
        aria-expanded={open === "sheet"}
        aria-controls={TRAY_ID}
        onClick={() => onToggle("sheet")}
      >
        <span className="rail__chip">Sheet</span>
        <span className="rail__name">{sheet}</span>
        <span className="rail__caret" aria-hidden="true">
          ▾
        </span>
      </Button>

      <div className="rail__tabs">
        {tabs.map((section) => (
          <Button
            key={section.id}
            variant="bare"
            className="rail__tab"
            aria-expanded={open === section.id}
            aria-controls={TRAY_ID}
            onClick={() => onToggle(section.id)}
          >
            {section.label}
          </Button>
        ))}
      </div>

      <PrintBar
        variants={variants}
        answers={answers}
        onVariants={onVariants}
        onAnswers={onAnswers}
      />
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
