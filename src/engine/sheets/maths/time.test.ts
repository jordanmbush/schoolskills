import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { DIAL, MINUTES_A_TURN } from "../clockface";
import { PROBLEM_GAP } from "../layout";
import type {
  ClockFace,
  MarginSize,
  Paper,
  PaperSize,
  Problem,
  TimeConfig,
} from "../types";

import { TIME_SHEET, timeLayout, TIME_STEPS } from "./time";

/**
 * Telling the time, held to the bar the maths families set.
 *
 * **Nothing here checks the generator against the generator.** The family works
 * forwards — one number of minutes past twelve, turned into a face and into the
 * words on the page. Every check below works backwards from what is *printed*:
 * a time is read off the page as a pair of digits, put back into minutes by
 * repeated addition, and an elapsed answer is verified by **counting the minutes
 * one at a time** from the start to the finish. There is no subtraction anywhere
 * in this file, which is the point — clock arithmetic is where a base-ten
 * subtraction quietly gives the wrong answer, and a test that did one would
 * agree with a family that had done the same one.
 *
 * The shape of a printed time is held as tightly as its value: `3:2` is not
 * twenty past three and it is exactly what a family formatting with `toString`
 * would print.
 */

/* ── Configs ───────────────────────────────────────────────────────────── */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const config = (over: Partial<TimeConfig> = {}): TimeConfig => ({
  kind: "time",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  style: "read",
  step: 5,
  count: 12,
  columns: 3,
  ...over,
});

/**
 * Every shape the family can print, which is every acceptance criterion of the
 * story: a dial read, a dial drawn, and the time between two of them — at each
 * of the five steps a clock is taught in.
 */
const EVERY_SHAPE: Array<Partial<TimeConfig>> = [
  {},
  { step: 60 },
  { step: 30 },
  { step: 15 },
  { step: 1 },
  { style: "draw" },
  { style: "draw", step: 30 },
  { style: "draw", step: 1 },
  { style: "elapsed" },
  { style: "elapsed", step: 15 },
  { style: "elapsed", step: 60, span: { min: 60, max: 300 } },
  { style: "elapsed", step: 1, span: { min: 5, max: 45 } },
  { style: "elapsed", span: { min: 90, max: 600 } },
  { workspace: true, count: 6 },
  { style: "elapsed", workspace: true, count: 8 },
];

const SEEDS = [0, 1, 2, 7, 4242];

