import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet } from "../index";
import { printedBlockBox } from "../chrome";
import { describeSheetFamily } from "../contract";
import { grouped } from "../counters";
import { BLOCK_GAP, answerLine } from "../layout";
import { jumps, ticks } from "../numberline";
import type {
  Block,
  Counters,
  DivisionHelp,
  GridSpec,
  LessonConfig,
  LessonTopic,
  Paper,
  Problem,
} from "../types";

import { blockHeight, bracket, type LessonBlock } from "./blocks";
import { DECIMAL_TRY_ITS } from "./decimals";
import { TRY_ITS } from "./division";
import {
  LESSON_SHEET,
  LESSON_TOPICS,
  lessonBlocks,
  lessonLayout,
  topicOf,
} from "./lesson";
import { WRITTEN_TRY_ITS } from "./written";

/**
 * Lessons, held to the bar every other family meets — and to the two that
 * only bite here.
 *
 * **The words and the picture agree.** A lesson's picture is the question and
 * its sentence is the answer, printed side by side, and a picture of twelve
 * in three rings under a sentence that says four rings is a page that teaches
 * something false. So every caption and every worked fact on every lesson is
 * parsed back to its numbers here and held to the counters it stands beside;
 * a worked bracket is walked row by row against the divisor; the place-value
 * chart is read back column by column.
 *
 * **Every try-it answer is checked by a path the family does not use.** The
 * family writes `dividend / divisor`, or shifts a `Fixed`; this file adds the
 * divisor to itself `answer` times and expects to arrive at the dividend,
 * and slides a decimal's digits along a string, which is what division and
 * a power of ten mean before either is a key on a calculator.
 *
 * The rest is the reservation: a lesson is the one family whose prose is long
 * enough for a wrong line count to put the problems on a second sheet, so the
 * two lessons written to fit one page are held to fitting it, and the seven
 * whose problems go over are held to going over whole.
 */

const paper: Paper = {
  size: "letter",
  orientation: "portrait",
  margin: "normal",
};

const config = (over: Partial<LessonConfig> = {}): LessonConfig => ({
  kind: "lesson",
  paper,
  fontPt: 14,
  fields: ["name", "date"],
  topic: "division-sharing",
  practice: true,
  ...over,
});

/** Every topic, with and without the problems to try. */
const EVERY_SHEET: LessonConfig[] = LESSON_TOPICS.flatMap((topic) => [
  config({ topic }),
  config({ topic, practice: false }),
]);

describeSheetFamily("lesson", {
  label: "Lessons: a method, explained",
  spec: LESSON_SHEET,
  config,
  shapes: EVERY_SHEET,
});

/* ── Reading a sheet back ──────────────────────────────────────────────── */

const problemsOf = (blocks: Block[]): Problem[] =>
  blocks.flatMap((block) => (block.kind === "problems" ? block.items : []));

const countersOf = (blocks: Block[]): Counters[] =>
  blocks.flatMap((block) =>
    block.kind === "counters" ? [block.counters] : [],
  );

const gridsOf = (blocks: Block[]): GridSpec[] =>
  blocks.flatMap((block) => (block.kind === "grid" ? [block.grid] : []));

/** The problems a child answers on a built sheet, in the order dealt. */
const tryIts = (topic: LessonTopic, seed: number): Problem[] =>
  problemsOf(buildSheet(config({ topic }), seed).blocks).filter(
    (problem) => !problem.worked,
  );

/** What a problem is called: its prompt, or the division in its bracket. */
const nameOf = (problem: Problem): string =>
  problem.prompt !== ""
    ? problem.prompt
    : `${problem.bracket?.dividend} ÷ ${problem.bracket?.divisor}`;

/** Every whole number in a string, in order. */
const numbersIn = (text: string): number[] =>
  (text.match(/\d+/g) ?? []).map(Number);

/** Every number in a string, point and all, as written. */
const decimalsIn = (text: string): string[] =>
  text.match(/\d+(?:\.\d+)?/g) ?? [];

/** "6.39" as 639 hundredths — read here, never through `exact.ts`. */
function unitsOf(text: string): { units: number; places: number } {
  const [whole, part = ""] = text.split(".");
  return { units: Number(whole + part), places: part.length };
}

/** `divisor` added to itself `times` times — division's definition, undone. */
const added = (divisor: number, times: number): number => {
  let sum = 0;
  for (let at = 0; at < times; at += 1) sum += divisor;
  return sum;
};

