/**
 * Penmanship: the page after the letters are learnt (§24).
 *
 * The handwriting family teaches a letter — trace it, copy it, write it. A
 * child who can do that and still hands in a page nobody can read has a
 * different problem, and it is one of a short list: the strokes are shaky, the
 * letters are the wrong size for one another, the words run together, they
 * cannot tell a good letter from a bad one, or the writing is neat only when it
 * is slow. Each style here works on one of those, on the same ruling and in
 * the same trace → copy → write row as the handwriting sheets (`rows.ts`),
 * because the rows are not what differs. What goes in them is.
 *
 * Nothing here is drawn at random: the strokes, the families and the zones are
 * tables, and a sentence is the parent's own or one of five. The seed decides
 * nothing and only prints in the footer, as it does for blank paper.
 */
import {
  faceOf,
  fittedCharacters,
  glyphEm,
  isCursive,
  type Face,
} from "../faces";
import { sheetBlockBox } from "../chrome";
import {
  BLOCK_GAP,
  NOTE_PAD,
  noteHeight,
  paged,
  ruleCapacity,
  type Box,
} from "../layout";
import { own, points, rulingOf, steppedSize, writingSpace } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import type {
  Block,
  FluencyTask,
  Mil,
  PenmanshipConfig,
  PenmanshipStyle,
  Rule,
  Sheet,
  SheetOptions,
  StrokeRow,
  TraceRow,
  TraceStyle,
} from "../types";

import {
  FLUENCY_SENTENCE,
  SPACING_SENTENCES,
  ZONES,
  ZONE_WORDS,
  familiesOf,
  familyLetters,
  letterFamily,
  type FamilyCase,
  type Hand,
} from "./letterfamilies";
import {
  ALPHABETS,
  LOWER,
  MODELLED,
  cellOf,
  clamp,
  groupsAcross,
  rowsAcross,
  ruleOf,
  tracePages,
  traceStyles,
  wrapPassage,
  writtenWords,
} from "./rows";
import { strokePattern, strokePatterns } from "./strokes";

/* ── What the family will and won't do ─────────────────────────────────── */

/** Rows per pattern on a strokes sheet. Four is a page of one pattern. */
export const MAX_LINES = 4;

/** How long a timed sheet may run. Past ten minutes it is a test, not a drill. */
export const MAX_MINUTES = 10;

/**
 * How long the timer runs when the config does not say: one minute for the
 * alphabet, which is the length the research task uses, and two for a
 * sentence, which takes longer to get going on.
 */
const DEFAULT_MINUTES: Record<FluencyTask, number> = {
  alphabet: 1,
  sentence: 2,
};

/** Longer than any list a parent would set, and short enough for a link. */
const MAX_TEXT = 2000;

const STYLES: PenmanshipStyle[] = [
  "strokes",
  "families",
  "sizes",
  "spacing",
  "check",
  "fluency",
];

/**
 * The style, or strokes when a saved config names one this build has never
 * heard of — the sheet that is right for the widest range of children, and a
 * page rather than nothing.
 */
const styleOf = (config: PenmanshipConfig): PenmanshipStyle =>
  STYLES.includes(config.style) ? config.style : "strokes";

const handOf = (config: PenmanshipConfig): Hand =>
  isCursive(config.font) ? "cursive" : "print";

/** A family is a set of one case, so `both` is read as the small letters. */
const caseOf = (config: PenmanshipConfig): FamilyCase =>
  config.letters === "upper" ? "upper" : "lower";

const taskOf = (config: PenmanshipConfig): FluencyTask =>
  config.task === "sentence" ? "sentence" : "alphabet";

const minutesOf = (config: PenmanshipConfig): number =>
  clamp(config.minutes ?? DEFAULT_MINUTES[taskOf(config)], 1, MAX_MINUTES);

const linesOf = (config: PenmanshipConfig): number =>
  clamp(config.lines ?? 1, 1, MAX_LINES);

/* ── What is written ───────────────────────────────────────────────────── */

