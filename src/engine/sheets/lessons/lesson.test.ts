import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet } from "../index";
import { printedBlockBox } from "../chrome";
import { describeSheetFamily } from "../contract";
import { grouped } from "../counters";
import { BLOCK_GAP } from "../layout";
import type {
  Block,
  Counters,
  LessonConfig,
  LessonTopic,
  Paper,
  Problem,
} from "../types";

import { blockHeight, type LessonBlock } from "./blocks";
import { TRY_ITS } from "./division";
import {
  LESSON_SHEET,
  LESSON_TOPICS,
  lessonBlocks,
  lessonLayout,
  topicOf,
} from "./lesson";

/**
 * Lessons, held to the bar every other family meets — and to the two that
 * only bite here.
 *
 * **The words and the picture agree.** A lesson's picture is the question and
 * its sentence is the answer, printed side by side, and a picture of twelve
 * in three rings under a sentence that says four rings is a page that teaches
 * something false. So every caption and every worked fact on every lesson is
 * parsed back to its numbers here and held to the counters it stands beside.
 *
 * **Every try-it answer is checked by a path the family does not use.** The
 * family writes `dividend / divisor`; this file adds the divisor to itself
 * `answer` times and expects to arrive at the dividend, which is what division
 * means before it is a key on a calculator.
 *
 * The rest is the reservation: a lesson is the one family whose prose is long
 * enough for a wrong line count to put the problems on a second sheet, so the
 * two lessons written to fit one page are held to fitting it.
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

/** Every whole number in a string, in order. */
const numbersIn = (text: string): number[] =>
  (text.match(/\d+/g) ?? []).map(Number);

/** `divisor` added to itself `times` times — division's definition, undone. */
const added = (divisor: number, times: number): number => {
  let sum = 0;
  for (let at = 0; at < times; at += 1) sum += divisor;
  return sum;
};

/* ── The lesson half ───────────────────────────────────────────────────── */

