import type { CSSProperties } from "react";

import type { Problem } from "@/engine/sheets/types";

import { ClockFaceView } from "../ClockFace";
import { FigureView } from "../Figure";
import { FractionArtView } from "../FractionArt";
import { NumberLineView } from "../NumberLine";
import { inch } from "../units";
import type { BlockProps } from "./block";

/**
 * Numbered problems in columns.
 *
 * Real text in a real list, not a drawing — the half of §2 the SVG blocks can't
 * do. It is also the block that decides whether a print preview is right the
 * first time, so `.sheet__problem` carries `break-inside: avoid` (§10).
 *
 * The answer prints when the sheet says so and is blank when it doesn't. Both
 * come from the same build, so a key cannot disagree with its sheet (§7).
 *
 * **This is the shared primitive.** Every maths family prints through it
 * rather than adding a block of its own, so the shapes below are the shapes an
 * arithmetic problem takes and not several families' worth of markup: written
 * along a line, written along a line with the gap inside it, stacked in columns
 * the way a sum is worked, set inside a division bracket, or answered on ruled
 * lines underneath when the answer is more than one sentence.
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
          {/* The pictures a problem asks about, before the blank they are
              answered in. On the sheet as well as on the key, because they are
              the question rather than the answer. */}
          {problem.art && <FractionArtView art={problem.art} />}
          {problem.figure && (
            <FigureView figure={problem.figure} fontPt={metrics.fontPt} />
          )}
          {asked(problem) && problem.clock && (
            <ClockFaceView face={problem.clock} answers={metrics.answers} />
          )}
          {/* A problem is set the way the data says it is set: a stack when
              there is a stack, a bracket when there is a bracket, a sentence
              otherwise — no flag beside the data to disagree with. */}
          {problem.bracket ? (
            <Bracket problem={problem} answers={metrics.answers} />
          ) : problem.operands ? (
            <Stacked problem={problem} answers={metrics.answers} />
          ) : (
            <Written problem={problem} answers={metrics.answers} />
          )}
          {/* And the one picture that is the answer rather than the question: a
              dial with no hands on it, which the key draws them onto. It comes
              after the time it is drawn from, where the ruled slot would have
              been on any other sheet — because it is the ruled slot. */}
          {drawn(problem) && problem.clock && (
            <ClockFaceView face={problem.clock} answers={metrics.answers} />
          )}
          {problem.line && <NumberLineView line={problem.line} />}
          <Below problem={problem} answers={metrics.answers} />
        </li>
      ))}
    </ol>
  );
}

type Part = { problem: Problem; answers: boolean };

/** Whether the answer is written on ruled lines under the problem. */
const ruled = (problem: Problem): boolean => (problem.answers?.length ?? 0) > 0;

/** Whether there is working to write between the problem and its answer. */
const worked = (problem: Problem): boolean =>
  (problem.working?.length ?? 0) > 0;

/**
 * Whether the problem's own drawing *is* the answer place — a clock face with no
 * hands on it, which the child draws and the key fills in.
 *
 * Read off the face rather than declared beside it, so the two cannot disagree,
 * and it does the same job `answers` does: it takes the ruled slot away, because
 * a problem has exactly one place to write the answer and a dial with a blank
 * beside it is a sheet a child answers twice.
 */
const drawn = (problem: Problem): boolean =>
  problem.clock !== undefined && !problem.clock.hands;

/** And whether it is the question, which is the same face the other way up. */
const asked = (problem: Problem): boolean =>
  problem.clock !== undefined && problem.clock.hands;

/**
 * A problem written along a line, with the answer wherever the prompt says.
 *
 * A single `_` in the prompt marks a gap inside the sentence — "7 + _ = 15" —
 * and everything else takes a ruled slot at the end, unless the answer is
 * already going on the lines below or onto the face of a clock. One rule, so a
 * problem can only ever have one place to write the answer: a missing-number
 * sheet that also drew a slot on the end, or a fact family that drew one beside
 * its four ruled lines, is a sheet a child answers twice.
 */
