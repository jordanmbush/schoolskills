import { describe, expect, it } from "vitest";

import { describeSheet } from "@/engine/sheets";
import { DEFAULT_FONT_PT, DEFAULT_PAPER } from "@/engine/sheets/paper";
import type { SavedSheet, SheetConfig } from "@/engine/sheets/types";

import { InvalidSheet, MAX_NAME, readSheetFile, toFile } from "./sheets";

/**
 * The pure half of the sheet service — what may be saved, and refusing a file
 * that isn't ours. Everything that writes needs IndexedDB, so it is covered in
 * `storage/db.test.ts` against a fake one, alongside the store's own upgrade
 * and backup paths.
 */

const config: SheetConfig = {
  kind: "paper",
  paper: DEFAULT_PAPER,
  fontPt: DEFAULT_FONT_PT,
  fields: ["name", "date"],
  rule: { style: "hand-5-8" },
};

const sheet: SavedSheet = {
  id: "sheet-abc",
  name: "Monday handwriting",
  config,
  seed: 12,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("sharing a sheet", () => {
  it("writes the sheet and nothing else", () => {
    // Not the id, and not the timestamps: what gets passed round is next week's
    // worksheet, not a record of when somebody made it.
    expect(toFile(sheet)).toEqual({
      kind: "schoolskills-sheet",
      version: 1,
      name: "Monday handwriting",
      config,
      seed: 12,
    });
    expect(Object.keys(toFile(sheet))).not.toContain("id");
  });

  it("reads a good file into the same input the builder produces", () => {
    expect(readSheetFile(toFile(sheet))).toEqual({
      name: "Monday handwriting",
      config,
      seed: 12,
    });
  });

  it("keeps the seed, because it says which sheet this is", () => {
    // A config alone reproduces the same *kind* of sheet with different
    // problems. The seed is the difference between being sent a worksheet and
    // being sent a description of one.
    expect(readSheetFile({ ...toFile(sheet), seed: 991 }).seed).toBe(991);
  });

  it("refuses a file that isn't ours", () => {
    expect(() => readSheetFile({ kind: "schoolskills-deck" })).toThrow(
      InvalidSheet,
    );
    expect(() => readSheetFile({ ...toFile(sheet), config: null })).toThrow(
      InvalidSheet,
    );
    // A sheet with no seed can't be the sheet the sender printed.
    expect(() => readSheetFile({ ...toFile(sheet), seed: undefined })).toThrow(
      InvalidSheet,
    );
    expect(() => readSheetFile("a string")).toThrow(InvalidSheet);
    expect(() => readSheetFile(null)).toThrow(InvalidSheet);
  });

  it("refuses a half-built config as InvalidSheet, not as a TypeError", () => {
    // The kind is one this build makes, so the spec check passes — and then the
    // family reads its own config to name the sheet, and `paper` has no rule to
    // read. Whatever comes out of this door has to be an `InvalidSheet`, or the
    // caller that catches one is left holding a crash instead of a message.
    expect(() =>
      readSheetFile({
        kind: "schoolskills-sheet",
        version: 1,
        name: "",
        config: { kind: "paper" },
        seed: 1,
      }),
    ).toThrow(InvalidSheet);
  });

  it("refuses a sheet this build doesn't know how to make", () => {
    // It would import perfectly and then print a page saying "sheet
    // unavailable". Somebody who was sent a worksheet is better told why.
    expect(() =>
      readSheetFile({
        ...toFile(sheet),
        config: { ...config, kind: "alchemy" },
      }),
    ).toThrow(InvalidSheet);
  });
});

describe("what may be saved", () => {
  it("names an unnamed sheet after what it prints", () => {
    // The engine already says in one line what a config makes, so a sheet with
    // no name typed on it gets that rather than "Untitled".
    const read = readSheetFile({ ...toFile(sheet), name: "   " });
    expect(read.name).toBe(describeSheet(config));
    expect(read.name.length).toBeGreaterThan(0);
  });

  it("refuses a name past the cap", () => {
    expect(() =>
      readSheetFile({ ...toFile(sheet), name: "x".repeat(MAX_NAME + 1) }),
    ).toThrow(InvalidSheet);
  });

  it("refuses a seed that isn't a whole number", () => {
    // Every one of these builds — `mulberry32` starts with `seed >>> 0` — and
    // every one builds a different sheet from the one being saved.
    for (const seed of [1.5, -1, Number.NaN, 2 ** 60]) {
      expect(() => readSheetFile({ ...toFile(sheet), seed })).toThrow(
        InvalidSheet,
      );
    }
  });
});
