/**
 * Counters, already sorted into the groups a division is about (§23).
 *
 * The picture division is taught from: twelve dots dealt into three rings, or
 * ringed three at a time along a row, or set out in three rows of four. It is
 * drawn beside a problem and on its own as the picture a lesson is about, the
 * way a number line is, and for the same reason one module places the dots for
 * both: a family reserves the height before anything is drawn (§4), and the
 * renderer has to land every dot inside it.
 *
 * So the geometry is worked out here, dot by dot, and the renderer only draws
 * what it is handed. That is also what makes the picture checkable: a test can
 * count the dots and the rings without a browser, and hold them to the
 * sentence printed beside them.
 *
 * Sizes are inches and do not scale with the body type, as a fraction bar's do
 * not: a counter is a thing to count, and at 18pt a child needs bigger words,
 * not bigger buttons.
 */
import type { CounterLayout, Counters, Mil, Point } from "./types";

import { inches } from "./paper";

/** A counter, across. */
export const DOT: Mil = inches(0.14);
/** Between two counters in one group. */
export const DOT_GAP: Mil = inches(0.06);
/** From the outermost counters of a group to the ring round them. */
export const RING_PAD: Mil = inches(0.07);
/** Between one ring and the next along a row. */
export const RING_GAP: Mil = inches(0.16);
/** Between one row of rings and the next when they wrap. */
export const ROW_GAP: Mil = inches(0.1);

/** The gutter an array's row and column counts are written in. */
export const LABEL_ROOM: Mil = inches(0.24);
/** The size those counts are set at — about 11½pt. */
export const LABEL_SIZE: Mil = 160;

/**
 * The strip round the drawing, so a ring on the edge keeps the outer half of
 * its stroke. The renderer draws rings at `RULE`, which is under this.
 */
const EDGE: Mil = 12;

/**
 * What the caption under a picture takes, in ems of the body size — the
 * `.sheet__caption` size over the sheet's own leading, 0.85 × 1.35, rounded
 * up. The caption is HTML text under the drawing rather than part of it, so
 * the family reserves for it separately.
 */
export const CAPTION_EMS = 1.15;

/**
 * The most counters one picture holds: past two dozen a child stops counting
 * and starts guessing (§23).
 */
export const MOST_DOTS = 24;

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value) || low));

export type Ring = { x: Mil; y: Mil; width: Mil; height: Mil };
export type Label = { x: Mil; y: Mil; text: string };

/** Everything the renderer draws, placed. */
export type Geometry = { dots: Point[]; rings: Ring[]; labels: Label[] };

/**
 * A counters picture with its height worked out.
 *
 * `total` is held to `MOST_DOTS` and `per` to the total, so a config from
 * outside this build draws something countable rather than a page of dots.
 */
export function counters(
  total: number,
  per: number,
  layout: CounterLayout,
  width: Mil,
  over: { rings?: boolean; caption?: string } = {},
): Counters {
  const dots = clamp(total, 1, MOST_DOTS);
  const partial: Counters = {
    total: dots,
    per: clamp(per, 1, dots),
    layout,
    rings: over.rings ?? true,
    caption: over.caption,
    width: Math.max(1, Math.floor(width)),
    height: 0,
  };
  return { ...partial, height: extent(countersGeometry(partial)) };
}

/** How tall a placed drawing stands, from the top edge to under the lowest thing in it. */
function extent(geometry: Geometry): Mil {
  const low = Math.max(
    0,
    ...geometry.dots.map((dot) => dot.y + DOT / 2),
    ...geometry.rings.map((ring) => ring.y + ring.height),
    ...geometry.labels.map((label) => label.y),
  );
  return low + EDGE;
}

/**
 * Where every dot, ring and label goes, from the top-left of the drawing.
 *
 * The three layouts are two shapes of placing. An array is a grid with its
 * counts written in the gutters. Sharing and grouping are both *clusters* laid
 * along a row that wraps — a cluster is `per` dots packed square for sharing,
 * because a ring of twelve in a line is a queue rather than a pile, and packed
 * in a line for grouping, because that is what "ring the next three" looks
 * like. What does not divide is one more cluster with no ring round it.
 *
 * Grouping with the rings left off is the one case that is not clusters at
 * all: the dots are spaced evenly and wrap where the width says (§23).
 */
