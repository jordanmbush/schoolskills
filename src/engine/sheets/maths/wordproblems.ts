/**
 * Word problems, from templates.
 *
 * The one place in the maths set where generated *text* is read by a person.
 * Everywhere else a template failure is a sum that looks odd; here it is a page
 * that reads as machinery — the worksheet farm §11 exists to keep out of the
 * shop, arrived at from the inside. So there are twenty templates, four to a
 * topic, and each one draws its own cast — a different child, a different thing
 * being counted — because a page of four templates wearing eight names reads as
 * eight questions and a page of one template wearing eight names reads as a form
 * letter.
 *
 * **Every number a story uses is printed in it, as digits.** Not for the child's
 * sake — for the key's. The suite reads the numbers back out of the sentence in
 * the order they appear and works the answer out with its own arithmetic, per
 * template, so a template whose story and answer disagree fails. A number
 * spelled out in words would be a number the check could not see, which is why
 * "four games" is the phrase and `4` is never the word.
 *
 * **No money.** Prices belong to `money.ts`, which has a currency switch,
 * because a British child counting dollars is being asked a question about a
 * foreign country. Everything here is counted in things, miles, pages and
 * points, which mean the same thing everywhere.
 *
 * **The row is declared, not measured (§4)** — and a story is the one problem in
 * the shop long enough for that to be a real reservation rather than a
 * formality. `MAX_TEXT` is the cap every template is held to by the suite, and
 * the layout reserves the lines that cap needs at the column width and type size
 * the sheet is actually set in.
 */
import { between, mulberry32, shuffled } from "@/engine/random";

import type {
  Mil,
  Problem,
  Sheet,
  SheetOptions,
  WordProblemConfig,
  WordTopic,
} from "../types";

import { sheetBlockBox } from "../chrome";
import {
  PROBLEM_GAP,
  answerLine,
  columnWidth,
  fitAcross,
  type Box,
} from "../layout";
import { inches, points } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import { signedText } from "./exact";

/* ── What a story takes on the page ───────────────────────────────────────
   Declared, not measured (§4).                                              */

/**
 * The longest a story may be, in characters.
 *
 * A cap rather than a measurement, because the layout has to know how tall a
 * row is before a single problem has been drawn — and because the alternative
 * is a page whose last row is decided by whichever template happened to come
 * out longest. The suite holds every template to it.
 */
export const MAX_TEXT = 150;

/**
 * How wide an average character is, as a fraction of the body size.
 *
 * The one estimate in the whole of the sheet engine, and it is deliberately
 * generous: half an em is wider than the average of Nunito's lower case, so the
 * reservation errs towards a line of air at the bottom of the page rather than
 * towards a row below the bottom margin. Print is the whole of the output path
 * (§10), so the two errors are not the same size.
 */
const CHAR_EM = 0.55;

/** The ruled blank a story is answered in — `.sheet__slot`, in this unit. */
const SLOT = inches(0.8);

/** Blank space to work a story out in. On unless a config turns it off. */
const WORKSPACE = inches(0.55);

/**
 * Two columns, and never three. A story is a sentence and a half, and a
 * sentence set in a third of a page is a paragraph.
 */
const MAX_COLUMNS = 2;

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

/* ── The cast ──────────────────────────────────────────────────────────────
   Names, things and places, drawn per problem. This is what stops four
   templates from reading as four templates: the arithmetic repeats twenty
   times on a page, and the reader has to not notice.                        */

const NAMES = [
  "Ava",
  "Ben",
  "Chloe",
  "Diego",
  "Emma",
  "Finn",
  "Grace",
  "Hugo",
  "Isla",
  "Jonah",
  "Kira",
  "Leo",
  "Maya",
  "Noah",
  "Priya",
  "Ravi",
  "Sofia",
  "Theo",
];

const THINGS = [
  "stickers",
  "marbles",
  "conkers",
  "pencils",
  "cards",
  "shells",
  "beads",
  "buttons",
  "acorns",
  "counters",
];

const PLACES = [
  "the chess club",
  "the swimming club",
  "the school choir",
  "the art club",
  "the running club",
];

/**
 * Somewhere a temperature belongs.
 *
 * A separate list from the clubs, because "the temperature in the art club" is
 * the sort of sentence that tells a reader immediately that nobody wrote it.
 */
const SPOTS = [
  "the mountains",
  "the valley",
  "the harbour",
  "the forest",
  "the city",
];

type Cast = { name: string; thing: string; place: string; spot: string };

