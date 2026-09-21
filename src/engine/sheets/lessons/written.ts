/**
 * What happens when it does not share out, and the two written methods
 * (§23): remainders, then chunking, then the compact algorithm chunking
 * abbreviates. Chunking comes first on purpose; §23 says why. The
 * long-division page's worked example is the guided bracket (§21) with every
 * written square shaded.
 */
import { shuffled } from "@/engine/random";

import { counters as place } from "../counters";
import { answerLine } from "../layout";
import type { DivisionHelp, LessonTopic, Problem } from "../types";

import {
  bracket,
  chunkLine,
  note,
  picture,
  worked,
  type Page,
  type Topic,
} from "./blocks";

/* ── Remainders ────────────────────────────────────────────────────────── */

/** The pairs to try: a total and the number it is shared between. */
const REMAINDERS: Array<[total: number, between: number]> = [
  [13, 4],
  [17, 5],
  [11, 3],
  [20, 6],
  [23, 4],
];

/**
 * The one story on the page, and it is a story on purpose: Carpenter et al.
 * (1983), in §23's sources, found children who could divide 1,128 by 36
 * perfectly well and still answered "31 remainder 12" when asked how many
 * buses were needed. The answer is the number of tables, not the division.
 */
const TABLES: Problem = {
  prompt: "9 children sit 4 to a table. How many tables?",
  answer: "3",
};

/** `13 ÷ 4 =` answered `3 r 1`, with the rings holding 3 and the 1 outside. */
function shared(page: Page, total: number, between: number): Problem {
  const each = Math.floor(total / between);
  return {
    prompt: `${total} ÷ ${between} =`,
    answer: `${each} r ${total - each * between}`,
    counters: place(total, each, "share", page.cell),
  };
}

const remainders: Topic = {
  label: "Division with remainders",
  title: "Division with remainders",
  instructions:
    "Read the box and count what is left outside the rings. Then try the six below.",
  columns: 2,
  lesson: (page) => [
    note(page, {
      heading: "Sometimes it doesn’t share out evenly",
      text: [
        "14 ÷ 4 means 14 candies shared between 4 children. Deal them out and 2 are left in the bag — not enough for everyone to get one more. What is left over is the remainder.",
      ],
    }),
    picture(page, 14, 3, "share", {
      caption: "4 rings · 3 in each · 2 left over",
    }),
    note(page, {
      heading: "14 ÷ 4, step by step",
      items: [
        "14 candies, 4 children. Deal them out: 1 each, 2 each, 3 each.",
        "Only 2 left — not enough for everyone to get one more. Stop.",
        "3 each, 2 left over. 14 ÷ 4 = 3 remainder 2.",
        "Check: 4 × 3 = 12, and 12 + 2 = 14.",
      ],
    }),
    worked(
      [
        { prompt: "14 ÷ 4 =", answer: "3 r 2" },
        { prompt: "4 × 3 + 2 =", answer: "14" },
      ],
      2,
    ),
    note(page, {
      heading: "When the leftover changes the answer",
      text: [
        "7 children. Each car holds 3. 7 ÷ 3 = 2 r 1. Two cars are full and one child is still waiting — so you need 3 cars. The remainder made the answer go up.",
      ],
    }),
    note(page, {
      aside: true,
      text: [
        "For the grown-up: when they can’t give everyone one more, stop — what’s in the bag is the remainder. Then ask what the leftover means in the story.",
      ],
    }),
  ],
  practice: (page, rand) =>
    shuffled(
      [
        ...REMAINDERS.map(([total, between]) => shared(page, total, between)),
        TABLES,
      ],
      rand,
    ),
};

/* ── Chunking ──────────────────────────────────────────────────────────── */

/**
 * The divisions to try, every divisor two digits — where chunking earns its
 * place, since "how many 12s in 144?" is not a table fact. The last leaves a
 * remainder: the method survives one.
 */
const CHUNKS: Array<[dividend: number, divisor: number]> = [
  [144, 12],
  [195, 15],
  [168, 14],
  [253, 11],
  [322, 14],
  [190, 15],
];

/**
 * Lines of blank paper under each division to try. Six is what 322 ÷ 14
 * takes in lumps of ten fourteens — take, what is left, take, what is left,
 * take, nothing — and a child who takes bigger lumps has room to spare.
 */
const CHUNK_LINES = 6;

/** `144 ÷ 12 =` with room to chunk underneath. */
function chunked(page: Page, dividend: number, divisor: number): Problem {
  const quotient = Math.floor(dividend / divisor);
  const left = dividend - quotient * divisor;
  return {
    prompt: `${dividend} ÷ ${divisor} =`,
    answer: left > 0 ? `${quotient} r ${left}` : String(quotient),
    workspace: CHUNK_LINES * answerLine(page.fontPt),
  };
}

