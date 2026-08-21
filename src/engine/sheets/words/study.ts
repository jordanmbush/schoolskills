/**
 * Word study: the ten lessons about words that are not spelling a list, and the
 * mirror image of `spelling.ts` — there the content is a parent's, here it is
 * ours, out of the authored bank beside this file (§11).
 *
 * One family rather than ten, because every topic reduces to the same
 * three-field question and from that the three shapes of sheet fall out: a
 * prompt with a ruled slot, four options to circle, or two columns to join with
 * a pencil. What a topic *cannot* honestly be asked in it does not offer
 * (`Topic.styles`).
 */
import { mulberry32, shuffled } from "@/engine/random";

import type {
  Block,
  Choice,
  Mil,
  Problem,
  Sheet,
  SheetOptions,
  WordStudyConfig,
  WordStudyStyle,
  WordStudyTopic,
} from "../types";

import { sheetBlockBox } from "../chrome";
import { faceOf, fittedCharacters } from "../faces";
import {
  LIST_GAP,
  MATCH_ROW_EMS,
  PROBLEM_GAP,
  columnWidth,
  fitAcross,
  type Box,
} from "../layout";
import { inches, own, points } from "../paper";
import { SHEET_CREDIT, SHEET_WORLD, gameUrl, type SheetSpec } from "../spec";

import {
  ANTONYMS,
  CONTRACTIONS,
  FAMILIES,
  HOMOPHONES,
  MAX_SYLLABLES,
  PLURALS,
  PREFIXES,
  SUFFIXES,
  SYLLABLES,
  SYNONYMS,
  familyWords,
  type Meaning,
  type Sum,
} from "./bank";

/* ── What a row takes on the page ─────────────────────────────────────────
   Declared, not measured (§4). The same numbers `spelling.ts` reserves by,
   because the blocks are the same blocks.                                    */

/** A prompt and its ruled slot, on one line of body type. */
const ROW_EMS = 1.7;

/** A question and the row of options under it — see `spelling.ts`. */
const CHOICE_EMS = 3.1;

/** `.sheet__slot` in sheet.css is this wide before anything is written in it. */
const SLOT_WIDTH: Mil = inches(0.8);

/** Room for the "12." a numbered list prints in front of every prompt. */
const NUMBER_CHARACTERS = 3;

/** The answer and three near misses — the same four the race deals. */
const CHOICES = 4;

/** More than three columns of words is a page nobody can write on. */
const MAX_COLUMNS = 3;

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/* ── A question, whatever topic it came from ──────────────────────────────── */

/**
 * One thing to ask, in the three forms a sheet needs it in.
 *
 * `ask` is the sentence a `write` sheet prints — "un + happy =", "one box,
 * two _" — and carries a `_` where the answer belongs inside it rather than
 * after it, the convention `Problem.prompt` already uses. `cue` is the same
 * question with the scaffolding off, for the left of a matching column and the
 * line above a row of options, where the instruction has said the verb already.
 */
type Question = { ask: string; cue: string; answer: string };

type Topic = {
  /** How the topic is named in a picker and in `describe`. */
  label: string;
  /** The sheet's own title. */
  title: string;
  /**
   * The styles this topic can honestly be asked in, its default first.
   *
   * A style a topic does not offer is not an error — a saved sheet outlives the
   * table below, exactly as it outlives the registry (§3) — so `styleOf`
   * resolves it to the first of these rather than refusing to print.
   */
  styles: WordStudyStyle[];
  /** The line at the top of the page. Per style, because the verb changes. */
  instruction: Partial<Record<WordStudyStyle, string>>;
  questions: Question[];
  /**
   * Where the options are a fixed scale rather than other answers.
   *
   * A syllable sheet offers one, two, three or four in that order: drawing three
   * "near misses" from the other questions would offer a child the numbers 1, 4
   * and 2 and call it a choice.
   */
  options?: string[];
};

/* ── The ten topics ──────────────────────────────────────────────────────── */

/**
 * Rhyming, one question to a family.
 *
 * One per family and never two: the whole point of a rime is that every word in
 * the family answers it, so a matching column of "cat" and "hat" against "mat"
 * and "bat" is a question with two right answers.
 */
const rhymes = (): Question[] =>
  FAMILIES.map((family) => {
    const [first, second] = familyWords(family);
    return { ask: first, cue: first, answer: second };
  });

