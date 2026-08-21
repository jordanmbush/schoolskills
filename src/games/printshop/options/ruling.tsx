/**
 * The one question two families ask identically: what ruling is the paper.
 *
 * A whole question rather than a shape, which is why it is its own module and
 * not another primitive in `parts.tsx`. The paper family's entire content is a
 * ruling and the handwriting family writes *on* one, and there is only one
 * right way to ask for it — so a ruling added to §5, or a hint reworded, is one
 * edit here rather than two that can be made singly.
 */
import { Checkbox, type SegmentedOption } from "@/components/ui/kit";
import { GRID_PITCHES, RULINGS, rulingOf } from "@/engine/sheets/paper";
import type { Midline, Mil, Rule, RuleStyle } from "@/engine/sheets/types";

import { Choice, opt } from "./parts";

/** Every ruling in §5, in the order `RULINGS` declares them. */
export const RULE_STYLES = Object.values(RULINGS).map((ruling) =>
  opt<RuleStyle>(ruling.id, ruling.label),
);

/**
 * The same list without blank paper, for a family that writes *on* the ruling: a
 * ruling with no pitch has no rows to write on, so `ruleOf` swaps it for the ⅝
 * rule and the control would read "Blank" over a sheet that plainly isn't. The
 * engine keeps that fallback for saved and shared configs; a control offering
 * the choice at all is the part that was wrong.
 */
export const RULED_STYLES = RULE_STYLES.filter(
  (option) => option.value !== "blank",
);

const MIDLINES = [
  opt<Midline>("dashed", "Dashed", "the usual"),
  opt<Midline>("solid", "Solid", "youngest"),
  opt<Midline>("none", "None", "oldest"),
];

/** The squares of §5, labelled the way the paper is sold. */
const SQUARES = [
  opt("quarter-inch", "¼ in"),
  opt("fifth-inch", "⅕ in"),
  opt("centimetre", "1 cm"),
  opt("half-centimetre", "5 mm"),
];

type Square = keyof typeof GRID_PITCHES;

/**
 * Which paper, and the two extras that only some papers have.
 *
 * §17 asks for "ruling and rule size · line spacing", and all three are one
 * question: on ruled paper the spacing between the lines *is* the ruling, which
 * is why the sizes are named by their pitch — a teacher says "we're on ⅝ paper
 * this year", not "we're on handwriting paper at spacing four".
 *
 * The extras appear only where they mean something. A midline and descender
 * space belong to a handwriting rule and nothing else; a square belongs to the
 * rulings that repeat across the page as well as down it.
 */
export function RulingControls({
  rule,
  onChange,
  options = RULE_STYLES,
}: {
  rule: Rule;
  /** A patch onto the rule, merged by the family that owns it. */
  onChange: (patch: Partial<Rule>) => void;
  /** Which rulings this family can honour. Every one of them, unless said. */
  options?: SegmentedOption<RuleStyle>[];
}) {
  const ruling = rulingOf(rule);

  // Read back off the pitch rather than stored beside it: `Rule` holds a
  // length, and a second field naming the same thing can disagree with it.
  const square =
    (Object.keys(GRID_PITCHES) as Square[]).find(
      (key) => GRID_PITCHES[key] === rule.pitch,
    ) ?? "quarter-inch";

  return (
    <>
      <Choice
        label="Ruling and line spacing"
        value={rule.style}
        onChange={(style) => onChange({ style })}
        options={options}
        hint="Handwriting sizes are named by the space between one set of lines and the next."
      />

      {ruling.handwriting && (
        <>
          <Choice
            label="Midline"
            value={rule.midline ?? "dashed"}
            onChange={(midline) => onChange({ midline })}
            options={MIDLINES}
          />
          <Checkbox
            label="Room for descenders"
            hint="Space below the baseline for the tail of a g."
            checked={rule.descender === true}
            onChange={(descender) => onChange({ descender })}
          />
        </>
      )}

      {ruling.grid && (
        <Choice
          label="Square"
          value={square}
          onChange={(next) => onChange({ pitch: GRID_PITCHES[next] as Mil })}
          options={SQUARES}
        />
      )}
    </>
  );
}