describe("a lesson", () => {
  it("is one idea, a picture, a worked example and a word for the grown-up", () => {
    for (const topic of LESSON_TOPICS) {
      const { page } = lessonLayout(config({ topic }));
      const blocks = topicOf(topic).lesson(page);
      const notes = blocks.filter((block) => block.kind === "note");
      expect(notes.length, topic).toBeGreaterThanOrEqual(2);
      expect(
        blocks.some(
          (block) => block.kind === "counters" || block.kind === "numberline",
        ),
        `${topic}: no picture`,
      ).toBe(true);
      const worked = problemsOf(blocks);
      expect(worked.length, `${topic}: no worked example`).toBeGreaterThan(0);
      expect(worked.every((problem) => problem.worked)).toBe(true);
      // The sentence for the grown-up, set small, last.
      const last = blocks[blocks.length - 1];
      expect(last.kind === "note" && last.aside, topic).toBe(true);
      expect(
        last.kind === "note" && last.text[0].startsWith("For the grown-up"),
      ).toBe(true);
    }
  });

  it("says in words what the picture shows, and no other numbers", () => {
    // Every caption reads as the two counts of its layout, and every worked
    // fact's numbers are the picture's total and the two that make it.
    for (const topic of LESSON_TOPICS) {
      const { page } = lessonLayout(config({ topic }));
      const blocks = topicOf(topic).lesson(page);
      const [picture] = countersOf(blocks);
      expect(picture, `${topic}: no counters`).toBeDefined();
      const { groups, left } = grouped(picture);
      expect(left, `${topic}: the lesson's picture has a remainder`).toBe(0);

      const caption = numbersIn(picture.caption ?? "");
      const expected = {
        share: [groups, picture.per],
        group: [picture.per, groups],
        array: [groups, picture.per],
      }[picture.layout];
      expect(caption, `${topic}: "${picture.caption}"`).toEqual(expected);

      for (const fact of problemsOf(blocks)) {
        const numbers = [...numbersIn(fact.prompt), ...numbersIn(fact.answer)];
        expect(numbers, fact.prompt).toHaveLength(3);
        const [product, ...factors] = [...numbers].sort((a, b) => b - a);
        expect(product, `${topic}: ${fact.prompt} ${fact.answer}`).toBe(
          picture.total,
        );
        expect(added(factors[0], factors[1]), fact.prompt).toBe(product);
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
    expect(line.jumps?.size).toBe(picture.per);
  });
});

/* ── The problems to try ───────────────────────────────────────────────── */

describe("the problems to try", () => {
  it("are the topic's own, dealt in the seed's order", () => {
    const expected: Record<LessonTopic, string[]> = {
      "division-sharing": TRY_ITS.SHARES.map(([a, b]) => `${a} ÷ ${b} =`),
      "division-grouping": TRY_ITS.GROUPS.map(([a, b]) => `${a} ÷ ${b} =`),
      "division-arrays": [
        ...TRY_ITS.ARRAYS.map(() => "Write the two divisions."),
        "18 ÷ 3 = _  Think: 3 × ? = 18.",
      ],
    };
    for (const topic of LESSON_TOPICS) {
      const prompts = (seed: number) =>
        problemsOf(buildSheet(config({ topic }), seed).blocks)
          .filter((problem) => !problem.worked)
          .map((problem) => problem.prompt);
      expect([...prompts(1)].sort(), topic).toEqual(
        [...expected[topic]].sort(),
      );
      // Another seed is the same six in another order — a lesson's problems
      // are written, not drawn.
      expect([...prompts(2)].sort()).toEqual([...prompts(1)].sort());
      expect(prompts(1)).not.toEqual(prompts(2));
    }
  });

  it("have answers that add back up to the dividend", () => {
    for (const topic of LESSON_TOPICS) {
      for (const seed of [1, 2, 3]) {
        const problems = problemsOf(
          buildSheet(config({ topic }), seed).blocks,
        ).filter((problem) => !problem.worked);
        for (const problem of problems) {
          if (problem.answers) {
            // An array's two divisions, each a sentence on its own line.
            expect(problem.answers).toHaveLength(2);
            for (const sentence of problem.answers) {
              const [dividend, divisor, quotient] = numbersIn(sentence);
              expect(added(divisor, quotient), sentence).toBe(dividend);
              expect(problem.counters?.total, sentence).toBe(dividend);
            }
            expect(problem.answer).toBe(problem.answers.join(" · "));
            continue;
          }
          const [dividend, divisor] = numbersIn(problem.prompt);
          const quotient = Number(problem.answer);
          expect(Number.isInteger(quotient), problem.prompt).toBe(true);
          expect(added(divisor, quotient), problem.prompt).toBe(dividend);
        }
      }
    }
  });

  it("draw the picture the question is about", () => {
    // Sharing: as many rings as the divisor, the answer in each. Grouping: the
    // divisor to a group, unringed, and the answer is how many. An array: the
    // total in rows, so both divisions are in it.
    for (const problem of problemsOf(
      buildSheet(config({ topic: "division-sharing" }), 1).blocks,
    ).filter((problem) => !problem.worked)) {
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
    const grouping = problemsOf(
      buildSheet(config({ topic: "division-grouping" }), 1).blocks,
    ).filter((problem) => !problem.worked);
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
    for (const problem of problemsOf(
      buildSheet(config({ topic: "division-arrays" }), 1).blocks,
    ).filter((problem) => !problem.worked && problem.counters)) {
      expect(problem.counters?.layout).toBe("array");
      const rows = grouped(problem.counters as Counters).groups;
      const columns = problem.counters?.per;
      expect(rows, problem.prompt).not.toBe(columns);
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
      expect(on.header.score?.outOf).toBe(6);
      expect(describeSheet(config({ topic }))).toContain("with 6 to try");
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

  it("reserves no more than the printed header and footer leave", () => {
    // Against the box the printed sheet actually has, not the one the config
    // was laid out against — the one way a family can be caught out (§4).
    for (const one of EVERY_SHEET) {
      for (const fontPt of [12, 14, 18]) {
        const sheet = buildSheet({ ...one, fontPt }, 1);
        const { page } = lessonLayout({ ...one, fontPt });
        const limit = printedBlockBox(sheet).height;
        for (const blocks of pagesOf(sheet.blocks)) {
          const used = blocks.reduce(
            (sum, block, index) =>
              sum + blockHeight(block, page) + (index > 0 ? BLOCK_GAP : 0),
            0,
          );
          expect(used, `${one.topic} at ${fontPt}pt`).toBeLessThanOrEqual(
            limit,
          );
        }
      }
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

  it("puts the arrays' problems on a second page, whole", () => {
    // Five arrays with two ruled lines each are taller than the room left
    // under the lesson, so they go over — the whole block, never a row of it.
    const pages = pagesOf(
      lessonBlocks(config({ topic: "division-arrays" }), 1).blocks,
    );
    expect(pages).toHaveLength(2);
    expect(pages[1]).toHaveLength(1);
    expect(pages[1][0].kind).toBe("problems");
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
