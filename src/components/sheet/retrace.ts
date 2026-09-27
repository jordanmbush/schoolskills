/**
 * A stroke without the ground it goes over twice (§25).
 *
 * A pen goes over the same ground twice in a good many letters — a stem drawn
 * down and back up, a bowl gone round twice before the tail — and drawn
 * solid, the second pass lies exactly on the first and is not seen. A dotted
 * trace is drawn the same way and does show it: the dots of the two passes
 * fall in different places along the line, and the line reads as a heavier
 * dotted line, or as two. So the dotted and dashed styles draw each stretch
 * once.
 *
 * A stretch counts as gone over when it lies within `tolerance` of ground the
 * stroke has already covered, and runs the same way or the opposite way — a
 * line crossing another does not. What is left is the original segments where
 * they are untouched and short lines along the parts that remain, each
 * starting from a move so the pen skips what was covered.
 */
import type { Point, Segment } from "./glyphs";

type Sample = Point & { dx: number; dy: number; along: number };

const endOf = (s: Segment): Point => ({
  x: s.points[s.points.length - 2],
  y: s.points[s.points.length - 1],
});

/** Points along one segment, each with the direction of travel there, at about `step` apart. */
function walk(
  segment: Segment,
  from: Point,
  step: number,
): Array<Point & { dx: number; dy: number }> {
  const to = endOf(segment);
  const control: Point[] = [from];
  for (let i = 0; i < segment.points.length - 2; i += 2)
    control.push({ x: segment.points[i], y: segment.points[i + 1] });
  control.push(to);
  const chord = control.reduce(
    (sum, p, i) =>
      i === 0
        ? 0
        : sum + Math.hypot(p.x - control[i - 1].x, p.y - control[i - 1].y),
    0,
  );
  const count = Math.max(1, Math.ceil(chord / step));
  const out: Array<Point & { dx: number; dy: number }> = [];
  for (let k = 0; k <= count; k++) {
    const t = k / count;
    const at = bezier(control, t);
    const ahead = bezier(control, Math.min(1, t + 0.001));
    const behind = bezier(control, Math.max(0, t - 0.001));
    const dx = ahead.x - behind.x;
    const dy = ahead.y - behind.y;
    const length = Math.hypot(dx, dy) || 1;
    out.push({ ...at, dx: dx / length, dy: dy / length });
  }
  return out;
}

function bezier(control: Point[], t: number): Point {
  let level = control;
  while (level.length > 1) {
    level = level.slice(1).map((p, i) => ({
      x: level[i].x + (p.x - level[i].x) * t,
      y: level[i].y + (p.y - level[i].y) * t,
    }));
  }
  return level[0];
}

export function withoutRetraces(
  stroke: Segment[],
  tolerance: number,
): Segment[] {
  const step = Math.max(tolerance, 0.5);
  const cell = tolerance * 2;
  // Ground within this far along the pen's own path is the line itself, not ground gone over twice.
  const own = tolerance * 8;
  const grid = new Map<string, Sample[]>();
  const covered = (p: Sample): boolean => {
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (const s of grid.get(`${gx},${gy}`) ?? []) {
          if (p.along - s.along < own) continue;
          if (Math.hypot(s.x - p.x, s.y - p.y) > tolerance) continue;
          if (Math.abs(s.dx * p.dx + s.dy * p.dy) > 0.85) return true;
        }
      }
    }
    return false;
  };

  const out: Segment[] = [];
  let at: Point = { x: 0, y: 0 };
  let pen: Point | null = null; // where the drawn line stands; null after a skip
  let walked = 0;
  let any = false;
  for (const segment of stroke) {
    if (segment.type === "M") {
      out.push(segment);
      at = endOf(segment);
      pen = at;
      continue;
    }
    const samples: Sample[] = walk(segment, at, step).map((p, i, all) => {
      if (i > 0) walked += Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y);
      return { ...p, along: walked };
    });
    const flags = samples.map(covered);
    for (const p of samples) {
      const k = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
      const list = grid.get(k) ?? [];
      list.push(p);
      grid.set(k, list);
    }
    const end = endOf(segment);
    if (flags.every((f) => !f)) {
      if (pen === null || Math.hypot(pen.x - at.x, pen.y - at.y) > 0.01)
        out.push({ type: "M", points: [at.x, at.y] });
      out.push(segment);
      pen = end;
    } else if (flags.every((f) => f)) {
      any = true;
      pen = null;
    } else {
      any = true;
      let run: Point[] = [];
      const flush = () => {
        if (run.length > 1) {
          out.push({ type: "M", points: [tenth(run[0].x), tenth(run[0].y)] });
          for (const p of run.slice(1))
            out.push({ type: "L", points: [tenth(p.x), tenth(p.y)] });
        }
        run = [];
      };
      samples.forEach((p, i) => {
        if (flags[i]) flush();
        else run.push(p);
      });
      flush();
      pen = flags[flags.length - 1] ? null : end;
    }
    at = end;
  }
  return any ? out : stroke;
}

const tenth = (v: number) => Math.round(v * 10) / 10;
