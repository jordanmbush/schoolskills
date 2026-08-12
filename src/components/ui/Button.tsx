import type { ButtonHTMLAttributes } from "react";

/**
 * The one button in the app.
 *
 * Two families of button exist in this codebase and both go through here:
 *
 * - **Pill buttons** — the `.btn` scale, selected with `variant` and `size`.
 * - **Skinned buttons** — `preset`, `segmented__btn`, `tablegrid__cell`,
 *   `rival`, `picker__cell`, `swatch`, `keypad__key`, `stepper__btn`,
 *   `topbar__icon`. Each carries its own complete CSS, so `variant="bare"`
 *   adds no classes at all and the caller's `className` is used verbatim.
 *
 * `bare` is what makes the kit boundary enforceable rather than aspirational.
 * Without it a skinned control has no primitive to reach for, and the only way
 * past the lint rule is a suppression — which is how kits die.
 */
export type ButtonVariant =
  "solid" | "go" | "accent" | "ghost" | "danger" | "bare";

export type ButtonSize = "md" | "sm";

const VARIANT_CLASS: Record<Exclude<ButtonVariant, "bare">, string> = {
  solid: "",
  go: "btn--go",
  accent: "btn--accent",
  ghost: "btn--ghost",
  danger: "btn--danger",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Sets `aria-pressed`. The matching `is-on` / `is-chosen` class stays with
   * the caller: each skin names its selected state differently, and the kit
   * has no business knowing which.
   */
  pressed?: boolean;
}

export function Button({
  variant = "solid",
  size = "md",
  pressed,
  className,
  // Defaulting to "button" rather than inheriting the platform default. A
  // bare <button> inside a <form> submits it — which is a real hazard here,
  // since the player editor is a form full of avatar and colour pickers.
  type = "button",
  ...rest
}: ButtonProps) {
  const classes =
    variant === "bare"
      ? className
      : [
          "btn",
          VARIANT_CLASS[variant],
          size === "sm" ? "btn--sm" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ");

  return (
    <button type={type} className={classes} aria-pressed={pressed} {...rest} />
  );
}
