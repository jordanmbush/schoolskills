import { describe, expect, it } from "vitest";

import { mulberry32 } from "@/engine/random";

import {
  WORDS,
  WORD_BY_SPELLING,
  isTricky,
  variesByAccent,
  wordSounds,
  type Word,
} from "./bank";
import {
  EMPTY_INVENTORY,
  MAX_TRICKY,
  allSounds,
  canRead,
  decodable,
  pickWords,
  readInventory,
  taughtSounds,
  type Inventory,
} from "./inventory";
import {
  CORRESPONDENCES,
  CORRESPONDENCES_BY_GRAPHEME,
  CORRESPONDENCE_BY_ID,
  PHONEMES,
  PHONEME_BY_ID,
  defaultSpelling,
  graphemeParts,
  isTeachable,
} from "./sounds";

/**
 * The sound inventory, held to the one bar that matters.
 *
 * **Nothing on the page uses a sound that hasn't been taught.** That is the
 * only promise this family makes to a parent, it is the reason the model exists
 * rather than a word list, and it is the promise every case below is a way of
 * checking. A maths sheet with a wrong answer on it is embarrassing; a phonics
 * sheet with an untaught spelling on it hands a five-year-old a word they have
 * been set up to fail, which is worse.
 *
 * The bank is checked by an independent path in the same spirit the maths
 * families check their answer keys: the spellings are put back together *from
 * the table* and compared with the word as it is printed, so a mis-cut word
 * fails here rather than on somebody's kitchen table.
 */

/**
 * The word rebuilt out of its parts.
 *
 * The independent path: it reads the graphemes from `sounds.ts` rather than the
 * shorthand `bank.ts` was authored in, so a part naming the wrong spelling
 * shows up as a word that no longer spells itself. A split vowel puts its head
 * where the vowel goes and its tail at the end, which is what makes `cake` out
 * of `c` + `a_e` + `k`.
 */
function respell(entry: Word): string {
  let head = "";
  let tail = "";
  for (const part of entry.parts) {
    const grapheme = CORRESPONDENCE_BY_ID.get(part)?.grapheme ?? "?";
    const [before, after] = graphemeParts(grapheme);
    head += before;
    tail += after;
  }
  return head + tail;
}

/** Inventories a parent might really have, at three points in a course. */
const FIRST_SIX: Inventory = {
  sounds: ["s:s", "a:a", "t:t", "p:p", "i:i", "n:n"],
  tricky: [],
};

const ALL = allSounds();

