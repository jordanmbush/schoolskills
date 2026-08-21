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
 * Everything below is a shape an option takes. A ruling is a subject rather
 * than a shape, so it lives next door in `ruling.tsx`.
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
import type { SheetConfig } from "@/engine/sheets/types";
import { parseWords } from "@/services/decks";

/**
 * What a family's panel is handed. `C` is that family's own config, so a panel
 * is checked against the fields it actually has — a `MoneyPanel` that reached
 * for `regrouping` would not compile. The registry in index.tsx is what ties `C`
 * back to the union.
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
 * One choice out of several: a row of pills up to five, a dropdown beyond. Every
 * option on screen at once is the better control right up to the point where the
 * row wraps into a wall, and a list of twelve rulings is well past it.
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

/**
 * The low and the high of a range, as two steppers that can't cross. Clamped
 * against each other rather than validated after the fact: a range whose bottom
 * is above its top is not a message to show a parent, it is a state the control
 * should not be able to reach.
 *
 * Every family reads a range as ends-included, so "1 to 20" on screen is
 * `{ min: 1, max: 20 }` and both numbers appear on the page.
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
 * The one place a number a parent types is knowingly a request rather than a
 * promise: each family caps the count at what the page holds, so asking for two
 * hundred sums on a Letter page gives as many as fit and no second page of
 * nothing. The hint says so, because a number that silently becomes another
 * number is worse than a smaller maximum.
 *
 * `columns` is optional because not every family lays its items out across the
 * page, and a stepper that could only ever be set to one is an option that does
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
 * the same paste: the list is coming off a school letter or a phone screenshot,
 * and retyping it into twelve inputs is how a parent decides not to bother.
 *
 * It is here rather than in the spelling panel because two screens need the same
 * box: the panel, where the list is what the sheet is *about*, and the
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
 * A list where a line is an item — the jobs on a chore chart, the six words on
 * a die.
 *
 * `WordList` above is the wrong control for these: `parseWords` splits on commas
 * as well as newlines, and a chore that reads "Feed the dog, and the rabbit"
 * would land as half a job on the next row of the chart. So this one splits on
 * newlines and nothing else, which is also what the box visibly does.
 *
 * The blanks are kept while somebody is typing and dropped by the family that
 * reads them, so pressing return in the middle of a list does not renumber the
 * chart under the cursor.
 */
export function TextLines({
  label,
  lines,
  onChange,
  hint,
  placeholder,
  rows = 5,
}: {
  label: string;
  lines: string[];
  onChange: (next: string[]) => void;
  hint?: ReactNode;
  placeholder?: string;
  rows?: number;
}) {
  const written = lines.filter((line) => line.trim() !== "").length;
  return (
    <Field
      label={label}
      hint={
        hint ?? (
          <>
            One a line. {written} {written === 1 ? "line" : "lines"} so far, and
            an empty one is a row to fill in by hand.
          </>
        )
      }
    >
      <TextArea
        value={lines.join("\n")}
        rows={rows}
        spellCheck={false}
        placeholder={placeholder}
        onChange={(text) => onChange(text.split("\n"))}
      />
    </Field>
  );
}

/**
 * Which of a set are in play — the times tables, the denominators, the topics.
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
