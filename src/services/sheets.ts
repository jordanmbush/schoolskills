import { describeSheet, sheetSpec } from "@/engine/sheets";
import { UNKNOWN_SHEET } from "@/engine/sheets/spec";
import type { SavedSheet, SheetConfig } from "@/engine/sheets/types";

import * as store from "./storage/db";

/**
 * Worksheets a parent set up and kept.
 *
 * The only writer of the `sheets` store, and the only place the rules for what
 * may be saved are stated — the same bargain `decks.ts` strikes with word
 * lists, for the same reason: a sheet typed into the builder and a sheet read
 * out of a file somebody was sent have to end up as the same record, and two
 * validators would eventually disagree about which.
 *
 * What it does *not* do is mirror anything back into the engine. A custom deck
 * has to be mirrored because `deckSpec` names one from the record book without
 * knowing storage exists; a sheet needs no such favour, because its name and
 * its one-line description are both computable from the config it carries. The
 * engine never has to be told that a saved sheet exists.
 */

export class InvalidSheet extends Error {}

/**
 * Long enough for the name the engine gives a sheet when a parent doesn't.
 *
 * Generous next to a word list's 40, because it is not only a thing somebody
 * types: `describeSheet` produces lines like "Multiplication — 3-digit by
 * 2-digit — worked in columns", and the default name has to fit inside its own
 * cap.
 */
export const MAX_NAME = 80;

/**
 * `sheet-` for the same reason a custom deck's id is `custom-`: the two live in
 * one origin's IndexedDB and one backup file, and a collision between them
 * would be a worksheet overwriting this week's spellings.
 */
const nextId = () =>
  `sheet-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** What a caller hands over. The record's id and timestamps are ours to make. */
export type SheetInput = { name: string; config: SheetConfig; seed: number };

function validate(input: SheetInput): SheetInput {
  // Guarded rather than trusted, because this is also the door a shared file
  // comes through. A config with no `kind` at all is not a sheet from a family
  // that retired — it is a record that can never start printing.
  if (typeof input.config?.kind !== "string" || !input.config.kind)
    throw new InvalidSheet("That sheet has nothing to print");

  const typed = input.name.trim();
  if (typed.length > MAX_NAME)
    throw new InvalidSheet(`Name must be ${MAX_NAME} characters or fewer`);

  // A blank name is not an error here, unlike a blank word-list name: the
  // engine can already say in one line what a config prints, and `describeSheet`
  // is documented as the line for the catalog *and the record*. Clipped rather
  // than checked against the cap, because a name the service chose for itself
  // must never be the thing that refuses the save.
  //
  // Guarded, because this is the untrusted door. A family describes its own
  // config and reaches into it to do so — `describePaper` reads `rule.style` —
  // and all this config has been held to so far is a `kind` string. A file
  // carrying the right kind and a missing sub-object would throw a raw
  // TypeError out of a function documented as throwing `InvalidSheet`, which a
  // caller catching `InvalidSheet` would not catch at all.
  let name = typed;
  if (!name) {
    try {
      name = describeSheet(input.config).slice(0, MAX_NAME);
    } catch {
      throw new InvalidSheet("That sheet has nothing to print");
    }
  }

  // The seed is which one of the infinitely many sheets a config makes this is
  // (§7). A fraction or a negative would still build — `mulberry32` starts with
  // `seed >>> 0` — but it would build a *different* sheet than the one being
  // saved, and reproducing that exact page is the whole of what a saved sheet
  // is for.
  if (!Number.isSafeInteger(input.seed) || input.seed < 0)
    throw new InvalidSheet("That sheet's seed isn't a whole number");

  return { name, config: input.config, seed: input.seed };
}

/**
 * Every saved sheet, oldest first.
 *
 * All of them, with no profile to filter by: a worksheet belongs to the
 * household rather than to a child (docs/printables.md §15).
 */
export async function all(): Promise<SavedSheet[]> {
  return (await store.allSheets()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

export async function create(input: SheetInput): Promise<SavedSheet> {
  const clean = validate(input);
  const now = new Date().toISOString();
  const sheet: SavedSheet = {
    id: nextId(),
    ...clean,
    createdAt: now,
    updatedAt: now,
  };
  await store.putSheet(sheet);
  return sheet;
}

export async function update(
  id: string,
  input: SheetInput,
): Promise<SavedSheet> {
  const existing = (await store.allSheets()).find((s) => s.id === id);
  if (!existing) throw new InvalidSheet("That sheet no longer exists");
  const sheet: SavedSheet = {
    ...existing,
    ...validate(input),
    updatedAt: new Date().toISOString(),
  };
  await store.putSheet(sheet);
  return sheet;
}

/**
 * Forgets a sheet.
 *
 * Nothing is orphaned by it, which is the difference from removing a deck:
 * there are no races saved against a worksheet, only paper that was already
 * printed and is on the fridge either way.
 */
export async function remove(id: string): Promise<void> {
  await store.removeSheet(id);
}

/* ── Sharing one sheet ───────────────────────────────────────────────────
   A single sheet as a file, distinct from a full backup, for the same reason
   a deck has one: what gets passed round a class group is next week's
   worksheet, not somebody's children's race history.

   Safe to email in a way an export of the record book is not, and not by
   luck. There is nowhere in a `SheetConfig` to put a child's name — the name
   line is printed blank and filled in by hand (§1) — so the file carries a
   configuration and nothing about anybody.                                 */

export type SheetFile = {
  kind: "schoolskills-sheet";
  version: 1;
  name: string;
  config: SheetConfig;
  /**
   * Travels with the config, for the reason §7 gives: without it the reader
   * gets the same *kind* of sheet with different problems, which is a feature
   * (`seed + 1`) handed out by accident instead of the sheet they were sent.
   */
  seed: number;
};

export const toFile = (sheet: SavedSheet): SheetFile => ({
  kind: "schoolskills-sheet",
  version: 1,
  name: sheet.name,
  config: sheet.config,
  seed: sheet.seed,
});

/**
 * Reads a shared sheet into the same input the builder produces.
 *
 * Deliberately does NOT write, exactly as `readDeckFile` doesn't: `create` is
 * the one path a saved sheet comes into being through, and an import that
 * wrote here would land in IndexedDB and stay invisible to whatever list is
 * already on screen until the next reload.
 *
 * The sender's id is dropped on purpose — it isn't in the file to begin with.
 * Two families' copies are separate sheets, and keeping the id would silently
 * overwrite a sheet of the same origin that the reader had since re-tuned.
 */
export function readSheetFile(parsed: unknown): SheetInput {
  const file = parsed as Partial<SheetFile>;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    file.kind !== "schoolskills-sheet" ||
    typeof file.config !== "object" ||
    file.config === null ||
    typeof file.seed !== "number"
  ) {
    throw new InvalidSheet("That doesn't look like a School Skills sheet");
  }

  // Checked here and nowhere else. A config whose family this build hasn't got
  // would save as a page that says "sheet unavailable", and somebody who was
  // sent a worksheet is better told why than handed a blank one. Records
  // already in storage are never held to this — `UNKNOWN_SHEET` exists so a
  // sheet outlives the family it was made on, and renaming an old one must not
  // fail because that family has since retired.
  if (sheetSpec(file.config.kind) === UNKNOWN_SHEET)
    throw new InvalidSheet("This version doesn't make that kind of sheet");

  return validate({
    name: typeof file.name === "string" ? file.name : "",
    config: file.config,
    seed: file.seed,
  });
}
