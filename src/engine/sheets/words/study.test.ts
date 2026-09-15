import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet } from "../index";
import { printedBlockBox } from "../chrome";
import { describeSheetFamily } from "../contract";
import { MAX_COUNT, PROBLEM_GAP } from "../layout";
import type {
  Block,
  Paper,
  Sheet,
  WordStudyConfig,
  WordStudyStyle,
} from "../types";

import {
  CONTRACTIONS,
  FAMILIES,
  HOMOPHONES,
  MAX_SYLLABLES,
  PREFIXES,
  SUFFIXES,
  SYLLABLES,
  familyWords,
} from "./bank";
import {
  STUDY_TOPICS,
  WORD_STUDY_SHEET,
  studyLayout,
  studyStyles,
  topicOf,
} from "./study";

/**
 * Word study, held to the bar the maths families set — and to one more.
 *
 * "Verified by an independent path" means something different again here. There
 * is no arithmetic to check an answer against: the answers are authored, so what
 * a test can prove is that the *bank* is sound and that the sheet does not spoil
 * it. Both halves matter, and the second is the one that bites.
 *
 * **The bank.** No question asked twice, no answer used twice inside a topic —
 * which is what stops a near miss also being right — every sum really making the
 * word it claims, and every homophone sentence settling which of its pair is
 * meant.
 *
 * **The sheet.** A question and its answer stay together through a shuffle, a
 * matching column points at the row it belongs to, and a choice prints the
 * answer exactly once. Those are the three ways a page of correct answers can
 * still be a wrong worksheet.
 */

const paper: Paper = {
  size: "letter",
  orientation: "portrait",
  margin: "normal",
};

const config = (over: Partial<WordStudyConfig> = {}): WordStudyConfig => ({
  kind: "word-study",
  paper,
  fontPt: 12,
  fields: ["name", "date"],
  topic: "rhyming",
  style: "choose",
  count: 10,
  columns: 2,
  ...over,
});

/** Every topic in every style it offers — the whole surface, as configs. */
const EVERY_SHEET: WordStudyConfig[] = STUDY_TOPICS.flatMap((topic) =>
  studyStyles(topic).map((style) => config({ topic, style, count: 12 })),
);

const where = (one: WordStudyConfig) => `${one.topic}/${one.style}`;

const blockOf = (one: WordStudyConfig, seed = 1): Block =>
  buildSheet(one, seed).blocks[0];

/**
 * The problems block of each page, in order. A written sheet prints one such
 * block a page and nothing else, so anything else on a page is a failure
 * here rather than a page silently skipped.
 */
function pagesOf(sheet: Sheet): Array<Extract<Block, { kind: "problems" }>> {
  const pages: Array<Extract<Block, { kind: "problems" }>> = [];
  let open = false;
  for (const block of sheet.blocks) {
    if (block.kind === "break") {
      expect(open, "a break with no page before it").toBe(true);
      open = false;
      continue;
    }
    if (block.kind !== "problems")
      throw new Error(`expected problems, got ${block.kind}`);
    expect(open, "two problems blocks on one page").toBe(false);
    pages.push(block);
    open = true;
  }
  return pages;
}

/** Every question a sheet put on paper, whichever pages it took. */
const printedOf = (sheet: Sheet): number =>
  sheet.blocks.reduce(
    (total, block) => total + (block.kind === "break" ? 0 : countOf(block)),
    0,
  );

/* ── The bank ──────────────────────────────────────────────────────────── */

