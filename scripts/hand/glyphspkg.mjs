/**
 * A glyph read out of a Glyphs package, for the outline a hand is drawn
 * over (`docs/printables.md` §25).
 *
 * The cursive faces publish their sources as one `.glyphspackage`: a folder
 * with a `glyphs/` of one file per glyph, each in the property-list dialect
 * the Glyphs app writes rather than XML. A file holds every master's outline
 * of the glyph as a layer, and a face is one point between masters, so
 * reading a glyph means naming the masters and how far between them to
 * stand. What comes out is the same `{ name, advance, contours }` that
 * `glif.mjs` gives for a UFO, so the template can draw either.
 *
 * Components are followed: a shape with a `ref` is another glyph's same
 * layer moved, turned and scaled, which is how the sources build a letter's
 * medial form out of its parts.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The property-list dialect, read into plain values: `{ k = v; }` is an
 * object, `( a, b )` a list, and a bare token is a number when it reads as
 * one. Nothing else appears in a glyph file.
 */
export function parsePlist(text) {
  let at = 0;
  const skip = () => {
    while (at < text.length && /\s/.test(text[at])) at += 1;
  };
  const value = () => {
    skip();
    const c = text[at];
    if (c === "{") return dict();
    if (c === "(") return list();
    if (c === '"') return quoted();
    return bare();
  };
  const dict = () => {
    at += 1;
    const out = {};
    for (;;) {
      skip();
      if (text[at] === "}") {
        at += 1;
        return out;
      }
      const key = value();
      skip();
      if (text[at] !== "=") throw new Error(`expected "=" at ${at}`);
      at += 1;
      out[key] = value();
      skip();
      if (text[at] === ";") at += 1;
    }
  };
  const list = () => {
    at += 1;
    const out = [];
    for (;;) {
      skip();
      if (text[at] === ")") {
        at += 1;
        return out;
      }
      out.push(value());
      skip();
      if (text[at] === ",") at += 1;
    }
  };
  const quoted = () => {
    at += 1;
    let s = "";
    while (text[at] !== '"') {
      if (text[at] === "\\") at += 1;
      s += text[at];
      at += 1;
    }
    at += 1;
    return s;
  };
  const bare = () => {
    let s = "";
    while (at < text.length && !/[\s;,)}=]/.test(text[at])) {
      s += text[at];
      at += 1;
    }
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s;
  };
  return value();
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * One instance of the package: the two master ids to stand between and how
 * far along, as `m008,m016,0.2`. A single id is that master itself.
 */
export function parseInstance(text) {
  const [from, to, at] = text.split(",");
  if (to === undefined) return { from, to: from, at: 0 };
  const t = Number(at);
  if (Number.isNaN(t)) throw new Error(`instance "${text}": bad share`);
  return { from, to, at: t };
}

function masterLayer(glyph, id) {
  return (glyph.layers ?? []).find(
    (layer) => layer.layerId === id && layer.associatedMasterId === undefined,
  );
}

/**
 * The file a glyph is kept in: every capital letter of its name is followed
 * by an underscore, so `A.cur` and `a.cur` are two files on a Mac — the
 * same reason a hand's own drawings are named `A_.svg` (`names.mjs`).
 */
const fileStem = (name) => name.replace(/[A-Z]/g, "$&_");

/**
 * The glyph's outline at the instance, as contours of nodes in the file's
 * own form — `[x, y, type]`, with `o` an off-curve point — components
 * followed. A glyph the package lacks is `null`.
 */
