/**
 * The dots of a dotted line, placed rather than left to a dash pattern (§25).
 *
 * A dash pattern dots one stroke evenly, and knows nothing of the others: where
 * two lines cross, meet or run side by side, each lays its dots on its own
 * lattice, and the two land a third of a space apart and print as one fat dot.
 * A pen goes over its own ground twice in a good many letters — the second pass
 * of an `a` — and there the dots of the two passes fall between each other and
 * the line reads as heavier or as two.
 *
 * So the dots are placed here, along each stroke every `gap` from its first
 * point, in the order the pen writes them, and a dot that lands within `near`
 * of one already placed is left out, whichever stroke placed it. That includes
 * the first dot of a stroke that starts on the end of another, like the
 * crossbar of an `H` on the foot of its stem, and the dot just past a point
 * where the pen turns back, like the top of an `i`: a dot is already there,
 * and a second one beside it prints as one fat dot.
 */
import { flatten, type Point, type Segment } from "./glyphs";

/** The dots placed so far in a word, by cell, so a new one is checked against its neighbors only. */
export type Dotted = { cell: number; grid: Map<string, Point[]> };

export const dottedGrid = (near: number): Dotted => ({
  cell: near,
  grid: new Map(),
});

const key = (x: number, y: number) => `${x},${y}`;

/** Points `gap` apart along `stroke`, the first at its start, leaving out any that crowd a dot already in `placed`. */
export function dotsOf(
  stroke: Segment[],
  gap: number,
  near: number,
  placed: Dotted,
): Point[] {
  const line = flatten(stroke, 40);
  if (line.length === 0) return [];
  const wanted: Point[] = [{ x: line[0].x, y: line[0].y }];
  let next = gap;
  for (let i = 1; i < line.length; i++) {
    const from = line[i - 1];
    const to = line[i];
    while (next <= to.at && to.at > from.at) {
      const t = (next - from.at) / (to.at - from.at);
      wanted.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      });
      next += gap;
    }
  }
  const crowded = (p: Point): boolean => {
    const cx = Math.floor(p.x / placed.cell);
    const cy = Math.floor(p.y / placed.cell);
    for (let x = cx - 1; x <= cx + 1; x++) {
      for (let y = cy - 1; y <= cy + 1; y++) {
        for (const d of placed.grid.get(key(x, y)) ?? []) {
          if (Math.hypot(d.x - p.x, d.y - p.y) < near) return true;
        }
      }
    }
    return false;
  };
  const kept: Point[] = [];
  for (const p of wanted) {
    if (crowded(p)) continue;
    kept.push(p);
    const k = key(Math.floor(p.x / placed.cell), Math.floor(p.y / placed.cell));
    const list = placed.grid.get(k) ?? [];
    list.push(p);
    placed.grid.set(k, list);
  }
  return kept;
}

/** Each dot as a stroke with no length, which a round cap draws as a dot. */
export const dotPath = (dots: Point[]): string =>
  dots
    .map(
      (d) => `M ${Math.round(d.x * 10) / 10} ${Math.round(d.y * 10) / 10} h 0`,
    )
    .join(" ");
