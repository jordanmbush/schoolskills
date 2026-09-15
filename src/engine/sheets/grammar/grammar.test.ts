import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet } from "../index";
import { printedBlockBox } from "../chrome";
import { describeSheetFamily } from "../contract";
import { MAX_COUNT } from "../layout";
import type {
  Block,
  GrammarConfig,
  GrammarStyle,
  Paper,
  Sheet,
} from "../types";

import { END_MARK, KINDS, PARTS, SENTENCES, type Tagged } from "./bank";
import {
  GRAMMAR_SHEET,
  GRAMMAR_TOPICS,
  grammarColumns,
  grammarLayout,
  grammarStyles,
  topicOf,
} from "./grammar";

/**
 * Grammar, held to the bar every other family meets — and to the one that only
 * bites here.
 *
 * On a maths sheet "verified by an independent path" means the answer is worked
 * out a second way. There is no second way to work out whether a word is an
 * adverb: the answer is a **tag somebody wrote down**, so what this file proves
 * is that the tags are sound and that the sheet prints them faithfully.
 *
 * **The bank.** Every sentence ends on the mark its kind takes, every split
 * rejoins to the sentence it came from with nothing added and nothing lost,
 * every tagged word is in its sentence exactly once, and every capitals
 * sentence has exactly one word to put right.
 *
 * **The sheet.** Every answer on every page is recovered from the bank *here*,
 * by this file's own arithmetic rather than by anything `grammar.ts` exports —
 * the prompt is parsed back to the entry it was made from and the answer is
 * re-derived from the tag. A generator that agreed with itself and disagreed
 * with the bank would pass every other assertion in this file and fail these.
 */

const paper: Paper = {
  size: "letter",
  orientation: "portrait",
  margin: "normal",
};

const config = (over: Partial<GrammarConfig> = {}): GrammarConfig => ({
  kind: "grammar",
  paper,
  fontPt: 12,
  fields: ["name", "date"],
  topic: "parts",
  style: "choose",
  count: 10,
  columns: 1,
  ...over,
});

/** Every topic in every style it offers — the whole surface, as configs. */
const EVERY_SHEET: GrammarConfig[] = GRAMMAR_TOPICS.flatMap((topic) =>
  grammarStyles(topic).map((style) => config({ topic, style, count: 10 })),
);

const where = (one: GrammarConfig) => `${one.topic}/${one.style}`;

/**
 * One block a page, in order, with a `break` between. A grammar sheet prints
 * nothing else, so a second block on a page is a failure here rather than a
 * page silently skipped.
 */
function pagesOf(sheet: Sheet): Block[] {
  const pages: Block[] = [];
  let open = false;
  for (const block of sheet.blocks) {
    if (block.kind === "break") {
      expect(open, "a break with no page before it").toBe(true);
      open = false;
      continue;
    }
    expect(open, "two blocks on one page").toBe(false);
    pages.push(block);
    open = true;
  }
  return pages;
}

/** The pages of a sheet, each narrowed to the block kind its style prints. */
function pagesAs<K extends Block["kind"]>(
  sheet: Sheet,
  kind: K,
): Array<Extract<Block, { kind: K }>> {
  return pagesOf(sheet).map((block) => {
    if (block.kind !== kind)
      throw new Error(`expected ${kind}, got ${block.kind}`);
    return block as Extract<Block, { kind: K }>;
  });
}

const blockOf = (one: GrammarConfig, seed = 1): Block =>
  pagesOf(buildSheet(one, seed))[0];

/** Every choice a sheet put on paper, whichever pages it took. */
const questionsOn = (one: GrammarConfig, seed = 1) =>
  pagesAs(buildSheet(one, seed), "choice").flatMap((page) => page.questions);

/** Every sentence a sheet put on paper, whichever pages it took. */
const printedOf = (sheet: Sheet): number =>
  pagesOf(sheet).reduce((total, block) => total + countOf(block), 0);

