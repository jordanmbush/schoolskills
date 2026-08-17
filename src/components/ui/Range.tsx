import type { InputHTMLAttributes } from "react";

/**
 * A slider, for a number nobody has an exact answer for.
 *
 * The distinction against `NumberStepper` is what the number means. "How many
 * problems" has a right answer a parent already knows and will type; "how big
 * is the type" does not — it is judged by looking at the result, so the
 * control that suits it is the one you can sweep while watching the page
 * change. Anything that wants an exact value typed in wants the stepper.
 *
 * The readout beside it is `aria-hidden` on purpose. A range input announces
 * its own value on every change, so a live number next to it is either
 * duplicate speech or, worse, speech that arrives out of order — it is there
 * for the eyes only. `format` exists because the number a slider carries is
 * rarely the number a person reads: 14 is "14 pt", 625 is "⅝ in".
 *
 * Everything the platform gives a range is kept: arrow keys by `step`,
 * Page Up/Down by a larger stride, Home and End to the ends, and the focus
 * ring base.css draws for every real control. `label` is required, because a
 * slider with no name announces as a number belonging to nothing.
 */
export interface RangeProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "type" | "min" | "max" | "step"
> {
  /** The accessible name. Repeat the visible label if there is one. */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** How the value reads beside the slider. Defaults to the bare number. */
  format?: (value: number) => string;
}

export function Range({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  className = "range",
  ...rest
}: RangeProps) {
  return (
    <span className={className}>
      <input
        type="range"
        className="range__input"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        {...rest}
      />
      <span className="range__value u-mono" aria-hidden="true">
        {format ? format(value) : value}
      </span>
    </span>
  );
}