/** Word families, as the sum a child is shown: an onset, a rime, a word. */
const blends = (): Question[] =>
  FAMILIES.flatMap((family) =>
    family.onsets.map((onset) => ({
      ask: `${onset} + ${family.rime} =`,
      cue: `${onset} + ${family.rime}`,
      answer: `${onset}${family.rime}`,
    })),
  );

const syllables = (): Question[] =>
  SYLLABLES.map(({ word, syllables: count }) => ({
    ask: word,
    cue: word,
    answer: String(count),
  }));

/**
 * A prefix or a suffix, added on the side it goes on: `un + happy` but
 * `care + ful`, because which end the part joins is the difference between the
 * two topics.
 */
const sums = (list: Sum[], before: boolean): Question[] =>
  list.map(({ part, base, word }) => {
    const cue = before ? `${part} + ${base}` : `${base} + ${part}`;
    return { ask: `${cue} =`, cue, answer: word };
  });

const plurals = (): Question[] =>
  PLURALS.map(({ one, many }) => ({
    ask: `one ${one}, two _`,
    cue: one,
    answer: many,
  }));

const contractions = (): Question[] =>
  CONTRACTIONS.map(({ words, short }) => ({
    ask: `${words} =`,
    cue: words,
    answer: short,
  }));

/**
 * A homophone, as a sentence with the pair printed beside it.
 *
 * The pair rides on `ask` rather than on the instruction line because every
 * sentence has a different pair — the same reason a clue does in
 * `wordlists.ts`.
 */
const homophones = (): Question[] =>
  HOMOPHONES.map(({ pair, sentence, answer }) => ({
    ask: `${sentence} (${pair[0]} / ${pair[1]})`,
    cue: sentence,
    answer,
  }));

const meanings = (list: Meaning[]): Question[] =>
  list.map(({ word, match }) => ({ ask: word, cue: word, answer: match }));

const TOPICS: Record<WordStudyTopic, Topic> = {
  rhyming: {
    label: "Rhyming words",
    title: "Rhyming words",
    styles: ["choose", "match"],
    instruction: {
      choose: "Circle the word that rhymes with the word on the left.",
      match: "Join each word to the word that rhymes with it.",
    },
    questions: rhymes(),
  },
  syllables: {
    label: "Syllables",
    title: "Syllables",
    styles: ["write", "choose"],
    instruction: {
      write: "Write how many syllables you can hear in each word.",
      choose: "Circle how many syllables you can hear in each word.",
    },
    questions: syllables(),
    options: Array.from({ length: MAX_SYLLABLES }, (_, at) => String(at + 1)),
  },
  families: {
    label: "Word families",
    title: "Word families",
    styles: ["write"],
    instruction: {
      write: "Add the letters together and write the word they make.",
    },
    questions: blends(),
  },
  prefixes: {
    label: "Prefixes",
    title: "Prefixes",
    styles: ["write"],
    instruction: {
      write: "Add the beginning to each word and write the new word.",
    },
    questions: sums(PREFIXES, true),
  },
  suffixes: {
    label: "Suffixes",
    title: "Suffixes",
    styles: ["write"],
    instruction: {
      write:
        "Add the ending to each word and write the new word. Some of the words change before the ending goes on.",
    },
    questions: sums(SUFFIXES, false),
  },
  plurals: {
    label: "Plurals",
    title: "One and more than one",
    styles: ["write", "match"],
    instruction: {
      write: "Write each word as more than one.",
      match:
        "Join each word to the way it is written when there is more than one.",
    },
    questions: plurals(),
  },
  contractions: {
    label: "Contractions",
    title: "Contractions",
    styles: ["write", "match"],
    instruction: {
      write:
        "Write the two words as one, with an apostrophe where the missing letters were.",
      match: "Join each pair of words to the short form it makes.",
    },
    questions: contractions(),
  },
  homophones: {
    label: "Homophones",
    title: "Homophones",
    styles: ["write"],
    instruction: {
      write: "Write the word from the pair that belongs in the sentence.",
    },
    questions: homophones(),
  },
  synonyms: {
    label: "Synonyms",
    title: "Words that mean the same",
    styles: ["choose", "match"],
    instruction: {
      choose: "Circle the word that means the same as the word on the left.",
      match: "Join each word to a word that means the same.",
    },
    questions: meanings(SYNONYMS),
  },
  antonyms: {
    label: "Antonyms",
    title: "Words that mean the opposite",
    styles: ["choose", "match"],
    instruction: {
      choose: "Circle the word that means the opposite.",
      match: "Join each word to the word that means the opposite.",
    },
    questions: meanings(ANTONYMS),
  },
};

