import { useEffect } from "react";
import type { InputMode } from "@/engine/types";

/**
 * Answering from a physical keyboard.
 *
 * This is the keyboard half of `AnswerPad` — same job, different input device
 * — but it can't live in that component: these are window-level listeners
 * bound to the race's state, and they must keep working while focus is
 * anywhere on the page. Older players use the number row and never touch the
 * on-screen keypad at all.
 */
export function useRaceKeyboard({
  active,
  inputMode,
  choices,
  answerLength,
  entry,
  entryRef,
  submit,
  pushDigit,
  dropDigit,
}: {
  /** Racing, and no card currently showing feedback. */
  active: boolean;
  inputMode: InputMode;
  choices: number[] | undefined;
  /** Digits in the current card's answer, for the auto-submit below. */
  answerLength: number;
  entry: string;
  entryRef: React.RefObject<string>;
  submit: (value: number | null) => void;
  pushDigit: (digit: string) => void;
  dropDigit: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (inputMode === "choose") {
        const slot = Number(event.key);
        if (slot >= 1 && slot <= 4 && choices) {
          event.preventDefault();
          submit(choices[slot - 1]);
        }
        return;
      }
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        pushDigit(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        dropDigit();
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (entryRef.current !== "") submit(Number(entryRef.current));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, inputMode, choices, entryRef, submit, pushDigit, dropDigit]);

  // Auto-submit the moment the entry is as long as the answer — keeps the pace
  // up without making kids hunt for Enter.
  useEffect(() => {
    if (!active || inputMode !== "type") return;
    if (entry.length > 0 && entry.length === answerLength) {
      const value = Number(entry);
      const timer = window.setTimeout(() => submit(value), 90);
      return () => window.clearTimeout(timer);
    }
  }, [active, inputMode, entry, answerLength, submit]);
}
