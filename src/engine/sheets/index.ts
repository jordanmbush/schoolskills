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
import { UNKNOWN_SHEET, type SheetSpec } from "./spec";
import { PAPER_SHEET } from "./templates/paper";

const SHEETS: Record<string, SheetSpec> = {
  [BLANK_SHEET.id]: BLANK_SHEET,
  [PAPER_SHEET.id]: PAPER_SHEET,
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
 * Build a sheet. Deterministic in `(config, seed)`, which is the mechanism
 * behind three of the features in §7 rather than one: an answer key is the
 * same build, "another sheet like this one" is `seed + 1`, and a sheet is
 * reproducible from a shared URL because the seed is in it.
 */
export function buildSheet(config: SheetConfig, seed: number): Sheet {
  return sheetSpec(config.kind).build(config, seed);
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
  return spec.key(spec.build(config, seed));
}

/** One line naming what a config prints, for the catalog and the record. */
export function describeSheet(config: SheetConfig): string {
  return sheetSpec(config.kind).describe(config);
}

export type { SheetSpec };
