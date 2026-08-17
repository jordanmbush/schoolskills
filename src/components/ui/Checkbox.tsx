import type { InputHTMLAttributes } from "react";

/**
 * A tick box, for options that stack.
 *
 * Not a `Toggle`, and the difference isn't cosmetic. A switch is a setting
 * that acts the moment it moves — sound on, sound off — and there is usually
 * one of them. A checkbox is a statement about a thing being built: "include
 * negatives", "print an answer key". Several sit in one panel, several are on
 * at once, and none of them do anything until the thing is rebuilt. Reaching
 * for the wrong one tells a parent the wrong story about what just happened.
 *
 * The native box is kept, not redrawn. `accent-color` recolours it to the
 * world's `--go` while leaving the platform's own checkmark, its
 * `:focus-visible` ring (base.css draws that for every real control) and its
 * behaviour under forced colours intact. A hand-drawn box has to reproduce all
 * three, and the tick is the one glyph a custom box always draws worse.
 *
 * The label is structural — the `<input>` sits inside the `<label>`, as in
 * `Field` — so there is no `htmlFor`/`id` pair to keep in step and the hit
 * target is the whole row rather than the box. `hint` sits inside the label
 * too, which makes it part of the announced name: a phrase, not a paragraph.
 * For the same reason this one does *not* go in a `Field`: that would put a
 * `<label>` around a `<label>`, and the name a browser then computes is
 * anyone's guess. It brings its own.
 *
 * `className` replaces the default rather than adding to it, matching `Input`
 * and `Select` — but note that the default is what carries the 44px row, so a
 * caller who overrides it owns the hit target from then on.
 */
export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "checked" | "type" | "aria-label" | "aria-labelledby"
> {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** A quiet second line under the label. Keep it to a phrase. */
  hint?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  className = "checkbox",
  ...rest
}: CheckboxProps) {
  return (
    <label className={className}>
      <input
        type="checkbox"
        className="checkbox__box"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        {...rest}
      />
      <span className="checkbox__text">
        {label}
        {hint ? <span className="checkbox__hint">{hint}</span> : null}
      </span>
    </label>
  );
}
