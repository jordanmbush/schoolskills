/**
 * SVG path data, read the way a drawing tool writes it and written the way
 * the sheet reads it (`docs/printables.md` §25).
 *
 * A path saved from Inkscape is relative by default, leans on implicit
 * repeats, and may sit inside a layer that carries a transform. What the hand
 * data wants is the opposite: absolute, explicit, one of four commands, and
 * already in the glyph's own units. `absolute` does the reading and
 * `transformed` the moving; the writing is `serialise`.
 *
 * Two commands are refused rather than converted. A closed path (`Z`) cannot
 * be a pen stroke — a child's pencil lifts, it does not return to where it
 * started by magic — and a drawing that produced one is a shape tool used
 * where the pen tool was meant. An arc (`A`) is what a circle tool draws; the
 * pen tool never emits one, so an arc is the same mistake in a different
 * coat, and the fix in both cases is to redraw the stroke rather than to
 * convert it here and hide that it happened.
 */

/** A segment after normalising: absolute, and one of the four kept commands. */
// type Segment = { type: "M" | "L" | "C" | "Q"; points: number[] }

const PARAMS = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

const TOKEN =
  /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;

/**
 * Path data to absolute segments in `M`, `L`, `C` and `Q`.
 *
 * `H`, `V`, `S` and `T` are rewritten into the four rather than kept: a
 * reader with four cases is a reader every test can cover, and the two
 * shorthand curves need the previous control point to mean anything, which is
 * state a stored path should not depend on.
 */
export function absolute(d) {
  const tokens = [...d.matchAll(TOKEN)].map((match) =>
    match[1] !== undefined ? match[1] : Number(match[2]),
  );
  const out = [];
  let x = 0;
  let y = 0;
  /** The last control point, for the two shorthand curves. */
  let cx = null;
  let cy = null;
  let at = 0;
  let command = null;

  const read = (count) => {
    const numbers = tokens.slice(at, at + count);
    if (numbers.length < count || numbers.some((n) => typeof n !== "number")) {
      throw new Error(`path ran out of numbers after "${command}" in: ${d}`);
    }
    at += count;
    return numbers;
  };

  while (at < tokens.length) {
    const token = tokens[at];
    if (typeof token === "string") {
      command = token;
      at += 1;
      if (command === "Z" || command === "z") {
        throw new Error(
          "closed path: a pen stroke is open, so redraw this one with the pen tool rather than a shape tool",
        );
      }
      if (command === "A" || command === "a") {
        throw new Error(
          "arc: a circle tool drew this; redraw the stroke with the pen tool",
        );
      }
    } else if (command === null) {
      throw new Error(`path data starts with a number: ${d}`);
    } else if (command === "M") {
      // An implicit repeat after a move is a line, per the SVG grammar.
      command = "L";
    } else if (command === "m") {
      command = "l";
    }

    const upper = command.toUpperCase();
    const relative = command !== upper;
    const n = read(PARAMS[upper]);
    const dx = relative ? x : 0;
    const dy = relative ? y : 0;

    switch (upper) {
      case "M":
        x = n[0] + dx;
        y = n[1] + dy;
        out.push({ type: "M", points: [x, y] });
        cx = cy = null;
        break;
      case "L":
        x = n[0] + dx;
        y = n[1] + dy;
        out.push({ type: "L", points: [x, y] });
        cx = cy = null;
        break;
      case "H":
        x = n[0] + dx;
        out.push({ type: "L", points: [x, y] });
        cx = cy = null;
        break;
      case "V":
        y = n[0] + dy;
        out.push({ type: "L", points: [x, y] });
        cx = cy = null;
        break;
      case "C": {
        const points = [
          n[0] + dx,
          n[1] + dy,
          n[2] + dx,
          n[3] + dy,
          n[4] + dx,
          n[5] + dy,
        ];
        out.push({ type: "C", points });
        [cx, cy] = [points[2], points[3]];
        [x, y] = [points[4], points[5]];
        break;
      }
      case "S": {
        // The first control point reflects the previous one, or is the
        // current point when the previous segment was not a cubic.
        const last = out[out.length - 1];
        const reflect = last?.type === "C" && cx !== null;
        const x1 = reflect ? 2 * x - cx : x;
        const y1 = reflect ? 2 * y - cy : y;
        const points = [x1, y1, n[0] + dx, n[1] + dy, n[2] + dx, n[3] + dy];
        out.push({ type: "C", points });
        [cx, cy] = [points[2], points[3]];
        [x, y] = [points[4], points[5]];
        break;
      }
      case "Q": {
        const points = [n[0] + dx, n[1] + dy, n[2] + dx, n[3] + dy];
        out.push({ type: "Q", points });
        [cx, cy] = [points[0], points[1]];
        [x, y] = [points[2], points[3]];
        break;
      }
      case "T": {
        const last = out[out.length - 1];
        const reflect = last?.type === "Q" && cx !== null;
        const x1 = reflect ? 2 * x - cx : x;
        const y1 = reflect ? 2 * y - cy : y;
        const points = [x1, y1, n[0] + dx, n[1] + dy];
        out.push({ type: "Q", points });
        [cx, cy] = [points[0], points[1]];
        [x, y] = [points[2], points[3]];
        break;
      }
      default:
        throw new Error(`unknown path command "${command}"`);
    }
  }

  if (out.length === 0) throw new Error(`empty path: "${d}"`);
  if (out[0].type !== "M") throw new Error(`path does not start with M: ${d}`);
  return out;
}

