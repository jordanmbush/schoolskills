import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Card, CardResult } from "@/engine/types";

import { Passage } from "./Passage";

/**
 * The passage, and the two things about its markup that are not cosmetic.
 *
 * **Where the space between two words goes.** A browser breaks a line at a
 * space, and it will not break inside an element that says its content is one
 * unbreakable run. Keep the space inside a word span and there is no break to
 * take: the passage lays out as one line several times the width of the
 * column, and `overflow: hidden` takes the end off it — including the word the
 * child is on. That is a dead end for a five-year-old, who cannot type what
 * they cannot see.
 *
 * **Which word the passage starts at.** Always the first, so a word laid out
 * once keeps its place. A window that slid to follow the cursor would reflow
 * the whole block a word to the left on every commit, walking a word up to the
 * line above while the cursor dropped to the start of the line below.
 *
 * What this file cannot check is the layout itself — there is no browser in
 * this suite. Section 14 of `e2e/smoke.mjs` measures the live word against the
 * frame it is drawn in, and watches for a word that moves, in a real one.
 */

const card = (answer: string): Card => ({
  prompt: answer,
  answer,
  factId: answer,
});

const typed = (answer: string, ok = true): CardResult => ({
  prompt: answer,
  answer,
  given: ok ? answer : `${answer}x`,
  ok,
  ms: 900,
  factId: answer,
});

const deck = ["think", "searched", "sunshine", "painter"].map(card);

/** The passage with two words behind the cursor, one live and one ahead. */
const html = renderToStaticMarkup(
  <Passage
    deck={deck}
    results={[typed("think"), typed("searched", false)]}
    entry="sun"
  />,
);

/** What the paragraph reads as, with every tag taken out. */
const readsAs = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

describe("Passage", () => {
  it("keeps the space between two words out of either word", () => {
    // The space that follows a word is what the line breaks at, so it may not
    // belong to the word. `is-live` included: the live word is the one that
    // must never be cut in half.
    expect(html).not.toMatch(/\s<\/span>/);
    expect(html).toMatch(/<\/span> <span class="passage__word/);
  });

  it("still reads as words with spaces between them", () => {
    // The other half of the rule: a break opportunity that was deleted rather
    // than moved would pass the check above and run every word together.
    expect(readsAs(html)).toBe("think searched sunshine painter");
  });

  it("marks each word as read back, live, or still ahead", () => {
    expect(html).toContain('class="passage__word is-done">think</span>');
    expect(html).toContain('class="passage__word is-wrong">searched</span>');
    expect(html).toContain('class="passage__word is-live" aria-current="true"');
    expect(html).toContain('class="passage__word">painter</span>');
  });

  it("colours the live word by what has been typed of it, and no further", () => {
    // Three letters typed of "sunshine": s-u-n hit, and the rest plain.
    const live = html.slice(html.indexOf("is-live"));
    expect(live).toContain('class="passage__ch is-hit">s</span>');
    expect(live).toContain('class="passage__ch is-hit">n</span>');
    expect(live).toContain('class="passage__ch">h</span>');
  });

  it("draws from the first word however far in the cursor is", () => {
    // The cursor is twenty words in and the passage still starts at word
    // zero, so nothing already on screen has to move. A window that slid six
    // words behind the cursor would start at "w14" instead.
    const long = Array.from({ length: 60 }, (_, n) => card(`w${n}`));
    const deep = renderToStaticMarkup(
      <Passage
        deck={long}
        results={long.slice(0, 20).map((c) => typed(c.answer))}
        entry=""
      />,
    );
    const drawn = readsAs(deep).split(" ");
    expect(drawn[0]).toBe("w0");
    // And it stops a bounded way past the cursor rather than drawing the rest
    // of a hundred-word lesson: twenty typed, fourteen to read ahead on.
    expect(drawn.at(-1)).toBe("w33");
  });

  it("shows what was typed past the end of a word", () => {
    // Or a doubled letter looks like nothing happened.
    const over = renderToStaticMarkup(
      <Passage deck={deck} results={[]} entry="thinkk" />,
    );
    expect(over).toContain('class="passage__ch is-miss">k</span>');
  });
});