/**
 * The digits of `text` slid `by` places left (right when negative), done on
 * the string: the point stays where it is and the digits move past it, with
 * noughts written into any place left empty. The check the family's
 * `shifted` is held to.
 */
function slid(text: string, by: number): string {
  const [whole, part = ""] = text.split(".");
  let digits = whole + part;
  let point = whole.length + by;
  if (point > digits.length) digits = digits.padEnd(point, "0");
  if (point < 1) {
    digits = "0".repeat(1 - point) + digits;
    point = 1;
  }
  const front = digits.slice(0, point).replace(/^0+(?=\d)/, "");
  const back = digits.slice(point);
  return back === "" ? front : `${front}.${back}`;
}

/** `q r r` or `q` as the two numbers. */
function quotientOf(answer: string): { quotient: number; left: number } {
  const [quotient, left = 0] = numbersIn(answer);
  return { quotient, left };
}

/* ── The lesson half ───────────────────────────────────────────────────── */

describe("a lesson", () => {
  it("is one idea, a picture, a worked example and a word for the grown-up", () => {
    for (const topic of LESSON_TOPICS) {
      const { page } = lessonLayout(config({ topic }));
      const blocks = topicOf(topic).lesson(page);
      const notes = blocks.filter((block) => block.kind === "note");
      expect(notes.length, topic).toBeGreaterThanOrEqual(2);
      const worked = problemsOf(blocks);
      expect(worked.length, `${topic}: no worked example`).toBeGreaterThan(0);
      expect(worked.every((problem) => problem.worked)).toBe(true);
      // The picture: counters, a line, a chart — or, on a worked example,
      // a fraction bar or a division in the bracket with every written
      // square shaded.
      expect(
        blocks.some((block) =>
          ["counters", "numberline", "grid"].includes(block.kind),
        ) ||
          worked.some(
            (problem) =>
              problem.art !== undefined || problem.bracket?.help === "guided",
          ),
        `${topic}: no picture`,
      ).toBe(true);
      // The sentence for the grown-up, set small, last.
      const last = blocks[blocks.length - 1];
      expect(last.kind === "note" && last.aside, topic).toBe(true);
      expect(
        last.kind === "note" && last.text[0].startsWith("For the grown-up"),
      ).toBe(true);
    }
  });

  it("says in words what the counters show, and no other numbers", () => {
    // Every caption reads as the counts of its layout — and the leftover,
    // where there is one — and every worked fact's numbers are the picture's
    // total, the two that make it, and the leftover if the picture has one.
    for (const topic of LESSON_TOPICS) {
      const { page } = lessonLayout(config({ topic }));
      const blocks = topicOf(topic).lesson(page);
      const [picture] = countersOf(blocks);
      if (!picture) continue;
      const { groups, left } = grouped(picture);

      const caption = numbersIn(picture.caption ?? "");
      const counts = {
        share: [groups, picture.per],
        group: [picture.per, groups],
        array: [groups, picture.per],
      }[picture.layout];
      expect(caption, `${topic}: "${picture.caption}"`).toEqual(
        left > 0 ? [...counts, left] : counts,
      );

      for (const fact of problemsOf(blocks)) {
        const numbers = [...numbersIn(fact.prompt), ...numbersIn(fact.answer)];
        const [product, ...rest] = [...numbers].sort((a, b) => b - a);
        expect(product, `${topic}: ${fact.prompt} ${fact.answer}`).toBe(
          picture.total,
        );
        if (left === 0) {
          expect(numbers, fact.prompt).toHaveLength(3);
          expect(added(rest[0], rest[1]), fact.prompt).toBe(product);
        } else {
          // `14 ÷ 4 = 3 r 2` and `4 × 3 + 2 = 14` both hold the same four.
          expect(numbers, fact.prompt).toHaveLength(4);
          expect(
            rest.some((over, at) => {
              const [a, b] = rest.filter((_, other) => other !== at);
              return over === left && added(a, b) + over === product;
            }),
            fact.prompt,
          ).toBe(true);
        }
      }
    }
  });

  it("jumps back along the line by the divisor, and lands on nought", () => {
    const { page } = lessonLayout(config({ topic: "division-grouping" }));
    const lines = topicOf("division-grouping")
      .lesson(page)
      .flatMap((block) => (block.kind === "numberline" ? [block.line] : []));
    expect(lines).toHaveLength(1);
    const [line] = lines;
    expect(line.jumps).toEqual({ start: 12, size: 3 });
    expect(line.from).toBe(0);
    expect(line.to).toBe(12);
    // Four hops of three from twelve is nought: the same fact as the rings.
    const [picture] = countersOf(topicOf("division-grouping").lesson(page));
    expect(line.jumps?.start).toBe(picture.total);
    expect(line.jumps && "size" in line.jumps && line.jumps.size).toBe(
      picture.per,
    );
  });

  it("puts the dividend and every landing of a hop on a tick", () => {
    // A line counted in twos to 22 has no 21 on it, and a child sent to jump
    // back in threes from 21 has nowhere to start. Every line a lesson draws
    // hops on, and every blank one a child hops on, ends on the dividend
    // with every landing marked.
    const landings = (line: Block & { kind: "numberline" }): number[] =>
      jumps(line.line).flatMap((hop) => [hop.from, hop.to]);
    for (const topic of ["division-grouping", "division-chunking"] as const) {
      const { page } = lessonLayout(config({ topic }));
      for (const block of topicOf(topic).lesson(page)) {
        if (block.kind !== "numberline") continue;
        const marks = ticks(block.line);
        expect(block.line.to, topic).toBe(block.line.jumps?.start);
        expect(landings(block).length, topic).toBeGreaterThan(0);
        for (const at of landings(block)) expect(marks, topic).toContain(at);
      }
    }
    const onTheLine = TRY_ITS.GROUPS.slice(4);
    expect(onTheLine.length).toBeGreaterThan(0);
    for (const problem of tryIts("division-grouping", 1)) {
      if (!problem.line) continue;
      const [dividend, divisor] = numbersIn(problem.prompt);
      const marks = ticks(problem.line);
      expect(problem.line.to, problem.prompt).toBe(dividend);
      for (let at = dividend; at >= 0; at -= divisor) {
        expect(marks, `${problem.prompt} at ${at}`).toContain(at);
      }
    }
  });

  it("refuses a division that is not one, at build time", () => {
    // The numbers are authored, so a mistyped dividend fails the suite
    // rather than printing an empty tableau over a "0".
    const { page } = lessonLayout(config());
    for (const dividend of ["", "12a", "1.2.3", ".5", "5.", "6 57"]) {
      expect(() => bracket(page, dividend, 3, "grid"), dividend).toThrow();
    }
    for (const divisor of [0, -3, 2.5, NaN]) {
      expect(() => bracket(page, "657", divisor, "grid"), `${divisor}`) //
        .toThrow();
    }
    expect(bracket(page, "657", 3, "grid").answer).toBe("219");
    expect(bracket(page, "8.46", 3, "grid").answer).toBe("2.82");
    expect(bracket(page, "14", 4, "grid").answer).toBe("3 r 2");
  });

  it("chunks the line into the lumps the steps name, and lands on nought", () => {
    const { page } = lessonLayout(config({ topic: "division-chunking" }));
    const blocks = topicOf("division-chunking").lesson(page);
    const [line] = blocks.flatMap((block) =>
      block.kind === "numberline" ? [block.line] : [],
    );
    expect(line.jumps).toEqual({ start: 156, sizes: [120, 36] });
    const hops = jumps(line);
    expect(hops).toHaveLength(2);
    expect(hops[hops.length - 1].to).toBe(0);
    // Every lump is a whole number of twelves, and the lumps add up to 156.
    for (const hop of hops) {
      const size = hop.from - hop.to;
      expect(added(12, size / 12), `${size} is not twelves`).toBe(size);
    }
    expect(hops.reduce((sum, hop) => sum + (hop.from - hop.to), 0)).toBe(156);
    // And the column written down the page names the same two lumps.
    const column = blocks.find(
      (block) => block.kind === "note" && block.heading?.startsWith("Written"),
    );
    expect(column?.kind === "note" && column.text.join(" ")).toContain("120");
    expect(column?.kind === "note" && column.text.join(" ")).toContain("36");
  });

  it("works the bracket the way the steps say", () => {
    for (const topic of ["long-division-steps", "decimal-division"] as const) {
      const { page } = lessonLayout(config({ topic }));
      const blocks = topicOf(topic).lesson(page);
      const [example] = problemsOf(blocks);
      const bracket = example.bracket;
      if (!bracket?.tableau) throw new Error(`${topic}: no worked bracket`);
      expect(example.worked).toBe(true);
      expect(bracket.help).toBe("guided");
      expect(bracket.rows).toBeGreaterThanOrEqual(bracket.tableau.rows.length);

      const divisor = Number(bracket.divisor);
      const digits = bracket.dividend.replace(".", "");
      const { quotient, rows, remainder } = bracket.tableau;
      // Every take-away row is the divisor times the digit written over it.
      for (const row of rows.filter((row) => row.role === "take")) {
        const digit = Number(quotient.text[row.end - quotient.start]);
        expect(Number(row.text), `${topic}: row under ${row.end}`).toBe(
          added(divisor, digit),
        );
      }
      expect(remainder).toBe(0);
      expect(added(divisor, Number(quotient.text))).toBe(Number(digits));
      // The answer over the bar is the one the heading of the steps names.
      const steps = blocks.find(
        (block) => block.kind === "note" && block.items?.length,
      );
      expect(steps?.kind === "note" && steps.heading).toContain(example.answer);
      expect(unitsOf(example.answer).places).toBe(
        unitsOf(bracket.dividend).places,
      );
    }
  });

  it("reads the chart the way the steps say, the digits one column along", () => {
    const { page } = lessonLayout(config({ topic: "decimals-powers-of-ten" }));
    const [chart] = gridsOf(topicOf("decimals-powers-of-ten").lesson(page));
    expect(chart.columns).toBe(8);
    expect(chart.rows).toBe(5);
    const cells = chart.cells ?? [];
    const row = (at: number): string[] =>
      cells.slice(at * chart.columns, (at + 1) * chart.columns);
    expect(row(0)).toEqual(["", "Th", "H", "T", "O", "t", "h", "th"]);
    // The point is the heavy rule after the ones column.
    expect(chart.origin).toEqual({ column: 5, row: 1 });

    /** The number a row holds, read column by column with the point put in. */
    const read = (at: number): string => {
      const [, ...places] = row(at);
      const whole = places.slice(0, 4).join("");
      const part = places.slice(4).join("");
      return part === "" ? whole : `${whole}.${part}`;
    };
    /** Which column each digit of a row stands in. */
    const columnsOf = (at: number): Array<[number, string]> =>
      row(at).flatMap((digit, column) =>
        column > 0 && digit !== "" ? [[column, digit] as [number, string]] : [],
      );

    expect(row(1)[0]).toBe("3.7");
    expect(read(1)).toBe("3.7");
    expect(row(2)[0]).toBe("× 10");
    expect(read(2)).toBe(slid("3.7", 1));
    expect(columnsOf(2)).toEqual(
      columnsOf(1).map(([column, digit]) => [column - 1, digit]),
    );
    expect(row(3)[0]).toBe("48");
    expect(read(3)).toBe("48");
    expect(row(4)[0]).toBe("÷ 1000");
    expect(read(4)).toBe(slid("48", -3));
    // The noughts are written digits, in the ones and tenths columns.
    expect(row(4).slice(4, 6)).toEqual(["0", "0"]);
    expect(DECIMAL_TRY_ITS.CHART.map((line) => line.label)).toEqual(
      [1, 2, 3, 4].map((at) => row(at)[0]),
    );
  });
});

