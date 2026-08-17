/**
 * The four shapes an option on a worksheet takes.
 *
 * Fifteen families ask fifteen different questions, but they ask them in almost
 * the same four ways: pick one of a handful, set a low and a high number, say
 * how many problems and how many columns, and tick which of a pool are in play.
 * Writing those four once is what keeps a family's panel down to the sentences
 * that are true of *that* family — see `arithmetic.tsx`, which is a dozen lines
 * because everything generic about it is here.
 *
 * Every control is a kit primitive underneath. Nothing in this directory
 * hand-rolls an `<input>`, a `<select>` or a `<label>`; if something is missing
 * it goes in `src/components/ui/`, which is the rule the lint config states in
 * its own words.
 */
import {
  Checkbox,
  FieldSet,
  NumberStepper,
  SegmentedControl,
  Select,
  type SegmentedOption,
} from "@/components/ui/kit";
import type { SheetConfig } from "@/engine/sheets/types";

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
 */
export function Sizing({
  count,
  columns,
  onCount,
  onColumns,
  maxColumns = 6,
}: {
  count: number;
  columns: number;
  onCount: (next: number) => void;
  onColumns: (next: number) => void;
  maxColumns?: number;
}) {
  return (
    <>
      <FieldSet legend="Problems" hint="Capped at what fits on the page.">
        <NumberStepper
          label="Problems"
          value={count}
          min={1}
          max={200}
          onChange={onCount}
        />
      </FieldSet>
      <FieldSet legend="Columns">
        <NumberStepper
          label="Columns"
          value={columns}
          min={1}
          max={maxColumns}
          onChange={onColumns}
        />
      </FieldSet>
    </>
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
