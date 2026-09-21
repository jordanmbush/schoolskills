/**
 * Decimals, three lessons (§23): the digits sliding under a place-value
 * chart, a decimal divided in the bracket with the point carried up, and
 * dividing by a decimal by rewriting the sum until the divisor is whole.
 *
 * The chart comes first because the other two lean on it: a child who can
 * say what the 7 in 3.7 is worth can say where the point goes in 8.46 ÷ 3,
 * and why 8.4 ÷ 0.2 is 84 ÷ 2. Its language is the DfE's — *the digits move;
 * the point stays* — and it never says the other picture is wrong (§22).
 *
 * Nothing here is a float: every value is a `Fixed`, shifted and multiplied
 * in whole units, and the point is written by `fixedText` at the end (§11).
 */
import { shuffled } from "@/engine/random";

import { fractionArt } from "../fractionart";
import { answerLine } from "../layout";
import {
  fixed,
  fixedText,
  parseFixed,
  shifted,
  type Fixed,
} from "../maths/exact";
import type { DivisionHelp, LessonTopic, Problem } from "../types";

import {
  bracket,
  note,
  worked,
  type LessonBlock,
  type Page,
  type Topic,
} from "./blocks";

/** An authored decimal, read back — and refused at build time if it was mistyped. */
function fixedOf(text: string): Fixed {
  const value = parseFixed(text);
  if (value === null) throw new Error(`not a decimal: "${text}"`);
  return value;
}

/* ── Powers of ten ─────────────────────────────────────────────────────── */

/**
 * The chart's columns, largest first, with the short name at the head of
 * each — the abbreviations a child meets on a classroom wall. The point is
 * not a column: it is the heavy rule between O and t, where the shop's own
 * place-value chart draws it (§11).
 */
const PLACES: Array<[power: number, head: string]> = [
  [3, "Th"],
  [2, "H"],
  [1, "T"],
  [0, "O"],
  [-1, "t"],
  [-2, "h"],
  [-3, "th"],
];

/** How tall a chart row stands, in lines a child writes an answer on. */
const CHART_ROW_LINES = 1.5;

/**
 * The rows of the chart: a number, then the same digits after the move.
 * Written as values rather than as digits in columns, so the row that says
 * "× 10" is 3.7 shifted and not a hand-placed 3 and 7.
 */
const CHART: Array<{ label: string; value: Fixed }> = [
  { label: "3.7", value: fixed(37, 1) },
  { label: "× 10", value: shifted(fixed(37, 1), 1) },
  { label: "48", value: fixed(48, 0) },
  { label: "÷ 1000", value: shifted(fixed(48, 0), -3) },
];

/** Each digit of a value with the power of ten its column stands for. */
function placed(value: Fixed): Array<[power: number, digit: string]> {
  const [whole, part = ""] = fixedText(value).split(".");
  return [
    ...[...whole].map(
      (digit, at) => [whole.length - 1 - at, digit] as [number, string],
    ),
    ...[...part].map((digit, at) => [-1 - at, digit] as [number, string]),
  ];
}

/**
 * The place-value chart as a grid: the headings in its first row, a label
 * column down the left, and the heavy rules under the headings and at the
 * point. Its own cell and row sizes, because the shop's chart is a page to
 * fill and this one is four rows of a lesson.
 */
function placeChart(page: Page): LessonBlock {
  const columns = 1 + PLACES.length;
  const column = (power: number): number =>
    1 + PLACES.findIndex(([at]) => at === power);
  const cells = ["", ...PLACES.map(([, head]) => head)];
  for (const row of CHART) {
    const line = Array<string>(columns).fill("");
    line[0] = row.label;
    for (const [power, digit] of placed(row.value)) line[column(power)] = digit;
    cells.push(...line);
  }
  return {
    kind: "grid",
    grid: {
      kind: "chart",
      columns,
      rows: 1 + CHART.length,
      cell: Math.floor(page.width / columns),
      row: Math.round(CHART_ROW_LINES * answerLine(page.fontPt)),
      cells,
      origin: { column: column(0) + 1, row: 1 },
    },
  };
}

/** The values to try, each with how many places its digits move (left is +). */
const POWERS: Array<[value: string, by: number]> = [
  ["4.2", 1],
  ["0.56", 2],
  ["3.07", 3],
  ["25", -1],
  ["6", -2],
  ["305", -3],
];

