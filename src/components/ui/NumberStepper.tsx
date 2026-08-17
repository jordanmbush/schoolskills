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
 * already a legal value; anything else lives in a draft until blur or Enter,
 * where it is clamped. `ClockPicker` does this by hand for the race clock —
 * this is that behaviour, moved somewhere it can be reused.
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
  // `null` means "showing the committed value". Any string means the field is
  // mid-edit and what the person typed wins over what the caller holds.
  const [draft, setDraft] = useState<string | null>(null);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const nudge = (delta: number) => {
    setDraft(null);
    onChange(clamp(value + delta));
  };

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    // An empty box or a typo is not a number to keep — fall back to the value
    // that was already there rather than to zero, which the minimum would then
    // silently turn into something else again.
    setDraft(null);
    if (draft.trim() !== "" && Number.isFinite(parsed)) onChange(clamp(parsed));
  };

  return (
    <span className="stepper">
      <Button
        variant="bare"
        className="stepper__btn"
        aria-label={decreaseLabel}
        disabled={disabled || value <= min}
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
            const parsed = Number(text);
            if (
              text.trim() !== "" &&
              Number.isFinite(parsed) &&
              parsed === clamp(parsed)
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
        disabled={disabled || value >= max}
        onClick={() => nudge(step)}
      >
        +
      </Button>
    </span>
  );
}
