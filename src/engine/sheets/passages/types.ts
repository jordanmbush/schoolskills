/**
 * What a copywork sheet is handed, whatever the text came out of.
 *
 * The passage library is the first thing in `src/engine/sheets/` that is not
 * generated. Every maths family computes its problems; a passage is quoted, and
 * quoting somebody else's words in a repository that anyone can clone raises
 * exactly one question worth building a type around: *may we, and how do we
 * know?* So a passage carries its provenance the way a `Sheet` carries its
 * seed — not as a comment that can drift, but as a field, right beside the
 * words it licenses (docs/printables.md §12).
 *
 * Three rules the shape enforces:
 *
 *   - **Every passage names its source and its licence.** `PassageSource` has
 *     no optional fields. A passage that can't say where its text came from
 *     doesn't get into the library.
 *   - **The text is a list of lines, not a paragraph of prose.** A stanza break
 *     in a poem and a paragraph break in a fable are the author's, and a
 *     renderer that re-wrapped them would be editing the work. Joining is a
 *     decision the sheet makes; splitting is not one it may make.
 *   - **Nothing here is HTML.** The strings are text. Whatever quotation marks,
 *     dashes and spellings the source used, the library keeps — for Scripture
 *     because it is a condition of the name (see scripture.ts), and for
 *     everything else because a child copying a passage by hand should be
 *     copying the passage.
 */

/** Which library a passage came out of, and how a sheet should set it. */
export type PassageKind = "scripture" | "prose" | "poetry" | "document";

/**
 * Which translation a Scripture passage is read in — the two of §12, and the
 * reasoning for both is beside the table in index.ts.
 *
 * The id lives here rather than there for one practical reason: a sheet config
 * carries a translation, so `engine/sheets/types.ts` has to be able to name the
 * type — and a type-only import of this module costs nothing, where an import
 * of the library's front door would put a hundred kilobytes of verses in front
 * of every module that so much as mentions a `Sheet`.
 */
export type TranslationId = "webu" | "kjv";

/**
 * Where the text came from, and why we may print it.
 *
 * `edition` is the load-bearing one and the one it is tempting to leave vague.
 * "Public domain" is a claim about a *work*; the text on this page came out of
 * a particular edition of it, and a transcription error is invisible unless
 * somebody can go back to the same place and look. So it names the copy —
 * "Project Gutenberg #11", "National Archives transcript" — precisely enough to
 * be re-fetched by whoever next doubts a comma.
 */
export type PassageSource = {
  /** The work the passage is out of. */
  work: string;
  /** Who wrote it. "Unknown" where nobody signed it — never blank. */
  author: string;
  /** When the text quoted here was published, as it should be printed. */
  year: string;
  /** The exact copy this text was taken from, specific enough to re-fetch. */
  edition: string;
  /** Why we may print it, in one clause. */
  licence: string;
};

/**
 * A group in the picker.
 *
 * Flat, and one collection per passage. A passage that belongs to two groups
 * belongs to neither in a picker a parent scans in five seconds, and the reason
 * the Scripture collections are cut by *book* rather than by theme is that a
 * theme ("comfort", "obedience") is an editorial claim about a verse and a book
 * is a fact about it.
 */
export type PassageCollection = {
  id: string;
  name: string;
  blurb: string;
  kind: PassageKind;
};

/**
 * A passage, resolved and ready to print.
 *
 * Scripture arrives here through the same door as a poem: by the time a sheet
 * holds one of these it cannot tell which library it came out of except by
 * reading `kind`, which is the point of §12's "woven through" — choosing
 * Psalm 23 and choosing the Gettysburg Address are the same interaction.
 */
export type Passage = {
  id: string;
  /** How it is named on the sheet and in the picker. "Psalm 23". */
  title: string;
  /** Printed under the text. An author, or the translation for Scripture. */
  attribution: string;
  kind: PassageKind;
  collection: string;
  /** The text, in the lines it should be set in. Verbatim. */
  lines: readonly string[];
  source: PassageSource;
  /**
   * Printed small on any sheet that uses this passage, where the source asks
   * for it. Absent where it doesn't — an 1885 poem needs no credit line, and a
   * sheet that printed one anyway would be noise on a child's page.
   */
  credit?: string;
};

/** Everything except the words, for a picker that lists before it loads. */
export type PassageSummary = Omit<Passage, "lines"> & {
  /** How much there is to copy, so a picker can sort short-to-long. */
  characters: number;
};
