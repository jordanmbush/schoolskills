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
 * matrix of every group above it composed in.
 */
export function strokesOf(svg, file) {
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
    paths.push(transformed(absolute(d), matrix));
  }
  return paths;
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
  const strokes = strokesOf(svg, file).map((segments) =>
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
    glyph: { advance, strokes: placed.map(serialise) },
  };
}