/* ── Drawing a story ───────────────────────────────────────────────────── */

export type WordStory = {
  /** Which template made it — the suite's way of knowing what to check. */
  id: string;
  topic: WordTopic;
  text: string;
  answer: string;
};

type Range = { min: number; max: number };

type Template = {
  id: string;
  topic: WordTopic;
  draw(
    range: Range,
    cast: Cast,
    rand: () => number,
  ): { text: string; answer: string } | null;
};

/** The percentages a child is taught to do in their head. */
const PERCENTS = [5, 10, 20, 25, 40, 50, 60, 75];

const pick = <T>(items: readonly T[], rand: () => number): T =>
  items[Math.floor(rand() * items.length)];

/** A small number, for the times a story counts hours, days or friends. */
const few = (range: Range, rand: () => number): number =>
  between(2, Math.max(2, Math.min(9, range.max)), rand);

const story = (text: string, answer: number | string) => ({
  text,
  answer: typeof answer === "number" ? signedText(answer) : answer,
});

/**
 * The twenty templates.
 *
 * Each draws the numbers it needs, prints every one of them in its sentence,
 * and returns the answer worked out from the same numbers — or `null` when what
 * came out is not a question with a whole answer, which is the rejection every
 * generated family in the shop is built on.
 */
const TEMPLATES: Template[] = [
  /* ── Integers ───────────────────────────────────────────────────────── */
  {
    id: "temperature",
    topic: "integers",
    draw: (range, cast, rand) => {
      const noon = between(range.min, range.max, rand);
      const fall = between(range.min, range.max * 2, rand);
      return story(
        `The temperature in ${cast.spot} was ${noon}°C at noon. By midnight it had fallen ${fall} degrees. What was the temperature then?`,
        noon - fall,
      );
    },
  },
  {
    id: "height",
    topic: "integers",
    draw: (range, cast, rand) => {
      const above = between(range.min, range.max, rand);
      const down = between(range.min, range.max * 2, rand);
      return story(
        `${cast.name} is ${above} m above sea level and walks ${down} m down into a valley. How many metres above sea level is ${cast.name} now?`,
        above - down,
      );
    },
  },
  {
    id: "points",
    topic: "integers",
    draw: (range, cast, rand) => {
      const had = between(range.min, range.max, rand);
      const lost = between(range.min, range.max * 2, rand);
      return story(
        `${cast.name} had ${had} points and then lost ${lost} in one round. How many points does ${cast.name} have now?`,
        had - lost,
      );
    },
  },
  {
    id: "lift",
    topic: "integers",
    draw: (range, cast, rand) => {
      const below = between(1, Math.max(1, Math.min(6, range.max)), rand);
      const up = between(range.min, range.max, rand);
      return story(
        `${cast.name} gets into a lift on floor ${signedText(-below)} and rides up ${up} floors. Which floor does ${cast.name} get out on?`,
        up - below,
      );
    },
  },

  /* ── Rate ───────────────────────────────────────────────────────────── */
  {
    id: "speed",
    topic: "rate",
    draw: (range, cast, rand) => {
      const hours = few(range, rand);
      const each = between(Math.max(2, range.min), range.max, rand);
      return story(
        `A train travels ${each * hours} miles to ${cast.spot} in ${hours} hours. How far does it go in one hour?`,
        each,
      );
    },
  },
  {
    id: "boxes",
    topic: "rate",
    draw: (range, cast, rand) => {
      const boxes = few(range, rand);
      const each = between(Math.max(2, range.min), range.max, rand);
      return story(
        `${boxes} boxes hold ${each * boxes} ${cast.thing} altogether. How many ${cast.thing} are in one box?`,
        each,
      );
    },
  },
  {
    id: "recipe",
    topic: "rate",
    draw: (range, cast, rand) => {
      const cups = between(1, Math.max(1, Math.min(6, range.max)), rand);
      const made = few(range, rand);
      const by = between(2, 5, rand);
      return story(
        `${cast.name} uses ${cups} cups of flour to make ${made} muffins. How many cups are needed for ${made * by} muffins?`,
        cups * by,
      );
    },
  },
  {
    id: "reading",
    topic: "rate",
    draw: (range, cast, rand) => {
      const days = few(range, rand);
      const each = between(Math.max(2, range.min), range.max, rand);
      const more = few(range, rand);
      if (more === days) return null;
      return story(
        `${cast.name} reads ${each * days} pages in ${days} days. At that rate, how many pages will ${cast.name} read in ${more} days?`,
        each * more,
      );
    },
  },

  /* ── Percent ────────────────────────────────────────────────────────── */
  {
    id: "score",
    topic: "percent",
    draw: (range, cast, rand) => {
      const outOf = between(range.min, range.max, rand) * 4;
      const percent = pick(PERCENTS, rand);
      // Only the pairs that land on a whole number of marks: a test scored
      // 17.5 out of 25 is a question nobody set.
      if ((outOf * percent) % 100 !== 0) return null;
      return story(
        `${cast.name} scored ${(outOf * percent) / 100} out of ${outOf} in a spelling test. What percentage is that?`,
        percent,
      );
    },
  },
  {
    id: "share",
    topic: "percent",
    draw: (range, cast, rand) => {
      const total = between(range.min, range.max, rand) * 4;
      const percent = pick(PERCENTS, rand);
      if ((total * percent) % 100 !== 0) return null;
      return story(
        `There are ${total} children in ${cast.place}, and ${percent}% of them are left-handed. How many is that?`,
        (total * percent) / 100,
      );
    },
  },
  {
    id: "left",
    topic: "percent",
    draw: (range, cast, rand) => {
      const total = between(range.min, range.max, rand) * 4;
      const percent = pick(PERCENTS, rand);
      if ((total * percent) % 100 !== 0) return null;
      return story(
        `A library has ${total} books and ${percent}% of them are out on loan. How many can ${cast.name} still find on the shelf?`,
        (total * (100 - percent)) / 100,
      );
    },
  },
  {
    id: "increase",
    topic: "percent",
    draw: (range, cast, rand) => {
      const total = between(range.min, range.max, rand) * 4;
      const percent = pick(PERCENTS, rand);
      if ((total * percent) % 100 !== 0) return null;
      return story(
        `There were ${total} members in ${cast.place} and the number grew by ${percent}%. How many members are there now?`,
        (total * (100 + percent)) / 100,
      );
    },
  },

  /* ── Equations ──────────────────────────────────────────────────────── */
  {
    id: "think",
    topic: "equation",
    draw: (range, cast, rand) => {
      const by = few(range, rand);
      const number = between(range.min, range.max, rand);
      const plus = between(range.min, range.max, rand);
      return story(
        `${cast.name} thinks of a number, multiplies it by ${by} and then adds ${plus}. The answer is ${by * number + plus}. What was the number?`,
        number,
      );
    },
  },
  {
    id: "gave",
    topic: "equation",
    draw: (range, cast, rand) => {
      const away = between(range.min, range.max, rand);
      const left = between(range.min, range.max, rand);
      return story(
        `${cast.name} had some ${cast.thing}. After giving ${away} away, there are ${left} left. How many were there to start with?`,
        away + left,
      );
    },
  },
  {
    id: "shared",
    topic: "equation",
    draw: (range, cast, rand) => {
      const friends = few(range, rand);
      const each = between(Math.max(2, range.min), range.max, rand);
      return story(
        `${cast.name} shares a jar of ${cast.thing} equally between ${friends} friends. Each one gets ${each}. How many were in the jar?`,
        friends * each,
      );
    },
  },
  {
    id: "consecutive",
    topic: "equation",
    draw: (range, cast, rand) => {
      const smaller = between(range.min, range.max, rand);
      return story(
        `${cast.name} thinks of two whole numbers next to each other. They add up to ${smaller + smaller + 1}. What is the smaller one?`,
        smaller,
      );
    },
  },

  /* ── Averages ───────────────────────────────────────────────────────── */
  {
    id: "games",
    topic: "average",
    draw: (range, cast, rand) => {
      const scores = fourThatShare(range, 4, rand);
      if (scores === null) return null;
      const [a, b, c, d] = scores;
      return story(
        `${cast.name} scored ${a}, ${b}, ${c} and ${d} points in four games. What was the mean score?`,
        (a + b + c + d) / 4,
      );
    },
  },
  {
    id: "total",
    topic: "average",
    draw: (range, cast, rand) => {
      const how = few(range, rand);
      const mean = between(Math.max(2, range.min), range.max, rand);
      return story(
        `${cast.name} writes down ${how} numbers with a mean of ${mean}. What is the total of the ${how} numbers?`,
        how * mean,
      );
    },
  },
  {
    id: "spread",
    topic: "average",
    draw: (range, cast, rand) => {
      const times = [0, 1, 2, 3].map(() =>
        between(range.min, range.max * 2, rand),
      );
      const [least, most] = [Math.min(...times), Math.max(...times)];
      // Four times that are all the same have no range worth asking for.
      if (most === least) return null;
      return story(
        `${cast.name}'s times were ${times.slice(0, 3).join(", ")} and ${times[3]} seconds. What is the range of the times?`,
        most - least,
      );
    },
  },
  {
    id: "equally",
    topic: "average",
    draw: (range, cast, rand) => {
      const shares = fourThatShare(range, 3, rand);
      if (shares === null) return null;
      const [a, b, c] = shares;
      return story(
        `Three friends have ${a}, ${b} and ${c} ${cast.thing}. If they share them equally, how many does each one get?`,
        (a + b + c) / 3,
      );
    },
  },
];

