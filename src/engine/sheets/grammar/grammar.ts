/**
 * Grammar: five views of one tagged sentence. Nothing here analyses a sentence
 * — it draws entries out of `bank.ts` and reads what somebody wrote down about
 * them (§11).
 *
 * Two shapes of question fall out, a ruled place to write in or a fixed set of
 * names to circle one of, and **a topic offers the second only where the answer
 * really is one of a closed list.** There are five parts of speech and four
 * kinds of sentence; there is no closed list of capital letters, end marks or
 * ways to cut a sentence in half.
 */
import { mulberry32, shuffled } from "@/engine/random";

import type {
  Block,
  Choice,
  GrammarConfig,
  GrammarStyle,
  GrammarTopic,
  Mil,
  Problem,
  Sheet,
  SheetOptions,
} from "../types";

import { declaredWidth, packRows, sheetBlockBox } from "../chrome";
import { faceOf, fittedCharacters } from "../faces";
import {
  LIST_GAP,
  PROBLEM_GAP,
  WRAP_GAP,
  answerLine,
  columnWidth,
  fitAcross,
  type Box,
} from "../layout";
import { inches, own, points } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";

import { KINDS, PARTS, SENTENCES, lowered, stem } from "./bank";

/* ── What a row takes on the page ─────────────────────────────────────────
   Declared, not measured (§4). The same numbers `words/study.ts` reserves by,
   because it prints through the same two blocks.                            */

/** A sentence and its ruled slot, on one line of body type. */
const ROW_EMS = 1.7;

/** The row of options under a question — see `optionRows` for how many. */
const OPTIONS_EMS = 1.4;

/** `.sheet__slot` in sheet.css is this wide before anything is written in it. */
const SLOT_WIDTH: Mil = inches(0.8);

/** Room for the "12." a numbered list prints in front of every sentence. */
const NUMBER_CHARACTERS = 3;

/** `.sheet__options` indents by this and sets this between its items. */
const OPTIONS_INDENT: Mil = inches(0.3);
const OPTIONS_GAP: Mil = inches(0.3);

/** The `A`, `B`, `C` in front of an option, and the air after it. */
const MARK_TEXT = "A";
const MARK_GAP: Mil = inches(0.05);

/**
 * More than two columns of sentences is a page nobody can read.
 *
 * Lower than every maths family's cap and lower than word study's three,
 * because what is in the cell is a whole sentence rather than a sum: at three
 * columns on Letter a cell holds about twenty characters, so every row wraps to
 * four lines and the page holds five questions. This is where the arithmetic
 * stops giving anything back, rather than a taste judgement.
 */
const MAX_COLUMNS = 2;

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/* ── A question, whatever topic it came from ──────────────────────────────── */

/**
 * One thing to ask about one sentence.
 *
 * `ask` is what is printed, and unlike `words/study.ts` there is no second
 * "cue" field beside it: a grammar question is the sentence, and the sentence
 * reads the same above a row of options as it does in front of a ruled slot.
 * The verb that changes between the two shapes lives in the instruction line.
 *
 * `lines` is where the answer is more than one thing to write — the two halves
 * of a sentence, a ruled line each. `answer` carries the same halves on one
 * line, built from the same array so the two cannot disagree
 * (`Problem.answers`).
 */
type Question = { ask: string; answer: string; lines?: string[] };

type Topic = {
  /** How the topic is named in a picker and in `describe`. */
  label: string;
  /** The sheet's own title. */
  title: string;
  /**
   * The styles this topic can honestly be asked in, its default first.
   *
   * A style a topic does not offer is not an error — a saved sheet outlives the
   * table below (§3) — so `styleOf` resolves it to the first of these rather
   * than refusing to print.
   */
  styles: GrammarStyle[];
  /** The line at the top of the page. Per style, because the verb changes. */
  instruction: Partial<Record<GrammarStyle, string>>;
  questions: Question[];
  /**
   * The closed list of names this topic's answer is one of.
   *
   * Always a scale, never a draw of near misses, which is the one way a grammar
   * `choose` sheet is *safer* than a word-study one: the five parts of speech
   * are the options on every line whatever the sentence, so no distractor can
   * quietly also be right. A topic with no such list has no `choose` style.
   */
  options?: string[];
  /**
   * How many ruled lines the answer is written on, when it is not a slot.
   *
   * Zero everywhere but the subject-and-predicate sheet, whose two lines are
   * what make the question markable: the split is exhaustive, so a child who
   * writes only the head noun has left the rest of the subject with nowhere to
   * go. See the house rules in `bank.ts`.
   */
  lines: number;
};

/* ── The five topics ─────────────────────────────────────────────────────── */

