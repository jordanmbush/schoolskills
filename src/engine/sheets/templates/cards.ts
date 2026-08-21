/**
 * The paper that gets cut up: flashcards, name tags, bookmarks, memory-verse
 * cards and certificates.
 *
 * One family and one geometry, because the geometry is the whole difficulty.
 * Everything else on the printables shelf is checked by reading it; this one is
 * checked with a pair of scissors, and a sheet that is a sixteenth of an inch
 * out is a stack of cards with a white sliver down one side of every other one.
 *
 * §11 sets out the cut geometry, the eighth-inch rounding and the fold offered
 * in place of a printed back. The arithmetic below is what holds to all three.
 */
import { declaredWidth, sheetBlockBox } from "../chrome";
import type { Box } from "../layout";
import { inches, own, toInches, whole } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import type {
  Block,
  CardFace,
  CardStyle,
  CardsConfig,
  Mil,
  Sheet,
  SheetOptions,
} from "../types";

import { copyworkSource } from "../writing/copywork";

/* ── The layouts ─────────────────────────────────────────────────────────
   A table rather than a free number, because how many cards fit *across* is a
   fact about the shape of a card and not something to be asked for: four
   bookmarks to a page is four columns of one, and four flashcards is two by
   two. §17 asks for 2-up and 4-up; every style here has both.               */

type Layout = { up: number; columns: number; rows: number };

const CARD_LAYOUTS: Record<string, Layout[]> = {
  flashcard: [
    { up: 2, columns: 1, rows: 2 },
    { up: 4, columns: 2, rows: 2 },
    { up: 6, columns: 2, rows: 3 },
    { up: 8, columns: 2, rows: 4 },
    { up: 10, columns: 2, rows: 5 },
  ],
  "name-tag": [
    { up: 2, columns: 1, rows: 2 },
    { up: 4, columns: 2, rows: 2 },
    { up: 6, columns: 2, rows: 3 },
    { up: 8, columns: 2, rows: 4 },
  ],
  // Along the page rather than down it: a bookmark is as long as a book is
  // tall, so the count is columns and the row is always one.
  bookmark: [
    { up: 2, columns: 2, rows: 1 },
    { up: 3, columns: 3, rows: 1 },
    { up: 4, columns: 4, rows: 1 },
  ],
  "verse-card": [
    { up: 2, columns: 1, rows: 2 },
    { up: 4, columns: 2, rows: 2 },
    { up: 6, columns: 2, rows: 3 },
    { up: 8, columns: 2, rows: 4 },
  ],
  // One to a page is the certificate somebody frames, and it is the default.
  // The other two are award slips: a class set of "well done" cards, and the
  // four-up §17 asks of every card.
  certificate: [
    { up: 1, columns: 1, rows: 1 },
    { up: 2, columns: 1, rows: 2 },
    { up: 4, columns: 2, rows: 2 },
  ],
};

/** How many of each a page holds unless a config says otherwise. */
const DEFAULT_UP: Record<string, number> = {
  flashcard: 8,
  "name-tag": 4,
  bookmark: 4,
  "verse-card": 6,
  certificate: 1,
};

/** The division a card's dimensions are rounded down to: an eighth of an inch. */
export const CARD_STEP: Mil = inches(0.125);

/** The smallest card worth cutting out. Below this, a layout is refused. */
const MIN_CARD: Mil = inches(0.75);

/**
 * The largest a card is allowed to be, on the one style that has a ceiling.
 *
 * A bookmark is one column of a page and would otherwise be nine and a half
 * inches long, which does not fit in a book. Seven and a half is a paperback
 * plus a tab to hold, and the inch it gives up stays as paper at the foot of
 * the sheet: the cut lines have to be where a bookmark ends, not where the page
 * does.
 */
const MAX_CARD: Record<string, { width?: Mil; height?: Mil }> = {
  bookmark: { height: inches(7.5) },
};

/** How much of a card's width a heading may take before it is set smaller. */
const HEADING_FILL = 0.86;

/**
 * The two styles a tent means something for.
 *
 * A folded name tag stands on a desk and reads from both sides, and a folded
 * flashcard does the same on a table. A folded certificate is not a thing and a
 * folded bookmark is a bookmark half as long, so the switch is honoured where
 * it makes an object and ignored where it would only make a crease.
 */
const foldable = (style: CardStyle): boolean =>
  style === "name-tag" || style === "flashcard";

/**
 * The layouts a style has, for the control that offers them.
 *
 * Read out of the table rather than listed again in the panel, so the control
 * can never offer a count the family would then quietly move somebody off.
 */
export const layoutsFor = (style: string): Layout[] =>
  own(CARD_LAYOUTS, style, CARD_LAYOUTS.flashcard);

