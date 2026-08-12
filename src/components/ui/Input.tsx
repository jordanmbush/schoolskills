import type { InputHTMLAttributes, Ref } from "react";

/**
 * Text and numeric entry.
 *
 * `onChange` hands over the string rather than the event — every call site
 * only ever wanted `event.target.value`, and matching `Toggle`'s
 * `onChange(next)` shape keeps the kit consistent with itself. Everything else
 * a native input understands (`type`, `step`, `min`, `max`, `inputMode`,
 * `maxLength`, `autoComplete`, `onBlur`, `ref`) passes straight through.
 *
 * Numeric fields deliberately keep the raw string. The race clock accepts
 * quarter-second steps and snaps what you type (3.3 → 3.25); parsing here
 * would strip the intermediate text a player types on the way to a number.
 */
export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "size"
> {
  value: string | number;
  onChange: (value: string) => void;
  /**
   * Commit on Enter by dropping focus. Numeric fields that snap their value on
   * blur need this, or a typed value sits uncommitted until the player thinks
   * to click elsewhere.
   */
  blurOnEnter?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  value,
  onChange,
  blurOnEnter = false,
  className = "field__input",
  onKeyDown,
  ...rest
}: InputProps) {
  return (
    <input
      className={className}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (blurOnEnter && event.key === "Enter") event.currentTarget.blur();
        onKeyDown?.(event);
      }}
      {...rest}
    />
  );
}