/**
 * The word being asked about, printed after the sentence it sits in.
 *
 * In quotation marks rather than bold, because a `Problem.prompt` is plain text
 * and always will be — a renderer that took markup could be handed a sentence
 * with a tag in it.
 */
const asked = (text: string, word: string): string => `${text} — “${word}”`;

const partsOfSpeech = (): Question[] =>
  SENTENCES.flatMap((entry) =>
    entry.focus
      ? [{ ask: asked(entry.text, entry.focus.word), answer: entry.focus.part }]
      : [],
  );

const subjects = (): Question[] =>
  SENTENCES.flatMap((entry) =>
    entry.split
      ? [
          {
            ask: entry.text,
            answer: `${entry.split.subject} / ${entry.split.predicate}`,
            lines: [entry.split.subject, entry.split.predicate],
          },
        ]
      : [],
  );

const kinds = (): Question[] =>
  SENTENCES.map((entry) => ({ ask: entry.text, answer: entry.kind }));

/**
 * The sentence with its end mark taken off, and the mark as the answer.
 *
 * The mark is read off the *sentence* rather than looked up from its kind: what
 * a child writes has to match what the sentence actually ends on. That the
 * character always agrees with the kind is then a claim about the bank, which
 * `grammar.test.ts` checks from the other side — the tag, not the string.
 *
 * Exclamations are left out entirely, because a topic that cannot say which of
 * two marks is right has no business printing a key.
 */
const endMarks = (): Question[] =>
  SENTENCES.filter((entry) => entry.kind !== "exclamation").map((entry) => ({
    ask: stem(entry),
    answer: entry.text.slice(-1),
  }));

const capitals = (): Question[] =>
  SENTENCES.flatMap((entry) =>
    entry.proper ? [{ ask: lowered(entry), answer: entry.proper }] : [],
  );

const TOPICS: Record<GrammarTopic, Topic> = {
  parts: {
    label: "Parts of speech",
    title: "Parts of speech",
    styles: ["choose", "write"],
    instruction: {
      choose:
        "Circle what the word in quotation marks is in the sentence beside it.",
      write:
        "Write what the word in quotation marks is: noun, verb, adjective, adverb or pronoun.",
    },
    questions: partsOfSpeech(),
    options: PARTS,
    lines: 0,
  },
  subject: {
    label: "Subject and predicate",
    title: "Subject and predicate",
    styles: ["write"],
    instruction: {
      write:
        "Write the subject of each sentence on the first line and the predicate on the second. Every word goes on one line or the other.",
    },
    questions: subjects(),
    lines: 2,
  },
  types: {
    label: "Kinds of sentence",
    title: "Kinds of sentence",
    styles: ["choose", "write"],
    instruction: {
      choose:
        "Circle what each sentence is: a statement, a question, a command or an exclamation.",
      write:
        "Write what each sentence is: a statement, a question, a command or an exclamation.",
    },
    questions: kinds(),
    options: KINDS,
    lines: 0,
  },
  punctuation: {
    label: "End punctuation",
    title: "The mark at the end",
    styles: ["write"],
    instruction: {
      write:
        "Write the full stop or the question mark that belongs at the end of each sentence.",
    },
    questions: endMarks(),
    lines: 0,
  },
  capitals: {
    label: "Capital letters",
    title: "Capital letters",
    styles: ["write"],
    instruction: {
      write:
        "One word in each sentence should start with a capital letter. Write that word correctly on the line.",
    },
    questions: capitals(),
    lines: 0,
  },
};

/** Every topic, for a picker and for the catalog. */
export const GRAMMAR_TOPICS: GrammarTopic[] = Object.keys(
  TOPICS,
) as GrammarTopic[];

/**
 * The topic a config names, or parts of speech if this build has never heard of
 * it. Never throws, for the reason `sheetSpec` doesn't.
 */
export const topicOf = (topic: string): Topic =>
  own(TOPICS, topic, TOPICS.parts);

/** What a topic is called, and which styles it can be asked in. */
export const grammarTopicLabel = (topic: string): string =>
  topicOf(topic).label;
export const grammarStyles = (topic: string): GrammarStyle[] =>
  topicOf(topic).styles;

/** The style this config will actually print in — see `Topic.styles`. */
export const styleOf = (config: GrammarConfig): GrammarStyle => {
  const { styles } = topicOf(config.topic);
  return styles.includes(config.style) ? config.style : styles[0];
};

/* ── The page ──────────────────────────────────────────────────────────── */