function nodesOf(pkg, name, instance, seen = new Set()) {
  const file = join(pkg, "glyphs", `${fileStem(name)}.glyph`);
  if (!existsSync(file) || seen.has(name)) return null;
  seen.add(name);
  const glyph = parsePlist(readFileSync(file, "utf8"));
  const a = masterLayer(glyph, instance.from);
  const b = masterLayer(glyph, instance.to);
  if (!a || !b) {
    throw new Error(
      `${name}: no layer for master ${instance.from} or ${instance.to}`,
    );
  }
  const contours = [];
  const shapesA = a.shapes ?? [];
  const shapesB = b.shapes ?? [];
  shapesA.forEach((shape, k) => {
    const other = shapesB[k] ?? shape;
    if (shape.ref !== undefined) {
      const inner = nodesOf(pkg, String(shape.ref), instance, seen);
      if (inner === null) return;
      const [dx, dy] = [
        lerp(shape.pos?.[0] ?? 0, other.pos?.[0] ?? 0, instance.at),
        lerp(shape.pos?.[1] ?? 0, other.pos?.[1] ?? 0, instance.at),
      ];
      const [sx, sy] = shape.scale ?? [1, 1];
      const rad =
        (lerp(shape.angle ?? 0, other.angle ?? 0, instance.at) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      for (const contour of inner.contours) {
        contours.push({
          closed: contour.closed,
          nodes: contour.nodes.map(([x, y, type]) => {
            const px = x * sx;
            const py = y * sy;
            return [dx + px * cos - py * sin, dy + px * sin + py * cos, type];
          }),
        });
      }
      return;
    }
    if (!shape.nodes) return;
    if (other.nodes?.length !== shape.nodes.length) {
      throw new Error(`${name}: the two masters do not match point for point`);
    }
    contours.push({
      closed: shape.closed === 1,
      nodes: shape.nodes.map(([x, y, type], j) => [
        lerp(x, other.nodes[j][0], instance.at),
        lerp(y, other.nodes[j][1], instance.at),
        String(type),
      ]),
    });
  });
  seen.delete(name);
  return { contours, advance: lerp(a.width ?? 0, b.width ?? 0, instance.at) };
}

/**
 * A contour's nodes as segments, the way `glif.mjs` gives them: a closed
 * contour is rotated to start on an on-curve node and wraps back to it.
 */
function segmentsOf({ closed, nodes }) {
  const onCurve = (node) => !node[2].startsWith("o");
  const first = nodes.findIndex(onCurve);
  if (first < 0) return [];
  let ordered = closed
    ? [...nodes.slice(first), ...nodes.slice(0, first)]
    : nodes;
  if (closed) ordered = [...ordered, ordered[0]];
  const segments = [{ type: "M", points: [ordered[0][0], ordered[0][1]] }];
  let offs = [];
  for (const node of ordered.slice(1)) {
    if (!onCurve(node)) {
      offs.push([node[0], node[1]]);
      continue;
    }
    const end = [node[0], node[1]];
    if (offs.length === 0) segments.push({ type: "L", points: end });
    else if (offs.length === 2) {
      segments.push({ type: "C", points: [...offs[0], ...offs[1], ...end] });
    } else if (offs.length === 1) {
      segments.push({ type: "Q", points: [...offs[0], ...end] });
    } else {
      throw new Error(`a run of ${offs.length} off-curve points`);
    }
    offs = [];
  }
  return segments;
}

/**
 * A glyph's outline at the instance, as absolute segments in the font's own
 * units, y up, plus its advance — the shape `readGlyph` in `glif.mjs`
 * returns. `null` for a glyph the package does not have.
 */
export function readPackageGlyph(pkg, name, instance) {
  const read = nodesOf(pkg, name, instance);
  if (read === null) return null;
  return {
    name,
    advance: read.advance,
    contours: read.contours.map(segmentsOf).filter((c) => c.length > 0),
  };
}

/**
 * The x-height of the instance, from the masters' metric values. The
 * package lists its metrics once by kind and each master's values in that
 * order.
 */
export function packageXHeight(pkg, instance) {
  const info = parsePlist(readFileSync(join(pkg, "fontinfo.plist"), "utf8"));
  const kinds = (info.metrics ?? []).map((metric) => metric.type);
  const index = kinds.indexOf("x-height");
  if (index < 0) throw new Error(`${pkg}: no x-height among its metrics`);
  const value = (id) => {
    const master = (info.fontMaster ?? []).find((m) => m.id === id);
    if (!master) throw new Error(`${pkg}: no master ${id}`);
    return Number(master.metricValues?.[index]?.pos ?? 0);
  };
  return lerp(value(instance.from), value(instance.to), instance.at);
}
