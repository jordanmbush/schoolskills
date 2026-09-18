/**
 * Where the guides on a model letter go (§25): a dot where each stroke
 * starts, an arrow running alongside it to say which way the pen goes, and
 * the stroke's number by the dot.
 *
 * The arrow is not on the stroke. A head sitting on the line it points
 * along is one more mark on a letter a child is trying to read, and on a
 * bowl it looks like a bump in the curve. So it runs *beside* the stroke, a
 * little way off, following its shape for a short stretch — the way a
 * teacher draws one next to a letter on the board — and on the side away
 * from the letter's middle, where there is no ink to run into.
 *
 * Everything here is in the row's mil, on paths already placed; the row
 * decides sizes and this decides positions, so the layout can be tested
 * without rendering anything.
 */
import {
  along,
  arrowhead,
  beside,
  strokeLength,
  type Point,
  type Segment,
} from "./glyphs";
import type { StrokeInk } from "./strokes";

export type Guide = {
  start: Point;
  /** The arrow's shaft, or empty when the stroke is too short to carry one. */
  line: Point[];
  /** The arrowhead at the shaft's end, as path data, or null with no shaft. */
  head: string | null;
  number: Point;
};

export type GuideSet = {
  /** The start dot's radius. */
  dot: number;
  /** The shaft's stroke width. */
  shaft: number;
  /** The stroke number's type size. */
  numeral: number;
  guides: Guide[];
};

/**
 * Where along the stroke the arrow runs, as shares of the writing space.
 * Short, so that on a letter that starts with a straight bar — the `e` —
 * the arrow is over before the stroke turns, and reads as "across".
 */
const ARROW = { from: 0.15, to: 0.4 };

/** The middle of a letter's ink. */
export function centreOf(strokes: Segment[][]): Point {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const segment of strokes.flat()) {
    for (let i = 0; i < segment.points.length; i += 2) {
      xs.push(segment.points[i]);
      ys.push(segment.points[i + 1]);
    }
  }
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The stroke number's place: by the tail of its own arrow when it has one,
 * a little further out, so the number and the arrow read as one mark and a
 * letter whose strokes all start in one corner — the `a` with its bowl and
 * stem — says which number is whose. Failing that, or when that spot is
 * taken, near the dot: straight out from the letter's middle first, then
 * swung to either side, then the same three a little further out, and the
 * first spot clear of every dot, every arrow and every number already
 * placed wins.
 */
function numberAt(
  start: Point,
  centre: Point,
  numeral: number,
  obstacles: Point[],
  preferred: Point | null,
): Point {
  const clearance = numeral * 0.8;
  const clear = (at: Point) =>
    obstacles.every((other) => distance(other, at) >= clearance);
  if (preferred && clear(preferred)) return preferred;
  const away = Math.atan2(start.y - centre.y, start.x - centre.x);
  const swing = (50 * Math.PI) / 180;
  let fallback = start;
  for (const reach of [0.8, 1.5, 2.2]) {
    for (const turn of [0, swing, -swing]) {
      const at = {
        x: start.x + reach * numeral * Math.cos(away + turn),
        y: start.y + reach * numeral * Math.sin(away + turn),
      };
      if (reach === 0.8 && turn === 0) fallback = at;
      if (clear(at)) return at;
    }
  }
  return fallback;
}

export function guidesOf(
  strokes: Segment[][],
  writing: number,
  ink: StrokeInk,
): GuideSet {
  const dot = ink.width * 1.3;
  const shaft = ink.width * 0.6;
  const head = { length: ink.width * 4, width: ink.width * 3.5 };
  const gap = Math.max(ink.width * 3, writing * 0.08);
  const numeral = Math.round(writing * 0.16);
  const centre = centreOf(strokes);
  const starts = strokes.map((segments) => along(segments, 0));

  const arrows = strokes.map((segments) => {
    const length = strokeLength(segments);
    const from = Math.min(writing * ARROW.from, length * 0.25);
    const to = Math.min(writing * ARROW.to, length * 0.75);
    if (to - from < head.length) {
      return { line: [] as Point[], head: null, tail: null };
    }
    const sides = ([1, -1] as const).map((side) =>
      beside(segments, from, to, gap, side),
    );
    const farness = (line: Point[]) =>
      line.reduce((sum, p) => sum + distance(p, centre), 0) / line.length;
    const side = farness(sides[1]) > farness(sides[0]) ? -1 : 1;
    const line = side === 1 ? sides[0] : sides[1];
    const tip = line[line.length - 1];
    const prev = line[line.length - 2];
    const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    // Where the number goes: past the arrow's tail, further out again.
    const [tail] = beside(segments, from, from, gap + numeral * 0.8, side, 1);
    return {
      line,
      head: arrowhead(tip.x, tip.y, angle, head.length, head.width),
      tail: tail ?? null,
    };
  });

  const numbers: Point[] = [];
  const fixed = [...starts, ...arrows.flatMap((arrow) => arrow.line)];
  starts.forEach((start, index) => {
    numbers.push(
      numberAt(
        start,
        centre,
        numeral,
        [...numbers, ...fixed.filter((point) => point !== start)],
        arrows[index].tail,
      ),
    );
  });

  return {
    dot,
    shaft,
    numeral,
    guides: strokes.map((_, index) => ({
      start: starts[index],
      line: arrows[index].line,
      head: arrows[index].head,
      number: numbers[index],
    })),
  };
}