/* ── The problems to try ───────────────────────────────────────────────── */

describe("the problems to try", () => {
  it("are the topic's own, dealt in the seed's order", () => {
    const divide = ([a, b]: readonly [number, number]) => `${a} ÷ ${b} =`;
    const expected: Record<LessonTopic, string[]> = {
      "division-sharing": TRY_ITS.SHARES.map(divide),
      "division-grouping": TRY_ITS.GROUPS.map(divide),
      "division-arrays": [
        ...TRY_ITS.ARRAYS.map(() => "Write the two divisions."),
        "18 ÷ 3 = _  Think: 3 × ? = 18.",
      ],
      "division-remainders": [
        ...WRITTEN_TRY_ITS.REMAINDERS.map(divide),
        WRITTEN_TRY_ITS.TABLES.prompt,
      ],
      "division-chunking": WRITTEN_TRY_ITS.CHUNKS.map(divide),
      "long-division-steps": WRITTEN_TRY_ITS.LONG.map(
        ([a, b]) => `${a} ÷ ${b}`,
      ),
      "decimals-powers-of-ten": DECIMAL_TRY_ITS.POWERS.map(
        ([value, by]) =>
          `${value} ${by > 0 ? "×" : "÷"} ${10 ** Math.abs(by)} =`,
      ),
      "decimal-division": DECIMAL_TRY_ITS.DECIMALS.map(
        ([a, b]) => `${a} ÷ ${b}`,
      ),
      "dividing-by-decimals": DECIMAL_TRY_ITS.BY_DECIMAL.map(
        ([a, b]) => `${a} ÷ ${b}`,
      ),
    };
    for (const topic of LESSON_TOPICS) {
      const names = (seed: number) => tryIts(topic, seed).map(nameOf);
      expect([...names(1)].sort(), topic).toEqual([...expected[topic]].sort());
      // Another seed is the same problems in another order — a lesson's
      // problems are written, not drawn.
      expect([...names(2)].sort()).toEqual([...names(1)].sort());
      expect(names(1), topic).not.toEqual(names(2));
    }
  });

  it("are dealt the same way for a seed as they were the day this shipped", () => {
    // The footer's promise: a seed is the same order next week, across a
    // deploy. Held on the two shapes of deal — one shuffle, and long
    // division's two halves each shuffled on their own — so a refactor that
    // moved where the deal spends `rand()` is a decision rather than a slip.
    expect(tryIts("division-sharing", 1).map(nameOf)).toEqual([
      "20 ÷ 5 =",
      "15 ÷ 3 =",
      "24 ÷ 4 =",
      "12 ÷ 4 =",
      "8 ÷ 2 =",
      "18 ÷ 3 =",
    ]);
    expect(tryIts("long-division-steps", 1).map(nameOf)).toEqual([
      "528 ÷ 4",
      "735 ÷ 5",
      "848 ÷ 4",
      "936 ÷ 4",
      "861 ÷ 7",
      "975 ÷ 3",
    ]);
  });

  it("have answers that add back up to the dividend", () => {
    for (const topic of LESSON_TOPICS) {
      for (const seed of [1, 2, 3]) {
        for (const problem of tryIts(topic, seed)) check(topic, problem);
      }
    }
  });

  /** One try-it, held to what its answer means, by the topic it is on. */
  function check(topic: LessonTopic, problem: Problem): void {
    const name = `${topic}: ${nameOf(problem)}`;
    switch (topic) {
      case "division-arrays": {
        if (!problem.answers) {
          const [dividend, divisor] = numbersIn(problem.prompt);
          expect(added(divisor, Number(problem.answer)), name).toBe(dividend);
          return;
        }
        // An array's two divisions, each a sentence on its own line — and
        // each the picture's own numbers: by its rows, then by its columns.
        expect(problem.answers).toHaveLength(2);
        const picture = problem.counters;
        if (!picture) throw new Error(`${name}: no array`);
        const rows = grouped(picture).groups;
        problem.answers.forEach((sentence, at) => {
          const [dividend, divisor, quotient] = numbersIn(sentence);
          expect(added(divisor, quotient), sentence).toBe(dividend);
          expect(picture.total, sentence).toBe(dividend);
          expect([divisor, quotient], sentence).toEqual(
            at === 0 ? [rows, picture.per] : [picture.per, rows],
          );
        });
        expect(problem.answer).toBe(problem.answers.join(" · "));
        return;
      }
      case "division-remainders":
      case "division-chunking": {
        const [dividend, divisor] = numbersIn(problem.prompt);
        const { quotient, left } = quotientOf(problem.answer);
        if (problem.prompt === WRITTEN_TRY_ITS.TABLES.prompt) {
          // The story: enough tables for everyone, so one more than the
          // full tables when anyone is left standing.
          expect(added(divisor, quotient), name).toBeGreaterThanOrEqual(
            dividend,
          );
          expect(added(divisor, quotient - 1), name).toBeLessThan(dividend);
          return;
        }
        expect(left, name).toBeLessThan(divisor);
        expect(added(divisor, quotient) + left, name).toBe(dividend);
        if (topic === "division-remainders")
          expect(left, name).toBeGreaterThan(0);
        return;
      }
      case "long-division-steps": {
        const bracket = problem.bracket;
        if (!bracket) throw new Error(`${name}: no bracket`);
        expect(problem.answer, name).toMatch(/^\d+$/);
        expect(added(Number(bracket.divisor), Number(problem.answer))).toBe(
          Number(bracket.dividend),
        );
        return;
      }
      case "decimal-division": {
        const bracket = problem.bracket;
        if (!bracket) throw new Error(`${name}: no bracket`);
        const dividend = unitsOf(bracket.dividend);
        const answer = unitsOf(problem.answer);
        expect(problem.answer, name).toMatch(/^\d+\.\d+$/);
        expect(answer.places, name).toBe(dividend.places);
        expect(added(Number(bracket.divisor), answer.units), name).toBe(
          dividend.units,
        );
        return;
      }
      case "dividing-by-decimals": {
        const [a, b] = decimalsIn(problem.prompt).map(unitsOf);
        const lines = problem.answers ?? [];
        expect(lines, name).toHaveLength(2);
        expect(problem.answer).toBe(lines.join(" · "));
        // The first line scales both by the same power of ten, the second
        // is the whole division that leaves.
        const [by, top, bottom] = numbersIn(lines[0]);
        expect(top * 10 ** a.places, name).toBe(a.units * by);
        expect(bottom * 10 ** b.places, name).toBe(b.units * by);
        expect(bottom, name).toBeGreaterThan(0);
        const quotient = Number(lines[1]);
        expect(added(bottom, quotient), name).toBe(top);
        return;
      }
      case "decimals-powers-of-ten": {
        const [value, factor] = decimalsIn(problem.prompt);
        const places = factor.length - 1;
        const by = problem.prompt.includes("×") ? places : -places;
        expect(problem.answer, name).toBe(slid(value, by));
        return;
      }
      default: {
        const [dividend, divisor] = numbersIn(problem.prompt);
        const quotient = Number(problem.answer);
        expect(Number.isInteger(quotient), name).toBe(true);
        expect(added(divisor, quotient), name).toBe(dividend);
      }
    }
  }

  it("draw the picture the question is about", () => {
    // Sharing: as many rings as the divisor, the answer in each. Grouping: the
    // divisor to a group, unringed, and the answer is how many. An array: the
    // total in rows, so both divisions are in it. Remainders: sharing again,
    // with the leftover outside every ring.
    for (const problem of tryIts("division-sharing", 1)) {
      const [dividend, divisor] = numbersIn(problem.prompt);
      const picture = problem.counters;
      if (!picture) throw new Error(`no picture on ${problem.prompt}`);
      expect(picture.layout).toBe("share");
      expect(picture.rings).toBe(true);
      expect(picture.caption).toBeUndefined();
      expect(picture.total).toBe(dividend);
      expect(grouped(picture)).toEqual({ groups: divisor, left: 0 });
      expect(picture.per).toBe(Number(problem.answer));
    }
    const grouping = tryIts("division-grouping", 1);
    const onCounters = grouping.filter((problem) => problem.counters);
    const onTheLine = grouping.filter((problem) => problem.line);
    expect(onCounters).toHaveLength(4);
    expect(onTheLine).toHaveLength(2);
    for (const problem of onCounters) {
      const [dividend, divisor] = numbersIn(problem.prompt);
      expect(problem.counters?.layout).toBe("group");
      expect(problem.counters?.rings).toBe(false);
      expect(problem.counters?.total).toBe(dividend);
      expect(problem.counters?.per).toBe(divisor);
    }
    for (const problem of onTheLine) {
      const [dividend] = numbersIn(problem.prompt);
      expect(problem.line?.from).toBe(0);
      expect(problem.line?.to).toBeGreaterThanOrEqual(dividend);
      // Blank: the jumps are the child's to draw.
      expect(problem.line?.jumps).toBeUndefined();
    }
    for (const problem of tryIts("division-arrays", 1).filter(
      (problem) => problem.counters,
    )) {
      expect(problem.counters?.layout).toBe("array");
      const rows = grouped(problem.counters as Counters).groups;
      const columns = problem.counters?.per;
      expect(rows, problem.prompt).not.toBe(columns);
    }
    const remainders = tryIts("division-remainders", 1);
    expect(remainders.filter((problem) => problem.counters)).toHaveLength(5);
    for (const problem of remainders.filter((problem) => problem.counters)) {
      const [dividend, divisor] = numbersIn(problem.prompt);
      const { quotient, left } = quotientOf(problem.answer);
      const picture = problem.counters as Counters;
      expect(picture.layout).toBe("share");
      expect(picture.rings).toBe(true);
      expect(picture.total).toBe(dividend);
      expect(picture.per).toBe(quotient);
      expect(grouped(picture)).toEqual({ groups: divisor, left });
    }
  });

  it("reserve room to work where the method is worked on paper", () => {
    const line = answerLine(14);
    // Chunking: blank paper under each, for the lumps.
    for (const problem of tryIts("division-chunking", 1)) {
      expect(problem.workspace).toBe(WRITTEN_TRY_ITS.CHUNK_LINES * line);
      expect(problem.counters).toBeUndefined();
      expect(problem.bracket).toBeUndefined();
    }
    // Long division and decimals: the bracket, the guided ones first and
    // then the steps alone, whatever the seed.
    const helps = (topic: LessonTopic, seed: number): DivisionHelp[] =>
      tryIts(topic, seed).map((problem) => {
        if (!problem.bracket) throw new Error(`${topic}: no bracket`);
        expect(problem.bracket.cell).toBe(line);
        expect(problem.bracket.rows).toBe(6);
        // Never a line of working past the squares reserved for it.
        expect(problem.bracket.tableau?.rows.length, topic) //
          .toBeLessThanOrEqual(problem.bracket.rows);
        return problem.bracket.help;
      });
    for (const seed of [1, 2, 3]) {
      expect(helps("long-division-steps", seed)).toEqual([
        ...Array<DivisionHelp>(WRITTEN_TRY_ITS.GUIDED).fill("guided"),
        "steps",
        "steps",
      ]);
      expect(helps("decimal-division", seed)).toEqual([
        "guided",
        "guided",
        "guided",
        "steps",
        "steps",
        "steps",
      ]);
    }
    // Dividing by a decimal: two ruled lines, the rewrite and the answer.
    for (const problem of tryIts("dividing-by-decimals", 1)) {
      expect(problem.answers).toHaveLength(2);
      expect(problem.workspace).toBe(2 * line);
    }
  });

  it("can be left off, which leaves nothing to mark", () => {
    for (const topic of LESSON_TOPICS) {
      const sheet = buildSheet(config({ topic, practice: false }), 1);
      expect(sheet.header.score).toBeUndefined();
      expect(problemsOf(sheet.blocks).every((problem) => problem.worked)).toBe(
        true,
      );
      expect(describeSheet(config({ topic, practice: false }))).toContain(
        "the lesson only",
      );
      const on = buildSheet(config({ topic }), 1);
      const count = tryIts(topic, 1).length;
      expect(count, topic).toBeGreaterThanOrEqual(6);
      expect(on.header.score?.outOf).toBe(count);
      expect(describeSheet(config({ topic }))).toContain(
        `with ${count} to try`,
      );
    }
  });
});

