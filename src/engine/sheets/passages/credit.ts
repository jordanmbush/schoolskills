/**
 * The Scripture credit line, alone in a module of its own.
 *
 * One constant, so the sheet footer, the catalog page and the typing race
 * can't drift apart — required by nothing (a public-domain text needs no
 * attribution) and printed anyway, on every sheet and every screen that shows
 * one (docs/printables.md §12).
 *
 * It sits here rather than beside the verses in `scripture.ts` for a bundling
 * reason that is invisible until it bites. A module is assigned to a chunk
 * whole: `decks/typing.ts` needs this line for the Scripture level, every
 * island imports the deck registry, and the print shop uses the whole passage
 * library — so an import of this string *from the file that holds the verses*
 * moves the entire library (the WEBu, the KJV beside it and thirty other
 * passages) into the chunk that the flash cards, the spelling mount and the
 * record book all load. Measured, not guessed: it took the shared chunk from
 * 46KB to 222KB. A leaf module with one string in it costs them nothing, and
 * the constant is still the only copy there is.
 */
export const SCRIPTURE_CREDIT =
  "Scripture: World English Bible Updated (public domain) · worldenglish.bible";