describe("the word bank", () => {
  it("asks nothing twice and answers nothing twice inside a topic", () => {
    // The property the near misses rest on: a distractor is another entry's
    // answer, so two entries sharing one would put two right answers on a line.
    for (const topic of STUDY_TOPICS) {
      const { questions } = topicOf(topic);
      expect(questions.length, topic).toBeGreaterThan(9);
      for (const question of questions) {
        expect(question.ask.trim(), topic).not.toBe("");
        expect(question.cue.trim(), topic).not.toBe("");
        expect(question.answer.trim(), topic).not.toBe("");
      }
      const asks = questions.map((question) => question.ask);
      const answers = questions.map((question) => question.answer);
      expect(new Set(asks).size, `${topic} asks`).toBe(asks.length);
      // Except where the answers are a scale rather than words: half the words
      // on a syllable sheet have three of them, and nothing is ambiguous about
      // that because the options are the numbers one to four either way.
      if (topicOf(topic).options) continue;
      expect(new Set(answers).size, `${topic} answers`).toBe(answers.length);
    }
  });

  it("makes a real word out of every word-family sum", () => {
    // The independent path for this topic: the answer is checked against its own
    // parts rather than against the generator that joined them.
    for (const family of FAMILIES) {
      for (const word of familyWords(family)) {
        expect(word.endsWith(family.rime), word).toBe(true);
        expect(word.length, word).toBeGreaterThan(family.rime.length);
      }
    }
  });

  it("puts a prefix on the front and a suffix on the back", () => {
    for (const { part, base, word } of PREFIXES) {
      expect(word.startsWith(part), word).toBe(true);
      expect(word.endsWith(base), word).toBe(true);
    }
    for (const { part, base, word } of SUFFIXES) {
      expect(word.endsWith(part), word).toBe(true);
      // Not the whole base — "happy + ness" is "happiness" and "make + ing" is
      // "making", which is the lesson — but a word that had lost its beginning
      // would be a typo rather than a spelling change.
      expect(word.startsWith(base.slice(0, 2)), word).toBe(true);
    }
  });

  it("counts every syllable between one and four", () => {
    for (const { word, syllables } of SYLLABLES) {
      expect(syllables, word).toBeGreaterThanOrEqual(1);
      expect(syllables, word).toBeLessThanOrEqual(MAX_SYLLABLES);
    }
  });

  it("marks where the letters went in every contraction", () => {
    for (const { words, short } of CONTRACTIONS) {
      expect(short, words).toContain("'");
      expect(short.length, words).toBeLessThan(words.length);
    }
  });

  it("gives every homophone a sentence that settles which one is meant", () => {
    // The house rule from `wordlists.ts`, held to on paper: one gap, the answer
    // one of the pair, and *neither* spelling anywhere else in the sentence — a
    // sentence containing the word answers itself.
    for (const { pair, sentence, answer } of HOMOPHONES) {
      expect(sentence.match(/_/g) ?? [], sentence).toHaveLength(1);
      expect(pair, sentence).toContain(answer);
      expect(pair[0], sentence).not.toBe(pair[1]);
      for (const word of pair) {
        expect(sentence.toLowerCase(), sentence) //
          .not.toMatch(new RegExp(`\\b${word}\\b`));
      }
    }
    const sentences = HOMOPHONES.map((one) => one.sentence);
    expect(new Set(sentences).size).toBe(sentences.length);
  });
});

/* ── The family ────────────────────────────────────────────────────────── */

describeSheetFamily("word-study", {
  label: "Word study",
  spec: WORD_STUDY_SHEET,
  config,
  shapes: EVERY_SHEET,
});