/* ── The page ──────────────────────────────────────────────────────────── */

describe("the page", () => {
  /** The blocks of each page, cut at the breaks. */
  const pagesOf = (blocks: Block[]): LessonBlock[][] => {
    const pages: LessonBlock[][] = [[]];
    for (const block of blocks) {
      if (block.kind === "break") pages.push([]);
      else pages[pages.length - 1].push(block as LessonBlock);
    }
    return pages;
  };

  /**
   * A lone block the family cannot cut smaller: everything but a block of
   * problems with more than one row in it. Taller than the page, it runs
   * over the foot (§23).
   */
  const uncuttable = (blocks: LessonBlock[]): boolean =>
    blocks.length === 1 &&
    !(
      blocks[0].kind === "problems" &&
      blocks[0].items.length > Math.max(1, blocks[0].columns)
    );

  it("reserves no more than the printed header and footer leave", () => {
    // Against the box the printed sheet actually has, not the one the config
    // was laid out against — the one way a family can be caught out (§4).
    // Strict at the sizes the lessons were written for; from 24pt up a page
    // holding one block that cannot be cut may run over (§23).
    for (const one of EVERY_SHEET) {
      for (const fontPt of [12, 14, 18, 24, 36]) {
        const sheet = buildSheet({ ...one, fontPt }, 1);
        const { page } = lessonLayout({ ...one, fontPt });
        const limit = printedBlockBox(sheet).height;
        for (const blocks of pagesOf(sheet.blocks)) {
          const used = blocks.reduce(
            (sum, block, index) =>
              sum + blockHeight(block, page) + (index > 0 ? BLOCK_GAP : 0),
            0,
          );
          if (fontPt >= 24 && uncuttable(blocks) && used > limit) continue;
          expect(used, `${one.topic} at ${fontPt}pt`).toBeLessThanOrEqual(
            limit,
          );
        }
      }
    }
  });

  it("cuts the problems to try into rows when the whole block is taller than the page", () => {
    // At the largest type the six go one row to a block, numbered on from
    // the last (§23), and every block fits the box. At the size a lesson was
    // written for they stay one block.
    const asked = (blocks: Block[]) =>
      blocks.filter(
        (block): block is Block & { kind: "problems" } =>
          block.kind === "problems" && !block.items.every((one) => one.worked),
      );
    let cut = 0;
    for (const topic of LESSON_TOPICS) {
      const at = config({ topic, fontPt: 36 });
      const { box, page, columns } = lessonLayout(at);
      const blocks = asked(lessonBlocks(at, 1).blocks);
      const items = blocks.flatMap((block) => block.items);
      expect(items.map(nameOf), topic).toEqual(tryIts(topic, 1).map(nameOf));
      const whole = blockHeight({ kind: "problems", columns, items }, page);
      if (whole <= box.height) {
        expect(blocks, topic).toHaveLength(1);
        continue;
      }
      cut += 1;
      expect(blocks.length, topic).toBeGreaterThan(1);
      let next = 1;
      for (const block of blocks) {
        // One row each — the smallest piece there is, so a row taller than
        // the page is the page's to run over rather than the split's to fix.
        expect(block.items.length, topic).toBeLessThanOrEqual(columns);
        expect(block.start ?? 1, topic).toBe(next);
        next += block.items.length;
      }
      // And at 24pt, where every row fits, every block does.
      const smaller = config({ topic, fontPt: 24 });
      const { box: room, page: at24 } = lessonLayout(smaller);
      for (const block of asked(lessonBlocks(smaller, 1).blocks)) {
        expect(blockHeight(block, at24), `${topic} at 24pt`) //
          .toBeLessThanOrEqual(room.height);
      }
    }
    expect(cut).toBeGreaterThan(0);
    for (const topic of LESSON_TOPICS) {
      expect(asked(lessonBlocks(config({ topic }), 1).blocks), topic) //
        .toHaveLength(1);
    }
  });

  it("holds sharing and grouping on one page at the size they were written for", () => {
    for (const topic of ["division-sharing", "division-grouping"] as const) {
      const { blocks } = lessonBlocks(config({ topic }), 1);
      expect(
        blocks.some((block) => block.kind === "break"),
        `${topic} no longer fits one Letter page at 14pt`,
      ).toBe(false);
    }
  });

  it("puts every later lesson's problems on a second page, whole", () => {
    // From the arrays on, the lesson and its problems are more than a page:
    // the problems go over — the whole block, never a row of it — and the
    // catalog says so.
    for (const topic of LESSON_TOPICS.slice(2)) {
      const pages = pagesOf(lessonBlocks(config({ topic }), 1).blocks);
      expect(pages, topic).toHaveLength(2);
      expect(pages[1], topic).toHaveLength(1);
      expect(pages[1][0].kind, topic).toBe("problems");
    }
  });

  it("prints in its key only the pages that differ", () => {
    // A lesson whose first page is the lesson alone would otherwise print it
    // twice, identically, in a sheet-and-key print (§7).
    for (const topic of ["division-arrays", "long-division-steps"] as const) {
      const sheet = buildSheet(config({ topic }), 1);
      const key = LESSON_SHEET.key(sheet);
      const pages = pagesOf(sheet.blocks);
      expect(pages, topic).toHaveLength(2);
      expect(pagesOf(key.blocks), topic).toHaveLength(1);
      expect(key.blocks, topic).toEqual(pages[1]);
      expect(key.answers, topic).toBe(true);
      // What was left off had nothing to reveal: prose, pictures and worked
      // examples, which print their answers on the sheet itself.
      for (const block of pages[0]) {
        expect(
          block.kind === "problems" && block.items.some((item) => !item.worked),
          `${topic}: a try-it on the page the key left off`,
        ).toBe(false);
      }
    }
    // A one-page lesson's key is the sheet, and so is a lesson printed alone.
    for (const one of [
      config({ topic: "division-sharing" }),
      config({ topic: "division-arrays", practice: false }),
    ]) {
      const sheet = buildSheet(one, 1);
      expect(LESSON_SHEET.key(sheet).blocks, one.topic).toEqual(sheet.blocks);
    }
  });

  it("breaks before a block rather than through one, at any type size", () => {
    for (const one of EVERY_SHEET) {
      for (const fontPt of [8, 12, 24, 36]) {
        const { blocks } = lessonBlocks({ ...one, fontPt }, 1);
        for (let at = 0; at < blocks.length; at += 1) {
          if (blocks[at].kind !== "break") continue;
          expect(at, "a break first").toBeGreaterThan(0);
          expect(blocks[at - 1].kind, "two breaks together").not.toBe("break");
          expect(at, "a break last").toBeLessThan(blocks.length - 1);
        }
      }
    }
  });

  it("prints a page for a topic this build has never heard of, rather than failing", () => {
    const unknown = config({ topic: "division-2030" as LessonTopic });
    const sheet = buildSheet(unknown, 1);
    expect(sheet.header.title).toBe("Lesson unavailable");
    expect(sheet.header.score).toBeUndefined();
    expect(sheet.blocks[0].kind).toBe("note");
    expect(describeSheet(unknown)).toContain("does not have");
    expect(answerKey(unknown, 1).answers).toBe(true);
  });
});
