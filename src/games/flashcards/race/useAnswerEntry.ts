import { useCallback, useRef, useState } from "react";

/** Nothing arithmetic asks for more digits than this. */
const MAX_DIGITS = 4;

/**
 * What the player has entered for the current card.
 *
 * Held in state to render and mirrored into a ref to read. The ref is the
 * point: the race re-renders roughly sixteen times a second, and every
 * callback that reads the entry — the Enter key, the on-screen ↵, the
 * auto-submit — has to keep a stable identity or the effects that own them
 * tear down and rebind on every tick. Reading `entryRef.current` instead of a
 * closed-over `entry` is what lets all of them be pinned with `[]`.
 *
 * `set` takes a whole value for the text field a word card types into; `push`
 * and `drop` are the keypad's one-character-at-a-time equivalents.
 */
export function useAnswerEntry() {
  const [entry, setEntry] = useState("");
  const entryRef = useRef("");

  const set = useCallback((value: string) => {
    entryRef.current = value;
    setEntry(value);
  }, []);

  const push = useCallback(
    (character: string) => {
      if (entryRef.current.length >= MAX_DIGITS) return;
      set(entryRef.current + character);
    },
    [set],
  );

  const drop = useCallback(() => set(entryRef.current.slice(0, -1)), [set]);
  const clear = useCallback(() => set(""), [set]);

  return { entry, entryRef, set, push, drop, clear };
}
