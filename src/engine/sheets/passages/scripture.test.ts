/**
 * The trademark condition, as a failing build.
 *
 * eBible.org places one condition on the World English Bible: a *modified* text
 * may not carry the name. A promise in a comment decays — somebody runs a smart
 * quote sweep, an editor autocorrects "LORD", a well-meant patch re-wraps a
 * long verse — and none of that shows up in review, because a verse looks like
 * a verse. So the promise is a snapshot instead.
 *
 * `release/engwebu.vpl.txt` holds the lines of the eBible verse-per-line
 * release that this library quotes, saved exactly as they were downloaded and
 * never hand-edited. Every verse in scripture.ts is compared against it
 * character for character. Two files would have to be edited identically, in
 * the same commit, for a change to the text to get past this — which is the
 * point at which it stops being an accident.
 *
 * The KJV extract is checked the same way, minus the two marks kjv.ts says it
 * removes and nothing else, so that claim is checked rather than asserted.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { KJV_CREDIT, KJV_VERSES } from "./kjv";
import {
  SCRIPTURE,
  SCRIPTURE_COLLECTIONS,
  SCRIPTURE_CREDIT,
} from "./scripture";

const HERE = fileURLToPath(new URL(".", import.meta.url));

/** `BOOK C:V text` per line — eBible's own format, kept as downloaded. */
function release(name: string): Map<string, string> {
  const lines = readFileSync(`${HERE}release/${name}.vpl.txt`, "utf8").split(
    "\n",
  );
  const verses = new Map<string, string>();
  for (const line of lines) {
    const match = /^(\S+ \d+:\d+) (.*)$/.exec(line);
    if (match) verses.set(match[1], match[2]);
  }
  return verses;
}

const WEBU = release("engwebu");
const KJV = release("eng-kjv2006");

const key = (book: string, chapter: number, verse: number): string =>
  `${book} ${chapter}:${verse}`;

/**
 * The 1769 press's apparatus, which kjv.ts removes: the pilcrow that marks a
 * paragraph, and the brackets around words the translators supplied. The words
 * inside the brackets stay — only the brackets go.
 */
const withoutApparatus = (verse: string): string =>
  verse.replace(/¶\s*/g, "").replace(/[[\]]/g, "").trim();

