import type { CSSProperties } from "react";

import type { Problem } from "@/engine/sheets/types";

import { NumberLineView } from "../NumberLine";
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
 *
 * **This is the shared primitive.** Every maths family prints through it
 * rather than adding a block of its own, so the three shapes below are the
 * three shapes an arithmetic problem takes and not three families' worth of
 * markup: written along a line, written along a line with the gap inside it,
 * or stacked in columns the way a sum is worked.
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
          {problem.operands ? (
            <Stacked problem={problem} answers={metrics.answers} />
          ) : (
            <Written problem={problem} answers={metrics.answers} />
          )}
          {problem.line && <NumberLineView line={problem.line} />}
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

type Part = { problem: Problem; answers: boolean };

/**
 * A problem written along a line, with the answer wherever the prompt says.
 *
 * A single `_` in the prompt marks a gap inside the sentence — "7 + _ = 15" —
 * and everything else takes a ruled slot at the end. One rule, so a problem
 * can only ever have one place to write the answer: a missing-number sheet
 * that also drew a slot on the end would be a sheet a child answers twice.
 */
function Written({ problem, answers }: Part) {
  const gap = problem.prompt.indexOf("_");
  if (gap < 0) {
    return (
      <>
        <span className="sheet__prompt">{problem.prompt}</span>
        <Slot answer={problem.answer} answers={answers} />
      </>
    );
  }
  return (
    <span className="sheet__prompt">
      {problem.prompt.slice(0, gap)}
      <Slot answer={problem.answer} answers={answers} />
      {problem.prompt.slice(gap + 1)}
    </span>
  );
}

/**
 * The same sum, stacked: the numbers right-aligned under one another, the sign
 * against the last of them, and a rule with the answer under it.
 *
 * Column form is not a style choice — it is how carrying is taught, and a
 * child who has been shown to line the units up notices when they aren't. The
 * digits sit in `tabular-nums` for that reason and no other.
 */
function Stacked({ problem, answers }: Part) {
  const operands = problem.operands ?? [];
  return (
    <span className="sheet__column">
      {operands.map((operand, index) => (
        <span className="sheet__addend" key={`${index}-${operand}`}>
          <span className="sheet__operator">
            {index === operands.length - 1 ? problem.operator : ""}
          </span>
          <span>{operand}</span>
        </span>
      ))}
      <span
        className={`sheet__total${answers ? " sheet__total--answered" : ""}`}
      >
        {answers ? problem.answer : ""}
      </span>
    </span>
  );
}

/** Where the answer goes: a ruled blank, or the answer the build computed. */
function Slot({ answer, answers }: { answer: string; answers: boolean }) {
  return (
    <span className={`sheet__slot${answers ? " sheet__slot--answered" : ""}`}>
      {answers ? answer : ""}
    </span>
  );
}
