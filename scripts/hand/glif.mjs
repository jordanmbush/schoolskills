/**
 * A UFO glyph, read for its outline (`docs/printables.md` §25).
 *
 * The template a hand is drawn over is the outline of an existing face, and
 * the faces this site ships publish their sources as UFO packages: one XML
 * file per glyph, listed in `glyphs/contents.plist`. This reads enough of
 * that to draw one — the contours, and components where a glyph is built out
 * of others — and nothing else.
 *
 * Node has no XML parser, and a glyph file is regular enough that none is
 * needed: every point is one `<point …/>` tag and every contour one
 * `<contour>…</contour>` block.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ATTRIBUTE = /(\w+)="([^"]*)"/g;

function attributes(tag) {
  const out = {};
  for (const match of tag.matchAll(ATTRIBUTE)) out[match[1]] = match[2];
  return out;
}

/** The `<key>…</key><string>…</string>` pairs of a plist dict, as a map. */
export function readContents(ufo) {
  const text = readFileSync(join(ufo, "glyphs", "contents.plist"), "utf8");
  const out = new Map();
  for (const match of text.matchAll(
    /<key>([^<]*)<\/key>\s*<string>([^<]*)<\/string>/g,
  )) {
    out.set(match[1], match[2]);
  }
  return out;
}

/** The integer under `<key>name</key>` in fontinfo.plist, or undefined. */
export function fontInfo(ufo, name) {
  const text = readFileSync(join(ufo, "fontinfo.plist"), "utf8");
  const match = text.match(
    new RegExp(`<key>${name}</key>\\s*<(?:integer|real)>([^<]*)<`),
  );
  return match ? Number(match[1]) : undefined;
}

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/**
 * One contour's points as segments. A closed contour is rotated to start on
 * an on-curve point and wraps back to it; an open one (first point `move`)
 * runs once.
 *
 * Cubic points come two off-curve to one on-curve. A quadratic contour may run
 * several off-curve points together, with the on-curve point between each pair
 * implied at their midpoint, which is what `qcurve` handling inserts.
 */
function contourSegments(points) {
  const onCurve = (p) => p.type !== undefined;
  if (points.length === 0 || !points.some(onCurve)) return [];
  const open = points[0].type === "move";
  let ordered = points;
  if (!open) {
    const first = points.findIndex(onCurve);
    ordered = [...points.slice(first), ...points.slice(0, first)];
    ordered = [...ordered, ordered[0]];
  }
  const start = ordered[0];
  const segments = [{ type: "M", points: [start.x, start.y] }];
  let offs = [];
  for (const point of ordered.slice(1)) {
    if (!onCurve(point)) {
      offs.push([point.x, point.y]);
      continue;
    }
    const end = [point.x, point.y];
    if (offs.length === 0) {
      segments.push({ type: "L", points: end });
    } else if (point.type === "curve" && offs.length === 2) {
      segments.push({ type: "C", points: [...offs[0], ...offs[1], ...end] });
    } else {
      // Quadratic, with implied on-curve points between successive controls.
      for (let i = 0; i < offs.length - 1; i += 1) {
        segments.push({
          type: "Q",
          points: [...offs[i], ...mid(offs[i], offs[i + 1])],
        });
      }
      segments.push({ type: "Q", points: [...offs[offs.length - 1], ...end] });
    }
    offs = [];
  }
  return segments;
}

/**
 * A glyph's outline as absolute segments in the font's own units, y up, plus
 * its advance. Components are followed and offset; a glyph the package does
 * not have returns `null` so the caller can say so.
 */
export function readGlyph(ufo, name, contents = readContents(ufo)) {
  const file = contents.get(name);
  if (file === undefined) return null;
  const path = join(ufo, "glyphs", file);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");

  const advance = Number(text.match(/<advance\s+width="([^"]*)"/)?.[1] ?? "0");
  const contours = [];
  for (const block of text.matchAll(/<contour>([\s\S]*?)<\/contour>/g)) {
    const points = [...block[1].matchAll(/<point\b([^>]*)\/>/g)].map((m) => {
      const a = attributes(m[1]);
      return { x: Number(a.x), y: Number(a.y), type: a.type };
    });
    const segments = contourSegments(points);
    if (segments.length > 0) contours.push(segments);
  }
  for (const tag of text.matchAll(/<component\b([^>]*)\/>/g)) {
    const a = attributes(tag[1]);
    const base = readGlyph(ufo, a.base, contents);
    if (base === null) continue;
    const dx = Number(a.xOffset ?? 0);
    const dy = Number(a.yOffset ?? 0);
    for (const contour of base.contours) {
      contours.push(
        contour.map((segment) => ({
          type: segment.type,
          points: segment.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)),
        })),
      );
    }
  }
  return { name, advance, contours };
}