const chunking: Topic = {
  label: "Chunking: take away big lumps",
  title: "Division by chunking",
  instructions:
    "Read the box and the line. Then try the six below: write down every lump you take, and add the lumps at the end.",
  columns: 3,
  lesson: (page) => [
    note(page, {
      heading: "Take away big lumps of the divisor",
      text: [
        "How many 12s in 156? Take away lumps of 12 until nothing is left, then add up how many lumps you took. Like paying with the big notes first and the coins after: ten 12s at once, then the rest.",
      ],
    }),
    chunkLine(page, 156, [120, 36]),
    // The side column, as it is written by hand: the number, what was taken,
    // what is left, what was taken, nothing — and the lumps beside each
    // take. A note rather than a stacked sum, whose working lines hold one
    // number each (§23).
    note(page, {
      heading: "Written down the page",
      text: [
        "156",
        "− 120  (ten 12s)",
        "36",
        "− 36  (three 12s)",
        "0  — lumps taken: 10 + 3 = 13",
      ],
    }),
    note(page, {
      heading: "156 ÷ 12, step by step",
      items: [
        "How many 12s in 156? I don’t know — but I know 10 twelves is 120.",
        "Take 120 away: 156 − 120 = 36. Write 10 in the side column.",
        "How many 12s in 36? 3. Take 36 away: 36 − 36 = 0. Write 3.",
        "Add the side column: 10 + 3 = 13. Check: 13 × 12 = 156.",
        "Any lump works. Five 12s at a time gets there too, in more steps. Ten-lumps are fastest.",
      ],
    }),
    worked(
      [
        { prompt: "156 ÷ 12 =", answer: "13" },
        { prompt: "13 × 12 =", answer: "156" },
      ],
      2,
    ),
    note(page, {
      aside: true,
      text: [
        "For the grown-up: ask ‘what’s ten lots?’ first. Write down every lump you take, and add the lumps at the end.",
      ],
    }),
  ],
  practice: (page, rand) =>
    shuffled(
      CHUNKS.map(([dividend, divisor]) => chunked(page, dividend, divisor)),
      rand,
    ),
};

/* ── Long division ─────────────────────────────────────────────────────── */

/**
 * The divisions to try: three digits by one, the first digit at least the
 * divisor, no remainder and no zero in the answer, so the method is met
 * clean.
 */
const LONG: Array<[dividend: number, divisor: number]> = [
  [848, 4],
  [735, 5],
  [936, 4],
  [528, 4],
  [861, 7],
  [975, 3],
];
const GUIDED = 4;

const helpAt = (index: number): DivisionHelp =>
  index < GUIDED ? "guided" : "steps";

const longDivision: Topic = {
  label: "Long division, step by step",
  title: "Long division, step by step",
  instructions:
    "Read the worked example and the steps under it. Then try the six below: the shaded squares show where each number goes.",
  columns: 3,
  lesson: (page) => [
    note(page, {
      heading: "Divide one column at a time, biggest first",
      text: [
        "657 ÷ 3. Share the hundreds first, then the tens, then the ones. Whatever is left over in one column joins the next — like changing a leftover note into coins. Four steps, the same in every column: divide, multiply, subtract, bring down.",
      ],
    }),
    worked([bracket(page, "657", 3, "guided")], 1),
    note(page, {
      heading: "657 ÷ 3 = 219, step by step",
      items: [
        "Divide. How many 3s in 6 hundreds? 2 hundreds. Write 2 above the 6.",
        "Multiply. 2 × 3 = 6. Write 6 under the 6.",
        "Subtract. 6 − 6 = 0. Nothing left in the hundreds.",
        "Bring down. Bring the 5 down: 5 tens. How many 3s in 5? 1. Write 1 above the 5. 1 × 3 = 3. 5 − 3 = 2 tens left.",
        "Bring the 7 down beside the 2: 27 ones. How many 3s in 27? 9. Write 9 above the 7. 9 × 3 = 27. 27 − 27 = 0. Nothing left.",
        "Read the top: 219. Check: 219 × 3 = 657.",
      ],
    }),
    note(page, {
      aside: true,
      text: [
        "For the grown-up: make them say what each digit is worth — ‘6 hundreds shared by 3 is 2 hundreds’ — and the steps are the same in every column.",
      ],
    }),
  ],
  // Guided first, then the steps alone, each set in the seed's order: the
  // easier four before the harder two, whatever the seed.
  practice: (page, rand) => {
    const set = LONG.map(([dividend, divisor], index) =>
      bracket(page, String(dividend), divisor, helpAt(index)),
    );
    return [
      ...shuffled(set.slice(0, GUIDED), rand),
      ...shuffled(set.slice(GUIDED), rand),
    ];
  },
};

/** The lesson each of the three prints, in the order they are met. */
export const WRITTEN_TOPICS = {
  "division-remainders": remainders,
  "division-chunking": chunking,
  "long-division-steps": longDivision,
} satisfies Partial<Record<LessonTopic, Topic>>;

/** The problems to try, as each topic's own list — for the suite to check against. */
export const WRITTEN_TRY_ITS = {
  REMAINDERS,
  TABLES,
  CHUNKS,
  CHUNK_LINES,
  LONG,
  GUIDED,
} as const;