describe("the table of sounds and spellings", () => {
  it("gives every correspondence its own id", () => {
    expect(CORRESPONDENCE_BY_ID.size).toBe(CORRESPONDENCES.length);
  });

  it("only names sounds that exist", () => {
    for (const entry of CORRESPONDENCES) {
      for (const sound of entry.phonemes) {
        expect(
          PHONEME_BY_ID.get(sound),
          `${entry.id} says ${sound}`,
        ).toBeDefined();
      }
    }
  });

  it("can spell every sound it lists", () => {
    // A phoneme nothing spells is a sound card with no word behind it, and a
    // tick list with a box that can never do anything.
    const spelled = new Set(CORRESPONDENCES.flatMap((entry) => entry.phonemes));
    for (const phoneme of PHONEMES) {
      expect(spelled.has(phoneme.id), `nothing spells /${phoneme.id}/`).toBe(
        true,
      );
    }
  });

  it("says which accents it is describing where they differ", () => {
    // The divergences the header names, spelled out as a test so that a later
    // edit quietly resolving one in favour of a single accent fails here. All
    // eight, including the r-coloured ones the header's rhoticity paragraph
    // covers as a set rather than one at a time.
    const varying = ["o", "aw", "ah", "ar", "or", "er", "air", "eer"];
    for (const id of varying) {
      expect(PHONEME_BY_ID.get(id)?.varies).toBeTruthy();
    }
    // And no others, so that `Phoneme.varies`' own doc comment cannot drift
    // away from the count it exists to make visible.
    expect(PHONEMES.filter((p) => p.varies).map((p) => p.id)).toEqual(varying);
    // And the consonants, which the two varieties agree about completely.
    for (const phoneme of PHONEMES.filter((p) => p.kind === "consonant")) {
      expect(phoneme.varies).toBeUndefined();
    }
  });

  it("keeps a grapheme's commonest sound first", () => {
    // The shorthand in `bank.ts` reads a bare grapheme as this, so the order is
    // data rather than presentation: `c` has to be the `c` of `cat`.
    expect(defaultSpelling("c")?.id).toBe("c:k");
    expect(defaultSpelling("ea")?.id).toBe("ea:ee");
    expect(defaultSpelling("th")?.id).toBe("th:th");
    expect(defaultSpelling("qu")?.id).toBe("qu:k-w");
    expect(defaultSpelling("nothing")).toBeUndefined();
  });

  it("never lets a one-off stand in for its letters", () => {
    // `ui` says /oo/ in `fruit` and /i/ in `build`, and only one of those is a
    // rule. Listing the exception first would make the shorthand `ui` mean
    // `build` — a whole grapheme standing for the one word that breaks it.
    for (const [grapheme, rows] of CORRESPONDENCES_BY_GRAPHEME) {
      if (!rows.some(isTeachable)) continue;
      expect(isTeachable(rows[0]), grapheme).toBe(true);
    }
  });

  it("holds the same letters saying different things", () => {
    // The many-to-many the model exists for. Three sounds for `ear` and two for
    // `th`: flatten either and a child gets a word they can't read.
    const ear = CORRESPONDENCES.filter((entry) => entry.grapheme === "ear");
    expect(ear.map((entry) => entry.phonemes.join())).toEqual([
      "eer",
      "er",
      "air",
    ]);
    expect(
      CORRESPONDENCES.filter((entry) => entry.grapheme === "th"),
    ).toHaveLength(2);
  });
});

describe("the word bank", () => {
  it("names a spelling this build has", () => {
    // A typo in the shorthand resolves to itself, which would silently retire
    // the word rather than print it wrong. It still has to fail.
    for (const entry of WORDS) {
      for (const part of entry.parts) {
        expect(
          CORRESPONDENCE_BY_ID.get(part),
          `${entry.word}: ${part}`,
        ).toBeDefined();
      }
    }
  });

  it("puts every word back together out of its parts", () => {
    for (const entry of WORDS) {
      expect(respell(entry), entry.word).toBe(entry.word);
    }
  });

  it("holds each word once, in letters a child can read", () => {
    expect(WORD_BY_SPELLING.size).toBe(WORDS.length);
    for (const entry of WORDS) {
      expect(entry.word).toMatch(/^[a-z]+$/);
      expect(entry.parts.length).toBeGreaterThan(0);
      // One split vowel at most: two would both claim the final `e`, and
      // `respell` would put the tails in an order nobody meant.
      const splits = entry.parts.filter((part) =>
        CORRESPONDENCE_BY_ID.get(part)?.grapheme.includes("_"),
      );
      expect(splits.length, entry.word).toBeLessThanOrEqual(1);
    }
  });

  it("says what a word sounds like, in order", () => {
    expect(wordSounds(WORD_BY_SPELLING.get("cat")!)).toEqual(["k", "a", "t"]);
    // One letter, two sounds — and `think` has a sound its letters don't show.
    expect(wordSounds(WORD_BY_SPELLING.get("box")!)).toEqual([
      "b",
      "o",
      "k",
      "s",
    ]);
    expect(wordSounds(WORD_BY_SPELLING.get("think")!)).toEqual([
      "th",
      "i",
      "ng",
      "k",
    ]);
    // A silent letter says nothing, and takes up no room in the blend.
    expect(wordSounds(WORD_BY_SPELLING.get("have")!)).toEqual(["h", "a", "v"]);
    // The same letters, two sounds, and nothing in the spelling to say which.
    // `respell` cannot see the difference — both cuts put `ow` back — so the
    // only thing standing between `cow` and a blending line that reads it as
    // `co` is a case that names the sounds.
    expect(wordSounds(WORD_BY_SPELLING.get("cow")!)).toEqual(["k", "ow"]);
    expect(wordSounds(WORD_BY_SPELLING.get("snow")!)).toEqual(["s", "n", "oa"]);
    expect(wordSounds(WORD_BY_SPELLING.get("who")!)).toEqual(["h", "oo"]);
    expect(wordSounds(WORD_BY_SPELLING.get("when")!)).toEqual(["w", "e", "n"]);
  });

  it("has a word behind every spelling a parent can tick", () => {
    // A tickable correspondence with no word in the bank is a box that can be
    // ticked and can never produce anything: `pickWords({ focus })` on it comes
    // back empty, and a wall chart prints a sound the child will never meet.
    //
    // It is also the cheapest guard there is against the shorthand resolving to
    // the wrong row — `cow` was cut as the `ow` of `snow` for exactly as long
    // as nothing checked that `ow:ow` was used by anything.
    const used = new Set(WORDS.flatMap((entry) => entry.parts));
    for (const entry of CORRESPONDENCES.filter(isTeachable)) {
      expect(used.has(entry.id), `nothing in the bank uses ${entry.id}`).toBe(
        true,
      );
    }
  });

  it("marks the words that follow no rule", () => {
    for (const word of ["said", "one", "two", "come", "friend", "again"]) {
      expect(isTricky(WORD_BY_SPELLING.get(word)!), word).toBe(true);
    }
    for (const word of ["cat", "ship", "night", "because", "want"]) {
      expect(isTricky(WORD_BY_SPELLING.get(word)!), word).toBe(false);
    }
  });

  it("knows which words two accents would say differently", () => {
    expect(variesByAccent(WORD_BY_SPELLING.get("dog")!)).toBe(true);
    expect(variesByAccent(WORD_BY_SPELLING.get("car")!)).toBe(true);
    expect(variesByAccent(WORD_BY_SPELLING.get("cat")!)).toBe(false);
    expect(variesByAccent(WORD_BY_SPELLING.get("ship")!)).toBe(false);
  });
});

