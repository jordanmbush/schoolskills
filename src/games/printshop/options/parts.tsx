/**
 * The shapes an option on a worksheet takes.
 *
 * Fifteen families ask fifteen different questions, but they ask them in almost
 * the same few ways: pick one of a handful, set a low and a high number, say
 * how many problems and how many columns, and tick which of a pool are in play.
 * Writing those once is what keeps a family's panel down to the sentences that
 * are true of *that* family — see `arithmetic.tsx`, which is a dozen lines
 * because everything generic about it is here.
 *
 * `RulingControls` is the one that is a whole question rather than a shape: two
 * families put a ruling on paper and there is only one right way to ask for
 * one, so it lives here beside the primitives rather than twice in the panels.
 *
 * Every control is a kit primitive underneath. Nothing in this directory
 * hand-rolls an `<input>`, a `<select>` or a `<label>`; if something is missing
 * it goes in `src/components/ui/`, which is the rule the lint config states in
 * its own words.
 */
import type { ReactNode } from "react";

import {
  Checkbox,
  Field,
  FieldSet,
  NumberStepper,
  SegmentedControl,
  Select,
  TextArea,
  type SegmentedOption,
} from "@/components/ui/kit";
import { GRID_PITCHES, RULINGS, rulingOf } from "@/engine/sheets/paper";
import type {
  Midline,
  Mil,
  Rule,
  RuleStyle,
  SheetConfig,
} from "@/engine/sheets/types";
import { parseWords } from "@/services/decks";

/**
 * What a family's panel is handed.
 *
 * `C` is that family's own config, so a panel is checked against the fields it
 * actually has — a `MoneyPanel` that reached for `regrouping` would not
 * compile. The registry in index.tsx is what ties `C` back to the union, the
 * same way `SheetSpec` does in the engine.
 */
export type PanelProps<C extends SheetConfig = SheetConfig> = {
  config: C;
  /** Patch this family's config. The bench merges it and rebuilds. */
  set: (patch: Partial<C>) => void;
};

/** A choice, written the short way: `opt("add", "Adding")`. */
export const opt = <T extends string>(
  value: T,
  label: string,
  hint?: string,
): SegmentedOption<T> => ({ value, label, hint });

/**
 * One choice out of several.
 *
 * A row of pills up to five, a dropdown beyond — which is the rule the kit's
 * own `SegmentedControl` states: every option on screen at once is the better
 * control right up to the point where the row wraps into a wall, and a list of
 * twelve rulings is well past it.
 */
export function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  hint?: string;
}) {
  return (
    <FieldSet legend={label} hint={hint}>
      {options.length > 5 ? (
        <Select
          value={value}
          onChange={(next) => onChange(next as T)}
          options={options}
          aria-label={label}
        />
      ) : (
        <SegmentedControl
          label={label}
          value={value}
          onChange={onChange}
          options={options}
          slim
        />
      )}
    </FieldSet>
  );
}

/* ── The ruling ────────────────────────────────────────────────────────────
   Two families ask this question — the paper sheet, whose whole content is the
   ruling, and the handwriting sheet, which is written on one — and they have
   to ask it identically. A ruling added to §5, or a hint reworded, is one edit
   here rather than two that can be made singly.                             */

/** Every ruling in §5, in the order `RULINGS` declares them. */
export const RULE_STYLES = Object.values(RULINGS).map((ruling) =>
  opt<RuleStyle>(ruling.id, ruling.label),
);

/**
 * The same list without blank paper.
 *
 * For a family that writes *on* the ruling: a ruling with no pitch has no rows
 * to write on, so `ruleOf` swaps it for the ⅝ rule and the control would read
 * "Blank" over a sheet that plainly isn't. The engine keeps that fallback for
 * saved and shared configs; a control offering the choice at all is the part
 * that was wrong.
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
 * The §17 line "ruling and rule size · line spacing", all three of which are
 * one question: on ruled paper the spacing between the lines *is* the ruling,
 * which is why the sizes are named by their pitch — a teacher says "we're on ⅝
 * paper this year", not "we're on handwriting paper at spacing four".
 *
 * The extras appear only where they mean something. A midline and descender
 * space belong to a handwriting rule and nothing else; a square belongs to the
 * three rulings that repeat across the page as well as down it. Showing them
 * greyed out on narrow ruled would be offering a choice that does nothing.
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

  // Which square is chosen, read back off the pitch rather than stored beside
  // it: `Rule` holds a length, and a second field naming the same thing is a
  // second thing that can disagree with it.
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

/**
 * The low and the high of a range, as two steppers that can't cross.
 *
 * Clamped against each other rather than validated after the fact: a range
 * whose bottom is above its top is not a message to show a parent, it is a
 * state the control should not be able to reach. Every family that has one
 * reads it as ends-included, so "1 to 20" on screen is `{ min: 1, max: 20 }`
 * and both numbers appear on the page.
 */