/** Whether a tent means anything on this style — see `foldable`. */
export const canFold = (style: CardStyle): boolean => foldable(style);

/** The layout a config asks for, or the nearest one this style actually has. */
export function layoutOf(config: CardsConfig): Layout {
  const layouts = own(CARD_LAYOUTS, config.style, CARD_LAYOUTS.flashcard);
  const asked = whole(config.up, own(DEFAULT_UP, config.style, 8), 1, 64);
  return (
    layouts.find((layout) => layout.up === asked) ??
    // The nearest count this style can lay out, rather than a refusal: `up`
    // arrives from a saved sheet as readily as from the control beside the
    // preview, and five flashcards should print as four rather than as none.
    layouts.reduce((best, layout) =>
      Math.abs(layout.up - asked) < Math.abs(best.up - asked) ? layout : best,
    )
  );
}

/** A length rounded down to a whole number of eighths of an inch. */
const toStep = (value: Mil): Mil => Math.floor(value / CARD_STEP) * CARD_STEP;

export type CardGrid = Layout & { card: { width: Mil; height: Mil } };

/**
 * The grid, and the size of one card on paper.
 *
 * A layout whose card would come out smaller than `MIN_CARD` is not drawn at
 * all — better an empty block than a page of confetti — and the caller finds
 * that out by reading `card.width`, which is zero.
 */
export function cardGrid(config: CardsConfig, box: Box): CardGrid {
  const layout = layoutOf(config);
  const ceiling = own(MAX_CARD, config.style, {});
  const width = toStep(
    Math.min(ceiling.width ?? Infinity, Math.floor(box.width / layout.columns)),
  );
  const height = toStep(
    Math.min(ceiling.height ?? Infinity, Math.floor(box.height / layout.rows)),
  );
  const fits = width >= MIN_CARD && height >= MIN_CARD;
  return {
    ...layout,
    card: fits ? { width, height } : { width: 0, height: 0 },
  };
}

/* ── What is printed on a face ────────────────────────────────────────── */

/** The words a config gave, trimmed and emptied of blanks. */
const wordsOf = (config: CardsConfig): string[] =>
  (Array.isArray(config.words) ? config.words : [])
    .filter((word): word is string => typeof word === "string")
    .map((word) => word.trim())
    .filter((word) => word !== "");

/** The verse, through the one door a passage id is ever resolved by (§12). */
const verseOf = (config: CardsConfig) =>
  copyworkSource({
    passage: config.passage,
    translation: config.translation,
    text: config.text,
  });

/**
 * How many ruled lines a blank memory-verse card carries.
 *
 * Three: a verse a family is learning is one or two lines of their own
 * handwriting and the third is the reference. A card ruled to the bottom would
 * have no room round the writing, and this one goes in a pocket.
 */
const BLANK_VERSE_LINES = 3;

/** What a certificate says above the lines, where nobody has said otherwise. */
const AWARD_TITLE = "Certificate of Achievement";

/**
 * The faces, one per card on the page.
 *
 * Always exactly `columns × rows` of them, even when there is nothing to put on
 * most: dropping the empty seven of ten would be a page with a hole in it and
 * cut guides round nothing.
 */
export function cardFaces(config: CardsConfig, count: number): CardFace[] {
  const words = wordsOf(config);
  const verse = verseOf(config);
  const verseText = verse.text.replaceAll("\n", " ").trim();

  return Array.from({ length: Math.max(0, count) }, (_, index): CardFace => {
    switch (config.style) {
      case "name-tag":
        return {
          eyebrow: "Hello, my name is",
          ...(words[index] ? { heading: words[index] } : { lines: 1 }),
        };
      case "bookmark":
      case "verse-card":
        // The same content on two different rectangles, which is what the pair
        // is: a memory-verse card goes in a pocket and a Scripture bookmark
        // goes in the book it was read out of.
        if (verseText !== "")
          return {
            ...(verse.title ? { heading: verse.title } : {}),
            body: verseText,
          };
        return config.style === "verse-card"
          ? { lines: BLANK_VERSE_LINES }
          : {};
      case "certificate":
        return {
          heading: config.title ?? AWARD_TITLE,
          ...(config.reason ? { body: config.reason } : {}),
          fields: config.reason
            ? ["Awarded to", "Date", "Signed"]
            : ["Awarded to", "For", "Date", "Signed"],
        };
      case "flashcard":
      default:
        return words[index] ? { heading: words[index] } : {};
    }
  });
}

/** How large a heading is set on each style, before the card has its say. */
const HEADING_EMS: Record<string, number> = {
  flashcard: 2.6,
  "name-tag": 2.2,
  bookmark: 1.3,
  "verse-card": 1.5,
  certificate: 2.2,
};