/**
 * Numbers that share out exactly between `how` of them.
 *
 * The last one is what makes it work: the others are drawn and it is whatever
 * the total needs, which is how every mean in the shop is built (see
 * `statistics.ts`). It is checked back into the range afterwards, because a
 * story about a child scoring −3 points is not a story about averages.
 */
function fourThatShare(
  range: Range,
  how: number,
  rand: () => number,
): number[] | null {
  const drawn = Array.from({ length: how - 1 }, () =>
    between(range.min, range.max, rand),
  );
  const mean = between(range.min, range.max, rand);
  const last = mean * how - drawn.reduce((sum, value) => sum + value, 0);
  if (last < range.min || last > range.max) return null;
  return [...drawn, last];
}

/* ── The pool ──────────────────────────────────────────────────────────────
   Sanitised once, because it comes from outside this build: a config in a
   bookmarked URL may name a topic twice, or one this build has never heard
   of.                                                                       */

const TOPICS: WordTopic[] = [
  "integers",
  "rate",
  "percent",
  "equation",
  "average",
];

function topicsOf(config: WordProblemConfig): WordTopic[] {
  const asked = (config.topics ?? []).filter((topic) => TOPICS.includes(topic));
  return asked.length > 0 ? [...new Set(asked)] : [];
}

function bounds(range: { min: number; max: number }): Range {
  const min = Math.max(1, Math.floor(range?.min ?? 1));
  return { min, max: Math.max(min, Math.floor(range?.max ?? 1)) };
}