/** `4.2 × 10 =` answered `42`; `25 ÷ 10 =` answered `2.5`. */
function power(value: string, by: number): Problem {
  const sign = by > 0 ? "×" : "÷";
  return {
    prompt: `${value} ${sign} ${10 ** Math.abs(by)} =`,
    answer: fixedText(shifted(fixedOf(value), by)),
  };
}

const powersOfTen: Topic = {
  label: "Multiplying and dividing by 10, 100, 1000",
  title: "Multiplying and dividing by 10, 100 and 1000",
  instructions:
    "Read the chart: the digits move, the point stays. Then try the six below.",
  // Two across, not three: "305 ÷ 1000 =" and its slot are wider than a
  // third of the page, and a slot that wraps sits on a line of its own.
  columns: 2,
  lesson: (page) => [
    note(page, {
      heading: "The digits move; the point stays",
      text: [
        "Times 10 makes every digit worth ten times more, so every digit moves one place to the left. The point never moves. Divide by 10 and every digit moves one place to the right. Think of a row of chairs: everyone shifts one seat along, and the seats stay where they are.",
        "In the chart, Th H T O are thousands, hundreds, tens and ones; t h th are tenths, hundredths and thousandths. The heavy line is the point.",
      ],
    }),
    placeChart(page),
    note(page, {
      heading: "3.7 × 10 and 48 ÷ 1000, step by step",
      items: [
        "3.7 × 10. Ten times more: 3 ones become 3 tens; 7 tenths become 7 ones. Read it: 37. 37 is ten times the size of 3.7.",
        "48 ÷ 1000. A thousand times smaller: three places right. 4 tens become 4 hundredths; 8 ones become 8 thousandths.",
        "Fill the empty places with 0 so every column has a digit: 0.048. 0.048 is one-thousandth times the size of 48.",
        "Check by going back: 0.048 × 1000 = 48.",
      ],
    }),
    worked(
      [
        { prompt: "3.7 × 10 =", answer: "37" },
        { prompt: "48 ÷ 1000 =", answer: "0.048" },
      ],
      2,
    ),
    note(page, {
      aside: true,
      text: [
        "For the grown-up: ask what the 7 is worth now — tenths — and what it will be worth after — ones. If they can say that, the answer writes itself.",
      ],
    }),
  ],
  practice: (_page, rand) =>
    shuffled(
      POWERS.map(([value, by]) => power(value, by)),
      rand,
    ),
};

/* ── A decimal divided by a whole number ───────────────────────────────── */

/**
 * The divisions to try, guided first and then the steps alone. 5.46 ÷ 6
 * starts with a nought and 8.16 ÷ 4 has one in the tenths — the two places
 * a child leaves a square empty — so both are among the guided three, where
 * the shading says the square is written in.
 */
const DECIMALS: Array<[dividend: string, divisor: number, help: DivisionHelp]> =
  [
    ["6.39", 3, "guided"],
    ["5.46", 6, "guided"],
    ["8.16", 4, "guided"],
    ["9.68", 4, "steps"],
    ["7.25", 5, "steps"],
    ["9.12", 8, "steps"],
  ];

const decimalDivision: Topic = {
  label: "Dividing a decimal",
  title: "Dividing a decimal by a whole number",
  instructions:
    "Read the worked example and the steps under it. Then try the six below, and keep the point in line.",
  columns: 3,
  lesson: (page) => [
    note(page, {
      heading: "Divide a decimal just like a whole number",
      text: [
        "8.46 ÷ 3. Share the ones first, then the tenths, then the hundredths — like sharing out money: the notes first, then the coins. The point in the answer sits straight above the point in the question.",
      ],
    }),
    worked([bracket(page, "8.46", 3, "guided")], 1),
    note(page, {
      heading: "8.46 ÷ 3 = 2.82, step by step",
      items: [
        "Estimate first: 8.46 is nearly 9, and 9 ÷ 3 = 3. So the answer is a bit less than 3.",
        "8 ones ÷ 3 = 2 ones, 2 ones left. Write 2 above the 8.",
        "Put the point in the answer straight above the point below.",
        "2 ones left is 20 tenths, plus the 4 tenths: 24 tenths. 24 ÷ 3 = 8 tenths. Write 8 above the 4.",
        "6 hundredths ÷ 3 = 2 hundredths. Write 2 above the 6.",
        "Answer: 2.82. Check: 2.82 × 3 = 8.46. And 2.82 is a bit less than 3 — the estimate agrees.",
      ],
    }),
    note(page, {
      aside: true,
      text: [
        "For the grown-up: before they start, ask ‘about how big will it be?’ Then divide as if there were no point, and keep the point in line.",
      ],
    }),
  ],
  practice: (page, rand) => {
    const set = DECIMALS.map(([dividend, divisor, help]) =>
      bracket(page, dividend, divisor, help),
    );
    const guided = set.filter((item) => item.bracket?.help === "guided");
    const steps = set.filter((item) => item.bracket?.help !== "guided");
    return [...shuffled(guided, rand), ...shuffled(steps, rand)];
  },
};