/** Every topic, for a picker and for the catalog. */
export const STUDY_TOPICS: WordStudyTopic[] = Object.keys(
  TOPICS,
) as WordStudyTopic[];

/**
 * The topic a config names, or rhyming if this build has never heard of it.
 *
 * Never throws, for the reason `sheetSpec` doesn't: the id arrives from a saved
 * sheet or from a link somebody was sent, and a page that prints something is
 * worth more than an exception inside a build.
 */
export const topicOf = (topic: string): Topic =>
  own(TOPICS, topic, TOPICS.rhyming);

/** What a topic is called, and which styles it can be asked in. */
export const studyTopicLabel = (topic: string): string => topicOf(topic).label;
export const studyStyles = (topic: string): WordStudyStyle[] =>
  topicOf(topic).styles;

/** The style this config will actually print in — see `Topic.styles`. */
export const styleOf = (config: WordStudyConfig): WordStudyStyle => {
  const { styles } = topicOf(config.topic);
  return styles.includes(config.style) ? config.style : styles[0];
};

/* ── The page ──────────────────────────────────────────────────────────── */

/**
 * How many lines the longest prompt in a topic wraps onto.
 *
 * Taken over the whole bank rather than over the questions that were drawn,
 * because the reservation is made before the draw: a row height that depended
 * on the seed would be a layout that disagreed with its own arithmetic from one
 * sheet to the next. It over-reserves by a line on a page whose longest
 * homophone sentence stayed in the bank, which is the cheap side to be wrong on
 * (`chrome.ts`).
 */