function Written({ problem, answers }: Part) {
  const gap = problem.prompt.indexOf("_");
  if (gap >= 0) {
    return (
      <span className="sheet__prompt">
        {problem.prompt.slice(0, gap)}
        <Slot answer={problem.answer} answers={answers} />
        {problem.prompt.slice(gap + 1)}
      </span>
    );
  }
  return (
    <>
      <span className="sheet__prompt">{problem.prompt}</span>
      {!ruled(problem) && !drawn(problem) && (
        <Slot answer={problem.answer} answers={answers} />
      )}
    </>
  );
}

/**
 * What sits under the problem: the lines its answer is written on, or blank
 * paper to work the answer out in — never both, because they are the same
 * paper. A problem whose answer is a list has already had its answer place
 * counted, and `workspace` is the height those lines share.
 *
 * A long multiplication has spent it too. Its working goes *inside* the stack,
 * between the rule and the total, because a partial product written anywhere
 * else is the mistake the sheet exists to practise out of a child.
 */
function Below({ problem, answers }: Part) {
  if (ruled(problem)) return <Ruled problem={problem} answers={answers} />;
  if (problem.workspace === undefined || worked(problem)) return null;
  return (
    <span
      className="sheet__workspace"
      style={{ height: inch(problem.workspace) }}
      aria-hidden="true"
    />
  );
}

/**
 * More than one answer to write, one ruled line each.
 *
 * A fact family asks for four number sentences, and the lines are where they
 * go on both halves of the build: a rule to write on when the sheet is blank,
 * the sentence itself when it is a key. They divide the height the family
 * reserved rather than adding to it, which is what keeps the row as tall as
 * the layout arithmetic declared — see `.sheet__answer-line` in sheet.css for
 * the other half of that, which is why the sentences may not wrap.
 */
function Ruled({ problem, answers }: Part) {
  const lines = problem.answers ?? [];
  const height = problem.workspace
    ? inch(problem.workspace / lines.length)
    : undefined;
  return (
    <span className="sheet__answers">
      {lines.map((line, index) => (
        <span
          className={`sheet__answer-line${answers ? " sheet__answer-line--answered" : ""}`}
          key={`${index}-${line}`}
          style={height ? { height } : undefined}
        >
          {answers ? line : ""}
        </span>
      ))}
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
  const working = problem.working ?? [];
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
      {/* The partial products of a long multiplication: ruled lines under the
          sum and above its total, which is where the algorithm puts them.
          They divide the height the family reserved rather than adding to it —
          see `.sheet__work-line` in sheet.css for the other half of that. */}
      {worked(problem) && (
        <span className="sheet__work">
          {working.map((line, index) => (
            <span
              className={`sheet__work-line${answers ? " sheet__work-line--answered" : ""}`}
              key={`${index}-${line}`}
              style={
                problem.workspace
                  ? { height: inch(problem.workspace / working.length) }
                  : undefined
              }
            >
              {answers ? line : ""}
            </span>
          ))}
        </span>
      )}
      <span
        className={`sheet__total${answers ? " sheet__total--answered" : ""}`}
      >
        {answers ? problem.answer : ""}
      </span>
    </span>
  );
}

/**
 * Long division, in the one shape it has ever been written in: the divisor
 * outside the bracket, the dividend under the bar, and the quotient along the
 * top of it.
 *
 * The bar and the upright are borders rather than a drawing, for the reason
 * everything else on a sheet is (§5) — they are foreground paint and always
 * print. The quotient is right-aligned over the dividend and not centred,
 * because the two are aligned by place value: the last digit of a quotient
 * always belongs over the last digit of the dividend, whatever either of them
 * measures. That is the whole reason for `tabular-nums` here, and it is the
 * same reason a column sum has it.
 */
function Bracket({ problem, answers }: Part) {
  const bracket = problem.bracket;
  if (!bracket) return null;
  return (
    <span className="sheet__bracket">
      <span className="sheet__divisor">{bracket.divisor}</span>
      <span className="sheet__house">
        <span
          className={`sheet__quotient${answers ? " sheet__quotient--answered" : ""}`}
        >
          {answers ? problem.answer : ""}
        </span>
        <span className="sheet__dividend">{bracket.dividend}</span>
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
