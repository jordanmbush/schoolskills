/**
 * One drawing of one glyph, read back into hand units
 * (`docs/printables.md` §25).
 *
 * The file is a template from `hand-template.mjs` with paths drawn into its
 * `strokes` layer. What comes out is the glyph the engine stores: strokes in
 * the order the paths sit in the file, in hand units with y up, spaced by
 * the hand's side bearings rather than by where on the template they were
 * drawn. `hand-ingest.mjs` runs this over a directory; the functions are
 * here so a test can run them over a string.
 */
import { identify } from "./forms.mjs";
import {
  absolute,
  bounds,
  multiply,
  parseTransform,
  rounded,
  serialise,
  transformed,
} from "./path.mjs";

/** How far off its line a letter's reach may be before the ingest says so. */
export const TOLERANCE = 40;

function attribute(tag, name) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return match ? match[1] : undefined;
}

/**
 * The paths inside the `strokes` layer, in document order, each with the
 * matrix of every group above it composed in and the name it was given —
 * its Inkscape label, or failing that its id — which is how a drawing marks
 * the parts of a joining stroke (`fused`).
 */
export function pathsOf(svg, file) {
  const open = svg.match(/<g\b[^>]*inkscape:label="strokes"[^>]*>/);
  if (!open) throw new Error(`${file}: no "strokes" layer`);
  const stack = [parseTransform(attribute(open[0], "transform"))];
  const paths = [];
  const tags = /<(\/?)(g|path)\b([^>]*?)(\/?)>/g;
  tags.lastIndex = open.index + open[0].length;
  let match;
  while ((match = tags.exec(svg)) !== null) {
    const [, closing, name, attrs, selfClosing] = match;
    if (name === "g") {
      if (closing) {
        stack.pop();
        if (stack.length === 0) break;
      } else if (!selfClosing) {
        stack.push(
          multiply(
            stack[stack.length - 1],
            parseTransform(attribute(attrs, "transform")),
          ),
        );
      }
      continue;
    }
    const d = attribute(attrs, "d");
    if (d === undefined) continue;
    const matrix = multiply(
      stack[stack.length - 1],
      parseTransform(attribute(attrs, "transform")),
    );
    paths.push({
      name: attribute(attrs, "inkscape:label") ?? attribute(attrs, "id"),
      segments: transformed(absolute(d), matrix),
    });
  }
  return paths;
}

/** The paths of the `strokes` layer as segments alone. */
export const strokesOf = (svg, file) =>
  pathsOf(svg, file).map((path) => path.segments);

/** The names a path may carry, and the order the parts of a joining stroke come in. */
const PARTS = ["lead", "top", "tail"];

/** How far apart two ends of one stroke may be drawn and still be one stroke. */
const GAP = 4;

const endOf = (segments) => segments[segments.length - 1].points.slice(-2);

/**
 * The strokes of a drawing, with the parts of a joining stroke fused into
 * its first stroke and counted (`docs/printables.md` §25).
 *
 * A hand that joins draws a letter as it is written alone and names the
 * parts a join replaces: a path called `lead` is the lead-in, `top` the top
 * of a bowl a bridge covers, and `tail` the exit stroke. They sit in the
 * layer in pen order — lead, top, the body, tail — and each must start where
 * the one before it ends, since they are one stroke drawn in pieces. What
 * comes back is the strokes as the engine stores them and, for a letter
 * with any part named, the `join` that says how many segments each is. A
 * part out of place, or one that does not meet its neighbour, is a drawing
 * error rather than a guess.
 */