/* ── The page ──────────────────────────────────────────────────────────── */

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/**
 * How many problems the paper holds, and how wide a column of them is.
 *
 * The row is the only one in the shop counted in *lines of text*: a story is as
 * long as it is, and how many lines that wraps onto depends on the column and
 * the type size together. Arithmetic still — there is no DOM here (§4) — and
 * `MAX_TEXT` is what makes it arithmetic rather than a guess.
 */
export function wordLayout(config: WordProblemConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  lines: number;
  perPage: number;
} {
  // Against the header the sheet will print, not the one the config holds, and
  // `true` for the score box because a sheet of problems is marked out of them.
  const box = sheetBlockBox(headerOf(config), true);
  const columns = clamp(config.columns, 1, MAX_COLUMNS);
  const cell = columnWidth(box, columns, PROBLEM_GAP.x);

  const character = Math.max(1, points(config.fontPt * CHAR_EM));
  // The slot is paid for in characters, because it sits on the same wrapping
  // line the story ends on and pushes it along like any other word.
  const room = MAX_TEXT + Math.ceil(SLOT / character);
  const perLine = Math.max(1, Math.floor(cell / character));
  const lines = Math.max(1, Math.ceil(room / perLine));
  const row =
    lines * answerLine(config.fontPt) + (spacious(config) ? WORKSPACE : 0);

  return {
    box,
    columns,
    cell,
    row,
    lines,
    perPage: columns * fitAcross(box.height, row, PROBLEM_GAP.y),
  };
}

/** Working space, which a word problem has unless it is turned off. */
const spacious = (config: WordProblemConfig): boolean =>
  config.workspace !== false;

/**
 * Every story on the sheet, in the order they are printed.
 *
 * Exported alongside the problems because a story carries the id of the
 * template that made it, and that is what lets the suite check each one against
 * arithmetic of its own — see the note at the top of this file. The page itself
 * never shows an id.
 */