/**
 * The families a sheet writes, each as its letters, in teaching order.
 *
 * One family when one was asked for, unless this hand has no such family — a
 * config that asked for the loop letters in print asked for a set print does
 * not have, and the page prints every family the hand does have rather than a
 * title over nothing.
 */
function familyGroups(config: PenmanshipConfig): string[][] {
  const hand = handOf(config);
  const letters = caseOf(config);
  const every = familiesOf(hand, letters).map((family) => family.id);
  const asked = config.family ? [config.family] : every;
  const groups = asked
    .map((family) => familyLetters(family, hand, letters))
    .filter((group) => group.length > 0);
  return groups.length > 0
    ? groups
    : every.map((family) => familyLetters(family, hand, letters));
}

/** What a check sheet writes: the parent's words, or an alphabet. */
function thingsOf(config: PenmanshipConfig): string[] {
  const words = writtenWords(config.words);
  if (words.length > 0) return words;
  return own(ALPHABETS, config.letters ?? "lower", ALPHABETS.lower);
}

/** The lines a parent typed, trimmed, blank ones dropped. */
const typedLines = (config: PenmanshipConfig): string[] =>
  (config.text ?? "")
    .slice(0, MAX_TEXT)
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line !== "");

/** One line a parent typed is one sentence; nothing typed is the five. */
function sentencesOf(config: PenmanshipConfig): string[] {
  const typed = typedLines(config);
  return typed.length > 0 ? typed : SPACING_SENTENCES;
}

/** What a timed sheet copies: the alphabet, or the first sentence typed. */
const modelOf = (config: PenmanshipConfig): string =>
  taskOf(config) === "alphabet"
    ? LOWER
    : (typedLines(config)[0] ?? FLUENCY_SENTENCE);

/** Everything the sheet writes, before the page has had its say. */
function contentOf(config: PenmanshipConfig): string[] {
  switch (styleOf(config)) {
    case "families":
      return familyGroups(config).flat();
    case "sizes":
      return [...ZONES.flatMap((zone) => zone.letters), ...ZONE_WORDS];
    case "spacing":
      return sentencesOf(config);
    case "check":
      return thingsOf(config);
    case "fluency":
      return [modelOf(config)];
    default:
      return [];
  }
}

/**
 * Every character the sheet will print, as one string, for `glyphHeight` and
 * `glyphAdvance` — which only want to know whether there is a capital or a
 * small letter anywhere on the page.
 */
const writtenOf = (config: PenmanshipConfig): string =>
  contentOf(config).join("");

/** The longest thing on the page, in characters. Never less than one. */
const longestOf = (things: string[]): number =>
  things.reduce((most, thing) => Math.max(most, thing.length), 1);

/* ── The progression ───────────────────────────────────────────────────── */

/**
 * How each repeat is drawn, per style.
 *
 * A check sheet is always a model and then empty places, whatever the trace
 * says: the child is to judge their own letters against the model, and a
 * traced letter is not their own. Never fewer than two, because a check with
 * nothing to check is not one. A timed sheet draws its model once and the rest
 * of the page is empty ruling, so its progression is one solid cell.
 */
function stylesOf(config: PenmanshipConfig): TraceStyle[] {
  switch (styleOf(config)) {
    case "check":
      return traceStyles({
        repeats: Math.max(2, config.repeats),
        trace: "none",
      });
    case "fluency":
      return ["solid"];
    default:
      return traceStyles(config);
  }
}

/* ── The page ──────────────────────────────────────────────────────────── */

export type PenmanshipLayout = {
  rule: Rule;
  box: Box;
  face: Face;
  /** The type size the ruling asks for, in mil. */
  em: Mil;
  /** How many repeats of the ruling the page holds, the count box paid for. */
  rows: number;
  /** How many things go on one row — one, for a sentence. */
  perRow: number;
  /** How many things the page holds altogether. */
  perPage: number;
};

/**
 * How much of the sheet fits, and how it is packed — the handwriting family's
 * arithmetic (§4), with two things of its own.
 *
 * A sentence fills the row, so its repeats go down the page and a page holds
 * a whole number of them. A timed sheet ends in a box for the count, which
 * comes off the height before the rows are counted, so the last row and the
 * box cannot both claim the same inch.
 */
