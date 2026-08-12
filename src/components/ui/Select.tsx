import type { SelectHTMLAttributes } from "react";

/**
 * A styled single-choice dropdown.
 *
 * No screen uses one today — every choice in the app is currently a segmented
 * row or a grid of tappable cells, which suits a five-year-old better than a
 * dropdown does. It exists because the native-control ban already tells you
 * `<select>` → `<Select>`, and a rule that names a primitive which doesn't
 * exist leaves a suppression as the only way forward. Reach for a segmented
 * row first; this is for the long lists where that stops working.
 *
 * The wrapper span carries the chevron. `appearance: none` removes the
 * platform arrow, and drawing our own with a border triangle keeps it on
 * `currentColor`'s side of the theme rather than baking a colour into an SVG.
 */
export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "onChange" | "value" | "children"
> {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}

export function Select({
  value,
  onChange,
  options,
  className = "field__input field__select",
  ...rest
}: SelectProps) {
  return (
    <span className="field__selectwrap">
      <select
        className={className}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  );
}
