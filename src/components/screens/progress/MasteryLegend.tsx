import type { Mastery } from "@/engine/records";

/**
 * Deliberately gentle. A child reads this about their own work, and "Not
 * tried" reads as a reproach where "Not tried yet" reads as a plan. Don't
 * tighten this copy for brevity.
 */
export const MASTERY_LABEL: Record<Mastery, string> = {
  untried: "Not tried yet",
  learning: "Still learning",
  solid: "Getting there",
  mastered: "Mastered",
};

export const MASTERY_ORDER: Mastery[] = [
  "untried",
  "learning",
  "solid",
  "mastered",
];

/** Shared by the times-table grid and the word list — same colours, same words. */
export function MasteryLegend() {
  return (
    <ul className="legend">
      {MASTERY_ORDER.map((level) => (
        <li key={level} className="legend__item">
          <span className={`legend__swatch is-${level}`} aria-hidden="true" />
          {MASTERY_LABEL[level]}
        </li>
      ))}
    </ul>
  );
}
