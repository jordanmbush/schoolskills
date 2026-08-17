/**
 * The sheet layer's front door.
 *
 * Everything above the engine asks for a sheet here rather than from a family
 * module, so a catalog page, the builder and a unit test all go through the
 * same three functions and none of them learns whether it is holding long
 * division or a handwriting rule.
 *
 * The `SheetConfig` union is narrowed in exactly one place: the registry lookup
 * in `sheetSpec`. A spec is keyed by the same string its config carries as
 * `kind`, so looking one up *is* the narrowing — there is no `if (isLined)`
 * chain to keep in step with the union, and adding a family is an entry in the
 * table below plus a `kind` in types.ts. See the note on `SheetSpec` for the
 * one thing that makes that typecheck.
 */
import type { Sheet, SheetConfig } from "./types";

import { BLANK_SHEET } from "./blank";
import { GRAMMAR_SHEET } from "./grammar/grammar";
import { ARITHMETIC_SHEET } from "./maths/arithmetic";
import { DECIMALS_SHEET } from "./maths/decimals";
import { FRACTIONS_SHEET } from "./maths/fractions";
import { GEOMETRY_SHEET } from "./maths/geometry";
import { INTEGERS_SHEET } from "./maths/integers";
import { MEASURE_SHEET } from "./maths/measure";
import { MONEY_SHEET } from "./maths/money";
import { MULTIPLICATION_SHEET } from "./maths/multiplication";
import { PREALGEBRA_SHEET } from "./maths/prealgebra";
import { RATIO_SHEET } from "./maths/ratio";
import { STATISTICS_SHEET } from "./maths/statistics";
import { TIME_SHEET } from "./maths/time";
import { WORD_PROBLEMS_SHEET } from "./maths/wordproblems";
import { PHONICS_SHEET } from "./phonics/sheets";
import { UNKNOWN_SHEET, type SheetSpec } from "./spec";
import { CHART_SHEET } from "./templates/charts";
import { PAPER_SHEET } from "./templates/paper";
import { HANDWRITING_SHEET } from "./writing/handwriting";
import { MEMORY_SHEET } from "./writing/memory";
import { PUZZLE_SHEET } from "./words/puzzles";
import { WORDS_SHEET } from "./words/spelling";
import { WORD_STUDY_SHEET } from "./words/study";

const SHEETS: Record<string, SheetSpec> = {
  [BLANK_SHEET.id]: BLANK_SHEET,
  [PAPER_SHEET.id]: PAPER_SHEET,
  [CHART_SHEET.id]: CHART_SHEET,
  [ARITHMETIC_SHEET.id]: ARITHMETIC_SHEET,
  [MULTIPLICATION_SHEET.id]: MULTIPLICATION_SHEET,
  [FRACTIONS_SHEET.id]: FRACTIONS_SHEET,
  [DECIMALS_SHEET.id]: DECIMALS_SHEET,
  [MONEY_SHEET.id]: MONEY_SHEET,
  [TIME_SHEET.id]: TIME_SHEET,
  [MEASURE_SHEET.id]: MEASURE_SHEET,
  [GEOMETRY_SHEET.id]: GEOMETRY_SHEET,
  [INTEGERS_SHEET.id]: INTEGERS_SHEET,
  [PREALGEBRA_SHEET.id]: PREALGEBRA_SHEET,
  [RATIO_SHEET.id]: RATIO_SHEET,
  [STATISTICS_SHEET.id]: STATISTICS_SHEET,
  [WORD_PROBLEMS_SHEET.id]: WORD_PROBLEMS_SHEET,
  [WORDS_SHEET.id]: WORDS_SHEET,
  [WORD_STUDY_SHEET.id]: WORD_STUDY_SHEET,
  [PUZZLE_SHEET.id]: PUZZLE_SHEET,
  [GRAMMAR_SHEET.id]: GRAMMAR_SHEET,
  [PHONICS_SHEET.id]: PHONICS_SHEET,
  [HANDWRITING_SHEET.id]: HANDWRITING_SHEET,
  [MEMORY_SHEET.id]: MEMORY_SHEET,
};

/**
 * Resolves a sheet family. Never throws — see `UNKNOWN_SHEET` for why a kind
 * this build has never heard of has to print something rather than fail.
 *
 * The lookup asks for an *own* property, because `kind` arrives from outside
 * this build. Plain `SHEETS[kind]` would answer `sheetSpec("toString")` with
 * `Object.prototype.toString`, which is truthy, is not a spec, and turns a
 * promise never to throw into a `TypeError` one line later in `buildSheet`.
 */
export function sheetSpec(kind: string): SheetSpec {
  return Object.hasOwn(SHEETS, kind) ? SHEETS[kind] : UNKNOWN_SHEET;
}

/** Everything this build can make, for the catalog and the builder's picker. */
export function listSheets(): SheetSpec[] {
  return Object.values(SHEETS);
}

/**
 * The presentation half of `SheetOptions`, copied onto what a family built.
 *
 * Here rather than in every `build` function for the reason `chrome.ts`
 * gives for living on its own: every family would otherwise write the same
 * three lines, and the next one added would be the one that forgot. It is
 * safe to do it after the fact because none of the three changes a length —
 * the face is set in points, a bordered slot is the same line box as a ruled
 * one, and the cut guides are drawn over the paper rather than in the flow —
 * so nothing here can make a sheet the layout arithmetic already fitted stop
 * fitting.
 *
 * A family that has already said something wins, which is what keeps this a
 * default rather than an override: `UNKNOWN_SHEET` sets nothing and gets the
 * parent's choices, and a family that one day sets its own is not quietly
 * undone from out here.
 */
function present(config: SheetConfig, sheet: Sheet): Sheet {
  return {
    ...sheet,
    font: sheet.font ?? config.font,
    answerBox: sheet.answerBox ?? config.answerBox,
    cutLines: sheet.cutLines ?? config.cutLines,
  };
}

/**
 * Build a sheet. Deterministic in `(config, seed)`, which is the mechanism
 * behind three of the features in §7 rather than one: an answer key is the
 * same build, "another sheet like this one" is `seed + 1`, and a sheet is
 * reproducible from a shared URL because the seed is in it.
 */
export function buildSheet(config: SheetConfig, seed: number): Sheet {
  return present(config, sheetSpec(config.kind).build(config, seed));
}

/**
 * The same sheet with the answers drawn in.
 *
 * A second build from the same seed, not a second generation of the answers:
 * they were computed when the sheet was built and `key` only decides to print
 * them, so a key cannot disagree with the sheet it belongs to.
 */
export function answerKey(config: SheetConfig, seed: number): Sheet {
  const spec = sheetSpec(config.kind);
  return present(config, spec.key(spec.build(config, seed)));
}

/** One line naming what a config prints, for the catalog and the record. */
export function describeSheet(config: SheetConfig): string {
  return sheetSpec(config.kind).describe(config);
}

export type { SheetSpec };