export function Span({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: { min: number; max: number };
  onChange: (next: { min: number; max: number }) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <FieldSet legend={label} hint={hint}>
      <span className="span">
        <NumberStepper
          label={`${label}, lowest`}
          value={value.min}
          min={min}
          max={max}
          onChange={(next) =>
            onChange({ min: next, max: Math.max(next, value.max) })
          }
        />
        <span className="span__to" aria-hidden="true">
          to
        </span>
        <NumberStepper
          label={`${label}, highest`}
          value={value.max}
          min={min}
          max={max}
          onChange={(next) =>
            onChange({ min: Math.min(next, value.min), max: next })
          }
        />
      </span>
    </FieldSet>
  );
}

/**
 * How many problems, and how many across.
 *
 * The one pair every generating family has, and the one place a number a parent
 * types is knowingly a request rather than a promise: each family caps the count
 * at what the page holds, so asking for two hundred sums on a Letter page gives
 * as many as fit and no second page of nothing. The hint says so, because a
 * number that silently becomes another number is worse than a smaller maximum.
 *
 * `columns` is optional because not every family lays its items out across the
 * page: a word with letters missing is a line of its own whatever the config
 * says, and a stepper that could only ever be set to one is an option that does
 * nothing — which is worse than a missing one.
 */
export function Sizing({
  label = "Problems",
  count,
  columns,
  onCount,
  onColumns,
  maxColumns = 6,
}: {
  /** What the family calls the things it is counting. */
  label?: string;
  count: number;
  columns?: number;
  onCount: (next: number) => void;
  onColumns?: (next: number) => void;
  maxColumns?: number;
}) {
  return (
    <>
      <FieldSet legend={label} hint="Capped at what fits on the page.">
        <NumberStepper
          label={label}
          value={count}
          min={1}
          max={200}
          onChange={onCount}
        />
      </FieldSet>
      {columns !== undefined && onColumns && (
        <FieldSet legend="Columns">
          <NumberStepper
            label="Columns"
            value={columns}
            min={1}
            max={maxColumns}
            onChange={onColumns}
          />
        </FieldSet>
      )}
    </>
  );
}

/**
 * A list of words, typed or pasted in.
 *
 * One box rather than a row of fields, for the reason `DeckEditor` gives about
 * the same paste: the list is coming off a school letter or a phone
 * screenshot, and retyping it into twelve inputs is how a parent decides not to
 * bother. `parseWords` is what splits it — newlines, commas, tabs and
 * semicolons all work — so a sheet takes whatever shape the letter was in.
 *
 * It is here rather than in the spelling panel because two screens need the
 * same box: the panel, where the list is what the sheet is *about*, and the
 * bootstrap, where a paste is one of the three ways to start a sheet at all
 * (§14). Two copies would be two rules about what counts as a word.
 */
export function WordList({
  label,
  text,
  onChange,
  hint,
  rows = 5,
}: {
  label: string;
  text: string;
  onChange: (text: string) => void;
  hint?: ReactNode;
  rows?: number;
}) {
  const words = parseWords(text);
  return (
    <Field
      label={label}
      hint={
        hint ?? (
          <>
            One a line, or separated by commas. {words.length}{" "}
            {words.length === 1 ? "word" : "words"} so far.
          </>
        )
      }
    >
      <TextArea
        value={text}
        rows={rows}
        spellCheck={false}
        placeholder={"because\nthought\nfriend"}
        onChange={onChange}
      />
    </Field>
  );
}

/**
 * Which of a set are in play — the times tables, the denominators, the topics.
 *
 * A pool rather than a range, for the reason the engine gives where each one is
 * declared: "the seven and eight times tables" is a choice somebody makes and
 * "2 to 12" is not.
 *
 * The last tick cannot be removed. An empty pool is not a harder sheet, it is a
 * sheet with nothing on it, and the honest place to refuse that is the control
 * rather than a generator that quietly draws from everything instead.
 */
export function Pool<T extends string | number>({
  label,
  values,
  chosen,
  onChange,
  labelOf = String,
  hint,
}: {
  label: string;
  values: readonly T[];
  chosen: T[];
  onChange: (next: T[]) => void;
  labelOf?: (value: T) => string;
  hint?: string;
}) {
  return (
    <FieldSet legend={label} hint={hint}>
      <span className="pool">
        {values.map((value) => {
          const on = chosen.includes(value);
          return (
            <Checkbox
              key={String(value)}
              label={labelOf(value)}
              checked={on}
              disabled={on && chosen.length === 1}
              onChange={(next) =>
                onChange(
                  next
                    ? values.filter((v) => v === value || chosen.includes(v))
                    : chosen.filter((v) => v !== value),
                )
              }
            />
          );
        })}
      </span>
    </FieldSet>
  );
}