export function countersGeometry(picture: Counters): Geometry {
  const { total, per, layout } = picture;
  if (layout === "array") return array(total, per);
  if (layout === "group" && !picture.rings) return evenly(total, picture.width);

  const { groups, left } = grouped(picture);
  const cluster = (count: number, ringed: boolean): Cluster => ({
    count,
    ringed,
    shape: layout === "share" ? square(count) : { columns: count, rows: 1 },
  });
  const clusters = Array.from({ length: groups }, () =>
    cluster(per, picture.rings),
  );
  if (left > 0) clusters.push(cluster(left, false));
  return flow(clusters, picture.width);
}

/** How `n` dots pack for a sharing ring: as near square as they go. */
function square(n: number): { columns: number; rows: number } {
  const columns = Math.max(1, Math.ceil(Math.sqrt(n)));
  return { columns, rows: Math.max(1, Math.ceil(n / columns)) };
}

type Cluster = {
  count: number;
  ringed: boolean;
  shape: { columns: number; rows: number };
};

const pitch = (n: number): Mil => n * DOT + Math.max(0, n - 1) * DOT_GAP;

/**
 * Clusters along a row, wrapping when the next would run past the width. A
 * cluster is never split, so a ring is never cut by a row break; a cluster
 * wider than the whole width gets a row of its own and runs past it, which is
 * the cheap side to be wrong on.
 */
function flow(clusters: Cluster[], width: Mil): Geometry {
  const geometry: Geometry = { dots: [], rings: [], labels: [] };
  let x = EDGE;
  let y = EDGE;
  let tallest = 0;

  for (const cluster of clusters) {
    const { columns, rows } = cluster.shape;
    const w = pitch(columns) + 2 * RING_PAD;
    const h = pitch(rows) + 2 * RING_PAD;
    if (x > EDGE && x + w + EDGE > width) {
      x = EDGE;
      y += tallest + ROW_GAP;
      tallest = 0;
    }
    if (cluster.ringed) geometry.rings.push({ x, y, width: w, height: h });
    for (let at = 0; at < cluster.count; at += 1) {
      const column = at % columns;
      const row = Math.floor(at / columns);
      geometry.dots.push({
        x: x + RING_PAD + DOT / 2 + column * (DOT + DOT_GAP),
        y: y + RING_PAD + DOT / 2 + row * (DOT + DOT_GAP),
      });
    }
    x += w + RING_GAP;
    tallest = Math.max(tallest, h);
  }
  return geometry;
}

/** Dots one after another, the same air between every pair, wrapping by dot. */
function evenly(total: number, width: Mil): Geometry {
  const across = Math.max(
    1,
    Math.floor((width - 2 * EDGE + DOT_GAP) / (DOT + DOT_GAP)),
  );
  const dots = Array.from({ length: total }, (_, at) => ({
    x: EDGE + DOT / 2 + (at % across) * (DOT + DOT_GAP),
    y: EDGE + DOT / 2 + Math.floor(at / across) * (DOT + DOT_GAP),
  }));
  return { dots, rings: [], labels: [] };
}

/**
 * Rows of `per`, with the row count down the left and the column count along
 * the top. A total that is not a whole number of rows leaves the last row
 * short, which is what a remainder looks like in an array.
 */
function array(total: number, per: number): Geometry {
  const rows = Math.ceil(total / per);
  const dots = Array.from({ length: total }, (_, at) => ({
    x: LABEL_ROOM + DOT / 2 + (at % per) * (DOT + DOT_GAP),
    y: LABEL_ROOM + DOT / 2 + Math.floor(at / per) * (DOT + DOT_GAP),
  }));
  // A numeral's baseline sits about a third of its size below its middle.
  const sink = Math.round(LABEL_SIZE * 0.35);
  return {
    dots,
    rings: [],
    labels: [
      {
        x: LABEL_ROOM + pitch(per) / 2,
        y: LABEL_ROOM / 2 + sink,
        text: String(per),
      },
      {
        x: LABEL_ROOM / 2,
        y: LABEL_ROOM + pitch(rows) / 2 + sink,
        text: String(rows),
      },
    ],
  };
}

/** How many groups the picture shows, and how many dots stand outside them. */
export function grouped(picture: Counters): { groups: number; left: number } {
  const groups = Math.floor(picture.total / picture.per);
  return { groups, left: picture.total - groups * picture.per };
}
