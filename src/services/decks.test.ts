import { describe, expect, it } from "vitest";

import { isBuiltIn, parseWords, readDeckFile, toFile } from "./decks";
import type { CustomDeck } from "@/engine/types";

/**
 * The pure half of the deck service — parsing what a parent pasted, and
 * refusing a file that isn't ours.
 *
 * `create`, `update` and `remove` are not exercised here or anywhere else: they
 * need IndexedDB, and the browser suite drives profiles and races rather than
 * decks. The store underneath them — the upgrade that added `decks`, and its
 * place in a backup — is covered in `storage/db.test.ts`.
 */

describe("parseWords", () => {
  it("takes a list off a school letter however it was formatted", () => {
    // Newlines, commas, semicolons and tabs, because the list is being pasted
    // from an email or a screenshot and nobody should have to reformat it.
    expect(parseWords("because\nthought\nfriend")).toEqual([
      "because",
      "thought",
      "friend",
    ]);
    expect(parseWords("because, thought; friend")).toEqual([
      "because",
      "thought",
      "friend",
    ]);
    expect(parseWords("because\tthought")).toEqual(["because", "thought"]);
  });

  it("keeps the order it was given", () => {
    // A spelling list is often taught in order, and re-sorting it alphabetically
    // would quietly throw that away.
    expect(parseWords("zebra, apple, mango")).toEqual([
      "zebra",
      "apple",
      "mango",
    ]);
  });

  it("drops blanks and trailing separators", () => {
    expect(parseWords("cat,,dog,\n\n")).toEqual(["cat", "dog"]);
    expect(parseWords("   ")).toEqual([]);
  });

  it("de-duplicates the way the marker will", () => {
    // "Cat" and "cat" mark identically, so keeping both would mean a card that
    // can never be got wrong twice and a word map with a phantom entry.
    expect(parseWords("cat, Cat, CAT")).toEqual(["cat"]);
  });
});

describe("sharing a list", () => {
  const deck: CustomDeck = {
    id: "custom-abc",
    name: "Week 12",
    emoji: "🐝",
    words: ["because", "thought"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  it("writes the list and nothing else", () => {
    // Not the id, and certainly not timestamps: what gets passed round a class
    // group is this week's spellings, not anything about the sender.
    expect(toFile(deck)).toEqual({
      kind: "schoolskills-deck",
      version: 1,
      name: "Week 12",
      emoji: "🐝",
      words: ["because", "thought"],
    });
    expect(Object.keys(toFile(deck))).not.toContain("id");
  });

  it("reads a good file into the same input a typed-in list produces", () => {
    expect(readDeckFile(toFile(deck))).toEqual({
      name: "Week 12",
      emoji: "🐝",
      words: ["because", "thought"],
    });
  });

  it("holds a shared list to the same rules as a typed-in one", () => {
    const file = (words: string[], name = "Week 12") => ({
      kind: "schoolskills-deck" as const,
      version: 1 as const,
      name,
      emoji: "🐝",
      words,
    });
    // A word with a space can't be marked fairly — nothing on the card tells
    // the speller a space is expected, so a missing one reads as a
    // misspelling. Same reason the shipped lists have none.
    expect(() => readDeckFile(file(["ice cream", "cat"]))).toThrow(/space/);
    expect(() => readDeckFile(file(["cat"]))).toThrow(/at least/);
    expect(() =>
      readDeckFile(file(Array.from({ length: 201 }, (_, i) => `w${i}`))),
    ).toThrow(/more than/);
    expect(() => readDeckFile(file(["cat", "dog"], "   "))).toThrow(/name/i);
  });

  it("refuses a file that isn't one of ours", () => {
    // A half-recognised file that imports anyway is worse than one that
    // refuses: it puts junk in a list a child then gets marked against.
    for (const bad of [
      null,
      42,
      {},
      { kind: "something-else", words: ["a"] },
      { kind: "schoolskills-deck", words: "not an array" },
    ]) {
      expect(() => readDeckFile(bad)).toThrow(/word list/);
    }
  });
});

describe("isBuiltIn", () => {
  it("knows which lists can't be edited", () => {
    expect(isBuiltIn("dolch-1")).toBe(true);
    expect(isBuiltIn("custom-abc")).toBe(false);
  });
});