/**
 * How many lines the longest sentence in a topic wraps onto.
 *
 * Taken over the whole bank rather than over the sentences that were drawn,
 * because the reservation is made before the draw: a row height that depended
 * on the seed would be a layout that disagreed with its own arithmetic from one
 * sheet to the next. It over-reserves on a page whose longest sentence stayed
 * in the bank, which is the cheap side to be wrong on (`chrome.ts`).
 */
function promptRows(
  topic: Topic,
  config: GrammarConfig,
  cell: Mil,
  slot: boolean,
): number {
  const across = fittedCharacters(
    Math.max(1, cell - (slot ? SLOT_WIDTH : 0)),
    points(config.fontPt),
    faceOf(config.font),
  );
  const longest = topic.questions.reduce(
    (most, question) => Math.max(most, question.ask.length),
    0,
  );
  return Math.max(1, Math.ceil((longest + NUMBER_CHARACTERS) / across));
}

/**
 * How many rows the options wrap onto.
 *
 * `words/study.ts` reserves one flat row for four short words and gets away
 * with it; four sentence-type names run to thirty-five characters, which is
 * wider than either paper at the largest type a config may ask for. So it is
 * counted the way `.sheet__options` actually packs — greedily, item by item,
 * each item its own label plus its `A.` mark — rather than assumed.
 */
function optionRows(topic: Topic, config: GrammarConfig, cell: Mil): number {
  const options = topic.options ?? [];
  if (options.length === 0) return 0;
  const mark = declaredWidth(MARK_TEXT, config, 1) + MARK_GAP;
  return packRows(
    options.map((option) => declaredWidth(option, config, 1) + mark),
    Math.max(1, cell - OPTIONS_INDENT),
    OPTIONS_GAP,
  );
}

/**
 * How many across this topic may be laid out.
 *
 * One for the sentence that is cut in half, whatever the config says. Its
 * answer is two ruled lines the width of the column, and `.sheet__answer-line`
 * does not wrap — so a predicate in a half-width column is a predicate with its
 * end cut off, which looks like a sheet rather than like a bug.
 */
const columnsFor = (topic: Topic): number =>
  topic.lines > 0 ? 1 : MAX_COLUMNS;

/**
 * The widest a topic may be laid out, for a panel that has to offer it.
 *
 * Exported so the options panel reads the rule rather than restating it: a
 * sixth topic with ruled answer lines would otherwise get a columns stepper the
 * engine silently ignores, and the panel disagreeing with the paper is the one
 * thing the builder's live preview cannot show a parent.
 */
export const grammarColumns = (topic: string): number =>
  columnsFor(topicOf(topic));

/** How many sentences the paper holds, and how wide a column of them is (§4). */
export function grammarLayout(config: GrammarConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
} {
  // Against the header the sheet will print rather than the one the config
  // holds, as `words/study.ts` does: reserving for the wrong header is a last
  // row below the bottom margin, invisible on screen and a second sheet.
  const box = sheetBlockBox(headerOf(config), true);
  const topic = topicOf(config.topic);
  const write = styleOf(config) === "write";
  const columns = write ? clamp(config.columns, 1, columnsFor(topic)) : 1;
  const cell = columnWidth(box, columns, PROBLEM_GAP.x);
  // The slot is only on the end of a prompt that has no ruled lines under it:
  // a problem has exactly one place to write the answer (`Problems.tsx`).
  const prompt = promptRows(topic, config, cell, write && topic.lines === 0);

  const row = write
    ? points(config.fontPt * ROW_EMS * prompt) +
      (topic.lines > 0 ? WRAP_GAP + topic.lines * answerLine(config.fontPt) : 0)
    : points(
        config.fontPt *
          (ROW_EMS * prompt + OPTIONS_EMS * optionRows(topic, config, cell)),
      );

  return {
    box,
    columns,
    cell,
    row,
    perPage:
      columns * fitAcross(box.height, row, write ? PROBLEM_GAP.y : LIST_GAP),
  };
}

/**
 * The sentences this sheet asks about, drawn from the topic by the seed.
 *
 * Shuffled rather than taken in order, because the bank is written in kind
 * order — every statement first — and a sentence-types sheet of the first
 * twelve would be a sheet with one answer on it. Never more than the bank holds
 * and never more than the page holds, so the count is a request.
 *
 * **The scale is covered rather than hoped for.** A shuffle-and-slice is fair
 * over many pages and says nothing about any one of them: a sentence-types
 * sheet drawn at random comes up with no command about one page in six, on the
 * page whose whole exercise is telling a command from a statement. Every item
 * on such a page is still correct, which is what makes it the worse bug. So
 * where the topic answers to a closed list and there is room for one of each,
 * one of each is drawn first, off the same stream; the rest of the page is
 * filled from what is left and the whole is shuffled again, so the guaranteed
 * items are not the first `options.length` rows every time.
 */
