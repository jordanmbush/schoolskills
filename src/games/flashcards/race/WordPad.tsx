import { useEffect, useRef } from "react";
import { Button, Input } from "@/components/ui/kit";

/**
 * Typing a word, rather than a number.
 *
 * A real focused text field rather than the keypad: it brings up the letter
 * keyboard on a phone, it handles a long word without a 4-character cap, and
 * it lets a child fix a typo before committing — which the numeric pad's
 * length-based auto-submit deliberately doesn't allow, and mustn't here. A
 * spelling answer is only finished when the speller says it is.
 *
 * Every correction feature the browser offers is turned off. Autocorrect on a
 * spelling test doesn't just help, it answers the question.
 */
export function WordPad({
  value,
  index,
  disabled,
  onChange,
  onSubmit,
}: {
  value: string;
  /** Card number — refocuses the field when a new word arrives. */
  index: number;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) field.current?.focus();
  }, [index, disabled]);

  return (
    <div className="wordpad">
      <Input
        ref={field}
        className="wordpad__input"
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label="Type the word"
        inputMode="text"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          onSubmit();
        }}
      />
      <Button
        variant="accent"
        className="wordpad__go"
        disabled={disabled || value.trim() === ""}
        onClick={onSubmit}
      >
        Done ↵
      </Button>
    </div>
  );
}
