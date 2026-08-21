/**
 * The Scripture credit line, alone in a module of its own.
 *
 * One constant, so the sheet footer, the catalog page and the typing race can't
 * drift apart — required by nothing and printed anyway, on every sheet and
 * every screen that shows one (docs/printables.md §12).
 *
 * A leaf module rather than a line beside the verses in `scripture.ts`, because
 * a module is assigned to a chunk whole and importing this string from there
 * pulled the whole library into the chunk every island loads (§12).
 */
export const SCRIPTURE_CREDIT =
  "Scripture: World English Bible Updated (public domain) · worldenglish.bible";
