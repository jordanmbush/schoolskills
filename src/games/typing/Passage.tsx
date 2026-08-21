import { Fragment } from "react";

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
          const mark = i < at ? (results[i].ok ? " is-done" : " is-wrong") : "";
          return (
            <Fragment key={i}>
              {i === at ? (
                <LiveWord answer={card.answer} entry={entry} />
              ) : (
                <span className={`passage__word${mark}`}>{card.answer}</span>
              )}
              {/* The space between two words, and the only place a line is
                  allowed to break. It belongs BETWEEN the spans, not inside
                  one: a word span is a unit the line may not break inside, so
                  a space kept in there is a break the browser will not take —
                  and the whole passage lays out as one unbreakable line that
                  runs off the right edge, taking the live word with it. */}{" "}
            </Fragment>
          );
        })}
      </p>
      {credit && <p className="passage__credit">{credit}</p>}
    </section>
  );
}

/**
 * The word under the cursor, a character at a time.
 *
 * Split out from the window above because it is the one word with state: every
 * other word is either read back or read ahead, and this one is being compared
 * to what the hands are doing letter by letter.
 */
function LiveWord({ answer, entry }: { answer: string; entry: string }) {
  return (
    <span className="passage__word is-live" aria-current="true">
      {answer.split("").map((letter, n) => {
        const typed = entry[n];
        const state =
          typed === undefined ? "" : typed === letter ? " is-hit" : " is-miss";
        return (
          <span key={n} className={`passage__ch${state}`}>
            {letter}
          </span>
        );
      })}
      {/* Anything typed past the end of the word is wrong but has to be
          visible, or a doubled letter looks like nothing happened. */}
      {entry.length > answer.length && (
        <span className="passage__ch is-miss">
          {entry.slice(answer.length)}
        </span>
      )}
    </span>
  );
}
