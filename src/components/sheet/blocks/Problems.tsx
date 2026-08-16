import type { CSSProperties } from "react";

import { inch } from "../units";
import type { BlockProps } from "./block";

/**
 * Numbered problems in columns.
 *
 * Real text in a real list, not a drawing — which is the half of §2 that the
 * SVG blocks can't do: the problems on a multiplication sheet are content a
 * search engine reads, a screen reader announces and a parent can select and
 * copy. It is also the block that decides whether a print preview is right the
 * first time, so `.sheet__problem` carries `break-inside: avoid` (§10).
 *
 * The answer prints when the sheet says so and is blank when it doesn't. Both
 * come from the same build, so a key cannot disagree with its sheet (§7).
 */
export function Problems({ block, metrics }: BlockProps<"problems">) {
  const columns = Math.max(1, Math.floor(block.columns));

  return (
    <ol
      className="sheet__problems"
      style={{ "--sheet-columns": columns } as CSSProperties}
    >
      {block.items.map((problem, index) => (
        <li className="sheet__problem" key={`${index}-${problem.prompt}`}>
          {/* The number is written out rather than left to a list marker:
              `base.css` strips markers site-wide, and a numbered problem a
              child is told to "do 4, 7 and 12 of" has to carry its number as
              text anyway. */}
          <span className="sheet__number">{index + 1}.</span>
          <span className="sheet__prompt">{problem.prompt}</span>
          <span
            className={`sheet__slot${
              metrics.answers ? " sheet__slot--answered" : ""
            }`}
          >
            {metrics.answers ? problem.answer : ""}
          </span>
          {problem.workspace !== undefined && (
            <span
              className="sheet__workspace"
              style={{ height: inch(problem.workspace) }}
              aria-hidden="true"
            />
          )}
        </li>
      ))}
    </ol>
  );
}
