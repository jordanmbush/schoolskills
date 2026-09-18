/**
 * The stroke patterns of §24, as SVG paths on a ruling.
 *
 * Geometry rather than text, on purpose: a pre-writing stroke is the thing a
 * child does before there are letters, so it is the same in every face — and
 * a path can be cut into cells that change from solid to dotted to nothing
 * without the line breaking, which is what makes a row of them read as one
 * pattern rather than three.
 *
 * Every pattern is one repeat, `unit` wide, drawn `count` times from `from`.
 * The continuous ones — zigzag, waves, humps, cups and the two loops — start
 * and end each repeat on the same line, so a cell that starts where the last
 * one ended continues the pattern in phase; the lifted ones — lines, slants
 * and circles — are one stroke a repeat, centred in it.
 *
 * Coordinates are mil, matching the viewBox the row sets up, and rounded to a
 * tenth so a page of paths stays a page.
 */
import { points } from "@/engine/sheets/paper";
import type { Mil, StrokePattern } from "@/engine/sheets/types";

/** Where the lines of one repeat of the ruling sit, top down. */
export type StrokeZones = {
  top: Mil;
  mid: Mil;
  base: Mil;
  /** The foot of the repeat — the bottom of the tail space, where there is one. */
  bottom: Mil;
};

/**
 * How wide one repeat of each pattern wants to be, as a share of the writing
 * space. A hump is a little narrower than it is tall, as an n is; a wave takes
 * a whole space for its rise and fall; a loop is narrow, as an l is.
 */
const UNIT: Record<StrokePattern, number> = {
  lines: 0.5,
  slants: 0.6,
  circles: 0.55,
  zigzag: 0.7,
  waves: 1,
  humps: 0.7,
  cups: 0.7,
  loops: 0.55,
  tails: 0.55,
};

/** How far a slanted stroke leans, as a share of the writing space. */
const LEAN = 0.4;

/**
 * The repeat that divides a cell exactly: the nearest whole number of the
 * pattern's own width, so cells of one row are all in phase.
 */
export function strokeUnit(
  pattern: StrokePattern,
  zones: StrokeZones,
  cell: Mil,
): { unit: Mil; count: number } {
  const writing = Math.max(1, zones.base - zones.top);
  const wanted = Math.max(1, writing * UNIT[pattern]);
  const count = Math.max(1, Math.round(cell / wanted));
  return { unit: cell / count, count };
}

const r = (value: number): number => Math.round(value * 10) / 10;

/**
 * `shares` of `total`, each rounded, with the last taking up the rounding so
 * the pieces sum to exactly what the shares do — a whole repeat across, or
 * nothing at all up and down, for a stroke that ends on the line it began.
 * Relative segments are written one rounded number at a time, and a repeat
 * whose pieces summed to a tenth over would drift a tenth further every
 * repeat: seven of them across a cell is most of a mil, and the next cell
 * would start where this one did not end.
 */
const split = (total: number, shares: number[]): number[] => {
  const whole = r(total * shares.reduce((sum, share) => sum + share, 0));
  const pieces = shares.slice(0, -1).map((share) => r(total * share));
  return [...pieces, r(whole - pieces.reduce((sum, piece) => sum + piece, 0))];
};

/** `n` copies of a relative segment, which is how a continuous pattern repeats. */
const times = (count: number, segment: string): string =>
  Array.from({ length: count }, () => segment).join(" ");