describe("the word-study family", () => {
  it("prints a titled, marked page for every topic and style", () => {
    for (const one of EVERY_SHEET) {
      const sheet = buildSheet(one, 1);
      expect(sheet.header.title, where(one)).not.toBe("");
      expect(sheet.header.instructions, where(one)).toBeTruthy();
      expect(sheet.header.score?.outOf, where(one)).toBe(12);
      expect(printedOf(sheet), where(one)).toBe(12);
    }
  });

  it("names what it prints, in the terms it was chosen by", () => {
    expect(describeSheet(config({ topic: "plurals", style: "write" }))) //
      .toBe("Plurals — 10 questions — written in");
    expect(describeSheet(config({ topic: "synonyms", style: "match" }))) //
      .toBe("Synonyms — 10 questions — joined up");
    // A count past the bank names the bank, not the page: a written sheet
    // runs on to another page rather than stopping at the paper.
    const plurals = topicOf("plurals").questions.length;
    expect(
      describeSheet(config({ topic: "plurals", style: "write", count: 200 })),
    ).toBe(`Plurals — ${plurals} questions — written in`);
  });

  it("falls back to a style the topic has rather than throwing", () => {
    // A saved sheet outlives the table it was made from (§3): rhyming has never
    // been writable, and a config that says so still has to print something.
    const rhyming = config({ topic: "rhyming", style: "write" });
    expect(blockOf(rhyming).kind).toBe("choice");
    // As does a topic this build has never heard of.
    const unknown = config({ topic: "kennings" as never });
    expect(() => buildSheet(unknown, 1)).not.toThrow();
  });

  it("builds the same sheet twice, and a different one next seed", () => {
    for (const one of EVERY_SHEET) {
      expect(JSON.stringify(buildSheet(one, 5)), where(one)) //
        .toBe(JSON.stringify(buildSheet(one, 5)));
      expect(JSON.stringify(buildSheet(one, 6)), where(one)) //
        .not.toBe(JSON.stringify(buildSheet(one, 5)));
    }
  });

  it("runs a written sheet on to another page, and cuts the other two to it", () => {
    // A written sheet asked for more than a page holds is more pages; a list
    // of choices numbers from one with no `start` to continue from, and a
    // matching column is shuffled as one whole, so those two stay one page.
    // Neither ever prints more than the bank has: a page with room for forty
    // rhymes still only has fourteen families.
    for (const size of ["letter", "a4"] as const) {
      for (const fontPt of [10, 12, 18]) {
        for (const one of EVERY_SHEET) {
          const big = { ...one, paper: { ...paper, size }, fontPt, count: 200 };
          const label = `${where(one)} ${size}@${fontPt}`;
          const { perPage } = studyLayout(big);
          const bank = Math.min(topicOf(one.topic).questions.length, MAX_COUNT);
          const sheet = buildSheet(big, 1);
          if (one.style === "write") {
            const pages = pagesOf(sheet);
            expect(pages.length, label).toBe(Math.ceil(bank / perPage));
            expect(printedOf(sheet), label).toBe(bank);
            for (const [at, page] of pages.entries())
              if (at < pages.length - 1)
                expect(page.items.length, `${label}, page ${at + 1}`) //
                  .toBe(perPage);
          } else {
            expect(sheet.blocks, label).toHaveLength(1);
            expect(printedOf(sheet), label).toBe(Math.min(perPage, bank));
          }
        }
      }
    }
  });

  it("runs on to another page rather than cutting the count to the paper", () => {
    // Every word family at 18pt is several pages, not one page of the first
    // twenty-odd (§4). The numbering carries on, the score box counts every
    // page, and the key runs on page for page.
    const one = config({
      topic: "families",
      style: "write",
      count: 200,
      fontPt: 18,
    });
    const { perPage } = studyLayout(one);
    const bank = Math.min(topicOf("families").questions.length, MAX_COUNT);
    const sheet = buildSheet(one, 3);
    const pages = pagesOf(sheet);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.length).toBe(Math.ceil(bank / perPage));
    expect(pages[0].items.length).toBe(perPage);
    expect(pages[1].start).toBe(perPage + 1);
    expect(sheet.header.score?.outOf).toBe(bank);
    expect(pagesOf(answerKey(one, 3)).map((page) => page.items.length)) //
      .toEqual(pages.map((page) => page.items.length));
  });

  it("never prints more questions on a page than the paper holds", () => {
    // Against the box the printed header leaves rather than the config's,
    // and every page but the last full: a page cut short of what fits would
    // be a sheet of paper for nothing.
    for (const size of ["letter", "a4", "legal"] as const) {
      for (const margin of ["narrow", "normal", "wide"] as const) {
        for (const fontPt of [8, 12, 18, 24, 36]) {
          for (const one of EVERY_SHEET) {
            if (one.style !== "write") continue;
            const big = {
              ...one,
              paper: { ...paper, size, margin },
              fontPt,
              count: 200,
            };
            const label = `${where(one)} ${size}/${margin}/${fontPt}pt`;
            const sheet = buildSheet(big, 8);
            const pages = pagesOf(sheet);
            expect(pages.length, label).toBeGreaterThan(0);
            const { row, perPage } = studyLayout(big);
            for (const [at, page] of pages.entries()) {
              const rows = Math.ceil(page.items.length / page.columns);
              const used = rows * row + Math.max(0, rows - 1) * PROBLEM_GAP.y;
              expect(used, `${label}, page ${at + 1}`).toBeLessThanOrEqual(
                printedBlockBox(sheet).height,
              );
              if (at < pages.length - 1)
                expect(page.items.length, `${label}, page ${at + 1}`).toBe(
                  pages[0].items.length,
                );
            }
            // A row taller than the page holds nothing at all.
            if (perPage === 0)
              expect(
                pages.map((page) => page.items),
                label,
              ).toEqual([[]]);
          }
        }
      }
    }
  });
});