describe("what a child may be given", () => {
  it("prints nothing at all before anything is taught", () => {
    expect(decodable(EMPTY_INVENTORY)).toEqual([]);
    expect(pickWords(EMPTY_INVENTORY, { count: 20 }, 1)).toEqual([]);
  });

  it("reads the letters taught and not the ones beside them", () => {
    // The premise of the whole model, as one case: `c`, `a`, `t` and `h` are
    // four sounds a child has, and `chat` is not a word they can read.
    const four: Inventory = {
      sounds: ["c:k", "a:a", "t:t", "h:h"],
      tricky: [],
    };
    expect(canRead(WORD_BY_SPELLING.get("cat")!, four)).toBe(true);
    expect(canRead(WORD_BY_SPELLING.get("hat")!, four)).toBe(true);
    expect(canRead(WORD_BY_SPELLING.get("chat")!, four)).toBe(false);
  });

  it("uses no spelling outside the inventory", () => {
    // The acceptance criterion, over the three inventories a parent is likeliest
    // to have and fifty they might.
    const rand = mulberry32(20260816);
    const teachable = CORRESPONDENCES.filter(isTeachable).map(
      (entry) => entry.id,
    );
    const inventories: Inventory[] = [FIRST_SIX, ALL, EMPTY_INVENTORY];
    for (let i = 0; i < 50; i++) {
      inventories.push({
        sounds: teachable.filter(() => rand() < 0.35),
        tricky: [],
      });
    }

    for (const [index, inventory] of inventories.entries()) {
      const taught = new Set(inventory.sounds);
      const sight = new Set(inventory.tricky);
      const words = [
        ...decodable(inventory),
        ...pickWords(inventory, { count: 40, tricky: true }, index),
      ];
      for (const entry of words) {
        const untaught = entry.parts.filter((part) => !taught.has(part));
        if (untaught.length === 0) continue;
        // The only other way onto a page: the parent said this whole word is
        // one their child knows by sight. Nothing else may put an untaught
        // spelling in front of a child, and `[...]` names the culprit when
        // something does.
        expect(
          sight.has(entry.word),
          `${entry.word} needs ${untaught.join(", ")}, which was not taught`,
        ).toBe(true);
      }
    }
  });

  it("never lets a rule reach a word that follows none", () => {
    // Ticking every teachable spelling in the table still cannot produce
    // `said` — the only door it has is the parent's own sight list.
    const everything: Inventory = { sounds: ALL.sounds, tricky: [] };
    const said = WORD_BY_SPELLING.get("said")!;
    expect(canRead(said, everything)).toBe(false);
    expect(decodable(everything)).not.toContain(said);
    expect(canRead(said, { sounds: [], tricky: ["said"] })).toBe(true);
  });

  it("keeps sight words off a decodable sheet unless they're asked for", () => {
    const taught: Inventory = { ...ALL, tricky: ["said", "come"] };
    const plain = pickWords(taught, { count: 200 }, 3);
    expect(plain.some(isTricky)).toBe(false);
    const dictation = pickWords(taught, { count: 1000, tricky: true }, 3);
    expect(dictation.map((entry) => entry.word)).toContain("said");
  });

  it("draws the same page from the same seed, and a different one from the next", () => {
    const once = pickWords(ALL, { count: 12 }, 7).map((entry) => entry.word);
    expect(pickWords(ALL, { count: 12 }, 7).map((entry) => entry.word)).toEqual(
      once,
    );
    expect(
      pickWords(ALL, { count: 12 }, 8).map((entry) => entry.word),
    ).not.toEqual(once);
    // And no word twice on one page.
    expect(new Set(once).size).toBe(once.length);
  });

  it("gives back what it can when it can't fill the page", () => {
    const words = pickWords(FIRST_SIX, { count: 500 }, 1);
    expect(words.length).toBeGreaterThan(3);
    expect(words.length).toBe(decodable(FIRST_SIX).length);
    for (const entry of words) expect(entry.word).toMatch(/^[satpin]+$/);
  });

  it("narrows to the sound the sheet is about", () => {
    const sh = pickWords(ALL, { count: 30, focus: "sh:sh" }, 2);
    expect(sh.length).toBeGreaterThan(5);
    for (const entry of sh) expect(entry.parts).toContain("sh:sh");
    // A sound the child hasn't met is an empty sheet, not a silent fallback to
    // whatever else was lying around.
    expect(pickWords(FIRST_SIX, { count: 30, focus: "sh:sh" }, 2)).toEqual([]);
  });

  it("keeps the first sheets short, and the listening sheets neutral", () => {
    for (const entry of pickWords(ALL, { count: 60, maxSounds: 3 }, 4)) {
      expect(wordSounds(entry).length, entry.word).toBeLessThanOrEqual(3);
    }
    for (const entry of pickWords(
      ALL,
      { count: 60, sameEverywhere: true },
      5,
    )) {
      expect(variesByAccent(entry), entry.word).toBe(false);
    }
  });
});

