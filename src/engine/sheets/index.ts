/**
 * The sheet layer's front door, with every family already in hand (§3).
 *
 * The `SheetConfig` union is narrowed in exactly one place: the registry lookup
 * in `sheetSpec`. A spec is keyed by the same string its config carries as
 * `kind`, so looking one up *is* the narrowing — there is no `if (isLined)`
 * chain to keep in step with the union, and adding a family is an entry in
 * families.ts plus a `kind` in types.ts. See the note on `SheetSpec` for the
 * one thing that makes that typecheck.
 *
 * **This door assembles the whole press, so only Node ever opens it.** The
 * top-level `await` below runs every loader in families.ts, which is what lets
 * the catalog build and the tests call a plain synchronous `buildSheet` while
 * the builder island fetches a family at a time. Import it from anything that
 * ships to a browser and the split stops working: the island's route is
 * `loadSheet(kind)`.
 */
import { SHEET_FAMILIES } from "./families";
import { UNKNOWN_SHEET, buildWith, keyWith, type SheetSpec } from "./spec";
import type { Sheet, SheetConfig } from "./types";

const SHEETS: Record<string, SheetSpec> = Object.fromEntries(
  await Promise.all(
    SHEET_FAMILIES.map(
      async (family) => [family.id, await family.load()] as const,
    ),
  ),
);

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

/** Build a sheet. Deterministic in `(config, seed)` — see `buildWith`. */
export function buildSheet(config: SheetConfig, seed: number): Sheet {
  return buildWith(sheetSpec(config.kind), config, seed);
}

/** The same sheet with the answers drawn in — see `keyWith`. */
export function answerKey(config: SheetConfig, seed: number): Sheet {
  return keyWith(sheetSpec(config.kind), config, seed);
}

/** One line naming what a config prints, for the catalog and its tests. */
export function describeSheet(config: SheetConfig): string {
  return sheetSpec(config.kind).describe(config);
}

export type { SheetSpec };
