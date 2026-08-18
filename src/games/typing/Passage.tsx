import type { Card, CardResult } from "@/engine/types";

/** Words either side of the current one. Enough to read ahead, not a wall. */
const BEHIND = 6;
const AHEAD = 14;

/**
 * The passage, with the current word live under the cursor.
 *
 * Per-character colouring on the current word only. Doing it on the whole
 * passage would turn a page of text into a page of red and green, and the one
 * place a typist is looking is the word they're on.
 *
 * A window rather than the whole passage: a fifty-word run would otherwise
 * reflow every time a word committed, and the line you're reading would move
 * under you.
 */
export function Passage({
  deck,
  results,
  entry,
  credit,
}: {
  deck: Card[];
  results: CardResult[];
  /** What's been typed of the current word. */
  entry: string;
  /** What the words are quoted from, where the source asks to be named. */
  credit?: string;
}) {
  const at = results.length;
  const from = Math.max(0, at - BEHIND);
  const visible = deck.slice(from, at + AHEAD);

  return (
    <section className="passage" aria-label="Passage to type">
      <p className="passage__text">
        {visible.map((card, offset) => {
          const i = from + offset;
          if (i < at) {
            const done = results[i];
            return (
              <span
                key={i}
                className={`passage__word${done.ok ? " is-done" : " is-wrong"}`}
              >
                {card.answer}{" "}
              </span>
            );
          }
          if (i > at) {
            return (
              <span key={i} className="passage__word">
                {card.answer}{" "}
              </span>
            );
          }
          return (
            <span key={i} className="passage__word is-live" aria-current="true">
              {card.answer.split("").map((letter, n) => {
                const typed = entry[n];
                const state =
                  typed === undefined
                    ? ""
                    : typed === letter
                      ? " is-hit"
                      : " is-miss";
                return (
                  <span key={n} className={`passage__ch${state}`}>
                    {letter}
                  </span>
                );
              })}
              {/* Anything typed past the end of the word is wrong but has to
                  be visible, or a doubled letter looks like nothing happened. */}
              {entry.length > card.answer.length && (
                <span className="passage__ch is-miss">
                  {entry.slice(card.answer.length)}
                </span>
              )}{" "}
            </span>
          );
        })}
      </p>
      {credit && <p className="passage__credit">{credit}</p>}
    </section>
  );
}