/** The one block a time sheet has, narrowed for the reader. */
function problemsOf(over: Partial<TimeConfig>, seed: number): Problem[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

/* ── Reading a sheet the way a child does ────────────────────────────────── */

/** `a` added to itself `b` times — the only multiplication in this file. */
function repeated(a: number, b: number): number {
  let total = 0;
  for (let step = 0; step < b; step += 1) total += a;
  return total;
}

/**
 * A printed time, as minutes past twelve.
 *
 * The digits are taken off the page and counted, rather than the face being
 * asked what it holds: a dial that says half past two under a heading that says
 * `2:03` passes every test that only ever looks at one of them.
 */
function minutesOf(text: string): number {
  const written = /^(\d{1,2}):(\d\d)$/.exec(text.trim());
  if (!written) throw new Error(`not a time: "${text}"`);
  const hour = Number(written[1]);
  const minute = Number(written[2]);
  if (hour < 1 || hour > 12) throw new Error(`not an hour: "${text}"`);
  if (minute > 59) throw new Error(`not a minute: "${text}"`);
  // Twelve o'clock is the top of the dial, not twelve hours round it.
  return repeated(60, hour % 12) + minute;
}

/** A printed length of time, as minutes: "1 h 25 min" is eighty-five. */
function durationOf(text: string): number {
  const written = /^(?:(\d+) h)?(?: )?(?:(\d+) min)?$/.exec(text.trim());
  if (!written || (!written[1] && !written[2]))
    throw new Error(`not a duration: "${text}"`);
  return repeated(60, Number(written[1] ?? 0)) + Number(written[2] ?? 0);
}

/**
 * How long it is from one time to the next, counted a minute at a time.
 *
 * The independent path, and deliberately the slowest one there is: no
 * subtraction, no borrowing across the hour, no modular arithmetic. A clock that
 * never arrives throws rather than looping.
 */
function counted(from: number, to: number): number {
  let at = from;
  let minutes = 0;
  while (at !== to) {
    at = (at + 1) % MINUTES_A_TURN;
    minutes += 1;
    if (minutes > MINUTES_A_TURN) throw new Error("the clock never gets there");
  }
  return minutes;
}

/** The face a problem carries, or a failure — every dial sheet has one. */
function faceOf(problem: Problem): ClockFace {
  if (!problem.clock) throw new Error(`no clock on "${problem.prompt}"`);
  return problem.clock;
}

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the time family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("time")).toBe(TIME_SHEET);
    expect(sheetSpec("time").label).toBe("Telling the time");
  });

  it("names the sheet by how precise it is, which is what makes it hard", () => {
    expect(describeSheet(config({ step: 60 }))).toBe(
      "Telling the time to the hour",
    );
    expect(describeSheet(config({ step: 15 }))).toBe(
      "Telling the time to the quarter hour",
    );
    expect(describeSheet(config({ style: "draw", step: 1 }))).toBe(
      "Drawing the hands to the minute",
    );
    expect(
      describeSheet(config({ style: "elapsed", span: { min: 30, max: 150 } })),
    ).toBe("Elapsed time — up to 2 h 30 min");
  });

  it("reads a step this build has never heard of back safely", () => {
    // `step` arrives from outside this build — a bookmarked URL, a sheet saved
    // before the list changed — so it has to resolve to something rather than
    // divide the dial into sevenths.
    for (const problem of problemsOf({ step: 7 }, 3)) {
      expect(minutesOf(problem.answer) % 5).toBe(0);
    }
    expect(describeSheet(config({ step: 7 }))).toBe(
      "Telling the time to five minutes",
    );
  });

  it("gives the sheet a title and a score box it can be marked against", () => {
    const sheet = buildSheet(config({ count: 8 }), 3);
    const block = sheet.blocks[0];
    expect(sheet.header.title).toBe("Telling the time to five minutes");
    expect(sheet.header.instructions).toBe("Write the time each clock shows.");
    expect(block.kind === "problems" && block.items.length).toBe(
      sheet.header.score?.outOf,
    );
  });
});

/* ── The answer key (§20) ──────────────────────────────────────────────── */

describe("the answer key", () => {
  it("agrees with the face on every dial the family can print", () => {
    for (const shape of [
      {},
      { step: 60 },
      { step: 1 },
      { style: "draw" as const },
    ]) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
        for (const problem of problems) {
          const face = faceOf(problem);
          const at = minutesOf(problem.answer);
          // The written time, read back and counted round the dial, has to land
          // on the hand positions the face was built with — and the hour has to
          // be the hour the dial has a numeral for.
          expect(repeated(60, face.hour % 12) + face.minute, problem.answer) //
            .toBe(at);
          expect(face.hour).toBeGreaterThanOrEqual(1);
          expect(face.hour).toBeLessThanOrEqual(12);
        }
      }
    }
  });

  it("is right on every elapsed sheet, counted a minute at a time", () => {
    for (const shape of EVERY_SHAPE.filter((s) => s.style === "elapsed")) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
        for (const problem of problems) {
          const [from, to] = timesOn(problem);
          expect(durationOf(problem.answer), problem.prompt) //
            .toBe(counted(from, to));
        }
      }
    }
  });

  it("writes every time with both its digits of minutes", () => {
    // `3:2` is not twenty past three, and it is exactly what a family that
    // formatted with `toString` would print.
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          for (const time of [
            ...(shape.style === "elapsed" ? [] : [problem.answer]),
            ...writtenTimes(problem.prompt),
          ]) {
            expect(time, JSON.stringify(shape)).toMatch(/^\d{1,2}:\d\d$/);
          }
        }
      }
    }
  });

  it("puts the hands on for a reading sheet and leaves them off for a drawing one", () => {
    // The whole of the difference between the two sheets, and the reason a
    // drawing problem prints no ruled slot: on that sheet the dial *is* the
    // answer place.
    for (const problem of problemsOf({ style: "read" }, 5)) {
      expect(faceOf(problem).hands).toBe(true);
      expect(problem.prompt).toBe("");
    }
    for (const problem of problemsOf({ style: "draw" }, 5)) {
      expect(faceOf(problem).hands).toBe(false);
      // The time to draw has to be on the page, or there is nothing to draw.
      expect(problem.prompt).toBe(problem.answer);
    }
  });

  it("prints the answers only when the sheet is a key", () => {
    const sheet = buildSheet(config(), 5);
    const key = answerKey(config(), 5);
    expect(sheet.answers).toBe(false);
    expect(key.answers).toBe(true);
    expect(key.footer.note).toBe("Answer key");
  });

  it("is the same sheet keyed, never a second generation", () => {
    for (const shape of EVERY_SHAPE) {
      expect(answerKey(config(shape), 11).blocks).toEqual(
        buildSheet(config(shape), 11).blocks,
      );
    }
  });
});