export function fused(paths, file) {
  const named = paths.filter((path) => PARTS.includes(path.name));
  if (named.length === 0) {
    return { strokes: paths.map((path) => path.segments), join: undefined };
  }
  const lead = paths[0]?.name === "lead" ? paths.shift() : undefined;
  const top = paths[0]?.name === "top" ? paths.shift() : undefined;
  const body = paths.shift();
  if (body === undefined || PARTS.includes(body.name)) {
    throw new Error(
      `${file}: a joining stroke needs a body after its "lead" and "top"`,
    );
  }
  const tail = paths[0]?.name === "tail" ? paths.shift() : undefined;
  const stray = paths.find((path) => PARTS.includes(path.name));
  if (stray !== undefined) {
    throw new Error(
      `${file}: "${stray.name}" is out of place — the parts of a joining stroke are lead, top, the body and tail, in that order and first`,
    );
  }
  let stroke = [];
  for (const part of [lead, top, body, tail]) {
    if (part === undefined) continue;
    if (stroke.length === 0) {
      stroke = [...part.segments];
      continue;
    }
    const [x, y] = endOf(stroke);
    const [px, py] = part.segments[0].points;
    if (Math.abs(x - px) > GAP || Math.abs(y - py) > GAP) {
      throw new Error(
        `${file}: "${part.name ?? "the body"}" starts at ${px},${py} but the part before it ends at ${x},${y}`,
      );
    }
    stroke.push(...part.segments.slice(1));
  }
  const count = (part) => (part === undefined ? 0 : part.segments.length - 1);
  const join = { lead: count(lead), tail: count(tail) };
  if (top !== undefined) join.top = count(top);
  return { strokes: [stroke, ...paths.map((path) => path.segments)], join };
}

/**
 * The reach a character's kind of letter is drawn to, in hand units, or
 * null for a character the table says nothing about.
 */
export function expectedReach(hand, character) {
  if (/[A-Z0-9]/.test(character)) return { top: hand.ascent, bottom: 0 };
  if (!/[a-z]/.test(character)) return null;
  const { tall, threeQuarter, tail } = hand.reach;
  return {
    top: tall.includes(character)
      ? hand.ascent
      : threeQuarter.includes(character)
        ? Math.round(hand.ascent * 0.75)
        : hand.xHeight,
    bottom: tail.includes(character) ? hand.descent : 0,
  };
}

/**
 * The glyph a drawing holds, and which character and form it is of. Throws
 * on a drawing that cannot be a glyph; pushes onto `warnings` for one that
 * reaches somewhere its letter should not, since the drawing may be right
 * and the table wrong.
 */
export function readDrawing(hand, svg, file, warnings = []) {
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const id = attribute(root, "data-glyph") ?? file.replace(/\.svg$/, "");
  const { character, form } = identify(hand, id, file);
  const originX = Number(attribute(root, "data-origin"));
  const baselineY = Number(attribute(root, "data-baseline"));
  if (Number.isNaN(originX) || Number.isNaN(baselineY)) {
    throw new Error(
      `${file}: not a template — no data-origin / data-baseline on <svg>`,
    );
  }

  // Template space to hand space: shift the origin, turn y over.
  const toHand = [1, 0, 0, -1, -originX, baselineY];
  const { strokes: drawn, join } = fused(pathsOf(svg, file), file);
  const strokes = drawn.map((segments) =>
    rounded(transformed(segments, toHand)),
  );
  if (strokes.length === 0) throw new Error(`${file}: nothing drawn`);

  const box = bounds(strokes.flat());
  const floor = hand.descent - 100;
  const ceiling = hand.ascent + 100;
  if (box.minY < floor || box.maxY > ceiling) {
    throw new Error(
      `${file}: a stroke runs off the ruling (y ${box.minY}…${box.maxY}; the ruling is ${hand.descent}…${hand.ascent})`,
    );
  }

  const shift = hand.bearing - box.minX;
  const placed = strokes.map((segments) =>
    segments.map((segment) => ({
      type: segment.type,
      points: segment.points.map((v, i) => (i % 2 === 0 ? v + shift : v)),
    })),
  );
  const advance = box.maxX + shift + hand.bearing;

  const reach = expectedReach(hand, character);
  if (reach) {
    if (Math.abs(box.maxY - reach.top) > TOLERANCE) {
      warnings.push(
        `${file}: reaches ${box.maxY}, and a letter like "${character}" is expected to reach ${reach.top}`,
      );
    }
    if (Math.abs(box.minY - reach.bottom) > TOLERANCE) {
      warnings.push(
        `${file}: bottoms out at ${box.minY}, and a letter like "${character}" is expected to stop at ${reach.bottom}`,
      );
    }
  }

  return {
    character,
    form,
    glyph: {
      advance,
      strokes: placed.map(serialise),
      ...(join === undefined ? {} : { join }),
    },
  };
}
