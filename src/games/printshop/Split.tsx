/**
 * The button on the line between the two panes, and whether there is a line.
 *
 * It flips the bench between its two rooms — the settings wide and the paper
 * small, or the paper nearly full size and the settings folded to a strip of
 * step numbers — by moving the split it sits on, so it is always where the
 * split is. Halfway down rather than in a corner because it is the hinge and
 * not a tool: pressing it changes the shape of the screen, and a button that
 * does that belongs on the line that moves (§14).
 *
 * The two rooms only exist side by side. Under `SPLIT` the panes stack, the
 * paper is already as wide as the screen, and there is nothing to flip — so
 * `useSplit` says whether the line is on screen at all, and App.tsx folds
 * nothing while it is not. A window narrowed while the paper was large would
 * otherwise leave every control on the page unpressable, with the one button
 * that brings them back hidden by the same width.
 */
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/kit";

/** The width the panes sit side by side from. printshop.css asks the same. */
const SPLIT = "(width >= 62rem)";

export function useSplit(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia(SPLIT).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(SPLIT);
    const onChange = () => setWide(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return wide;
}

export function SplitButton({
  large,
  onToggle,
}: {
  large: boolean;
  onToggle: () => void;
}) {
  const label = large ? "Back to the settings" : "See the sheet large";
  return (
    <Button
      variant="bare"
      className="bench__split no-print"
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      {/* One chevron, turned by CSS rather than swapped: it points the way
          the split is about to move. */}
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          d="M15 6l-6 6 6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Button>
  );
}