/**
 * The heading size: the style's own, or what the longest of them will fit at.
 *
 * Declared rather than measured, off the face's own mean advance (§4). One size
 * for every card, and it is the smallest any of them needs — per card would
 * print a page whose type size varied with how long a word happened to be,
 * which reads as a fault whether or not it is one.
 *
 * A folded card halves the room, because the writing is on one panel.
 */
export function headingEms(
  config: CardsConfig,
  faces: CardFace[],
  card: { width: Mil },
): number {
  const options: SheetOptions = {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: [],
    font: config.font,
  };
  const room = card.width * HEADING_FILL;
  return faces.reduce(
    (smallest, face) => {
      const at1em = declaredWidth(face.heading ?? "", options, 1);
      if (at1em <= 0) return smallest;
      return Math.min(smallest, room / at1em);
    },
    own(HEADING_EMS, config.style, 2),
  );
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

const TITLE: Record<CardStyle, string> = {
  flashcard: "Flashcards",
  "name-tag": "Name tags",
  bookmark: "Bookmarks",
  "verse-card": "Memory verse cards",
  certificate: "Certificates",
};

/**
 * No title on the paper, and no instruction either.
 *
 * The same argument the lined-paper family makes: a page of blank flashcards
 * with "Blank flashcards" printed across the top is a page with one fewer card
 * on it. The header holds whatever a parent explicitly put there, and the page
 * that *names* the sheet is the catalog page above it.
 */
function headerOf(config: CardsConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    ...(config.title && config.style !== "certificate"
      ? { title: config.title }
      : {}),
    ...(config.instructions ? { instructions: config.instructions } : {}),
    font: config.font,
  };
}

const cardBox = (config: CardsConfig): Box => {
  const verse = verseOf(config);
  return sheetBlockBox(headerOf(config), false, {
    note: "Answer key",
    ...(verse.credit ? { source: verse.credit } : {}),
  });
};

/** Nothing on this shelf withholds anything — see `formKeyed`. */
export const cardsKeyed = (): boolean => false;

export function buildCardsSheet(config: CardsConfig, seed: number): Sheet {
  const box = cardBox(config);
  const grid = cardGrid(config, box);
  const faces = cardFaces(config, grid.columns * grid.rows);
  const verse = verseOf(config);

  const blocks: Block[] =
    grid.card.width <= 0
      ? []
      : [
          {
            kind: "cutcards",
            card: grid.card,
            columns: grid.columns,
            rows: grid.rows,
            faces,
            headingEms: headingEms(config, faces, grid.card),
            frame: config.style === "certificate" ? "award" : "plain",
            ...(config.fold === true && foldable(config.style)
              ? { fold: true }
              : {}),
          },
        ];

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      // Empty rather than absent, the way the paper family leaves it: an empty
      // title draws no heading at all (`SheetHead`), and `headerOf` is the one
      // place that decides whether there is one, so what is reserved and what
      // is printed are one answer.
      title: headerOf(config).title ?? "",
      instructions: config.instructions,
      fields: config.fields,
    },
    blocks,
    footer: {
      credit: SHEET_CREDIT,
      url: SHEET_URL,
      seed,
      ...(verse.credit ? { source: verse.credit } : {}),
    },
    answers: false,
  };
}

/** A length as somebody would say it: "3.75", "1.875", "10". */
export const inchLabel = (mil: Mil): string =>
  String(Number(toInches(mil).toFixed(3)));

/**
 * One line naming the sheet, and it names the two numbers that matter.
 *
 * How many, and how big — because "blank flashcards" is a shape of paper rather
 * than a topic, and the count and the dimension are the only things that tell
 * one page of them from another. The catalog pages quote both, and
 * `_templates.test.ts` holds the prose to what the block draws.
 */
export function describeCards(config: CardsConfig): string {
  const grid = cardGrid(config, cardBox(config));
  const name = own(TITLE, config.style, TITLE.flashcard);
  if (grid.card.width <= 0) return `${name} — too small to cut on this paper`;
  const size = `${inchLabel(grid.card.width)} by ${inchLabel(grid.card.height)} inches`;
  const folded =
    config.fold === true && foldable(config.style)
      ? ", folded to stand up"
      : "";
  // The count in the middle rather than at the front: a count-first sentence
  // prints "1 certificates to a page" on the one style whose page holds a
  // single card.
  return `${name}, ${grid.columns * grid.rows} to a page, ${size}${folded}`;
}

export const CARDS_SHEET: SheetSpec<CardsConfig> = {
  id: "cards",
  label: "Cards, tags and bookmarks",
  world: SHEET_WORLD,
  build: buildCardsSheet,
  key: (sheet) => ({
    ...sheet,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeCards,
};
