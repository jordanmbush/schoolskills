/**
 * Things to cut out and fold up, or cut out and spin.
 *
 * Two sheets, and both are objects rather than pages. They share a family
 * because they share the difficulty — the ink says where the scissors go, and
 * being a sixteenth of an inch out is a cube that will not close or a spinner
 * that is not fair.
 *
 * Both of §11's claims about them are held here by construction rather than by
 * arithmetic: the net states the three pairs it folds into and the pips are
 * derived from those, and the spinner block carries a radius and a list of
 * labels with no angles in it at all.
 */
import { sheetBlockBox } from "../chrome";
import { inches, own, whole } from "../paper";
import type { Box } from "../layout";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import type {
  Block,
  Mil,
  Net,
  NetConfig,
  NetEdge,
  NetFace,
  NetStyle,
  NetTab,
  Sheet,
  SheetOptions,
} from "../types";

import { CARD_STEP, inchLabel } from "./cards";

/* ── The cross ────────────────────────────────────────────────────────────
   Three columns and four rows, with the six faces at the indices below. The
   grid is stated here so a renderer places nothing: where a square sits and
   where a fold falls are the same fact, and a layout worked out twice is a
   layout that can be worked out two ways.                                   */

const NET_COLUMNS = 3;
const NET_ROWS = 4;

/** Where each face sits in the grid, row-major. */
const TOP = 1;
const LEFT = 3;
const FRONT = 4;
const RIGHT = 5;
const BOTTOM = 7;
const BACK = 10;

/**
 * The three pairs the net folds into, as grid indices.
 *
 * This is the Latin cross: the column `TOP, FRONT, BOTTOM, BACK` wraps the
 * cube, so its first and third are opposite and so are its second and fourth,
 * and the two flaps either side of `FRONT` end up on opposite sides of it.
 * Everything about the numbering below follows from this list, and the suite
 * checks the list itself against a folded cube.
 */
export const OPPOSITE: Array<[number, number]> = [
  [TOP, BOTTOM],
  [FRONT, BACK],
  [LEFT, RIGHT],
];

/** What a die's faces add up to across a pair. */
export const DICE_PAIR = 7;

/**
 * The seven joins, as the two free edges that meet at each.
 *
 * Reading one of them: the top face's left edge meets the left face's top edge,
 * because going up the net from the front face and going left from it arrive at
 * the same cube edge from either side.
 */
export const JOINS: Array<[[number, NetEdge], [number, NetEdge]]> = [
  [
    [TOP, "left"],
    [LEFT, "top"],
  ],
  [
    [TOP, "right"],
    [RIGHT, "top"],
  ],
  [
    [TOP, "top"],
    [BACK, "bottom"],
  ],
  [
    [LEFT, "bottom"],
    [BOTTOM, "left"],
  ],
  [
    [RIGHT, "bottom"],
    [BOTTOM, "right"],
  ],
  [
    [LEFT, "left"],
    [BACK, "left"],
  ],
  [
    [RIGHT, "right"],
    [BACK, "right"],
  ],
];

/**
 * One tab per join, and it is the first edge of each pair.
 *
 * Which of the two carries it does not matter to the cube and matters to the
 * scissors: taking the first of every pair puts all seven on three faces — the
 * top and the two flaps — which is a shape somebody can cut round without
 * turning the paper over.
 */
export const DICE_TABS: NetTab[] = JOINS.map(([[face, edge]]) => ({
  face,
  edge,
}));

/**
 * How many pips are on each face.
 *
 * Assigned from `OPPOSITE` rather than typed out, so a numbering that did not
 * add to seven could not be written here.
 */
export function dicePips(): Map<number, number> {
  const pips = new Map<number, number>();
  OPPOSITE.forEach(([face, against], index) => {
    pips.set(face, index + 1);
    pips.set(against, DICE_PAIR - (index + 1));
  });
  return pips;
}

/** How far a glue tab sticks out, as a share of the edge it hangs off. */
const TAB_SHARE = 0.18;

/**
 * How long one edge of the cube is.
 *
 * Bounded by both dimensions of the page, with room for the tabs that stick out
 * past the squares — one beyond the left column, one beyond the right, one
 * above the top — and then rounded down to an eighth of an inch for the reason
 * a card is (`CARD_STEP`).
 */
export function cubeEdge(box: Box): Mil {
  const across = box.width / (NET_COLUMNS + 2 * TAB_SHARE);
  const down = box.height / (NET_ROWS + TAB_SHARE);
  const edge = Math.floor(Math.min(across, down));
  return Math.max(0, Math.floor(edge / CARD_STEP) * CARD_STEP);
}

/** The labels a config gave, trimmed, in order. */
const labelsOf = (config: NetConfig): string[] =>
  (Array.isArray(config.labels) ? config.labels : [])
    .filter((label): label is string => typeof label === "string")
    .map((label) => label.trim());

/**
 * The die, as a net.
 *
 * A face carries pips *or* a word, never both: a die with "jump" written across
 * three spots is a die a child has to read twice. Where a parent has given six
 * words the pips go.
 */
