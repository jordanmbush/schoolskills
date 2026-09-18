#!/usr/bin/env node
/**
 * Writes the SVG a glyph of a hand is drawn in (`docs/printables.md` §25).
 *
 * One file per glyph, opened in a vector editor and drawn on: the ruling the
 * letter must sit on, the outline of the face it is traced over in two
 * scales, a note saying what to do, and an empty `strokes` layer to do it in.
 * Everything but that layer is locked, so the only thing a drawing can
 * contain is what the ingest (`hand-ingest.mjs`) reads back.
 *
 * Two outlines because the face being traced was drawn to a paragraph and
 * the hand is drawn to a ruling. Scaled so its x-height meets the midline,
 * the source's `l` stops short of the top line and its `g` short of the tail
 * line; scaled so those reach, its body overshoots the midline. So the body
 * outline says what shape the letter is, the reach outline says how far its
 * tall or hanging part goes, and the drawn stroke follows the first and
 * stretches to the second.
 *
 * A file that already exists is never rewritten. The drawing in it is hours
 * of somebody's work, and a template is a minute's.
 *
 * Usage:
 *   node scripts/hand-template.mjs --hand print --ufo path/to/Andika-Regular.ufo a e g l t
 *
 * Glyphs are given as characters (`a`, `A`, `5`) or as their file stems
 * (`A_`, `five`) — see `scripts/hand/names.mjs`. A letter the hand draws in
 * more than one form gets a template per form, named for it (`t.curved.svg`,
 * `t.straight.svg`), each over the outline of that form where the face has
 * one; `t.straight` alone asks for just the one. With none given, every
 * character the names table knows is written.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fontInfo, readContents, readGlyph } from "./hand/glif.mjs";
import { splitId } from "./hand/forms.mjs";
import { CHARACTERS, SIL_FORMS, SIL_NAMES, STEMS } from "./hand/names.mjs";
import { bounds, serialise } from "./hand/path.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Room around the ruling, in hand units, so a stroke can overshoot a line. */
const PAD = 150;

const INKSCAPE = "http://www.inkscape.org/namespaces/inkscape";
const SODIPODI = "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd";

function args(argv) {
  const out = { glyphs: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--hand") out.hand = argv[++i];
    else if (argv[i] === "--ufo") out.ufo = argv[++i];
    else out.glyphs.push(argv[i]);
  }
  if (!out.hand) throw new Error("--hand is required");
  return out;
}

/** How far a character reaches, as the hand's own share of its ruling. */
function reachOf(hand, character) {
  if (/[A-Z0-9]/.test(character)) return { top: hand.ascent, bottom: 0 };
  const { tall, threeQuarter, tail } = hand.reach;
  const top = tall.includes(character)
    ? hand.ascent
    : threeQuarter.includes(character)
      ? Math.round(hand.ascent * 0.75)
      : hand.xHeight;
  const bottom = tail.includes(character) ? hand.descent : 0;
  return { top, bottom };
}

/**
 * The source outline placed on the template, as one path `d`.
 *
 * `scale` sets the body. `stretch`, when given, is what the reach outline
 * does to the parts beyond it: a point above the x-height is moved so the
 * source's own top lands on the hand's, and a point below the baseline so
 * the source's bottom lands on the tail line — each zone linearly, the body
 * untouched. A curve that crosses the midline bends a little under that,
 * which is fine for a guide whose job is to say where a stroke ends.
 */
function outlinePath(glyph, scale, originX, baselineY, stretch) {
  const place = (x, y) => {
    let yy = y * scale;
    if (stretch && y > stretch.xHeight) {
      yy = stretch.xHeight * scale + (y - stretch.xHeight) * stretch.up;
    } else if (stretch && y < 0) {
      yy = y * stretch.down;
    }
    return [originX + x * scale, baselineY - yy];
  };
  return glyph.contours
    .map((contour) => {
      const moved = contour.map((segment) => {
        const points = [];
        for (let i = 0; i < segment.points.length; i += 2) {
          points.push(...place(segment.points[i], segment.points[i + 1]));
        }
        return { type: segment.type, points };
      });
      return `${serialise(moved)} Z`;
    })
    .join(" ");
}

function layer(id, label, locked, body, extra = "") {
  const lock = locked ? ` sodipodi:insensitive="true"` : "";
  return `  <g inkscape:groupmode="layer" id="${id}" inkscape:label="${label}"${lock}${extra}>\n${body}\n  </g>`;
}

