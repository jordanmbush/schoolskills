import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import type { Block, GrammarConfig, GrammarStyle, Paper } from "../types";

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

const blockOf = (one: GrammarConfig, seed = 1): Block =>
  buildSheet(one, seed).blocks[0];

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

describe("the grammar family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("grammar")).toBe(GRAMMAR_SHEET);
    expect(sheetSpec("grammar").label).toBe("Grammar");
  });

  it("prints a titled, marked page for every topic and style", () => {
    for (const one of EVERY_SHEET) {
      const sheet = buildSheet(one, 1);
      expect(sheet.header.title, where(one)).not.toBe("");
      expect(sheet.header.instructions, where(one)).toBeTruthy();
      // Marked out of what is on the page rather than out of what was asked
      // for: a subject-and-predicate sheet spends three lines on every sentence
      // and holds eight of them, and "/ 10" over eight is wrong twice.
      const room = Math.min(
        one.count,
        grammarLayout(one).perPage,
        topicOf(one.topic).questions.length,
      );
      expect(room, where(one)).toBeGreaterThan(5);
      expect(sheet.header.score?.outOf, where(one)).toBe(room);
      expect(sheet.blocks, where(one)).toHaveLength(1);
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

  it("never prints more sentences than the paper holds", () => {
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
          const { perPage } = grammarLayout(big);
          const printed = countOf(blockOf(big));
          expect(printed, `${where(one)} ${size}@${fontPt}`) //
            .toBeLessThanOrEqual(perPage);
          // And never more than the bank has, which is the other cap.
          expect(printed, where(one)) //
            .toBeLessThanOrEqual(topicOf(one.topic).questions.length);
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

/** The `problems` block of a written sheet, narrowed. */
function itemsOf(topic: string) {
  const block = blockOf(config({ topic: topic as never, style: "write" }), 3);
  if (block.kind !== "problems") throw new Error(`got ${block.kind}`);
  expect(block.items.length, topic).toBeGreaterThan(0);
  return block.items;
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
        const block = blockOf(
          config({ topic, style: "choose", count: 12 }),
          seed,
        );
        if (block.kind !== "choice") throw new Error("expected choice");
        const drawn = new Set(
          block.questions.map((question) => question.options[question.answer]),
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
      const block = blockOf(config({ topic, style: "choose", count: 12 }));
      if (block.kind !== "choice") throw new Error("expected choice");
      expect(block.questions.length, topic).toBeGreaterThan(0);

      for (const question of block.questions) {
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

/* ── The key ───────────────────────────────────────────────────────────── */

describe("the answer key", () => {
  it("is the same sheet keyed, never a second generation", () => {
    for (const one of EVERY_SHEET) {
      const sheet = buildSheet(one, 7);
      const key = answerKey(one, 7);
      expect(key.answers, where(one)).toBe(true);
      expect(key.footer.note, where(one)).toBe("Answer key");
      expect({ ...key, answers: false, footer: sheet.footer }, where(one)) //
        .toEqual(sheet);
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
