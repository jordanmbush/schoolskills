import { describe, expect, it } from "vitest";

import { setCustomLists } from "@/engine/decks/words";
import { WORD_LISTS, listWords } from "@/engine/decks/wordlists";

import { buildSheet } from "./index";
import { PRACTICE_SEED, practiceHref, practiceSheet } from "./practice";
import { decodeSharedSheet } from "./share";
import type { Problem } from "./types";

/**
 * The record book, as paper.
 *
 * The claim this module makes is narrow and total: what comes out prints
 * *exactly* the facts that went in, in the same order, with nothing about the
 * child anywhere in it. So the tests are about the hand-off rather than about
 * arithmetic — the families' own suites already check that every answer is
 * right — plus the two cases a headline feature has to survive: a child with
 * no history, and a deck this build cannot print.
 */

const problemsOf = (mode: string, facts: string[]): Problem[] => {
  const config = practiceSheet(mode, facts);
  if (!config) throw new Error(`no sheet for ${mode}`);
  const block = buildSheet(config, PRACTICE_SEED).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
};

describe("a sheet of what they keep missing", () => {
  it("prints the times-table facts the record book ranked, in order", () => {
    const missed = ["7:8", "6:9", "12:11"];
    expect(problemsOf("multiply", missed).map((p) => p.factId)) //
      .toEqual(missed);
    expect(problemsOf("multiply", missed).map((p) => p.prompt)).toEqual([
      "7 × 8 =",
      "6 × 9 =",
      "12 × 11 =",
    ]);
  });

  it("asks a division deck's facts as divisions", () => {
    // The deck files "21 ÷ 3" under `3:7` — the divisor, then the answer — and
    // a sheet that read the pair the other way round would drill 7 ÷ 3.
    expect(problemsOf("divide", ["3:7"])[0].prompt).toBe("21 ÷ 3 =");
    expect(problemsOf("subtract", ["3:5"])[0].prompt).toBe("8 − 3 =");
    expect(problemsOf("add", ["3:5"])[0].prompt).toBe("3 + 5 =");
  });

  it("asks for each fact once, however often it was missed", () => {
    // `troubleFacts` already folds a fact onto one entry, but a caller may
    // hand over cards rather than facts, and a page that asked "7 × 8" three
    // times would be a page of three problems pretending to be one of eight.
    expect(problemsOf("multiply", ["7:8", "7:8", "6:9"]).length).toBe(2);
  });

  it("prints a spelling deck's missed words as a spelling sheet", () => {
    const config = practiceSheet("words:dolch-1", ["because", "friend"]);
    expect(config).toMatchObject({
      kind: "words",
      style: "copy",
      words: ["because", "friend"],
    });
  });

  it("prints a parent's own list, mirrored in from the deck service", () => {
    // A custom list only exists in the engine because `services/decks.ts` put
    // it there. This is the path that would break if the mirror ever stopped
    // being loaded before a sheet was asked for.
    setCustomLists([{ id: "custom-1", name: "Week 3", words: ["gnome"] }]);
    expect(practiceSheet("words:custom-1", [])).toMatchObject({
      kind: "words",
      words: ["gnome"],
    });
    setCustomLists([]);
  });
});

describe("a child with no history", () => {
  it("still gets a sheet worth printing", () => {
    // The commonest case on a family machine, and the one that decides whether
    // the feature is usable at all: an empty list is not an empty sheet.
    for (const mode of ["multiply", "divide", "add", "subtract"]) {
      const problems = problemsOf(mode, []);
      expect(problems.length, mode).toBeGreaterThan(10);
      for (const problem of problems) expect(problem.answer).not.toBe("");
    }
  });

  it("prints a whole word list when nothing has been missed in it", () => {
    const config = practiceSheet(`words:${WORD_LISTS[0].id}`, []);
    expect(config).toMatchObject({
      kind: "words",
      words: listWords(WORD_LISTS[0]),
    });
  });
});

describe("a deck with no sheet in this build", () => {
  it("says so rather than printing a blank page", () => {
    // `null` and not an empty sheet: the caller is the one that knows what to
    // do instead — a results screen hides the button, the bench says a line.
    expect(practiceSheet("typing:home-row", ["the", "and"])).toBeNull();
    expect(practiceSheet("hieroglyphs", ["1:2"])).toBeNull();
    // A list this build has never heard of, with nothing missed in it either:
    // there are no words to print, and inventing some would be worse.
    expect(practiceSheet("words:gone", [])).toBeNull();
  });
});

describe("the link to the bench", () => {
  it("carries the whole sheet, and reads back as the same one", () => {
    const config = practiceSheet("multiply", ["7:8"])!;
    const href = practiceHref(config);
    expect(href.startsWith("/printables/make#s=")).toBe(true);
    expect(decodeSharedSheet(href.split("#s=")[1])).toEqual({
      config,
      seed: PRACTICE_SEED,
    });
  });

  it("has nothing about the child in it", () => {
    // The one property this module cannot be allowed to lose, and the reason
    // the profile stays on the service's side of the line: a config is facts,
    // paper and type, and this link is the surface a name would leak through.
    // `fields` is the blank rule on the paper, filled in by hand (§1) — there
    // is nowhere here to put a value for it.
    const config = practiceSheet("words:dolch-1", ["because"])!;
    expect(config.fields).toEqual(["name", "date"]);
    expect(Object.keys(config).sort()).toEqual([
      "columns",
      "count",
      "fields",
      "fontPt",
      "gaps",
      "kind",
      "paper",
      "style",
      "times",
      "words",
    ]);
    expect(Object.keys(practiceSheet("multiply", ["7:8"])!).sort()).toEqual([
      "columns",
      "count",
      "factors",
      "facts",
      "fields",
      "fontPt",
      "form",
      "kind",
      "operation",
      "paper",
      "style",
      "tables",
    ]);
  });
});