export function penmanshipLayout(
  config: PenmanshipConfig,
  longest: number,
): PenmanshipLayout {
  const rule = ruleOf(config);
  const box = sheetBlockBox(headerOf(config));
  const face = faceOf(config.font);
  const written = writtenOf(config);
  const em = glyphEm(writingSpace(rule), face, written);
  const times = stylesOf(config).length;
  const style = styleOf(config);

  const height =
    style === "fluency"
      ? box.height -
        BLOCK_GAP -
        noteHeight(countLines(config, box, face), config.fontPt)
      : box.height;
  const rows = ruleCapacity(height, rule);

  if (style === "spacing") {
    return {
      rule,
      box,
      face,
      em,
      rows,
      perRow: 1,
      perPage: Math.floor(rows / Math.max(1, times)),
    };
  }

  const perRow = groupsAcross(box.width, em, face, written, longest, times);
  return { rule, box, face, em, rows, perRow, perPage: perRow * rows };
}

/* ── The rows ──────────────────────────────────────────────────────────── */

/**
 * A strokes sheet: one pattern to a row, the first row of each walking the
 * progression and any further rows the child's own.
 */
function strokeRows(config: PenmanshipConfig): Block[] {
  const { rule, rows } = penmanshipLayout(config, 1);
  const styles = stylesOf(config);
  const lines = linesOf(config);
  const drawn: StrokeRow[] = strokePatterns(config.patterns, rule).flatMap(
    (pattern) => [
      { pattern, cells: styles },
      ...Array.from({ length: lines - 1 }, () => ({
        pattern,
        cells: ["none" as const],
      })),
    ],
  );
  return paged(drawn, rows, (page) => ({ kind: "strokes", rule, rows: page }));
}

/** Groups of things written across the row, each group starting a new row. */
function groupedRows(config: PenmanshipConfig, groups: string[][]): Block[] {
  const { rule, rows, perRow } = penmanshipLayout(
    config,
    longestOf(groups.flat()),
  );
  const styles = stylesOf(config);
  const drawn = groups.flatMap((group) => rowsAcross(group, styles, perRow));
  return tracePages(rule, drawn, rows);
}

/**
 * The three heights, a zone to a row, and then words that mix them. The words
 * are packed by their own width, so their rows hold fewer groups than the
 * rows of single letters above them.
 */
function zoneRows(config: PenmanshipConfig): Block[] {
  const styles = stylesOf(config);
  const letters = penmanshipLayout(config, 1);
  const words = penmanshipLayout(config, longestOf(ZONE_WORDS));
  const drawn = [
    ...ZONES.flatMap((zone) =>
      rowsAcross(zone.letters, styles, letters.perRow),
    ),
    ...rowsAcross(ZONE_WORDS, styles, words.perRow),
  ];
  return tracePages(letters.rule, drawn, letters.rows);
}

/**
 * Sentences down the page, once per style, every row with a finger space
 * between its words so the model and the rows traced under it line up. Only
 * the solid model marks the spaces: a child tracing over a dotted sentence
 * would trace the marks too, and a mark between every word is not the habit
 * being taught. The wrap counts a finger space as one character, as it does
 * a space; a line the wider gaps make too wide shrinks to fit, model and
 * trace alike, so the two still line up.
 */
function spacingRows(config: PenmanshipConfig): Block[] {
  const { box, em, face, perPage, rule } = penmanshipLayout(config, 1);
  const styles = stylesOf(config);
  const across = fittedCharacters(box.width, em, face);
  const lines = sentencesOf(config).flatMap((line) =>
    wrapPassage(line, across),
  );
  const drawn: TraceRow[] = lines.flatMap((line) =>
    styles.map((style) => ({
      cells: [
        {
          ...cellOf(line, style),
          spaces: style === "solid" ? ("marked" as const) : ("finger" as const),
        },
      ],
    })),
  );
  return tracePages(rule, drawn, perPage * styles.length);
}

