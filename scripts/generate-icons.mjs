#!/usr/bin/env node
/**
 * Generates the favicon, PWA icons and the Open Graph card.
 *
 * Committed as generated files rather than produced at build time: they change
 * about once a year, and a build-time image step would add a sharp dependency
 * to CI for no benefit. Re-run this after editing anything below.
 *
 * The mark itself is vector, traced from the master artwork by
 * scripts/trace-icon.mjs into scripts/icons/mark-paths.mjs. Every PNG here is
 * rasterised from those curves *at its final size* — never downscaled from a
 * larger render. That distinction is the whole reason the pipeline is shaped
 * this way: librsvg laying out curves at 32px is crisp, and resampling a
 * 1478px bitmap down to 32px is not.
 *
 * The OG card must be a raster format — most social platforms and chat clients
 * refuse to render an SVG preview, so an SVG og:image is the same as no image.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { SIDE, DETAIL, SIMPLE } from "./icons/mark-paths.mjs";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

/**
 * The plate, lifted from the artwork's own #142b4e.
 *
 * The silhouettes are pure black, and black on the original navy measures
 * 1.49:1 — which is why the figures dissolve below 64px. They were never
 * really visible against the plate, only outlined by its edge. #20477b is
 * 2.25:1: enough for the figures to separate at 32px, still unmistakably the
 * same deep navy at 512. Restoring the original is a one-line change here,
 * at the cost of the small sizes.
 */
const PLATE = "#20477b";
const BLACK = "#000000";
const BOOK = "#f8f8f8";

/** Matches the master artwork's own corner radius, 9.8% of the side. */
const RADIUS = Math.round(SIDE * 0.098);

/** The OG card's palette, which is the site's rather than the mark's. */
const INK = "#0b0f1a";
const LIME = "#c8ff41";
const SKY = "#4cc4ff";

/**
 * The mark's contents, in mark coordinates — a clip, a plate, the two tones.
 *
 * Kept separate from the `<svg>` wrapper so the OG card can drop the same mark
 * into its own canvas rather than keeping a second, drifting copy of it.
 *
 * `radius` of 0 gives the full-bleed square that iOS and Android expect to mask
 * themselves. `inset` shrinks the art inside the plate for maskable output,
 * where anything outside the centre 80% may be cropped. `id` only has to be
 * unique within whichever document this lands in.
 */
const markBody = (paths, { radius = RADIUS, inset = 1, id = "plate" } = {}) => {
  const shift = (SIDE * (1 - inset)) / 2;
  return `<defs><clipPath id="${id}"><rect width="${SIDE}" height="${SIDE}" rx="${radius}" ry="${radius}"/></clipPath></defs>
  <g clip-path="url(#${id})">
    <rect width="${SIDE}" height="${SIDE}" fill="${PLATE}"/>
    <g fill-rule="evenodd" transform="translate(${shift} ${shift}) scale(${inset})">
      <path d="${paths.black}" fill="${BLACK}"/>
      <path d="${paths.white}" fill="${BOOK}"/>
    </g>
  </g>`;
};

/**
 * The mark as a standalone file.
 *
 * `size` sets the declared width/height so the renderer lays the curves out at
 * that size directly, rather than rendering large and resampling down.
 */
const mark = (paths, { size, ...rest }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIDE} ${SIDE}" width="${size}" height="${size}">
  ${markBody(paths, rest)}
</svg>`;

const png = (svg) =>
  sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

/**
 * Where the mark sits on the card, and how big.
 *
 * The old mark was a 240x300 portrait plate. A 240 square beside display type
 * that tall reads underweight, so this matches the old plate's area instead of
 * its width — 268 squared is within a per cent of 240x300 — and stays clear of
 * the text column at x=380. Centred on the card's midline, not eyeballed.
 */
const OG_MARK = { x: 80, size: 268 };

const ogCard = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${INK}"/>
  <circle cx="1050" cy="90" r="260" fill="${SKY}" opacity="0.10"/>
  <circle cx="150" cy="560" r="220" fill="${LIME}" opacity="0.10"/>
  <g transform="translate(${OG_MARK.x} ${(630 - OG_MARK.size) / 2}) scale(${OG_MARK.size / SIDE})">
    ${markBody(DETAIL, { id: "og-plate" })}
  </g>
  <text x="380" y="252" font-family="Georgia, 'Times New Roman', serif" font-size="86" font-weight="700" fill="#eef4ff">School Skills</text>
  <text x="380" y="330" font-family="Helvetica, Arial, sans-serif" font-size="38" fill="${LIME}">Learning games that feel like games</text>
  <text x="382" y="400" font-family="Helvetica, Arial, sans-serif" font-size="29" fill="#93a3bd">Free · no sign-up · progress stays on your device</text>
  <rect x="380" y="446" width="360" height="4" rx="2" fill="${SKY}" opacity="0.5"/>
  <text x="380" y="512" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#93a3bd">schoolskills.app</text>
</svg>`;

const outputs = [
  /**
   * The tab icon, and the only shipped vector.
   *
   * SIMPLE rather than DETAIL: a tab draws this at 16 or 32px, and at that
   * size the book's page rules and the lettering on its cover are not detail,
   * they are grit. Dropping them leaves a cleaner shape at the sizes that
   * actually render it, and nothing renders this file large.
   */
  ["favicon.svg", Buffer.from(mark(SIMPLE, { size: SIDE }))],

  /**
   * iOS draws its own squircle and composites onto black, so a rounded source
   * with transparent corners shows up as dark notches. Square and full bleed.
   */
  ["apple-touch-icon.png", await png(mark(DETAIL, { size: 180, radius: 0 }))],

  ["icon-192.png", await png(mark(DETAIL, { size: 192 }))],
  ["icon-512.png", await png(mark(DETAIL, { size: 512 }))],

  /**
   * Maskable: Android crops this to whatever shape the launcher uses, and only
   * the centre 80% is guaranteed to survive. Full bleed so no transparent
   * corner can appear, with the art inset so the crop takes plate, not figures.
   */
  [
    "icon-maskable-512.png",
    await png(mark(DETAIL, { size: 512, radius: 0, inset: 0.8 })),
  ],

  ["og-default.png", await sharp(Buffer.from(ogCard)).png().toBuffer()],
];

for (const [name, data] of outputs) {
  writeFileSync(join(PUBLIC, name), data);
  console.log(`✓ public/${name} (${(data.length / 1024).toFixed(1)} kB)`);
}
