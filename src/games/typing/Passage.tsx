import { Fragment, useLayoutEffect, useRef } from "react";

import type { Card, CardResult } from "@/engine/types";

/** How far past the cursor to draw. Enough to read ahead, not a wall. */
const AHEAD = 14;

/**
 * The fraction of a line that counting lines forgives.
 *
 * Chromium rounds a line box up to the next sixty-fourth of a pixel, so three
 * lines come to marginally more than a frame cut to hold three: at 640px wide
 * the frame is 122.88 and a line 40.96875, and three lines are 122.90625. The
 * division lands at 2.9992 and floors to two — a whole line lost, which takes
 * away the row the cursor holds and scrolls the block under every word.
 *
 * It happens wherever the text size is a fraction of a pixel, which is the
 * whole `3.2vw` middle of the clamp `.passage__text` is sized by: roughly
 * 525px to 750px of width, so portrait tablets and phones held sideways. The
 * shortfall is arithmetic and never a real line, so counting forgives a
 * fiftieth of one.
 */
const SNAP = 0.02;

/**
 * The passage, with the current word live under the cursor.
 *
 * Per-character colouring on the current word only. Doing it on the whole
 * passage would turn a page of text into a page of red and green, and the one
 * place a typist is looking is the word they're on.
 *
 * **The words never move sideways.** The passage is drawn from its first word
 * every time and only ever grows at the end, so a word laid out once keeps the
 * position it was given: committing a word repaints it and moves nothing. A
 * window that slid — dropping a word off the front to add one at the back —
 * reflows the whole block a word to the left each time, which walks a word up
 * to the end of the line above while the cursor drops back to the start of the
 * line below. The eye then has nowhere to expect the cursor, which is the one
 * thing a child reading ahead depends on.
 *
 * So the cursor runs left to right along a line and down the lines, the way
 * typing does, and the only thing that ever moves is the block itself — up by
 * whole lines, and not until the cursor has run out of lines below it.
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
  const visible = deck.slice(0, at + AHEAD);

  const boxRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  /**
   * Scroll the block by whole lines, but only once the cursor has run out of
   * room below.
   *
   * The cursor walks down the lines it can see and the passage stays put; the
   * scroll starts when the line being typed on would otherwise be the last one
   * showing, and from then on it is one line per line — always leaving a line
   * still to come underneath. Waiting until it is needed is what makes the
   * movement mean something: the block moves because there is more passage,
   * not because a word was finished.
   *
   * Written straight to `scrollTop` rather than held as state, because the
   * answer is a reading of the layout and putting it through a render would
   * only ask for the same layout twice.
   *
   * Every number here is measured, because where the lines break is the
   * browser's answer and not ours — it moves with the width, the text size and
   * the length of the words. It is also what keeps a word too long for the
   * column honest: that word wraps onto a second line of its own, and this
   * counts it like any other line.
   *
   * No dependency list: a resize or a turned tablet re-wraps the passage
   * without a single prop changing, and the run's own ticker re-renders this
   * screen often enough for that to be all the redraw it needs. A render that
   * moves nothing costs a handful of reads and a scroll position set to what
   * it already was.
   */
  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;
    // Element children are the words: the spaces between them are text nodes,
    // so word `n` of the passage is child `n`.
    const words = text.children;
    const live = words[at] as HTMLElement | undefined;
    const first = words[0] as HTMLElement | undefined;
    if (!live || !first) return;

    // The last word of the line above — the first one going back that sits
    // higher, so never more than a line's worth of words to look at.
    let above: HTMLElement | null = null;
    for (let i = at - 1; i >= 0; i--) {
      const word = words[i] as HTMLElement;
      if (word.offsetTop < live.offsetTop) {
        above = word;
        break;
      }
    }
    // Nothing above means the first line, which is never scrolled off.
    if (!above) {
      text.scrollTop = 0;
      return;
    }

    /**
     * A line's height, read off two real lines — and read off `rect`, which
     * keeps its fraction.
     *
     * `offsetTop` and `clientHeight` are whole pixels, and a line here is
     * rarely one: at the smallest text size it is 33.6, so three of them fill
     * a frame the browser reports as 101 and the division comes out at two
     * lines rather than three. That one lost line is the difference between
     * the cursor holding a row and the passage scrolling under every word.
     */
    const step =
      live.getBoundingClientRect().top - above.getBoundingClientRect().top;
    if (step <= 0) {
      text.scrollTop = 0;
      return;
    }

    const line = Math.round((live.offsetTop - first.offsetTop) / step);
    // The three lines the frame is cut to, unless a short screen has squeezed
    // the row below them — `.passage` is what gives when the board wants the
    // height, so what is really on screen is whichever of the two is smaller.
    // Counted with `SNAP`, or three lines in a three-line frame count as two.
    const showing = Math.floor(
      Math.min(
        text.getBoundingClientRect().height,
        box.getBoundingClientRect().height,
      ) /
        step +
        SNAP,
    );
    // The row the cursor may reach before the block starts moving: the last
    // one that still has a line under it. A screen squeezed to a single line
    // has no such row, and `max` hands that case the only row there is.
    const held = Math.max(0, showing - 2);
    text.scrollTop = Math.max(0, line - held) * step;
  });

  return (
    <section ref={boxRef} className="passage" aria-label="Passage to type">
      <p ref={textRef} className="passage__text">
        {visible.map((card, i) => {
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
 * Split out from the passage above because it is the one word with state:
 * every other word is either read back or read ahead, and this one is being
 * compared to what the hands are doing letter by letter.
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