export function grammarQuestions(
  config: GrammarConfig,
  seed: number,
): Question[] {
  const { questions, options } = topicOf(config.topic);
  const { perPage } = grammarLayout(config);
  const room = Math.min(perPage, questions.length);
  const wanted = clamp(config.count ?? room, 0, room);

  const rand = mulberry32(seed);
  const pool = shuffled(questions, rand);
  // Too small a page to hold the scale: a four-question sheet cannot show five
  // parts of speech, and pretending otherwise would be dropping a question.
  if (!options || wanted < options.length) return pool.slice(0, wanted);

  const covered = new Set<string>();
  const first: Question[] = [];
  const rest: Question[] = [];
  for (const question of pool) {
    const fresh =
      options.includes(question.answer) && !covered.has(question.answer);
    if (fresh) covered.add(question.answer);
    (fresh ? first : rest).push(question);
  }
  return shuffled([...first, ...rest.slice(0, wanted - first.length)], rand);
}

/** A sentence and the place its answer goes: a ruled slot, or ruled lines. */
const written = (question: Question, config: GrammarConfig): Problem =>
  question.lines
    ? {
        prompt: question.ask,
        answer: question.answer,
        answers: question.lines,
        // The height those lines share, not blank paper under them —
        // `grammarLayout` reserves exactly this number.
        workspace: question.lines.length * answerLine(config.fontPt),
      }
    : { prompt: question.ask, answer: question.answer };

/**
 * A sentence with the closed list of names beside it.
 *
 * The options are the topic's whole vocabulary in the topic's own order, on
 * every line: no shuffle, because a page whose five options moved about from
 * line to line is a page a child has to re-read five times — and no near misses
 * drawn from the other questions, because a distractor out of another
 * sentence's answer is the one thing this family cannot risk.
 */
const circled = (question: Question, topic: Topic): Choice => {
  const options = topic.options ?? [];
  return {
    prompt: question.ask,
    options,
    answer: options.indexOf(question.answer),
  };
};

function bodyOf(
  config: GrammarConfig,
  seed: number,
): { blocks: Block[]; outOf: number } {
  const topic = topicOf(config.topic);
  const drawn = grammarQuestions(config, seed);
  const outOf = drawn.length;

  if (styleOf(config) === "choose") {
    return {
      blocks: [
        {
          kind: "choice",
          questions: drawn.map((question) => circled(question, topic)),
        },
      ],
      outOf,
    };
  }

  const { columns } = grammarLayout(config);
  return {
    blocks: [
      {
        kind: "problems",
        columns,
        items: drawn.map((question) => written(question, config)),
      },
    ],
    outOf,
  };
}

/* ── What it is called ─────────────────────────────────────────────────── */

/** How the style reads in a description, in the terms a parent chose it by. */
const STYLE_WORDS: Record<GrammarStyle, string> = {
  write: "written in",
  choose: "circled",
};

/**
 * The header this sheet will actually print.
 *
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page.
 */
function headerOf(config: GrammarConfig): SheetOptions {
  const topic = topicOf(config.topic);
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? topic.title,
    instructions: config.instructions ?? topic.instruction[styleOf(config)],
  };
}

/** One line naming what the sheet holds, in the terms it was chosen by. */
export function describeGrammar(config: GrammarConfig): string {
  const topic = topicOf(config.topic);
  // What the sheet will print rather than what was asked for, and by the same
  // arithmetic the build uses — a line that promised twenty over a page of
  // fourteen would be wrong in the record book and in the picker at once.
  const room = Math.min(grammarLayout(config).perPage, topic.questions.length);
  const asked = clamp(config.count ?? room, 0, room);
  return [
    topic.label,
    `${asked} ${asked === 1 ? "sentence" : "sentences"}`,
    STYLE_WORDS[styleOf(config)],
  ].join(" — ");
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

export function buildGrammarSheet(config: GrammarConfig, seed: number): Sheet {
  const head = headerOf(config);
  const { blocks, outOf } = bodyOf(config, seed);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
      // Out of what is on the page rather than what was asked for: a sheet
      // that says "/ 20" over eighteen questions is wrong twice.
      score: { outOf },
    },
    blocks,
    // The site itself, not a game: §16's footer URL is the game that *matches*
    // the sheet, and there is no grammar race for this one to point at.
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const GRAMMAR_SHEET: SheetSpec<GrammarConfig> = {
  id: "grammar",
  label: "Grammar",
  world: SHEET_WORLD,
  build: buildGrammarSheet,
  // Every answer was decided when the sheet was built — which sentences were
  // drawn, and which tag each was asked about — so a key cannot disagree with
  // its sheet.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeGrammar,
};
