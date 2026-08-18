/**
 * The library as a whole, and the door into it.
 *
 * scripture.test.ts holds the WEBu to its release; this holds everything else
 * to the two rules types.ts states — every passage names its source and its
 * licence, and nothing is quoted that we can't say why we may quote. Those are
 * the rules that stop being true quietly, one careless addition at a time.
 */
import { describe, expect, it } from "vitest";

import { DOCUMENTS } from "./documents";
import {
  DEFAULT_TRANSLATION,
  PASSAGE_COLLECTIONS,
  SCRIPTURE_CREDIT,
  TRANSLATION_LIST,
  listPassageSummaries,
  listPassages,
  passage,
  passageText,
  passagesIn,
  type TranslationId,
} from "./index";
import { LITERATURE } from "./literature";
import { POETRY } from "./poetry";
import { SCRIPTURE } from "./scripture";

const ALL = listPassages();

describe("provenance", () => {
  it("records a source and a licence on every passage", () => {
    for (const item of ALL) {
      const { work, author, year, edition, licence } = item.source;
      for (const [field, value] of Object.entries({
        work,
        author,
        year,
        edition,
        licence,
      })) {
        expect(value.trim(), `${item.id}.${field}`).not.toBe("");
      }
    }
  });

  it("credits Scripture, and only Scripture, on the sheet", () => {
    for (const item of ALL) {
      if (item.kind === "scripture") expect(item.credit, item.id).toBeTruthy();
      // A poem from 1885 needs no credit line, and one printed anyway is noise
      // on a child's page. This is the rule, not an omission to be filled in.
      else expect(item.credit, item.id).toBeUndefined();
    }
  });

  it("quotes nothing published inside the last hundred years", () => {
    // Not the legal line — US copyright runs to publication before 1931 as
    // things stand — but the slack this library keeps, because a term that
    // moves is the failure mode you can't see coming. Scripture is exempt: the
    // WEBu is a modern text released into the public domain outright.
    for (const item of [...DOCUMENTS, ...LITERATURE, ...POETRY]) {
      const year = Number(item.source.year.replace(/\D/g, ""));
      expect(year, item.id).toBeLessThan(1926);
    }
  });
});

describe("the shape of a passage", () => {
  it("has unique ids across every library", () => {
    const ids = ALL.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts every passage in a collection that exists", () => {
    const known = new Set(PASSAGE_COLLECTIONS.map(({ id }) => id));
    for (const item of ALL)
      expect(known.has(item.collection), item.id).toBe(true);
  });

  it("agrees with its collection about what kind of thing it is", () => {
    const kinds = new Map(PASSAGE_COLLECTIONS.map((c) => [c.id, c.kind]));
    for (const item of ALL) {
      expect(kinds.get(item.collection), item.id).toBe(item.kind);
    }
  });

  it("has text, trimmed, on every line that isn't a stanza break", () => {
    for (const item of ALL) {
      expect(item.lines.length, item.id).toBeGreaterThan(0);
      for (const line of item.lines) {
        expect(line, item.id).toBe(line.trim());
        // An empty line is a stanza break, which only a poem has. Anywhere
        // else it is a paragraph that went missing in an edit.
        if (line === "") expect(item.kind, item.id).toBe("poetry");
      }
      expect(item.lines.at(0), item.id).not.toBe("");
      expect(item.lines.at(-1), item.id).not.toBe("");
    }
  });

  it("joins its lines without inventing anything", () => {
    const alice = passage("alice-in-wonderland");
    expect(passageText(alice!)).toBe(alice!.lines.join("\n"));
  });
});

describe("the front door", () => {
  it("lists Scripture first, then the rest", () => {
    const scripture = ALL.slice(0, SCRIPTURE.length);
    expect(scripture.every((item) => item.kind === "scripture")).toBe(true);
    expect(ALL).toHaveLength(
      SCRIPTURE.length + DOCUMENTS.length + LITERATURE.length + POETRY.length,
    );
    expect(PASSAGE_COLLECTIONS[0].kind).toBe("scripture");
  });

  it("answers with nothing for an id it has never heard of", () => {
    expect(passage("no-such-passage")).toBeUndefined();
    // The prototype-chain trap `sheetSpec` guards against, from the same
    // direction: an id can arrive from a bookmarked URL.
    expect(passage("toString")).toBeUndefined();
  });

  it("falls back to a whole translation for one it has never heard of", () => {
    // Same trap from the other side, and the reason the fallback is whole: a
    // sheet must never print WEBu verses under the KJV's credit line.
    const odd = passage("psalm-23", "toString" as TranslationId);
    expect(odd).toEqual(passage("psalm-23"));
    expect(odd?.credit).toBe(SCRIPTURE_CREDIT);
  });

  it("reads a psalm in either translation, credited correctly", () => {
    const webu = passage("psalm-23");
    const kjv = passage("psalm-23", "kjv");
    expect(webu?.lines[0]).toContain("The LORD is my shepherd");
    expect(kjv?.lines[0]).toContain("I shall not want");
    expect(webu?.credit).toBe(SCRIPTURE_CREDIT);
    expect(kjv?.credit).not.toBe(SCRIPTURE_CREDIT);
    expect(kjv?.lines).toHaveLength(webu!.lines.length);
  });

  it("defaults to the WEBu", () => {
    expect(DEFAULT_TRANSLATION).toBe("webu");
    expect(passage("psalm-23")).toEqual(passage("psalm-23", "webu"));
    expect(TRANSLATION_LIST.map((t) => t.id)).toEqual(["webu", "kjv"]);
  });

  it("leaves a poem alone whatever translation is asked for", () => {
    expect(passage("the-swing", "kjv")).toEqual(passage("the-swing"));
  });

  it("still holds the two passages the site's own chrome quotes", () => {
    // The footer's signature (`components/site/SiteFooter.astro`) and the
    // verse under "Where it fits in a day" (`pages/index.astro`) both read
    // through this door, and both render nothing when it answers `undefined`
    // — by design, because a chrome element is not worth a failed build.
    // Which means renaming either id would quietly drop a reference from
    // every page on the site, and a verse from the home page, with the types,
    // the build and the rest of this suite all green. This is what fails
    // instead, and it names the two surfaces so the reason arrives with it.
    expect(passage("the-day-of-small-things")?.title).toBe("Zechariah 4:10");

    const band = passage("the-plans-of-the-diligent");
    expect(band?.title).toBe("Proverbs 21:5");
    // The home page prints this under the verse. A passage that arrived
    // without it would be quoted on the front door saying nothing about where
    // the words came from, which is the one condition §12 accepts.
    expect(band?.credit).toBe(SCRIPTURE_CREDIT);
  });

  it("groups by collection, and every collection has something in it", () => {
    for (const collection of PASSAGE_COLLECTIONS) {
      expect(passagesIn(collection.id).length, collection.id).toBeGreaterThan(
        0,
      );
    }
    expect(passagesIn("no-such-collection")).toEqual([]);
  });

  it("summarises without the words, but with how many there are", () => {
    const summary = listPassageSummaries().find((s) => s.id === "psalm-23");
    const full = passage("psalm-23");
    expect(summary).not.toHaveProperty("lines");
    expect(summary?.characters).toBe(
      full!.lines.reduce((n, line) => n + line.length, 0),
    );
  });
});
