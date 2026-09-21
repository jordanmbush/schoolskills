/**
 * Division, taught three ways, in the order a child meets them (§23): sharing
 * out, then making groups, then the array that holds both and their two
 * multiplications.
 *
 * Every word on these pages is for a child of six to nine and the grown-up
 * beside them. The numbers, pictures and step sentences follow the sources
 * §23 lists. The problems to try are written down here (`SHARES`, `GROUPS`,
 * `ARRAYS`) and only shuffled by the seed, and no total is over two dozen,
 * which is where counting on paper stops (`MOST_DOTS`).
 */
import { shuffled } from "@/engine/random";

import { counters as place } from "../counters";
import { answerLine } from "../layout";
import { hopLine } from "../numberline";
import type { LessonTopic, Problem } from "../types";

import {
  jumpsLine,
  note,
  picture,
  worked,
  type Page,
  type Topic,
} from "./blocks";

/** `12 ÷ 3 =` with a slot on the end, answered. */
const divide = (dividend: number, divisor: number): Problem => ({
  prompt: `${dividend} ÷ ${divisor} =`,
  answer: String(dividend / divisor),
});

/* ── Sharing ───────────────────────────────────────────────────────────── */

/** The pairs to try, each a total and the number it is shared between. */
const SHARES: Array<[total: number, between: number]> = [
  [8, 2],
  [15, 3],
  [12, 4],
  [18, 3],
  [20, 5],
  [24, 4],
];

const sharing: Topic = {
  label: "Division is sharing",
  title: "Division is sharing",
  instructions: "Read the box and count the rings. Then try the six below.",
  columns: 2,
  lesson: (page) => [
    note(page, {
      heading: "Dividing is sharing out fairly",
      text: [
        "12 ÷ 3 means 12 things shared between 3. The answer is how many each one gets. Think of dealing cards: one for you, one for you, one for you, and round again until they are all gone.",
      ],
    }),
    picture(page, 12, 4, "share", { caption: "3 rings · 4 in each" }),
    note(page, {
      heading: "12 ÷ 3, step by step",
      items: [
        "12 candies. 3 children. Draw 3 rings.",
        "Give one to each ring. Again. Again. Again.",
        "Nothing left. Count one ring: 4.",
        "12 shared between 3 is 4 each.",
      ],
    }),
    worked(
      [
        { prompt: "12 shared between 3 is _ each", answer: "4" },
        { prompt: "12 ÷ 3 =", answer: "4" },
        { prompt: "3 × 4 =", answer: "12" },
      ],
      3,
    ),
    note(page, {
      aside: true,
      text: [
        "For the grown-up: get 12 real things out and deal them into 3 piles, one at a time, like cards. When they are gone, count one pile — that is the answer.",
      ],
    }),
  ],
  practice: (page, rand) =>
    shuffled(
      SHARES.map(([total, between]) => ({
        ...divide(total, between),
        // The rings are the children, drawn already holding their share, so
        // the count in one ring is the answer. That is the picture children
        // read most easily — §23 says why.
        counters: place(total, total / between, "share", page.cell),
      })),
      rand,
    ),
};

/* ── Grouping ──────────────────────────────────────────────────────────── */

/** The pairs to try: a total and the size of a group. */
const GROUPS: Array<[total: number, of: number]> = [
  [10, 2],
  [12, 4],
  [15, 5],
  [16, 4],
  [18, 6],
  [21, 3],
];

/** The last two are tried on a blank number line rather than on counters. */
const ON_THE_LINE = 4;