describe("an inventory read back from somewhere else", () => {
  it("keeps what this build still teaches and drops the rest", () => {
    const read = readInventory({
      sounds: ["s:s", "a:a", "s:s", "ai:e", "zz:top", 7],
      tricky: ["  Said ", "said", "one", 12],
    });
    // Deduplicated, and `ai:e` is gone: it is recorded in the table so `said`
    // can be described honestly, never so it can be ticked.
    expect(read.sounds).toEqual(["s:s", "a:a"]);
    expect(read.tricky).toEqual(["said", "one"]);
  });

  it("answers an empty inventory for anything that isn't one", () => {
    for (const value of [undefined, null, 42, "sounds", { sounds: "a:a" }]) {
      expect(readInventory(value)).toEqual(EMPTY_INVENTORY);
    }
  });

  it("won't take more sight words than a parent could type", () => {
    const many = Array.from({ length: MAX_TRICKY + 50 }, (_, i) => `word${i}`);
    expect(readInventory({ tricky: many }).tricky).toHaveLength(MAX_TRICKY);
  });

  it("lists what has been taught in the order the chart prints it", () => {
    const chart = taughtSounds({ sounds: ["t:t", "s:s", "a:a"], tricky: [] });
    expect(chart.map((entry) => entry.id)).toEqual(["s:s", "t:t", "a:a"]);
    expect(chart[0].example).toBe("sun");
  });
});
