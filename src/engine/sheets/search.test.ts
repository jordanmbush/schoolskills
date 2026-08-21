import { describe, expect, it } from "vitest";

import { SHEET_FAMILIES } from "./families";
import {
  EMPTY_QUERY,
  SHEET_TYPES,
  TYPE_OF,
  findSheets,
  isIdle,
  readQuery,
  readRow,
  reachesGrade,
  ruleOf,
  terms,
  typeOf,
  writeQuery,
  type IndexRow,
  type SheetIndex,
} from "./search";
import type { PaperConfig, SheetOptions } from "./types";

/**
 * The matcher, the fold and the fragment — the half of the search that has no
 * opinion about what is on the shelves, tested without them.
 *
 * The catalog's own half is held to `dist/` in `_search.test.ts`, which is
 * where "this row points at a page that exists" is answered. Nothing here needs
 * a build, a browser or a DOM.
 */

const INDEX: SheetIndex = {
  facets: {
    subject: [
      ["math", "Maths"],
      ["paper", "Paper"],
    ],
    grade: [
      ["pre-k", "Pre-K"],
      ["kindergarten", "K"],
      ["3rd-grade", "3rd"],
    ],
    type: [
      ["worksheet", "Worksheets"],
      ["paper", "Paper"],
    ],
    rule: [["wide", "Wide ruled"]],
  },
  sheets: [
    [
      "/printables/multiplication-worksheets",
      "Multiplication worksheets",
      "Times tables to twelve",
      "Ages 7–10",
      "math",
      "worksheet",
      "",
      0b100,
    ],
    [
      "/printables/lined-paper",
      "Lined paper — wide ruled",
      "Handwriting and note taking",
      "Ages 6–11",
      "paper",
      "paper",
      "wide",
      0b011,
    ],
  ],
};

const hrefs = (query = EMPTY_QUERY) =>
  findSheets(INDEX, query).map((hit) => hit.href);

describe("what kind of page a family makes", () => {
  it("has an answer for every family in the press", () => {
    // A `Record` over the config union, so this is really a compile-time check
    // — the runtime half is that the registry and the union agree, which is
    // what would rot if a family were registered under a different id.
    for (const { id } of SHEET_FAMILIES) {
      expect(TYPE_OF[id as keyof typeof TYPE_OF], id).toBeDefined();
    }
  });

  it("only answers with a type the chips offer", () => {
    const offered = new Set(SHEET_TYPES.map((type) => type.id));
    for (const type of Object.values(TYPE_OF)) expect(offered).toContain(type);
  });

  it("reads the ruling off the config, and nothing off the ones with none", () => {
    const options: SheetOptions = {
      paper: { size: "letter", orientation: "portrait", margin: "normal" },
      fontPt: 12,
      fields: [],
    };
    const paper: PaperConfig = {
      ...options,
      kind: "paper",
      rule: { style: "hand-5-8", midline: "dashed" },
    };
    expect(typeOf(paper)).toBe("paper");
    expect(ruleOf(paper)).toBe("hand-5-8");
    // Four fifths of the catalog: a ruling honestly absent rather than
    // defaulted to something a chip would then filter on.
    expect(ruleOf({ ...options, kind: "blank" })).toBeUndefined();
  });
});

describe("reading a row", () => {
  it("names the columns the index is written in", () => {
    const hit = readRow(INDEX.sheets[1] as IndexRow);
    expect(hit).toMatchObject({
      href: "/printables/lined-paper",
      subject: "paper",
      type: "paper",
      rule: "wide",
    });
  });

  it("reads a year off the bits by its position in the facet", () => {
    // The bit order IS the facet's order — the reason `facets.grade` ships
    // whole rather than trimmed to the years that have sheets.
    expect(reachesGrade(0b110, 1)).toBe(true);
    expect(reachesGrade(0b110, 0)).toBe(false);
    expect(reachesGrade(0b110, -1)).toBe(false);
  });
});

describe("asking the index something", () => {
  it("answers an empty query with the whole shop", () => {
    expect(isIdle(EMPTY_QUERY)).toBe(true);
    expect(hrefs()).toHaveLength(2);
  });

  it("narrows as more words are typed, rather than widening", () => {
    expect(terms("  Long   Division ")).toEqual(["long", "division"]);
    expect(hrefs({ ...EMPTY_QUERY, text: "lined" })).toEqual([
      "/printables/lined-paper",
    ]);
    // The second word is the test: an `or` would bring back every sheet whose
    // name contains "paper", which is the opposite of what typing more means.
    expect(hrefs({ ...EMPTY_QUERY, text: "lined multiplication" })).toEqual([]);
  });

  it("finds a sheet by its shelf and by its school year", () => {
    // Neither word is on the sheet. "Maths" is the shelf's label and "3rd
    // grade" is a fact about the row's bits, and a parent types both.
    expect(hrefs({ ...EMPTY_QUERY, text: "maths" })).toEqual([
      "/printables/multiplication-worksheets",
    ]);
    expect(hrefs({ ...EMPTY_QUERY, text: "3rd grade" })).toEqual([
      "/printables/multiplication-worksheets",
    ]);
    // Both ways of writing the year, because both get typed. Widening the row
    // rather than rewriting the query: "first" has to keep finding the sheet
    // called "First sentences".
    expect(hrefs({ ...EMPTY_QUERY, text: "third grade" })).toEqual([
      "/printables/multiplication-worksheets",
    ]);
  });

  it("crosses the four facets with each other and with the words", () => {
    expect(hrefs({ ...EMPTY_QUERY, grade: "kindergarten" })).toEqual([
      "/printables/lined-paper",
    ]);
    expect(hrefs({ ...EMPTY_QUERY, subject: "math", type: "paper" })).toEqual(
      [],
    );
    expect(hrefs({ ...EMPTY_QUERY, rule: "wide", text: "paper" })).toEqual([
      "/printables/lined-paper",
    ]);
  });
});

describe("the search in the fragment", () => {
  it("writes nothing at all when nothing has been asked for", () => {
    expect(writeQuery(EMPTY_QUERY)).toBe("");
  });

  it("survives a round trip", () => {
    const query = { ...EMPTY_QUERY, text: "graph paper", grade: "3rd-grade" };
    const hash = writeQuery(query);
    expect(hash).toContain("find=graph+paper");
    expect(readQuery(hash, INDEX)).toEqual(query);
  });

  it("drops a facet this build has never heard of", () => {
    // Untrusted input: it came off somebody's clipboard. An id nothing matches
    // would filter every sheet out and leave a parent looking at an empty shop
    // with no way to tell why.
    expect(readQuery("#grade=year-4&subject=math", INDEX)).toEqual({
      ...EMPTY_QUERY,
      subject: "math",
    });
    expect(readQuery("#s=eyJjb25maWciOnt9fQ", INDEX)).toEqual(EMPTY_QUERY);
  });
});
