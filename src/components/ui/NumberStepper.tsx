import { useState } from "react";

import { Button } from "./Button";

/**
 * A small whole number, with two big targets and a box you can type in.
 *
 * Both halves earn their place. The − and + are what a child or a thumb uses,
 * and they are the reason this isn't a bare `Input type="number"`: the native
 * spinner arrows are a few pixels tall and are hidden here (`appearance:
 * textfield`) because they promise a target that isn't one. The box is what a
 * parent uses, because nobody presses + thirty times to reach 40.
 *
 * The `<input>` is real rather than a `role="spinbutton"` span, which buys the
 * name, the value, the range and the arrow keys from the platform instead of
 * from three key handlers. It carries `aria-label` and the two buttons carry
 * their own names, so a group of steppers in one panel never announces as
 * "increase, increase, increase". Sit it in a `FieldSet`, not a `Field`: a
 * `<label>` names the *first* control it contains, which here is the − button.
 *
 * **What is typed is held until it is committed.** Clamping on every keystroke
 * means typing "12" into a field whose minimum is 5 snaps to 5 at the "1" and
 * takes the caret with it. So a keystroke only reaches the caller once it is
 * already the value a commit would produce; anything else lives in a draft
 * until blur or Enter, where `commitValue` clamps it and snaps it to the step
 * grid.
 *
 * **At a bound the button is `aria-disabled`, not `disabled`.** The real
 * attribute would be the tidier markup and the worse control: the browser
 * blurs a disabled element, so a keyboard user pressing − down to the minimum
 * has focus fall to `<body>` mid-interaction and the next Tab restarts at the
 * top of the page. `aria-disabled` announces the same thing, keeps the stop in
 * the tab order, and `nudge` makes the press a no-op.
 */
export interface NumberStepperProps {
  /** The accessible name of the number itself, e.g. "Problems". */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /**
   * Printed after the number, inside the box: "pt", "cm". Decorative — if the
   * unit is load-bearing, it belongs in `label` too ("Type size in points"),
   * because that is what gets announced.
   */
  unit?: string;
  disabled?: boolean;
  /** Overrides for the button names, when "Decrease problems" reads oddly. */
  decreaseLabel?: string;
  increaseLabel?: string;
}

export function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled = false,
  decreaseLabel = `Decrease ${label.toLowerCase()}`,
  increaseLabel = `Increase ${label.toLowerCase()}`,
}: NumberStepperProps) {
  // `null` means "showing the committed value"; any string is a live edit.
  const [draft, setDraft] = useState<string | null>(null);

  // `value` and not the draft, which is correct because blur fires — and React
  // flushes that discrete update — before the button's click, so by the time a
  // press lands the typed number has already been committed.
  const nudge = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    setDraft(null);
    if (next !== value) onChange(next);
  };

  const commit = () => {
    if (draft === null) return;
    const next = commitValue(draft, value, min, max, step);
    setDraft(null);
    if (next !== value) onChange(next);
  };

  return (
    <span className="stepper">
      <Button
        variant="bare"
        className="stepper__btn"
        aria-label={decreaseLabel}
        disabled={disabled}
        aria-disabled={value <= min || undefined}
        onClick={() => nudge(-step)}
      >
        −
      </Button>
      <span className="stepper__field">
        <input
          type="number"
          inputMode="numeric"
          className="stepper__input u-mono"
          aria-label={label}
          value={draft ?? String(value)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            // A half-typed "1" below the minimum, or an off-grid "12.5",
            // waits for blur instead of fighting the caret.
            const parsed = Number(text);
            if (
              text.trim() !== "" &&
              commitValue(text, value, min, max, step) === parsed
            ) {
              onChange(parsed);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          onBlur={commit}
        />
        {unit ? (
          <span className="stepper__unit u-mono" aria-hidden="true">
            {unit}
          </span>
        ) : null}
      </span>
      <Button
        variant="bare"
        className="stepper__btn"
        aria-label={increaseLabel}
        disabled={disabled}
        aria-disabled={value >= max || undefined}
        onClick={() => nudge(step)}
      >
        +
      </Button>
    </span>
  );
}

/**
 * What a draft typed into the box should become. Exported so it can be tested
 * as a function rather than as an interaction the project has no DOM to
 * simulate.
 *
 * Returns `current` for anything that isn't a number to keep, so an empty box
 * or a typo falls back to the value already there rather than to zero, which
 * the minimum would then silently turn into something else again.
 */
export function commitValue(
  draft: string,
  current: number,
  min: number,
  max: number,
  step: number,
): number {
  const parsed = Number(draft);
  if (draft.trim() === "" || !Number.isFinite(parsed)) return current;
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  // Snapped to the grid `step` describes, measured from `min` and not from
  // zero: a stepper from 5 to 60 by 5 offers 5, 10, 15 and never 23. Clamped a
  // second time because rounding up from the last cell can overshoot.
  return clamp(min + Math.round((clamp(parsed) - min) / step) * step);
}