/** The two times written on an elapsed problem, in the order they are read. */
function timesOn(problem: Problem): [number, number] {
  const written = /^(\S+) to (\S+) =$/.exec(problem.prompt);
  if (!written) throw new Error(`not an elapsed problem: "${problem.prompt}"`);
  return [minutesOf(written[1]), minutesOf(written[2])];
}

/** Every time printed in a prompt, whatever shape the prompt is. */
const writtenTimes = (prompt: string): string[] =>
  prompt.split(/[\s=]+/).filter((word) => word.includes(":"));

/* ── Bounds (§20) ──────────────────────────────────────────────────────── */

describe("what may be on the page", () => {
  it("never lands on a minute the step does not allow", () => {
    for (const step of TIME_STEPS) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf({ step, count: 10 }, seed)) {
          for (const time of writtenTimes(problem.prompt)) {
            expect(minutesOf(time) % step, `${step}: ${time}`).toBe(0);
          }
          if (problem.clock) {
            expect(minutesOf(problem.answer) % step).toBe(0);
          }
        }
      }
    }
  });

  it("keeps an elapsed answer inside the span that was asked for", () => {
    const ASKS = [
      { min: 5, max: 60 },
      { min: 60, max: 300 },
      { min: 1, max: 10 },
    ];
    for (const span of ASKS) {
      const problems = problemsOf(
        { style: "elapsed", step: 1, span, count: 12 },
        9,
      );
      expect(problems.length, JSON.stringify(span)).toBeGreaterThan(0);
      for (const problem of problems) {
        const lasted = durationOf(problem.answer);
        expect(lasted, problem.prompt).toBeGreaterThanOrEqual(span.min);
        expect(lasted, problem.prompt).toBeLessThanOrEqual(span.max);
      }
    }
  });

  it("never runs an elapsed problem past twelve", () => {
    // A sheet with no am or pm on it that ran from 11:30 to 1:30 would have two
    // right answers and no way for a child to know which was meant.
    for (const shape of EVERY_SHAPE.filter((s) => s.style === "elapsed")) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          const [from, to] = timesOn(problem);
          expect(to, problem.prompt).toBeGreaterThan(from);
        }
      }
    }
  });

  it("asks the same question twice on no sheet at all", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        const asked = problems.map(
          (problem) => `${problem.prompt}|${problem.answer}`,
        );
        expect(new Set(asked).size, JSON.stringify(shape)).toBe(
          problems.length,
        );
      }
    }
  });

  it("prints what the pool holds rather than repeating itself", () => {
    // On the hour there are twelve times on a dial, and twelve is the honest
    // answer to a request for thirty.
    expect(problemsOf({ step: 60, count: 30 }, 1).length).toBe(12);
  });
});

/* ── Determinism, and the three features it buys (§7) ──────────────────── */

