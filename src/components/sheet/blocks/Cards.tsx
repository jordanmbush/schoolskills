import { Fragment, type CSSProperties } from "react";

import {
  CARD_BIG_LEADING,
  CARD_PAD_EMS,
  CARD_SMALL_EMS,
  CARD_SMALL_LEADING,
} from "@/engine/sheets/phonics/metrics";
import type { MarkedWord } from "@/engine/sheets/types";

import type { BlockProps } from "./block";

/**
 * Cards: a spelling over the word it is in, or a sentence on a strip.
 *
 * Real text in a real list, not a drawing — the half of §2 the SVG blocks
 * cannot do, and exactly what a page whose whole content is "the letters `sh`
 * say /sh/" needs to be.
 *
 * **Nothing here decides a size.** Every proportion comes out of
 * `phonics/metrics.ts` — the big line's size travels on the block, because a
 * flash card and a sentence strip are this block at two very different sizes,
 * and the leading and the small line are the constants the family reserved the
 * page against. A second set of numbers in this file would be a card
 * overhanging the one beneath it, and the failure is silent on screen. From the
 * leaf rather than from `phonics/cards.ts`, so that four constants cost this
 * island four constants and not the phonics word bank (§3).
 *
 * The border is a real border rather than a tint (§5), so a page of cards to
 * cut out does not come out as words floating on nothing.
 */
export function Cards({ block }: BlockProps<"cards">) {
  const columns = Math.max(1, Math.floor(block.columns));

  return (
    <ol
      className={`sheet__cards${block.boxed ? " sheet__cards--boxed" : ""}`}
      style={{ "--sheet-columns": columns } as CSSProperties}
    >
      {block.cards.map((card, index) => (
        <li
          className="sheet__card"
          key={index}
          style={{ padding: `${CARD_PAD_EMS}em` }}
        >
          <span
            className="sheet__card-big"
            style={{
              fontSize: `${block.bigEms}em`,
              lineHeight: CARD_BIG_LEADING,
            }}
          >
            <Marked word={card.big} />
          </span>
          {card.small && (
            <span
              className="sheet__card-small"
              style={{
                fontSize: `${CARD_SMALL_EMS}em`,
                lineHeight: CARD_SMALL_LEADING,
              }}
            >
              <Marked word={card.small} />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * A word, in the pieces it is spelled with.
 *
 * An unmarked piece is written out as plain text rather than wrapped in a span
 * of its own, and that is the point: with all three switches off — which is the
 * default — a card is one run of text with no markup inside it at all, so it
 * selects, copies and reads aloud as the word it is. Marking a word is
 * something a parent turns on, and only then does it cost the page any
 * structure.
 */
function Marked({ word }: { word: MarkedWord }) {
  // Consecutive unmarked pieces are joined back into one run of text. A word is
  // handed over cut into its spellings whether or not anything is being marked,
  // and rendering each piece as its own node would leave `sun` on the paper as
  // three text nodes — worse for the three things this block is real text
  // *for*: indexing, announcing, and copying.
  const runs: MarkedWord = [];
  for (const part of word) {
    const last = runs.at(-1);
    if (!part.mark && last && !last.mark)
      runs[runs.length - 1] = { text: last.text + part.text };
    else runs.push(part);
  }

  return (
    <>
      {runs.map((part, at) =>
        part.mark ? (
          <span className={`sheet__part sheet__part--${part.mark}`} key={at}>
            {part.text}
          </span>
        ) : (
          <Fragment key={at}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}