/** A string cut into pieces of at most `width` characters. */
function chunk(text: string, width: number): string[] {
  const size = Math.max(1, width);
  const out: string[] = [];
  for (let at = 0; at < text.length; at += size) {
    out.push(text.slice(at, at + size));
  }
  return out;
}

/** "one minute", "two minutes", "3 minutes". */
function minutesLabel(config: PenmanshipConfig): string {
  const minutes = minutesOf(config);
  const said = minutes === 1 ? "one" : minutes === 2 ? "two" : `${minutes}`;
  return `${said} minute${minutes === 1 ? "" : "s"}`;
}

const countText = (config: PenmanshipConfig): string =>
  `Letters written in ${minutesLabel(config)}: ________    Neat ones: ________`;

/**
 * How many lines the count box takes, counted the way a lesson counts a note
 * (`lessons/blocks.ts`): characters over what fits in one line inside the
 * box, and long before short.
 */
function countLines(config: PenmanshipConfig, box: Box, face: Face): number {
  const text = countText(config);
  const across = fittedCharacters(
    Math.max(1, box.width - 2 * NOTE_PAD),
    points(config.fontPt),
    face,
    text,
  );
  return Math.max(1, Math.ceil(text.length / across));
}

/**
 * A timed sheet: the model once, at the top, and then empty ruling to the
 * count box at the foot. One page and never more, because the page is the
 * task — "as many as you can" is measured against the paper in front of the
 * child, and a second sheet would be a second go.
 */
function fluencyRows(config: PenmanshipConfig): Block[] {
  const { box, em, face, rows, rule } = penmanshipLayout(config, 1);
  const model = modelOf(config);
  const across = fittedCharacters(box.width, em, face, model);
  const lines =
    taskOf(config) === "alphabet"
      ? chunk(model, across)
      : wrapPassage(model, across);
  const drawn: TraceRow[] = [
    ...lines.map((line) => ({ cells: [cellOf(line, "solid")] })),
    ...Array.from({ length: Math.max(0, rows - lines.length) }, () => ({
      cells: [cellOf("", "none")],
    })),
  ];
  return [
    { kind: "trace", rule, rows: drawn },
    {
      kind: "note",
      text: [countText(config)],
      lines: countLines(config, box, face),
    },
  ];
}

function bodyOf(config: PenmanshipConfig): Block[] {
  switch (styleOf(config)) {
    case "families":
      return groupedRows(config, familyGroups(config));
    case "sizes":
      return zoneRows(config);
    case "spacing":
      return spacingRows(config);
    case "check":
      return groupedRows(config, [thingsOf(config)]);
    case "fluency":
      return fluencyRows(config);
    default:
      return strokeRows(config);
  }
}

/* ── What it is called ─────────────────────────────────────────────────── */

const TITLE: Record<PenmanshipStyle, string> = {
  strokes: "Pencil strokes",
  families: "Letter families",
  sizes: "Tall, small and tail",
  spacing: "Finger spaces",
  check: "Circle your best one",
  fluency: "Against the clock",
};

/**
 * The two whose content changes with the hand. The rest are the same
 * exercise in either: a tall letter is tall in cursive too, and a space is a
 * space.
 */
const CURSIVE_TITLE: Partial<Record<PenmanshipStyle, string>> = {
  strokes: "Cursive strokes",
  families: "Cursive letter families",
};

function titleOf(config: PenmanshipConfig): string {
  const style = styleOf(config);
  return (
    (isCursive(config.font) ? CURSIVE_TITLE[style] : undefined) ?? TITLE[style]
  );
}

/**
 * What the child is being asked to do, read off the row rather than off the
 * config, for the reason the handwriting family reads its own that way: a
 * sheet with nothing dotted on it must not say "trace".
 */
function ask(
  styles: TraceStyle[],
  noun: string,
  where: string,
  verb = "write",
): string {
  const traced = styles.some((style) => MODELLED.has(style));
  const model = traced || styles.includes("solid");
  const alone = styles.includes("none");
  if (traced && alone) return `Trace each ${noun}, then ${verb} it ${where}.`;
  if (traced) return `Trace each ${noun}.`;
  if (model && alone) return `Copy each ${noun} ${where}.`;
  return `${verb === "write" ? "Write" : "Draw"} each ${noun}.`;
}