export function wordStories(
  config: WordProblemConfig,
  seed: number,
): WordStory[] {
  const { perPage } = wordLayout(config);
  // The count is a request, not a promise: a count that overruns is a second
  // sheet out of the printer with two problems on it.
  const wanted = clamp(config.count, 0, perPage);

  const rand = mulberry32(seed);
  const pool = TEMPLATES.filter((template) =>
    topicsOf(config).includes(template.topic),
  );
  const range = bounds(config.range);
  const seen = new Set<string>();
  const out: WordStory[] = [];
  if (pool.length === 0) return out;

  // Shuffled and then walked in order, rather than drawn each time. This is the
  // whole of "a page that doesn't read as generated": twelve templates picked at
  // random from twenty give the same one twice on most pages, and two stories
  // with the same skeleton and different names is exactly what a reader notices
  // first. Walking a shuffled list gives a different template every time until
  // there are no more, and only then starts round again.
  const order = shuffled(pool, rand);
  let at = 0;

  let misses = 0;
  while (out.length < wanted && misses < MISS_BUDGET) {
    const template = order[at % order.length];
    at += 1;
    const cast = {
      name: pick(NAMES, rand),
      thing: pick(THINGS, rand),
      place: pick(PLACES, rand),
      spot: pick(SPOTS, rand),
    };
    const drawn = template.draw(range, cast, rand);
    // Rejected for one of three things: not a question with a whole answer, too
    // long for the row the layout reserved, or the same numbers as one already
    // on the page.
    const key =
      drawn === null ? null : `${template.id}:${numbersIn(drawn.text)}`;
    if (drawn === null || key === null || seen.has(key)) {
      misses += 1;
      continue;
    }
    if (drawn.text.length > MAX_TEXT) {
      misses += 1;
      continue;
    }
    seen.add(key);
    out.push({ id: template.id, topic: template.topic, ...drawn });
    misses = 0;
  }
  return out;
}

/**
 * What makes two stories the same story: the template and its numbers.
 *
 * The cast is deliberately not part of it. Two children counting different
 * things through the same arithmetic is the same question twice, and a child
 * who has done one has done the other.
 */
const numbersIn = (text: string): string =>
  (text.match(/−?\d+/g) ?? []).join(":");

/** The stories as they are printed: a sentence, and a blank on the end. */
export function wordProblems(
  config: WordProblemConfig,
  seed: number,
): Problem[] {
  const extras = spacious(config) ? { workspace: WORKSPACE } : {};
  return wordStories(config, seed).map((one) => ({
    prompt: one.text,
    answer: one.answer,
    ...extras,
  }));
}

/* ── What it is called ─────────────────────────────────────────────────── */

const TOPIC_NAME: Record<WordTopic, string> = {
  integers: "integers",
  rate: "ratio and rate",
  percent: "percentages",
  equation: "equations",
  average: "averages",
};

/**
 * "Word problems: percentages" — the phrase a parent says out loud.
 *
 * A sheet drawing on more than one topic is not named after any of them,
 * because it is not about any of them: it is the mixed sheet, and naming it
 * after whichever was listed first would be a title that is wrong most of the
 * time.
 */
function titleOf(config: WordProblemConfig): string {
  const pool = topicsOf(config);
  return pool.length === 1
    ? `Word problems: ${TOPIC_NAME[pool[0]]}`
    : "Word problems";
}

/**
 * The header this sheet will actually print, which is what the layout reserves
 * space against — see the note in `arithmetic.ts`.
 */
function headerOf(config: WordProblemConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? titleOf(config),
    instructions:
      config.instructions ?? "Read each problem and write the answer.",
  };
}

/**
 * One line naming what the sheet holds, in the terms a parent chose it by.
 *
 * Which topics are on the page is the whole of whether a sheet matches the
 * lesson, and it is exactly what the title of a mixed sheet leaves off.
 */
function describeWordProblems(config: WordProblemConfig): string {
  const pool = topicsOf(config);
  if (pool.length <= 1) return titleOf(config);
  return `${titleOf(config)} — ${pool.map((topic) => TOPIC_NAME[topic]).join(", ")}`;
}

function buildWordProblemSheet(config: WordProblemConfig, seed: number): Sheet {
  const items = wordProblems(config, seed);
  const { columns } = wordLayout(config);
  const head = headerOf(config);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
      score: { outOf: items.length },
    },
    blocks: [{ kind: "problems", columns, items }],
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const WORD_PROBLEMS_SHEET: SheetSpec<WordProblemConfig> = {
  world: SHEET_WORLD,
  build: buildWordProblemSheet,
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeWordProblems,
};

/** Every template this build can print, for the suite that checks each one. */
export const WORD_TEMPLATES: string[] = TEMPLATES.map(
  (template) => template.id,
);