/**
 * A 2-D affine matrix, as SVG writes one: `[a, b, c, d, e, f]` maps
 * `(x, y)` to `(a·x + c·y + e, b·x + d·y + f)`.
 */
export const IDENTITY = [1, 0, 0, 1, 0, 0];

export function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

const TRANSFORM = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g;

/**
 * An SVG `transform` attribute as one matrix. The four forms a drawing tool
 * writes; `skewX` and `skewY` are not among them and are refused.
 */
export function parseTransform(text) {
  if (!text || text.trim() === "") return IDENTITY;
  const leftover = text.replace(TRANSFORM, "").replace(/[\s,]/g, "");
  if (leftover !== "") throw new Error(`unsupported transform: ${text}`);
  let matrix = IDENTITY;
  for (const match of text.matchAll(TRANSFORM)) {
    const args = match[2]
      .trim()
      .split(/[\s,]+/)
      .filter((part) => part !== "")
      .map(Number);
    let next;
    switch (match[1]) {
      case "matrix":
        if (args.length !== 6)
          throw new Error(`matrix wants 6 numbers: ${text}`);
        next = args;
        break;
      case "translate":
        next = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
        break;
      case "scale":
        next = [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0];
        break;
      case "rotate": {
        const angle = ((args[0] ?? 0) * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotation = [cos, sin, -sin, cos, 0, 0];
        if (args.length >= 3) {
          const [, cx, cy] = args;
          next = multiply(multiply([1, 0, 0, 1, cx, cy], rotation), [
            1,
            0,
            0,
            1,
            -cx,
            -cy,
          ]);
        } else {
          next = rotation;
        }
        break;
      }
    }
    matrix = multiply(matrix, next);
  }
  return matrix;
}

/** The segments with every point put through `matrix`. */
export function transformed(segments, matrix) {
  return segments.map((segment) => {
    const points = [];
    for (let i = 0; i < segment.points.length; i += 2) {
      points.push(...apply(matrix, segment.points[i], segment.points[i + 1]));
    }
    return { type: segment.type, points };
  });
}

/** Every point rounded to the nearest whole unit. */
export const rounded = (segments) =>
  segments.map((segment) => ({
    type: segment.type,
    points: segment.points.map((value) => Math.round(value)),
  }));

/** The four-command form, as the hand data stores it: `M 12 0 C 1 2 3 4 5 6`. */
export const serialise = (segments) =>
  segments
    .map((segment) => `${segment.type} ${segment.points.join(" ")}`)
    .join(" ");

/** Every on-curve and control point, for bounds. */
export function pointsOf(segments) {
  const out = [];
  for (const segment of segments) {
    for (let i = 0; i < segment.points.length; i += 2) {
      out.push([segment.points[i], segment.points[i + 1]]);
    }
  }
  return out;
}

export function bounds(segments) {
  const points = pointsOf(segments);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