/** How many questions a block put on the paper. */
function countOf(block: Block): number {
  if (block.kind === "problems") return block.items.length;
  if (block.kind === "choice") return block.questions.length;
  if (block.kind === "matching") return block.left.length;
  throw new Error(`unexpected block ${block.kind}`);
}

/* ── The three shapes of question ──────────────────────────────────────── */

describe("writing the answer", () => {
  it("keeps every question with its own answer through the draw", () => {
    // The failure a shuffle makes possible and nothing else catches: a page of
    // correct answers attached to the wrong prompts.
    for (const topic of STUDY_TOPICS) {
      if (!studyStyles(topic).includes("write")) continue;
      const items = pagesOf(
        buildSheet(config({ topic, style: "write", count: 12 }), 1),
      ).flatMap((page) => page.items);
      const bank = new Map(
        topicOf(topic).questions.map((one) => [one.ask, one.answer]),
      );
      for (const item of items) {
        expect(bank.get(item.prompt), item.prompt).toBe(item.answer);
      }
    }
  });
});

describe("circling one of four", () => {
  it("prints the answer once, marks it, and draws the rest from the topic", () => {
    for (const topic of STUDY_TOPICS) {
      if (!studyStyles(topic).includes("choose")) continue;
      const { questions, options: scale } = topicOf(topic);
      const block = blockOf(config({ topic, style: "choose", count: 12 }));
      if (block.kind !== "choice") throw new Error("expected choice");

      const bank = new Map(questions.map((one) => [one.cue, one.answer]));
      const answers = new Set(questions.map((one) => one.answer));
      for (const question of block.questions) {
        const right = bank.get(question.prompt);
        expect(right, question.prompt).toBeDefined();
        expect(question.options[question.answer], question.prompt).toBe(right);
        // Exactly once: an option list with the answer twice on it has two
        // right answers and no way to mark either.
        expect(
          question.options.filter((option) => option === right),
          question.prompt,
        ).toHaveLength(1);
        expect(new Set(question.options).size).toBe(question.options.length);
        expect(question.options.length).toBe(scale ? scale.length : 4);
        // The near misses are other answers from the same topic, which is what
        // makes them near — never a word from somewhere else.
        for (const option of question.options) {
          expect(answers.has(option), `${topic}: ${option}`).toBe(true);
        }
      }
    }
  });

  it("offers a syllable count as a scale rather than as a shuffle", () => {
    const block = blockOf(config({ topic: "syllables", style: "choose" }));
    if (block.kind !== "choice") throw new Error("expected choice");
    for (const question of block.questions) {
      expect(question.options).toEqual(["1", "2", "3", "4"]);
    }
  });
});

describe("joining two columns", () => {
  it("points every left-hand word at the row its answer landed in", () => {
    for (const topic of STUDY_TOPICS) {
      if (!studyStyles(topic).includes("match")) continue;
      const block = blockOf(config({ topic, style: "match", count: 12 }));
      if (block.kind !== "matching") throw new Error("expected matching");

      const bank = new Map(
        topicOf(topic).questions.map((one) => [one.cue, one.answer]),
      );
      expect(block.left.length).toBe(block.right.length);
      expect([...block.right].sort()).toEqual(
        block.left.map((cue) => bank.get(cue) ?? "").sort(),
      );
      block.left.forEach((cue, at) => {
        expect(block.right[block.answer[at]], cue).toBe(bank.get(cue));
      });
    }
  });
});

/* ── What a panel is allowed to offer ──────────────────────────────────── */

describe("the styles a topic offers", () => {
  it("gives every topic at least one, and its first as the default", () => {
    const known: WordStudyStyle[] = ["write", "choose", "match"];
    for (const topic of STUDY_TOPICS) {
      const styles = studyStyles(topic);
      expect(styles.length, topic).toBeGreaterThan(0);
      for (const style of styles) expect(known, topic).toContain(style);
      expect(new Set(styles).size, topic).toBe(styles.length);
    }
  });
});
