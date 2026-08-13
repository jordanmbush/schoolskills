import type { Ref, TextareaHTMLAttributes } from "react";

/**
 * Multi-line text entry.
 *
 * `onChange` hands over the string rather than the event, matching `Input` —
 * the kit is consistent with itself, and no call site has ever wanted anything
 * but `event.target.value`.
 *
 * There is exactly one caller today (pasting a week's spellings in), and one
 * caller is enough: the native-controls ban has no exceptions, and adding the
 * primitive is the whole point of having a kit. Everything a textarea
 * understands — `rows`, `maxLength`, `spellCheck`, `placeholder`, `ref` —
 * passes through.
 */
export interface TextAreaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange" | "value"
> {
  value: string;
  onChange: (value: string) => void;
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextArea({
  value,
  onChange,
  className = "field__input field__input--multi",
  ...rest
}: TextAreaProps) {
  return (
    <textarea
      className={className}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  );
}
