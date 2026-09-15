import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/kit";

/**
 * Where the typing actually happens.
 *
 * A real focused input rather than a window-level key listener, because a
 * phone or tablet only raises its keyboard for a focused field — and a typing
 * game you can't type on is worse than no typing game. It is styled to read as
 * a line under the passage rather than as a form control.
 *
 * Space commits: it never reaches the buffer. Backspace on an empty buffer is
 * swallowed, so the passage can't be walked backwards into words already
 * scored. Autocorrect and friends are all off — a keyboard that finishes the
 * word is doing the exercise for you.
 */
export function TypeField({
  value,
  index,
  disabled,
  hint,
  onChange,
  onCommit,
}: {
  value: string;
  /** Which word is live. Refocuses if focus was lost between words. */
  index: number;
  disabled: boolean;
  /**
   * What the line under the field says instead of how to move on, when the
   * run has something more pressing to say — a held-key lesson whose key is
   * up (§5.8). `loud` is that case: the field is closed until it is answered.
   */
  hint?: { text: string; loud?: boolean };
  onChange: (value: string) => void;
  onCommit: (typed: string) => void;
}) {
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) field.current?.focus();
  }, [index, disabled]);

  return (
    <div className="typefield">
      <Input
        ref={field}
        className="typefield__input"
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label="Type the highlighted word"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onKeyDown={(event) => {
          if (event.key === " ") {
            event.preventDefault();
            // An empty buffer means a leading or doubled space, which is a
            // keystroke rather than an answer. Committing it would score a
            // blank word against the typist.
            if (value !== "") onCommit(value);
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            // The last word of a passage has no space after it.
            if (value !== "") onCommit(value);
            return;
          }
          if (event.key === "Backspace" && value === "") event.preventDefault();
        }}
      />
      {/* Live, because on a held-key lesson this is the one line that says
          why nothing is happening, and the board that says it too is hidden
          from a screen reader (§4.4). On every other run it never changes. */}
      <p
        className={`typefield__hint${hint?.loud ? " is-loud" : ""}`}
        aria-live="polite"
      >
        {hint?.text ?? "Space for the next word · Enter to finish the last one"}
      </p>
    </div>
  );
}