describe("the WEBu library is verbatim", () => {
  it("matches the release character for character", () => {
    for (const entry of SCRIPTURE) {
      entry.verses.forEach((verse, index) => {
        const ref = key(entry.book, entry.chapter, entry.first + index);
        expect(verse, `${entry.id} · ${ref}`).toBe(WEBU.get(ref));
      });
    }
  });

  it("quotes every verse the release extract holds, and no others", () => {
    const quoted = new Set(
      SCRIPTURE.flatMap((entry) =>
        entry.verses.map((_, index) =>
          key(entry.book, entry.chapter, entry.first + index),
        ),
      ),
    );
    // Both directions. A verse in the library that is not in the extract was
    // never checked against the release; a verse in the extract that nothing
    // quotes is a leftover from an edit, and leftovers are how an extract stops
    // being a record of what was pulled.
    expect([...quoted].filter((ref) => !WEBU.has(ref))).toEqual([]);
    expect([...WEBU.keys()].filter((ref) => !quoted.has(ref))).toEqual([]);
  });

  it("carries no verse numbers, because they are not the text", () => {
    for (const entry of SCRIPTURE) {
      for (const verse of entry.verses) {
        expect(verse, entry.id).not.toMatch(/\d/);
      }
    }
  });

  it("is not re-wrapped, padded or double-spaced", () => {
    for (const entry of SCRIPTURE) {
      for (const verse of entry.verses) {
        expect(verse, entry.id).toBe(verse.trim());
        expect(verse, entry.id).not.toMatch(/[\n\t]| {2}/);
      }
    }
  });

  it("keeps the release's own quotation marks rather than substituting", () => {
    // The release uses curly marks throughout. A straight one anywhere is the
    // fingerprint of a text that has been through an editor that "fixed" it.
    for (const entry of SCRIPTURE) {
      for (const verse of entry.verses) {
        expect(verse, entry.id).not.toMatch(/["']/);
      }
    }
  });
});

describe("the KJV option", () => {
  it("matches the release once its apparatus is removed", () => {
    for (const entry of SCRIPTURE) {
      const verses = KJV_VERSES[entry.id];
      verses.forEach((verse, index) => {
        const ref = key(entry.book, entry.chapter, entry.first + index);
        expect(verse, `${entry.id} · ${ref}`).toBe(
          withoutApparatus(KJV.get(ref) ?? ""),
        );
      });
    }
  });

  it("covers every entry, with the same number of verses", () => {
    const ids = SCRIPTURE.map((entry) => entry.id);
    expect(Object.keys(KJV_VERSES).sort()).toEqual([...ids].sort());
    for (const entry of SCRIPTURE) {
      expect(KJV_VERSES[entry.id], entry.id).toHaveLength(entry.verses.length);
    }
  });

  it("kept the words the brackets held, and dropped only the marks", () => {
    for (const verses of Object.values(KJV_VERSES)) {
      for (const verse of verses) {
        expect(verse).not.toMatch(/[¶[\]]/);
        expect(verse).toBe(verse.trim());
      }
    }
  });
});

describe("the shape of the curated set", () => {
  it("is a few hundred entries, each a contiguous run in one chapter", () => {
    expect(SCRIPTURE.length).toBeGreaterThanOrEqual(200);
    for (const entry of SCRIPTURE) {
      expect(entry.verses.length, entry.id).toBeGreaterThan(0);
      expect(entry.first, entry.id).toBeGreaterThan(0);
      expect(entry.book, entry.id).toMatch(/^[1-4A-Z]{3}$/);
    }
  });

  it("prints a reference that says what was actually quoted", () => {
    // The one error in this file a reader cannot catch by reading: the verses
    // are right and the label above them is not. "Philippians 4:13" over four
    // verses is wrong in the way a child copies down and repeats.
    for (const entry of SCRIPTURE) {
      const last = entry.first + entry.verses.length - 1;
      const range = /(\d+):(\d+)(?:-(\d+))?$/.exec(entry.ref);
      if (range) {
        const [, chapter, from, to] = range;
        expect([+chapter, +from, +(to ?? from)], entry.id).toEqual([
          entry.chapter,
          entry.first,
          last,
        ]);
      } else {
        // No verse in the label means the whole chapter, so it had better be.
        expect(entry.ref, entry.id).toMatch(new RegExp(`\\b${entry.chapter}$`));
        expect(entry.first, entry.id).toBe(1);
      }
    }
  });

  it("has unique ids and a real collection on every entry", () => {
    const ids = SCRIPTURE.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const collections = new Set(SCRIPTURE_COLLECTIONS.map(({ id }) => id));
    for (const entry of SCRIPTURE) {
      expect(collections.has(entry.collection), entry.id).toBe(true);
    }
  });

  it("names every collection, and fills every one it names", () => {
    const used = new Set(SCRIPTURE.map((entry) => entry.collection));
    for (const collection of SCRIPTURE_COLLECTIONS) {
      expect(used.has(collection.id), collection.id).toBe(true);
      expect(collection.kind).toBe("scripture");
    }
  });

  it("ships a curated library, not a Bible", () => {
    // §12's budget, in the units it is written in: tens of kilobytes per
    // translation, not megabytes. The whole WEBu is about five megabytes, so
    // this is roughly one per cent of it. Raising the ceiling is allowed;
    // doing it without noticing is what this is here to prevent.
    const weigh = (verses: readonly string[][]): number =>
      verses.flat().reduce((total, verse) => total + verse.length, 0);
    expect(weigh(SCRIPTURE.map((entry) => [...entry.verses]))).toBeLessThan(
      64 * 1024,
    );
    expect(weigh(Object.values(KJV_VERSES).map((v) => [...v]))).toBeLessThan(
      64 * 1024,
    );
  });
});

describe("the credit line", () => {
  it("is the exact string the design records", () => {
    expect(SCRIPTURE_CREDIT).toBe(
      "Scripture: World English Bible Updated (public domain) · worldenglish.bible",
    );
  });

  it("names the KJV separately, so neither can borrow the other's", () => {
    expect(KJV_CREDIT).toContain("King James Version");
    expect(KJV_CREDIT).not.toContain("World English Bible");
  });
});