export function cubeNet(config: NetConfig, box: Box): Net {
  const edge = cubeEdge(box);
  const pips = dicePips();
  const labels = labelsOf(config);
  const written = labels.some((label) => label !== "");

  const faces = Array.from(
    { length: NET_COLUMNS * NET_ROWS },
    (_, index): NetFace | null => {
      const spots = pips.get(index);
      if (spots === undefined) return null;
      // In reading order of the *cube's* numbering, not of the grid: a parent
      // who typed six words expects the first on the face they call one.
      const label = labels[spots - 1] ?? "";
      return written ? { pips: 0, label } : { pips: spots };
    },
  );

  return {
    shape: "cube",
    edge,
    columns: NET_COLUMNS,
    rows: NET_ROWS,
    faces,
    tabs: DICE_TABS,
    tab: Math.round(edge * TAB_SHARE),
  };
}

/* ── The spinner ─────────────────────────────────────────────────────────── */

/** How many equal sectors a spinner may be cut into. */
export const SECTORS = { min: 2, max: 12 };

/** The air between the dial and the pointer that is cut out under it. */
const POINTER_GAP: Mil = inches(0.3);

/** The pointer, as shares of the dial's radius: how long, and how wide. */
const POINTER_LENGTH = 0.9;
const POINTER_WIDTH = 0.22;

/**
 * The dial and its pointer, sized to the page.
 *
 * The pointer is cut out of the same sheet and pinned through the middle of the
 * dial, so the page has to hold both — which is why the radius is solved for
 * rather than set. A dial sized to the page with a pointer added underneath is
 * a pointer below the bottom margin.
 */
export function spinnerNet(config: NetConfig, box: Box): Net {
  const count = whole(config.sectors, 6, SECTORS.min, SECTORS.max);
  const given = labelsOf(config);
  const sectors = Array.from(
    { length: count },
    (_, index) => given[index] || String(index + 1),
  );

  const down = (box.height - POINTER_GAP) / (2 + POINTER_LENGTH);
  const radius = Math.max(0, Math.floor(Math.min(box.width / 2, down)));

  return {
    shape: "spinner",
    radius,
    sectors,
    pointer: {
      length: Math.round(radius * POINTER_LENGTH),
      width: Math.round(radius * POINTER_WIDTH),
    },
  };
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

const TITLE: Record<NetStyle, string> = {
  dice: "Dice to cut out",
  spinner: "Spinner",
};

const INSTRUCTION: Record<string, string> = {
  dice: "Cut round the outside, fold along every dotted line, and glue each tab inside the cube.",
  spinner:
    "Cut out the circle and the arrow. Push a split pin through the middle of both so the arrow turns freely.",
};

const titleOf = (config: NetConfig): string =>
  config.title ?? own(TITLE, config.style, TITLE.dice);

const instructionOf = (config: NetConfig): string =>
  config.instructions ?? own(INSTRUCTION, config.style, INSTRUCTION.dice);

/** What the chrome will hold — see the note on `headerOf` in forms.ts. */
function headerOf(config: NetConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: titleOf(config),
    instructions: instructionOf(config),
    font: config.font,
  };
}

const netBox = (config: NetConfig): Box =>
  sheetBlockBox(headerOf(config), false, { note: "Answer key" });

/** Nothing on this shelf withholds anything — see `formKeyed`. */
export const netKeyed = (): boolean => false;

export function buildNetSheet(config: NetConfig, seed: number): Sheet {
  const box = netBox(config);
  const net =
    config.style === "spinner" ? spinnerNet(config, box) : cubeNet(config, box);
  const drawn =
    net.shape === "spinner" ? net.radius > 0 : net.edge >= CARD_STEP;

  const blocks: Block[] = drawn ? [{ kind: "net", net }] : [];

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: titleOf(config),
      instructions: instructionOf(config),
      fields: config.fields,
    },
    blocks,
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

/** One line naming the sheet, and the number that makes it that sheet. */
export function describeNet(config: NetConfig): string {
  const box = netBox(config);
  if (config.style === "spinner") {
    const net = spinnerNet(config, box);
    if (net.shape !== "spinner") return TITLE.spinner;
    const count = net.sectors.length;
    // The angle only where a whole turn divides into the count. Rounded, seven
    // sectors print as "7 equal sectors of 51°", a sum that comes to 357 — and
    // on the one object whose purpose is "do you think this is fair?", an angle
    // a child can add up and find short is the worst line to put under it. Two
    // of the eleven counts divide 360 unevenly, and say what is true instead.
    return 360 % count === 0
      ? `Spinner cut into ${count} equal sectors of ${360 / count}°`
      : `Spinner cut into ${count} equal sectors, a whole turn divided ${count} ways`;
  }
  const edge = cubeEdge(box);
  return `A die to cut out and fold, ${inchLabel(edge)} inches on a side, opposite faces adding to ${DICE_PAIR}`;
}

export const NET_SHEET: SheetSpec<NetConfig> = {
  world: SHEET_WORLD,
  build: buildNetSheet,
  key: (sheet) => ({
    ...sheet,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeNet,
};