/** The number a page's first sentence carries — both grammar blocks number. */
const startOf = (block: Block): number | undefined =>
  block.kind === "problems" || block.kind === "choice"
    ? block.start
    : undefined;

/** How many across a page lays its sentences; a list down the page is one. */
const columnsOf = (block: Block): number =>
  block.kind === "problems" ? block.columns : 1;

/** The bank by the sentence it holds, which is how a prompt finds its way home. */
const BY_TEXT = new Map(SENTENCES.map((entry) => [entry.text, entry]));

/** The words of a sentence, with the punctuation taken off each of them. */
const wordsOf = (text: string): string[] =>
  text.split(/\s+/).map((word) => word.replaceAll(/[^A-Za-z]/g, ""));

/** How many times a word stands on its own in a sentence, case and all. */
const occurrences = (text: string, word: string): number =>
  wordsOf(text).filter((one) => one === word).length;

/* ── The bank ──────────────────────────────────────────────────────────── */

describe("the sentence bank", () => {
  it("writes every sentence once, with a capital and the right mark", () => {
    const texts = SENTENCES.map((entry) => entry.text);
    expect(new Set(texts).size).toBe(texts.length);
    for (const entry of SENTENCES) {
      expect(entry.text.trim(), entry.text).toBe(entry.text);
      expect(entry.text[0], entry.text).toBe(entry.text[0].toUpperCase());
      // The mark is derived from the kind here and read off the string in
      // `endMarks()` — the two ends of the same claim, meeting in the middle.
      expect(entry.text.slice(-1), entry.text).toBe(END_MARK[entry.kind]);
      expect(KINDS, entry.text).toContain(entry.kind);
    }
  });

  it("cuts a statement in two, and cuts nothing else", () => {
    // The property that makes "write the subject" markable at all: the split is
    // exhaustive, so a child who writes the head noun alone has left words with
    // nowhere to go. Checked by rejoining, which no amount of care in the
    // authoring can be trusted to have got right.
    for (const entry of SENTENCES) {
      if (entry.kind !== "statement") {
        expect(entry.split, entry.text).toBeUndefined();
        continue;
      }
      const split = entry.split;
      if (!split) throw new Error(`no split on "${entry.text}"`);
      expect(`${split.subject} ${split.predicate}.`, entry.text) //
        .toBe(entry.text);
      expect(split.subject.trim(), entry.text).not.toBe("");
      expect(split.predicate.trim(), entry.text).not.toBe("");
      // A subject the sentence does not open on is a subject somebody moved.
      expect(entry.text.startsWith(split.subject), entry.text).toBe(true);
    }
  });

  it("tags one word, and finds it once in its own sentence", () => {
    // The whole question a parts-of-speech sheet asks is "this word, here", so
    // a word that turns up twice is a question with two subjects and one
    // answer. Case-sensitive, because the printed prompt quotes the word as it
    // is written — "They" at the front of a sentence is not "they".
    for (const entry of SENTENCES) {
      const focus = entry.focus;
      if (!focus) continue;
      expect(PARTS, entry.text).toContain(focus.part);
      expect(occurrences(entry.text, focus.word), entry.text).toBe(1);
    }
    // And every part of speech is somewhere in the bank, or a sheet drawn from
    // it teaches four of the five.
    const tagged = SENTENCES.flatMap((entry) => entry.focus?.part ?? []);
    expect(new Set(tagged)).toEqual(new Set(PARTS));
  });

  it("leaves exactly one word to capitalise, and never the first", () => {
    for (const entry of SENTENCES) {
      const [first, ...rest] = wordsOf(entry.text);
      expect(first, entry.text).not.toBe("");
      // Whatever else is capitalised inside the sentence is the proper noun and
      // nothing else — an "I" or a second name would be a second thing a child
      // could point at and be right about.
      const capitalised = rest.filter(
        (word) => word !== "" && word[0] === word[0].toUpperCase(),
      );
      expect(capitalised, entry.text).toEqual(
        entry.proper ? [entry.proper] : [],
      );
      if (!entry.proper) continue;
      expect(occurrences(entry.text, entry.proper), entry.text).toBe(1);
    }
  });

  it("has more of every topic than a page of it holds", () => {
    // The bank's own header names this as the failure to avoid: a page whose
    // sentences are the topic's whole supply is the same page every week,
    // whatever seed a parent rerolls to. Measured against what the paper holds
    // rather than against a number somebody typed, so the bar moves the day a
    // row gets shorter — and against the *widest* style a topic offers, since a
    // "write" page fits half again as many as a "circle one" page.
    for (const topic of GRAMMAR_TOPICS) {
      const page = Math.max(
        ...grammarStyles(topic).map(
          (style) =>
            grammarLayout(config({ topic, style, columns: 1 })).perPage,
        ),
      );
      expect(topicOf(topic).questions.length, topic).toBeGreaterThan(page);
    }
  });

  it("never asks which mark an exclamation ends on", () => {
    // "What a mess" takes a bang and a full stop is not a mistake anybody can
    // point to, so the one judgement call in end punctuation is left out of the
    // topic rather than guessed at.
    const asked = topicOf("punctuation").questions.map((one) => one.answer);
    expect(new Set(asked)).toEqual(new Set([".", "?"]));
  });

  it("keeps the four kinds of sentence in play", () => {
    // A types sheet drawn from a bank of statements is a page with one answer.
    for (const kind of KINDS) {
      const many = SENTENCES.filter((entry) => entry.kind === kind).length;
      expect(many, kind).toBeGreaterThan(3);
    }
  });
});