/* ── Dividing by a decimal ─────────────────────────────────────────────── */

/** The divisions to try. The last two need × 100, and say so on the key. */
const BY_DECIMAL: Array<[dividend: string, divisor: string]> = [
  ["6.3", "0.7"],
  ["4.8", "0.4"],
  ["7.5", "0.5"],
  ["9.6", "0.3"],
  ["1.44", "0.12"],
  ["3.6", "0.04"],
];

/**
 * `6.3 ÷ 0.7` with two ruled lines under it: the rewritten sum on the first,
 * the answer on the second. Both numbers are scaled by the same power of
 * ten — enough to make the divisor whole — and the answer is the whole
 * division that leaves, which every pair above was chosen to make exact.
 */
function byDecimal(page: Page, dividend: string, divisor: string): Problem {
  const a = fixedOf(dividend);
  const b = fixedOf(divisor);
  const by = Math.max(a.places, b.places);
  const top = shifted(a, by);
  const bottom = shifted(b, by);
  const rewritten = `${fixedText(top)} ÷ ${fixedText(bottom)}`;
  const answers = [
    `× ${10 ** by} both: ${rewritten}`,
    String(top.units / bottom.units),
  ];
  return {
    prompt: `${dividend} ÷ ${divisor}`,
    answer: answers.join(" · "),
    answers,
    workspace: answers.length * answerLine(page.fontPt),
  };
}

const dividingByDecimals: Topic = {
  label: "Dividing by a decimal",
  title: "Dividing by a decimal",
  instructions:
    "Read the box. Then try the six below: rewrite each one with a whole-number divisor on the first line, and put the answer on the second.",
  columns: 2,
  lesson: (page) => [
    note(page, {
      heading: "You can’t share between 0.2 of a person",
      text: [
        "But you can ask: how many 0.2s make 8.4? Think of ribbon. How many 0.2 m pieces can you cut from 8.4 m? Ask it in centimeters — how many 20 cm pieces from 840 cm — and it is the same question with easier numbers. Scale both numbers up by the same amount until the divisor is whole. The answer does not change.",
      ],
    }),
    worked(
      [
        {
          prompt: "One piece is 0.2. How many make 1? _",
          answer: "5",
          art: fractionArt("bar", 5, 1),
        },
        { prompt: "8.4 ÷ 0.2 =", answer: "42" },
      ],
      2,
    ),
    note(page, {
      heading: "8.4 ÷ 0.2, step by step",
      items: [
        "Make the divisor whole: 0.2 × 10 = 2.",
        "Do exactly the same to the other number: 8.4 × 10 = 84.",
        "Now it is 84 ÷ 2 = 42.",
        "Check: 42 × 0.2 = 8.4. And 42 is bigger than 8.4 — dividing by less than one makes the answer bigger, because you are asking how many small pieces fit.",
      ],
    }),
    note(page, {
      heading: "Written in one line",
      text: [
        "8.4 ÷ 0.2 = 84 ÷ 2 = 42. The same value with easier numbers, the way 1/2 is 5/10.",
      ],
    }),
    note(page, {
      aside: true,
      text: [
        "For the grown-up: say it as ‘how many 0.2s make 8.4?’ It is a grouping question, so a big answer is the right kind of answer.",
      ],
    }),
  ],
  practice: (page, rand) =>
    shuffled(
      BY_DECIMAL.map(([dividend, divisor]) =>
        byDecimal(page, dividend, divisor),
      ),
      rand,
    ),
};

/** The lesson each of the three prints, in the order they are met. */
export const DECIMAL_TOPICS = {
  "decimals-powers-of-ten": powersOfTen,
  "decimal-division": decimalDivision,
  "dividing-by-decimals": dividingByDecimals,
} satisfies Partial<Record<LessonTopic, Topic>>;

/** The problems to try, as each topic's own list — for the suite to check against. */
export const DECIMAL_TRY_ITS = {
  CHART,
  PLACES,
  POWERS,
  DECIMALS,
  BY_DECIMAL,
} as const;
