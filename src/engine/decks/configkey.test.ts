import { describe, expect, it } from "vitest";

import { TYPING_LEVELS } from "./typing";
import { configKey } from "./index";
import type { LegacyFlashConfig, RaceConfig } from "@/engine/types";

/**
 * The keys already in IndexedDB, frozen.
 *
 * `configKey` decides which runs may race each other as ghosts (CLAUDE.md), and
 * a child's record book is the only copy there is — there is no server holding
 * a second one and no deploy that can go back and rewrite it. So a change to
 * the format doesn't fail loudly: every personal best saved under the old key
 * is simply never found again, and a seven-year-old is told they have no best
 * time on a level they have run twenty times.
 *
 * Every literal below is a key some child's run is filed under today. They are
 * transcribed, not generated — a table built by calling the same function it
 * checks would agree with any format at all. **If one of these fails, the
 * change is wrong; the expectation is not.**
 *
 * The families each get their optional segments covered, because those are
 * where a key grows: the clock and the explicit word set are appended only
 * when they are in play, which is what keeps a run saved before either existed
 * filed where it has always been.
 */

/** A config as it sits in storage, with the key it has always produced. */
type Frozen = [name: string, config: RaceConfig, key: string];

/**
 * Arithmetic, which predates the union and so carries no `kind` (§decks/index).
 *
 * The second is older still: a config written before `others` replaced the
 * min/max range, which `readConfig` widens on the way past. It is a shape
 * TypeScript no longer describes — that is the point of pinning it — so it is
 * cast in rather than declared.
 */
const legacyRange: LegacyFlashConfig = {
  operation: "add",
  tables: [3],
  otherMin: 1,
  otherMax: 5,
  cardCount: 10,
  inputMode: "choose",
};

const FROZEN: Frozen[] = [
  [
    "arithmetic, no kind",
    {
      operation: "multiply",
      tables: [7],
      others: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      cardCount: 20,
      inputMode: "type",
    },
    "multiply|7|1.2.3.4.5.6.7.8.9.10.11.12|20|type",
  ],
  [
    "arithmetic, timed",
    {
      operation: "subtract",
      tables: [4, 2],
      others: [3, 1],
      cardCount: 12,
      inputMode: "type",
      timeLimitMs: 8000,
    },
    "subtract|2.4|1.3|12|type|t8000",
  ],
  [
    "arithmetic, a drill of the facts a player keeps missing",
    {
      operation: "multiply",
      tables: [7],
      others: [1, 2, 3],
      cardCount: 6,
      inputMode: "type",
      facts: [
        [7, 8],
        [6, 9],
      ],
    },
    "multiply|7|1.2.3|6|type|f6:9,7:8",
  ],
  [
    "arithmetic, written before `others` existed",
    legacyRange as unknown as RaceConfig,
    "add|3|1.2.3.4.5|10|choose",
  ],
  [
    "words, a shipped list",
    { kind: "words", listId: "dolch-1", cardCount: 12, inputMode: "choose" },
    "words|dolch-1|12|choose",
  ],
  [
    "words, timed",
    {
      kind: "words",
      listId: "dolch-2",
      cardCount: 20,
      inputMode: "type",
      timeLimitMs: 6000,
    },
    "words|dolch-2|20|type|t6000",
  ],
  [
    "words, a list a parent typed in",
    {
      kind: "words",
      listId: "custom-abc",
      cardCount: 8,
      inputMode: "type",
      words: ["Because", "thought", "friend"],
    },
    "words|custom-abc|8|type|wbecause,friend,thought",
  ],
  // Every level this build ships, at the setup screen's default length. The
  // ladder's lesson ids (`L07`) are a second namespace inside the same prefix,
  // and nothing here can collide with one — no shipped level id starts with an
  // L and a digit — which is what lets a lesson key without touching these.
  [
    "typing, home row",
    { kind: "typing", levelId: "home-row", wordCount: 30 },
    "typing|home-row|30",
  ],
  [
    "typing, top row",
    { kind: "typing", levelId: "top-row", wordCount: 30 },
    "typing|top-row|30",
  ],
  [
    "typing, every letter",
    { kind: "typing", levelId: "common", wordCount: 30 },
    "typing|common|30",
  ],
  [
    "typing, sentences",
    { kind: "typing", levelId: "sentences", wordCount: 30 },
    "typing|sentences|30",
  ],
  [
    "typing, verses",
    { kind: "typing", levelId: "scripture", wordCount: 80 },
    "typing|scripture|80",
  ],
  [
    "typing, a drill of the words a player keeps fumbling",
    {
      kind: "typing",
      levelId: "home-row",
      words: ["ask", "add"],
      wordCount: 10,
    },
    "typing|home-row|10|wadd,ask",
  ],
  // The ladder's two run shapes. Both key on the LESSON and on the length the
  // rung declares — never on the words a passage came out with, and never on
  // how much of a wave was survived (§5.4, §8.7). The lesson below carries
  // both of the fields that have to stay inert: the passage it generated, and
  // the board the child chose to type it under.
  [
    "typing, a lesson from the ladder",
    {
      kind: "typing",
      levelId: "L07",
      lessonId: "L07",
      words: ["fff", "jjj", "fjfj"],
      keyboard: "off",
      wordCount: 25,
    },
    "typing|L07|25",
  ],
  [
    "typing, a Hailstorm wave",
    { kind: "typing", levelId: "L39", lessonId: "L39", wordCount: 12 },
    "typing|L39|12",
  ],
];

describe("the keys already saved", () => {
  for (const [name, config, key] of FROZEN) {
    it(`is unchanged for ${name}`, () => {
      expect(configKey(config)).toBe(key);
    });
  }

  it("pins every typing level this build ships", () => {
    // So that a level added later arrives with its own line above rather than
    // quietly untested — the table is only a promise if it is complete.
    const pinned = new Set(FROZEN.map(([, , key]) => key.split("|")[1]));
    for (const level of TYPING_LEVELS) expect(pinned.has(level.id)).toBe(true);
  });
});