/* ── The family ────────────────────────────────────────────────────────── */

describeSheetFamily("grammar", {
  label: "Grammar",
  spec: GRAMMAR_SHEET,
  config,
  shapes: EVERY_SHEET,
});

describe("the grammar family", () => {
  it("prints a titled, marked page for every topic and style", () => {
    for (const one of EVERY_SHEET) {
      const sheet = buildSheet(one, 1);
      expect(sheet.header.title, where(one)).not.toBe("");
      expect(sheet.header.instructions, where(one)).toBeTruthy();
      // Marked out of what is on the sheet rather than out of what was asked
      // for, and the sheet runs on: subject and predicate spends three lines
      // on every sentence, holds eight to a page, and prints ten over two.
      const room = Math.min(one.count, topicOf(one.topic).questions.length);
      expect(room, where(one)).toBeGreaterThan(5);
      expect(sheet.header.score?.outOf, where(one)).toBe(room);
      expect(printedOf(sheet), where(one)).toBe(room);
      // §16's footer URL is the game that matches the sheet, and there is no
      // grammar race — so this one says the site.
      expect(sheet.footer.url, where(one)).toBe("schoolskills.app");
    }
  });

  it("names what it prints, in the terms it was chosen by", () => {
    expect(describeSheet(config({ topic: "capitals", style: "write" }))) //
      .toBe("Capital letters — 10 sentences — written in");
    expect(describeSheet(config({ topic: "types", style: "choose" }))) //
      .toBe("Kinds of sentence — 10 sentences — circled");
    // A count past the bank names the bank, not the page: a written sheet
    // runs on to another page rather than stopping at the paper.
    const capitals = topicOf("capitals").questions.length;
    expect(
      describeSheet(config({ topic: "capitals", style: "write", count: 200 })),
    ).toBe(`Capital letters — ${capitals} sentences — written in`);
  });

  it("falls back to a style the topic has rather than throwing", () => {
    // A saved sheet outlives the table it was made from (§3): there has never
    // been a list of capital letters to circle, and a config that says so still
    // has to print something.
    const circled = config({ topic: "capitals", style: "choose" });
    expect(blockOf(circled).kind).toBe("problems");
    // As does a topic this build has never heard of.
    const unknown = config({ topic: "clauses" as never });
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

  it("runs both styles on to another page rather than cutting either", () => {
    // A sheet asked for more than a page holds is more pages, written or
    // circled (§4) — and never more than the bank has.
    for (const size of ["letter", "a4"] as const) {
      for (const fontPt of [10, 12, 18, 36]) {
        for (const one of EVERY_SHEET) {
          const big = {
            ...one,
            paper: { ...paper, size },
            fontPt,
            count: 200,
            columns: 2,
          };
          const label = `${where(one)} ${size}@${fontPt}`;
          const { perPage } = grammarLayout(big);
          const bank = Math.min(topicOf(one.topic).questions.length, MAX_COUNT);
          const sheet = buildSheet(big, 1);
          const pages = pagesOf(sheet);
          // A row taller than the page holds nothing at all, and no number
          // of pages would mend it.
          if (perPage === 0) {
            expect(pages.map(countOf), label).toEqual([0]);
            continue;
          }
          expect(pages.length, label).toBe(Math.ceil(bank / perPage));
          expect(printedOf(sheet), label).toBe(bank);
          for (const [at, page] of pages.entries())
            if (at < pages.length - 1)
              expect(countOf(page), `${label}, page ${at + 1}`).toBe(perPage);
        }
      }
    }
  });

  it("runs on to another page rather than cutting the count to the paper", () => {
    // Twenty sentences to cut in half, at eight to a page, are three pages
    // and not eight sentences; every part of speech to circle at 36pt is
    // several (§4). The numbering carries on, the score box counts every
    // page, and the key runs on page for page.
    const shapes: Array<Partial<GrammarConfig>> = [
      { topic: "subject", style: "write", count: 20 },
      { topic: "parts", style: "choose", count: 200, fontPt: 36 },
    ];
    for (const shape of shapes) {
      const one = config(shape);
      const { perPage } = grammarLayout(one);
      const wanted = Math.min(one.count, topicOf(one.topic).questions.length);
      const sheet = buildSheet(one, 3);
      const pages = pagesOf(sheet);
      expect(pages.length, where(one)).toBeGreaterThan(1);
      expect(pages.length, where(one)).toBe(Math.ceil(wanted / perPage));
      expect(countOf(pages[0]), where(one)).toBe(perPage);
      expect(startOf(pages[1]), where(one)).toBe(perPage + 1);
      expect(printedOf(sheet), where(one)).toBe(wanted);
      expect(sheet.header.score?.outOf, where(one)).toBe(wanted);
      expect(pagesOf(answerKey(one, 3)).map(countOf), where(one)) //
        .toEqual(pages.map(countOf));
    }
  });

  it("never prints more sentences on a page than the paper holds", () => {
    // Against the box the printed header leaves rather than the config's,
    // and every page but the last full: a page cut short of what fits would
    // be a sheet of paper for nothing.
    for (const size of ["letter", "a4", "legal"] as const) {
      for (const margin of ["narrow", "normal", "wide"] as const) {
        for (const fontPt of [8, 12, 18, 24, 36]) {
          for (const one of EVERY_SHEET) {
            const big = {
              ...one,
              paper: { ...paper, size, margin },
              fontPt,
              count: 200,
              columns: 2,
            };
            const label = `${where(one)} ${size}/${margin}/${fontPt}pt`;
            const sheet = buildSheet(big, 8);
            const pages = pagesOf(sheet);
            expect(pages.length, label).toBeGreaterThan(0);
            const { row, gap, perPage } = grammarLayout(big);
            for (const [at, page] of pages.entries()) {
              const rows = Math.ceil(countOf(page) / columnsOf(page));
              const used = rows * row + Math.max(0, rows - 1) * gap;
              expect(used, `${label}, page ${at + 1}`).toBeLessThanOrEqual(
                printedBlockBox(sheet).height,
              );
              if (at < pages.length - 1)
                expect(countOf(page), `${label}, page ${at + 1}`).toBe(
                  countOf(pages[0]),
                );
            }
            // A row taller than the page holds nothing at all.
            if (perPage === 0) expect(pages.map(countOf), label).toEqual([0]);
          }
        }
      }
    }
  });

  it("lays a sentence out one or two across, and a split only one", () => {
    // Two ruled lines that do not wrap in a half-width column is a predicate
    // with its end cut off, which reads as a sheet rather than as a bug.
    for (const topic of GRAMMAR_TOPICS) {
      if (!grammarStyles(topic).includes("write")) continue;
      const wide = grammarLayout(config({ topic, style: "write", columns: 6 }));
      expect(wide.columns, topic).toBe(topic === "subject" ? 1 : 2);
      // And the number the options panel builds its stepper out of is the one
      // the paper obeys, rather than a second copy of the same rule.
      expect(grammarColumns(topic), topic).toBe(wide.columns);
    }
    // And a circled sheet is a list down the page whatever the config says.
    expect(grammarLayout(config({ topic: "parts", columns: 2 })).columns).toBe(
      1,
    );
  });
});

/** How many questions a block put on the paper. */
function countOf(block: Block): number {
  if (block.kind === "problems") return block.items.length;
  if (block.kind === "choice") return block.questions.length;
  throw new Error(`unexpected block ${block.kind}`);
}

/* ── The answers, checked against the tags ─────────────────────────────────
   The story's own condition, and the reason this section does not import a
   single helper out of `grammar.ts`: a prompt is taken apart here, matched to
   the bank entry it was built from, and the answer re-derived from the tag by
   this file. Anything the generator believes about its own output is beside
   the point.                                                               */

/** The entry a printed prompt came from, and the tag it was asked about. */
function entryOf(prompt: string, find: (entry: Tagged) => string): Tagged {
  const found = SENTENCES.find((entry) => find(entry) === prompt);
  if (!found) throw new Error(`no sentence prints "${prompt}"`);
  return found;
}

/** Every problem of a written sheet, whichever pages it took. */
function itemsOf(topic: string) {
  const items = pagesAs(
    buildSheet(config({ topic: topic as never, style: "write" }), 3),
    "problems",
  ).flatMap((page) => page.items);
  expect(items.length, topic).toBeGreaterThan(0);
  return items;
}

describe("the answers on a grammar sheet", () => {
  it("names the part of speech the bank tagged, for the word it quoted", () => {
    for (const item of itemsOf("parts")) {
      const split = /^(.*) — “(.+)”$/.exec(item.prompt);
      if (!split) throw new Error(`unquoted prompt "${item.prompt}"`);
      const entry = BY_TEXT.get(split[1]);
      if (!entry?.focus) throw new Error(`no tag for "${split[1]}"`);
      expect(split[2], item.prompt).toBe(entry.focus.word);
      expect(item.answer, item.prompt).toBe(entry.focus.part);
    }
  });

  it("cuts each sentence where the bank cuts it, and writes both halves", () => {
    for (const item of itemsOf("subject")) {
      const entry = BY_TEXT.get(item.prompt);
      if (!entry?.split) throw new Error(`no split for "${item.prompt}"`);
      expect(item.answers, item.prompt) //
        .toEqual([entry.split.subject, entry.split.predicate]);
      // Rejoined here as well as in the bank's own test, because what is being
      // checked now is the pair that reached the paper.
      expect(`${item.answers?.join(" ")}.`, item.prompt).toBe(entry.text);
      // Two ruled lines and no slot: exactly one place to write the answer.
      expect(item.workspace, item.prompt).toBeGreaterThan(0);
    }
  });

  it("says what each sentence is for, from the kind it was tagged with", () => {
    for (const item of itemsOf("types")) {
      const entry = BY_TEXT.get(item.prompt);
      if (!entry) throw new Error(`no sentence "${item.prompt}"`);
      expect(item.answer, item.prompt).toBe(entry.kind);
    }
  });

  it("asks for the mark the sentence's own kind takes", () => {
    for (const item of itemsOf("punctuation")) {
      const entry = entryOf(item.prompt, (one) => one.text.slice(0, -1));
      expect(entry.kind, item.prompt).not.toBe("exclamation");
      // Derived from the tag rather than from the string the sheet was built
      // out of, which is the whole point of the tag being there.
      expect(item.answer, item.prompt).toBe(END_MARK[entry.kind]);
    }
  });

  it("lower-cases one proper noun and asks for exactly it back", () => {
    for (const item of itemsOf("capitals")) {
      // The printed sentence is recomputed here rather than imported, so the
      // exercise and the answer are checked against the bank instead of against
      // each other.
      const entry = entryOf(item.prompt, (one) =>
        one.proper
          ? one.text.replace(one.proper, one.proper.toLowerCase())
          : one.text,
      );
      if (!entry.proper) throw new Error(`no proper noun in "${item.prompt}"`);
      expect(item.answer, item.prompt).toBe(entry.proper);
      // One character apart, and that character is a case change: a sheet that
      // had rewritten anything else would be asking a different question.
      expect(item.prompt.toLowerCase(), item.prompt) //
        .toBe(entry.text.toLowerCase());
      expect(item.prompt, item.prompt).not.toBe(entry.text);
    }
  });
});

describe("circling one of a closed list", () => {
  it("puts every name on the list on the page, at every seed", () => {
    // The variety is asserted rather than hoped for, as `wordproblems.test.ts`
    // puts it. A shuffle is fair across many pages and silent about any one of
    // them: before this was drawn deliberately, one page in six of "kinds of
    // sentence" came up with no command on it — every item correct, and the
    // sheet no longer the exercise its own instruction line describes.
    for (const topic of GRAMMAR_TOPICS) {
      if (!grammarStyles(topic).includes("choose")) continue;
      const scale = topicOf(topic).options;
      if (!scale) throw new Error(`${topic} circles nothing`);
      for (let seed = 1; seed <= 50; seed++) {
        const printed = questionsOn(
          config({ topic, style: "choose", count: 12 }),
          seed,
        );
        const drawn = new Set(
          printed.map((question) => question.options[question.answer]),
        );
        expect([...drawn].sort(), `${topic} @${seed}`).toEqual(
          [...scale].sort(),
        );
      }
    }
  });

  it("prints the whole scale, in order, and marks the tagged answer", () => {
    for (const topic of GRAMMAR_TOPICS) {
      if (!grammarStyles(topic).includes("choose")) continue;
      const scale = topicOf(topic).options;
      if (!scale) throw new Error(`${topic} circles nothing`);
      const printed = questionsOn(
        config({ topic, style: "choose", count: 12 }),
      );
      expect(printed.length, topic).toBeGreaterThan(0);

      for (const question of printed) {
        // The same list on every line, in the same order — a page whose options
        // moved about is a page a child has to read five times.
        expect(question.options, question.prompt).toEqual(scale);
        expect(question.answer, question.prompt).toBeGreaterThanOrEqual(0);
        const chosen = question.options[question.answer];
        const entry =
          topic === "parts"
            ? BY_TEXT.get(/^(.*) — “.+”$/.exec(question.prompt)?.[1] ?? "")
            : BY_TEXT.get(question.prompt);
        if (!entry) throw new Error(`no sentence for "${question.prompt}"`);
        expect(chosen, question.prompt) //
          .toBe(topic === "parts" ? entry.focus?.part : entry.kind);
      }
    }
  });
});

/* ── What a panel is allowed to offer ──────────────────────────────────── */

describe("the styles a topic offers", () => {
  it("gives every topic at least one, and only where it has a list", () => {
    const known: GrammarStyle[] = ["write", "choose"];
    for (const topic of GRAMMAR_TOPICS) {
      const styles = grammarStyles(topic);
      expect(styles.length, topic).toBeGreaterThan(0);
      for (const style of styles) expect(known, topic).toContain(style);
      expect(new Set(styles).size, topic).toBe(styles.length);
      // A topic offers "circle one" exactly when there is something closed to
      // circle. An end mark, a capitalised word and a sentence cut in half are
      // none of them one of four things.
      expect(styles.includes("choose"), topic) //
        .toBe(topicOf(topic).options !== undefined);
    }
  });
});