export function instructionOf(config: PenmanshipConfig): string {
  const styles = stylesOf(config);
  switch (styleOf(config)) {
    case "families":
      return `Every letter on a line starts with the same stroke. ${ask(styles, "letter", "on your own")}`;
    case "sizes":
      return `Tall letters touch the top line, small letters stop at the midline, and tails hang below it. ${ask(styles, "one", "on your own")}`;
    case "spacing":
      return `The mark between the words shows where a finger space goes. ${ask(styles, "sentence", "on the line below, with a space after every word")}`;
    case "check": {
      const tries = styles.length - 1;
      const noun =
        writtenWords(config.words).length > 0
          ? "word"
          : config.letters === "both"
            ? "pair"
            : "letter";
      return `Write each ${noun} ${tries === 1 ? "once" : `${tries} times`}, then circle the one that looks most like the model.`;
    }
    case "fluency": {
      const timer = `Set a timer for ${minutesLabel(config)}.`;
      const task =
        taskOf(config) === "alphabet"
          ? "Write the alphabet in order, a to z, again and again, as neatly as you can."
          : "Copy the sentence again and again, as neatly as you can.";
      return `${timer} ${task} When the timer rings, count the letters.`;
    }
    default:
      return `${ask(styles, "pattern", "on to the end of the line", "carry")} Keep every stroke the same size.`;
  }
}

/** How the content is described in one phrase, in the terms it was chosen by. */
function contentLabel(config: PenmanshipConfig): string {
  switch (styleOf(config)) {
    case "families": {
      const which = config.family
        ? letterFamily(config.family).label.toLowerCase()
        : "every family";
      return caseOf(config) === "upper" ? `${which}, capitals` : which;
    }
    case "sizes":
      return "the three heights";
    case "spacing": {
      const count = sentencesOf(config).length;
      return `${count} ${count === 1 ? "sentence" : "sentences"}`;
    }
    case "check": {
      const words = writtenWords(config.words).length;
      if (words > 0) return `${words} ${words === 1 ? "word" : "words"}`;
      switch (config.letters ?? "lower") {
        case "upper":
          return "capitals";
        case "both":
          return "capitals and small letters";
        default:
          return "small letters";
      }
    }
    case "fluency":
      return `${taskOf(config) === "alphabet" ? "the alphabet" : "a sentence"} in ${minutesLabel(config)}`;
    default: {
      const patterns = strokePatterns(config.patterns, ruleOf(config));
      return patterns.length === 1
        ? strokePattern(patterns[0]).label.toLowerCase()
        : `${patterns.length} patterns`;
    }
  }
}

/**
 * The header this sheet will actually print — written once and read by both the
 * layout and the build, because a header the layout under-reserved for is a row
 * of writing below the bottom margin.
 */
function headerOf(config: PenmanshipConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? titleOf(config),
    instructions: config.instructions ?? instructionOf(config),
  };
}

/** One line naming what the sheet holds, for the catalog and the record. */
function describePenmanship(config: PenmanshipConfig): string {
  const rule = ruleOf(config);
  const stepped = steppedSize(rule);
  const times = stylesOf(config).length;
  return [
    titleOf(config),
    contentLabel(config),
    rulingOf(rule).label.toLowerCase(),
    ...(stepped ? [`${stepped} letters`] : []),
    ...(styleOf(config) === "fluency"
      ? []
      : [`written ${times} ${times === 1 ? "time" : "times"}`]),
  ].join(" — ");
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

function buildPenmanshipSheet(config: PenmanshipConfig, seed: number): Sheet {
  const head = headerOf(config);
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    font: config.font,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
    },
    blocks: bodyOf(config),
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const PENMANSHIP_SHEET: SheetSpec<PenmanshipConfig> = {
  world: SHEET_WORLD,
  build: buildPenmanshipSheet,
  // The sheet is its own key, as a handwriting sheet is: the model is already
  // on it, and nothing on it has a right answer.
  key: (sheet) => sheet,
  describe: describePenmanship,
};
