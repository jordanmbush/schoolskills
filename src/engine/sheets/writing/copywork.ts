/**
 * Where the words on a copywork sheet come from.
 *
 * Two doors — the library by id, or a paste — and this is the only place either
 * is opened, which is §12's "woven through" reduced to a function.
 *
 * Two things it owns that neither family should have to:
 *
 *   - **The provenance travels with the words.** A passage out of the library
 *     carries the credit its source asks for (`Passage.credit`). A pasted verse
 *     carries none, because we have no idea where it came from and printing a
 *     credit we made up would be worse than printing nothing.
 *   - **It never fails.** An id this build has never heard of falls back to
 *     whatever `text` says and then to an empty page, the way `sheetSpec`
 *     answers with `UNKNOWN_SHEET`: a link bookmarked in March must still open
 *     in June after a passage was retired.
 */
import { DEFAULT_TRANSLATION, passage, passageText } from "../passages";
import type { TranslationId } from "../passages/types";

/**
 * The longest **paste** worth setting.
 *
 * The smallest ruling holds about twenty-two lines to a page and about
 * forty-six characters to a line, so a thousand characters is already more than
 * any sheet can print — this is twice that, and still short enough that a config
 * fits in a URL (§14).
 *
 * A paste only. A library passage is nine characters of id in the `#s=` link
 * and its words never travel, so the cap's own reason does not reach it —
 * applying it there once cost the Christmas story (2,048 characters) its last
 * eight words, on a sheet whose instruction line promises the whole passage on
 * the answer key. How much of a passage reaches the paper is already decided by
 * the capacity arithmetic, a page at a time.
 */
export const MAX_TEXT = 2000;

/**
 * A paste cut down to length on a boundary its author put there.
 *
 * Back to the last space rather than to a character index, because the cut
 * shows on the paper: half a word reads as a misprint. A run with no whitespace
 * in it at all keeps the plain cut — there is no boundary to find, and one very
 * long word is still better than a blank page.
 */
export function trimText(text: string, limit: number = MAX_TEXT): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  if (/\s/.test(text.charAt(limit))) return cut.trimEnd();
  const whole = cut.replace(/\S+$/, "").trimEnd();
  return whole === "" ? cut : whole;
}

/** What either family is actually handed, whichever door the words came in. */
export type CopyworkSource = {
  /** The words, as they should be set. A newline is a break the author made. */
  text: string;
  /** How the passage is named — "Psalm 23". Absent for a paste. */
  title?: string;
  /** Who wrote it, or which translation it is. Absent for a paste. */
  attribution?: string;
  /** Printed small at the foot of any sheet that quotes it (§12). */
  credit?: string;
};

/** The two fields both families carry, and nothing else about either of them. */
export type CopyworkConfig = {
  passage?: string;
  translation?: TranslationId;
  text?: string;
};

/**
 * The words a config asks for.
 *
 * The library wins where both are set: `passage` is the choice a parent made in
 * the picker and `text` is what the box happened to be holding underneath it,
 * so a sheet built from an id prints the passage rather than whatever was typed
 * before it was chosen. Clearing the id is how you go back to your own words.
 */
export function copyworkSource(config: CopyworkConfig): CopyworkSource {
  const chosen =
    typeof config.passage === "string" && config.passage !== ""
      ? passage(config.passage, config.translation ?? DEFAULT_TRANSLATION)
      : undefined;

  if (chosen) {
    // Verbatim, and uncapped: the library's text is quoted rather than
    // generated (§12), so it is handed on whole and the page decides how much
    // of it fits.
    return {
      text: passageText(chosen),
      title: chosen.title,
      attribution: chosen.attribution,
      credit: chosen.credit,
    };
  }
  return {
    text: typeof config.text === "string" ? trimText(config.text) : "",
  };
}