function promptRows(topic: Topic, config: WordStudyConfig, cell: Mil): number {
  const across = fittedCharacters(
    Math.max(1, cell - SLOT_WIDTH),
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
 * How many questions the paper holds, and how wide a column of them is (§4).
 *
 * The three styles are three different shapes of page: a grid of prompts across
 * it, a list of choices down it, or two columns of pairs the width of the
 * paper.
 */
export function studyLayout(config: WordStudyConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
} {
  // Against the header the sheet will print rather than the one the config
  // holds, as `spelling.ts` does: reserving for the wrong header is a last row
  // below the bottom margin, invisible on screen and a second sheet of paper.
  const box = sheetBlockBox(headerOf(config), true);
  const topic = topicOf(config.topic);
  const style = styleOf(config);
  const write = style === "write";
  const columns = write ? clamp(config.columns, 1, MAX_COLUMNS) : 1;
  const cell = columnWidth(box, columns, PROBLEM_GAP.x);

  const row = points(
    config.fontPt *
      (style === "match"
        ? MATCH_ROW_EMS
        : style === "choose"
          ? CHOICE_EMS
          : ROW_EMS * promptRows(topic, config, cell)),
  );
  // A matching block draws its own rows one under another with nothing between
  // them, so there is no gap to pay for; the other two are lists with one.
  const gap = style === "match" ? 0 : write ? PROBLEM_GAP.y : LIST_GAP;

  return {
    box,
    columns,
    cell,
    row,
    perPage: columns * fitAcross(box.height, row, gap),
  };
}

/**
 * The questions this sheet prints, drawn from the topic's bank by the seed.
 *
 * Shuffled rather than taken in order, because the bank is written in teaching
 * order — every plain `-s` plural first — and a sheet of the first twelve would
 * be a sheet of the easy half. Never more than the bank holds and never more
 * than the page holds, so the count is a request rather than a promise.
 */
export function studyQuestions(
  config: WordStudyConfig,
  seed: number,
): Question[] {
  const { questions } = topicOf(config.topic);
  const { perPage } = studyLayout(config);
  const room = Math.min(perPage, questions.length);
  const wanted = clamp(config.count ?? room, 0, room);
  return shuffled(questions, mulberry32(seed)).slice(0, wanted);
}

/** A prompt and a ruled slot — the shape of every `write` sheet. */
const written = (question: Question): Problem => ({
  prompt: question.ask,
  answer: question.answer,
});

/**
 * A question with four things it could be.
 *
 * The near misses are the other answers in the same topic, which is what makes
 * them near: the opposite of "hot" is asked against "small", "night" and
 * "slow". That the three are never *also* right is a fact about the bank rather
 * than about this function — see the house rules in `bank.ts`.
 */
function chosen(question: Question, topic: Topic, rand: () => number): Choice {
  if (topic.options) {
    return {
      prompt: question.cue,
      options: topic.options,
      answer: topic.options.indexOf(question.answer),
    };
  }
  const others = topic.questions
    .map((other) => other.answer)
    .filter((answer) => answer !== question.answer);
  const options = shuffled(
    [question.answer, ...shuffled(others, rand).slice(0, CHOICES - 1)],
    rand,
  );
  return {
    prompt: question.cue,
    options,
    answer: options.indexOf(question.answer),
  };
}

function bodyOf(
  config: WordStudyConfig,
  seed: number,
): { blocks: Block[]; outOf: number } {
  const topic = topicOf(config.topic);
  const drawn = studyQuestions(config, seed);
  const outOf = drawn.length;
  const style = styleOf(config);
  // A second generator off the same seed — `studyQuestions` made its own for
  // the draw and this one shuffles the options. Reproducibility comes from the
  // seed being fixed rather than from there being a single sequence (§7). What
  // it costs is that the options replay values the draw already spent, which is
  // harmless here, but anything wanting the two streams to be independent has
  // to thread one generator through instead.
  const rand = mulberry32(seed);

  if (style === "choose") {
    const questions = drawn.map((question) => chosen(question, topic, rand));
    return { blocks: [{ kind: "choice", questions }], outOf };
  }

  if (style === "match") {
    // The right column is shuffled and the left is not: the left is the order
    // the questions were drawn in, and a matching sheet whose columns lined up
    // would be a sheet a child could answer with a ruler.
    const right = shuffled(
      drawn.map((question) => question.answer),
      rand,
    );
    return {
      blocks: [
        {
          kind: "matching",
          left: drawn.map((question) => question.cue),
          right,
          answer: drawn.map((question) => right.indexOf(question.answer)),
        },
      ],
      outOf,
    };
  }

  const { columns } = studyLayout(config);
  return {
    blocks: [{ kind: "problems", columns, items: drawn.map(written) }],
    outOf,
  };
}

/* ── What it is called ─────────────────────────────────────────────────── */

/** How the style reads in a description, in the terms a parent chose it by. */
const STYLE_WORDS: Record<WordStudyStyle, string> = {
  write: "written in",
  choose: "circled",
  match: "joined up",
};

/**
 * The header this sheet will actually print.
 *
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page. `config.title` is an override
 * and is usually absent — a family names its own sheet.
 */
function headerOf(config: WordStudyConfig): SheetOptions {
  const topic = topicOf(config.topic);
  const style = styleOf(config);
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? topic.title,
    instructions: config.instructions ?? topic.instruction[style],
  };
}

/** One line naming what the sheet holds, in the terms it was chosen by. */
export function describeStudy(config: WordStudyConfig): string {
  const topic = topicOf(config.topic);
  // What the sheet will print rather than what was asked for, and by the same
  // arithmetic the build uses — a line that promised twenty over a page of
  // fourteen would be wrong in the record book and in the picker at once.
  const room = Math.min(studyLayout(config).perPage, topic.questions.length);
  const asked = clamp(config.count ?? room, 0, room);
  return [
    topic.label,
    `${asked} ${asked === 1 ? "question" : "questions"}`,
    STYLE_WORDS[styleOf(config)],
  ].join(" — ");
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

export function buildStudySheet(config: WordStudyConfig, seed: number): Sheet {
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
    // The jungle, as a spelling sheet does: a child who has just sorted twenty
    // plurals on paper is the one likeliest to run the word race (§16).
    footer: { credit: SHEET_CREDIT, url: gameUrl("jungle"), seed },
    answers: false,
  };
}

export const WORD_STUDY_SHEET: SheetSpec<WordStudyConfig> = {
  world: SHEET_WORLD,
  build: buildStudySheet,
  // Every answer was decided when the sheet was built — which questions were
  // drawn, which options they were printed against, which column the pair
  // landed in — so a key cannot disagree with its sheet.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeStudy,
};