/** One path, `count` repeats of `pattern`, starting at `from`. */
export function strokePath(
  pattern: StrokePattern,
  zones: StrokeZones,
  from: Mil,
  unit: Mil,
  count: number,
): string {
  const { top, mid, base, bottom } = zones;
  const u = unit;
  const w = base - top;
  const body = base - mid;

  switch (pattern) {
    case "lines":
      return Array.from({ length: count }, (_, i) => {
        const x = r(from + i * u + u / 2);
        return `M${x},${top} L${x},${base}`;
      }).join(" ");

    case "slants": {
      const lean = w * LEAN;
      return Array.from({ length: count }, (_, i) => {
        const x = from + i * u + u / 2;
        return `M${r(x + lean / 2)},${top} L${r(x - lean / 2)},${base}`;
      }).join(" ");
    }

    case "circles": {
      const ry = body / 2;
      const rx = Math.min(ry * 0.85, (u / 2) * 0.9);
      const cy = r(mid + body / 2);
      return Array.from({ length: count }, (_, i) => {
        const cx = from + i * u + u / 2;
        return `M${r(cx - rx)},${cy} a${r(rx)},${r(ry)} 0 1 0 ${r(2 * rx)},0 a${r(rx)},${r(ry)} 0 1 0 ${r(-2 * rx)},0`;
      }).join(" ");
    }

    case "zigzag": {
      const [up, down] = split(u, [0.5, 0.5]);
      return `M${r(from)},${base} ${times(count, `l${up},${r(-w)} l${down},${r(w)}`)}`;
    }

    case "waves": {
      // Crest on the midline, trough on the baseline: a quadratic peaks at
      // half its control's offset, so the control sits twice the amplitude out.
      const amplitude = body / 2;
      const centre = r(base - amplitude);
      const [rise, fall] = split(u, [0.5, 0.5]);
      return `M${r(from)},${centre} ${times(count, `q${r(u / 4)},${r(-2 * amplitude)} ${rise},0 q${r(u / 4)},${r(2 * amplitude)} ${fall},0`)}`;
    }

    case "humps":
      // Sweep flag 1 draws the arc over the top: baseline to baseline, up to
      // the midline, the way an n is made.
      return `M${r(from)},${base} ${times(count, `a${r(u / 2)},${r(body)} 0 0 1 ${r(u)},0`)}`;

    case "cups":
      return `M${r(from)},${mid} ${times(count, `a${r(u / 2)},${r(body)} 0 0 0 ${r(u)},0`)}`;

    case "loops":
      // Up and to the right, over the top and back through the upstroke, out
      // along the baseline to the next: a joined l with the letter left off.
      return `M${r(from)},${base} ${times(count, loop(u, -w))}`;

    case "tails":
      // The same loop upside down, from the midline into the tail space and
      // back up through itself: a joined j with the dot left off.
      return `M${r(from)},${mid} ${times(count, loop(u, bottom - mid))}`;
  }
}

/**
 * One loop, `u` wide and reaching `h` from its start — up when `h` is
 * negative, down when it is positive. Three cubics: out and up to the apex,
 * the curl over it, and the long stroke back down through the first and out
 * to the next repeat. The three endpoints are split so they close exactly.
 */
function loop(u: number, h: number): string {
  const [x1, x2, x3] = split(u, [0.55, -0.25, 0.7]);
  const [y1, y2, y3] = split(h, [0.95, -0.2, -0.75]);
  return (
    `c${r(0.35 * u)},${r(0.1 * h)} ${r(0.65 * u)},${r(0.6 * h)} ${x1},${y1} ` +
    `c${r(-0.05 * u)},${r(0.12 * h)} ${r(-0.28 * u)},${r(0.08 * h)} ${x2},${y2} ` +
    `c${r(0.03 * u)},${r(-0.3 * h)} ${r(0.2 * u)},${r(-0.6 * h)} ${x3},${y3}`
  );
}

/** What a pattern is drawn with, at one writing space. */
export type StrokeInk = {
  /** `stroke-width`, in mil. */
  width: Mil;
  /** `stroke-dasharray` for the dotted style, in mil. */
  dotted: string;
  /** `stroke-dasharray` for the dashed style, in mil. */
  dashed: string;
};

/**
 * A pencil line rather than a glyph outline: heavier than `traceInk` gives a
 * letter, because there is no fill for the stroke to be the edge of, and
 * clamped so an inch-high rule does not draw a crayon and a college rule a
 * hair. Dots and dashes are shares of it, as a face's are.
 */
export function strokeInk(writing: Mil): StrokeInk {
  const width = Math.round(
    Math.min(points(2.5), Math.max(points(1), writing * 0.045)),
  );
  return {
    width,
    dotted: `0 ${Math.round(width * 2.2)}`,
    dashed: `${Math.round(width * 2.5)} ${Math.round(width * 1.5)}`,
  };
}