const grouping: Topic = {
  label: "Division is making groups",
  title: "Division is making groups",
  instructions:
    "Read the box, then ring the groups or jump back along the line. Try the six below.",
  columns: 2,
  lesson: (page) => [
    note(page, {
      heading: "Dividing is also asking how many groups",
      text: [
        "12 ÷ 3 can also mean: how many 3s make 12? Think of packing bags: put 3 in every bag, and count the bags you fill. It is the same sum as the sharing page, but a different story. Both are dividing.",
      ],
    }),
    picture(page, 12, 3, "group", { caption: "groups of 3 · 4 groups" }),
    jumpsLine(page, 12, 3),
    note(page, {
      heading: "12 ÷ 3, step by step",
      items: [
        "12 candies. Bags hold 3.",
        "Ring 3. Ring 3. Ring 3. Ring 3.",
        "Count the rings: 4.",
        "Start at 12 on the line. Jump back 3 at a time. Four jumps reach 0.",
      ],
    }),
    // The sum and the question it is read as, two across so the question
    // keeps to one line: three across put its blank on a second line and
    // the page over its foot by a hair. The multiplication is the next
    // lesson's, which holds all four facts in one picture.
    worked(
      [
        { prompt: "12 ÷ 3 =", answer: "4" },
        { prompt: "How many 3s in 12? _", answer: "4" },
      ],
      2,
    ),
    note(page, {
      aside: true,
      text: [
        "For the grown-up: say it as a question — how many 3s in 12? — and let them make the groups. Then count groups, not candies.",
      ],
    }),
  ],
  practice: (page, rand) =>
    shuffled(
      GROUPS.map(([total, of], index) =>
        index < ON_THE_LINE
          ? {
              ...divide(total, of),
              // Evenly spaced and unringed: the rings are the child's to draw.
              counters: place(total, of, "group", page.cell, { rings: false }),
            }
          : // Blank, with the dividend and every landing on a tick, so the
            // child's hops have somewhere to land.
            { ...divide(total, of), line: hopLine(total, [of], page.cell) },
      ),
      rand,
    ),
};

/* ── Arrays ────────────────────────────────────────────────────────────── */

/**
 * The arrays to try, as rows by columns. None square: 4 × 4 holds only one
 * division, and the exercise is writing two.
 */
const ARRAYS: Array<[rows: number, columns: number]> = [
  [2, 5],
  [3, 6],
  [4, 5],
  [3, 7],
  [4, 6],
];

/** An array, and the two divisions written on ruled lines under it. */
function arrayProblem(page: Page, rows: number, columns: number): Problem {
  const total = rows * columns;
  const answers = [
    `${total} ÷ ${rows} = ${columns}`,
    `${total} ÷ ${columns} = ${rows}`,
  ];
  return {
    prompt: "Write the two divisions.",
    answer: answers.join(" · "),
    answers,
    workspace: answers.length * answerLine(page.fontPt),
    counters: place(total, columns, "array", page.cell),
  };
}

const arrays: Topic = {
  label: "One array, four facts",
  title: "One array, four facts",
  instructions:
    "Read the box and the picture. Then write the two divisions each array holds.",
  columns: 3,
  lesson: (page) => [
    note(page, {
      heading: "One picture, four facts",
      text: [
        "If you know 3 × 4 = 12, you already know 12 ÷ 4 and 12 ÷ 3. Think of an egg box: rows across and columns down.",
      ],
    }),
    picture(page, 12, 4, "array", { caption: "3 rows of 4" }),
    worked(
      [
        { prompt: "3 × 4 =", answer: "12" },
        { prompt: "4 × 3 =", answer: "12" },
        { prompt: "12 ÷ 3 =", answer: "4" },
        { prompt: "12 ÷ 4 =", answer: "3" },
      ],
      2,
    ),
    note(page, {
      heading: "Read the picture four ways",
      items: [
        "3 rows of 4. Count: 12. So 3 × 4 = 12.",
        "Turn the page sideways: 4 rows of 3. Still 12. So 4 × 3 = 12.",
        "12 in 3 rows: how many in a row? 4. So 12 ÷ 3 = 4.",
        "12 in rows of 4: how many rows? 3. So 12 ÷ 4 = 3.",
      ],
    }),
    note(page, {
      heading: "Think multiplication",
      text: ["12 ÷ 4 = ? Ask: 4 × ? = 12. It is 3."],
    }),
    note(page, {
      aside: true,
      text: [
        "For the grown-up: cover the answer and ask what times 4 makes 12 — that is all division is asking.",
      ],
    }),
  ],
  practice: (page, rand) =>
    shuffled(
      [
        ...ARRAYS.map(([rows, columns]) => arrayProblem(page, rows, columns)),
        // One with no picture: the reflex the page is for, on its own.
        { prompt: "18 ÷ 3 = _  Think: 3 × ? = 18.", answer: "6" },
      ],
      rand,
    ),
};

/** The lesson each of the three prints, in the order they are met. */
export const DIVISION_TOPICS = {
  "division-sharing": sharing,
  "division-grouping": grouping,
  "division-arrays": arrays,
} satisfies Partial<Record<LessonTopic, Topic>>;

/** The problems to try, as a topic's own list — for the suite to check against. */
export const TRY_ITS = { SHARES, GROUPS, ARRAYS } as const;