function template({ hand, character, id, glyph, source }) {
  const height = hand.ascent - hand.descent + 2 * PAD;
  const originX = PAD;
  const baselineY = PAD + hand.ascent;
  const y = (units) => baselineY - units;

  const body = source ? hand.xHeight / source.xHeight : 1;
  const advance = glyph ? Math.round(glyph.advance * body) : 600;
  const width = advance + 2 * PAD;

  const lines = [
    [hand.ascent, "top", "#5b7fa6"],
    [hand.xHeight, "mid", "#5b7fa6"],
    [0, "base", "#1f3a5f"],
    [hand.descent, "tail", "#9aa8b8"],
  ]
    .map(
      ([at, name, colour]) =>
        `    <line x1="0" y1="${y(at)}" x2="${width}" y2="${y(at)}" stroke="${colour}" stroke-width="2"${name === "mid" ? ' stroke-dasharray="24 16"' : ""}/>\n` +
        `    <text x="8" y="${y(at) - 8}" font-family="sans-serif" font-size="28" fill="${colour}">${name} ${at}</text>`,
    )
    .join("\n");
  const grid = [];
  for (let at = hand.descent; at <= hand.ascent; at += 100) {
    if ([hand.ascent, hand.xHeight, 0, hand.descent].includes(at)) continue;
    grid.push(
      `    <line x1="0" y1="${y(at)}" x2="${width}" y2="${y(at)}" stroke="#e3e8ee" stroke-width="1"/>`,
    );
  }
  for (let at = 0; at <= advance; at += 100) {
    grid.push(
      `    <line x1="${originX + at}" y1="0" x2="${originX + at}" y2="${height}" stroke="#e3e8ee" stroke-width="1"/>`,
    );
  }
  grid.push(
    `    <line x1="${originX}" y1="0" x2="${originX}" y2="${height}" stroke="#9aa8b8" stroke-width="2"/>`,
    `    <line x1="${originX + advance}" y1="0" x2="${originX + advance}" y2="${height}" stroke="#9aa8b8" stroke-width="2" stroke-dasharray="12 12"/>`,
  );

  let outlines = "";
  if (glyph && glyph.contours.length > 0) {
    const box = bounds(glyph.contours.flat());
    const reach = reachOf(hand, character);
    const above = box.maxY - source.xHeight;
    const stretch = {
      xHeight: source.xHeight,
      up:
        reach.top > hand.xHeight && above > 0
          ? (reach.top - hand.xHeight) / above
          : body,
      down: reach.bottom < 0 && box.minY < 0 ? reach.bottom / box.minY : body,
    };
    outlines =
      layer(
        "outline-body",
        "outline (body)",
        true,
        `    <path d="${outlinePath(glyph, body, originX, baselineY)}" fill="#c9d3df" fill-rule="evenodd"/>`,
      ) +
      "\n" +
      layer(
        "outline-reach",
        "outline (reach)",
        true,
        `    <path d="${outlinePath(glyph, body, originX, baselineY, stretch)}" fill="none" stroke="#d99a9a" stroke-width="3" stroke-dasharray="10 8" fill-rule="evenodd"/>`,
      ) +
      "\n";
  }

  const notes = [
    `    <text x="${originX}" y="40" font-family="sans-serif" font-size="30" fill="#1f3a5f">${hand.name} — ${id}</text>`,
    `    <text x="${originX}" y="76" font-family="sans-serif" font-size="22" fill="#5b7fa6">Draw in the "strokes" layer with the pen tool: one open path per pen stroke, in the order the pen makes them. Grey is the shape; red dashes are how far the tall or hanging part goes.</text>`,
    `    <text x="${originX}" y="${height - 20}" font-family="sans-serif" font-size="22" fill="#5b7fa6">Ink starts wherever you like: the ingest sets the side bearings.</text>`,
  ].join("\n");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="${INKSCAPE}" xmlns:sodipodi="${SODIPODI}"`,
    `  width="${width / 2}" height="${height / 2}" viewBox="0 0 ${width} ${height}"`,
    `  data-hand="${hand.id}" data-glyph="${id}" data-units="${hand.units}" data-origin="${originX}" data-baseline="${baselineY}">`,
    `  <sodipodi:namedview id="namedview" inkscape:current-layer="strokes" inkscape:document-units="px"/>`,
    layer("ruling", "ruling", true, `${grid.join("\n")}\n${lines}`),
    outlines +
      layer("notes", "notes", true, notes) +
      "\n" +
      layer("strokes", "strokes", false, ""),
    `</svg>`,
    ``,
  ].join("\n");
}

/**
 * What was asked for as `{ stem, form }` pairs: a bare letter the hand draws
 * in more than one form is every form of it, and `t.straight` is that one.
 */
function wanted(hand, given) {
  const ids = given.length > 0 ? given : Object.keys(CHARACTERS);
  return ids.flatMap((one) => {
    const { stem: named, form } = splitId(one);
    const stem = STEMS[named] ?? named;
    const forms = hand.forms?.[CHARACTERS[stem]];
    if (form !== undefined || !forms) return [{ stem, form }];
    return forms.map((each) => ({ stem, form: each }));
  });
}

function main() {
  const { hand: id, ufo, glyphs } = args(process.argv.slice(2));
  const dir = join(ROOT, "art", "hands", id);
  const hand = JSON.parse(readFileSync(join(dir, "hand.json"), "utf8"));
  mkdirSync(dir, { recursive: true });

  const source = ufo
    ? { contents: readContents(ufo), xHeight: fontInfo(ufo, "xHeight") }
    : null;

  for (const { stem, form } of wanted(hand, glyphs)) {
    const character = CHARACTERS[stem];
    const name = form === undefined ? stem : `${stem}.${form}`;
    if (character === undefined) {
      console.error(`skipped ${name}: not a glyph the names table knows`);
      continue;
    }
    if (form !== undefined && !hand.forms?.[character]?.includes(form)) {
      console.error(
        `skipped ${name}: hand.json lists no "${form}" ${character}`,
      );
      continue;
    }
    const file = join(dir, `${name}.svg`);
    if (existsSync(file)) {
      console.log(`kept    ${name}.svg (already drawn)`);
      continue;
    }
    let glyph = null;
    if (source) {
      const outline = SIL_FORMS[`${character}.${form}`] ?? SIL_NAMES[character];
      glyph = readGlyph(ufo, outline, source.contents);
      if (glyph === null) {
        console.error(`no outline for ${name}: ${outline} is not in ${ufo}`);
      }
    }
    writeFileSync(file, template({ hand, character, id: name, glyph, source }));
    console.log(`wrote   ${name}.svg${glyph ? "" : " (no outline)"}`);
  }
}

main();