describe("(config, seed)", () => {
  it("builds the same sheet twice", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const once = buildSheet(config(shape), seed);
        const twice = buildSheet(config(shape), seed);
        expect(once).not.toBe(twice);
        expect(once).toEqual(twice);
      }
    }
  });

  it("draws the same times whether they are read or drawn", () => {
    // The two sheets are one question asked from either end, so a parent who
    // prints both for the same seed gets the same twelve times — and a child who
    // has drawn them can check them against the reading sheet.
    const times = (style: "read" | "draw") =>
      problemsOf({ style, count: 9 }, 5).map((problem) => problem.answer);
    expect(times("draw")).toEqual(times("read"));
  });

  it("draws the same problems for a seed as it did the day it shipped", () => {
    // The promise the footer makes: the seed is printed on the paper so a
    // parent can have the same sheet again next week, across a deploy.
    expect(problemsOf({ count: 4 }, 4242).map((p) => p.answer)) //
      .toEqual(GOLDEN.read);
    expect(
      problemsOf({ style: "elapsed", count: 4 }, 7).map((p) => [
        p.prompt,
        p.answer,
      ]),
    ).toEqual(GOLDEN.elapsed);
  });

  it("makes variants A, B and C genuinely different sets of problems", () => {
    // Every shape except the one set to the hour: there are twelve times on a
    // dial, so two variants of six must share some of them. What a variant
    // promises there is a different sheet, not a disjoint one.
    for (const shape of EVERY_SHAPE.filter((one) => one.step !== 60)) {
      const [a, b, c] = [0, 1, 2].map((offset) =>
        problemsOf({ ...shape, count: 6 }, 100 + offset).map(
          (problem) => `${problem.prompt}|${problem.answer}`,
        ),
      );
      for (const [one, other] of [
        [a, b],
        [a, c],
        [b, c],
      ]) {
        expect(one).not.toEqual(other);
        const shared = one.filter((asked) => other.includes(asked)).length;
        expect(shared, JSON.stringify(shape)).toBeLessThan(
          (one.length * 2) / 3,
        );
      }
    }
  });
});

/* ── Capacity (§20) ────────────────────────────────────────────────────── */

describe("how much fits", () => {
  const SIZES: PaperSize[] = ["letter", "a4", "legal"];
  const MARGINS: MarginSize[] = ["none", "narrow", "normal", "wide"];

  it("never prints more problems than the paper holds", () => {
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        for (const fontPt of [12, 18]) {
          for (const shape of EVERY_SHAPE) {
            const over = { ...shape, paper: paper({ size, margin }), fontPt };
            const problems = problemsOf({ ...over, count: 200 }, 8);
            const { box, columns, row } = timeLayout(config(over));
            const rows = Math.ceil(problems.length / columns);
            const used = rows * row + Math.max(0, rows - 1) * PROBLEM_GAP.y;
            expect(used, `${size}/${margin}/${fontPt}pt`).toBeLessThanOrEqual(
              box.height,
            );
          }
        }
      }
    }
  });

  it("reserves a whole dial for every row that carries one", () => {
    // The drawing does not scale with the body type (§17), so the row has to be
    // at least as tall as the dial whatever the type is set at — a face taller
    // than the reservation is the bottom row of the page on a second sheet.
    for (const fontPt of [10, 12, 14, 18]) {
      expect(timeLayout(config({ fontPt })).row).toBeGreaterThan(DIAL);
      expect(timeLayout(config({ fontPt, style: "draw" })).row) //
        .toBeGreaterThan(DIAL);
    }
  });

  it("honours the count and the columns it was given", () => {
    expect(problemsOf({ style: "elapsed", count: 10 }, 1).length).toBe(10);
    expect(problemsOf({ count: 0 }, 1).length).toBe(0);
    for (const columns of [1, 2, 3]) {
      const block = buildSheet(config({ columns }), 1).blocks[0];
      expect(block.kind === "problems" && block.columns).toBe(columns);
    }
    const wide = buildSheet(config({ columns: 6 }), 1).blocks[0];
    expect(wide.kind === "problems" && wide.columns).toBe(3);
  });
});

/**
 * What two sheets came out as on the day this shipped.
 *
 * Recorded rather than computed — both are proved right by the assertions
 * above, and what these hold is that they do not silently *change*.
 */
const GOLDEN = {
  read: ["6:30", "3:20", "11:10", "6:05"],
  elapsed: [
    ["12:40 to 12:45 =", "5 min"],
    ["8:20 to 11:20 =", "3 h"],
    ["4:50 to 6:25 =", "1 h 35 min"],
    ["2:50 to 4:15 =", "1 h 25 min"],
  ],
};
