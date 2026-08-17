/**
 * Where the words on a copywork sheet come from.
 *
 * Two doors, and this is the only place either is opened. A parent either picks
 * something out of the library — Psalm 23, the Gettysburg Address, a fable —
 * or pastes what they have in front of them, and the sheet that comes out is
 * the same sheet either way. That is §12's "woven through" reduced to a
 * function: choosing Scripture and choosing Lincoln are the same interaction,
 * and neither the handwriting family nor the memory one learns which it got.
 *
 * Two things it owns that neither family should have to:
 *
 *   - **The provenance travels with the words.** A passage out of the library
 *     carries the credit its source asks for (`Passage.credit`), and the sheet
 *     puts that on the paper. A pasted verse carries none, because we have no
 *     idea where it came from and printing a credit we made up would be worse
 *     than printing nothing.
 *   - **It never fails.** An id this build has never heard of falls back to
 *     whatever `text` says and then to an empty page, the way `sheetSpec`
 *     answers with `UNKNOWN_SHEET`: a link bookmarked in March must still open
 *     in June after a passage was retired, and a build of the catalog must not
 *     stop because of it.
 */
import { DEFAULT_TRANSLATION, passage, passageText } from "../passages";
import type { TranslationId } from "../passages/types";

/**
 * The longest passage worth setting.
 *
 * The smallest ruling holds about twenty-two lines to a page and about
 * forty-six characters to a line, so a thousand characters is already more than
 * any sheet can print — this is twice that, and still short enough that a
 * config fits in a URL (§14), which is not the place for an essay. Applied to
 * the library's own passages as well as to a paste: the Christmas story is
 * longer than this, and a sheet that printed the first page of it and stopped
 * is the honest thing rather than one that refuses to build.
 */
export const MAX_TEXT = 2000;

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
 * The library wins where both are set, which is the way round that keeps a
 * shared link honest: `passage` is the choice a parent made in the picker and
 * `text` is what the box happened to be holding underneath it, so a sheet built
 * from an id prints the passage rather than whatever was typed before it was
 * chosen. Clearing the id is how you go back to your own words.
 */
export function copyworkSource(config: CopyworkConfig): CopyworkSource {
  const chosen =
    typeof config.passage === "string" && config.passage !== ""
      ? passage(config.passage, config.translation ?? DEFAULT_TRANSLATION)
      : undefined;

  if (chosen) {
    return {
      text: passageText(chosen).slice(0, MAX_TEXT),
      title: chosen.title,
      attribution: chosen.attribution,
      credit: chosen.credit,
    };
  }
  return {
    text: typeof config.text === "string" ? config.text.slice(0, MAX_TEXT) : "",
  };
}
