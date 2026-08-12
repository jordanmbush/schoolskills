#!/usr/bin/env node
/**
 * Generates the favicon, PWA icons and the Open Graph card from one SVG source.
 *
 * Committed as generated PNGs rather than produced at build time: they change
 * about once a year, and a build-time image step would add a sharp dependency
 * to CI for no benefit. Re-run this after editing the SVG below.
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

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const INK = "#0b0f1a";
const LIME = "#c8ff41";
const SKY = "#4cc4ff";

/** The mark: a card with a multiplication sign, which is the whole product. */
const mark = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${LIME}"/>
      <stop offset="100%" stop-color="${SKY}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="${INK}"/>
  <rect x="96" y="72" width="320" height="368" rx="44" fill="url(#g)"/>
  <g stroke="${INK}" stroke-width="42" stroke-linecap="round">
    <line x1="196" y1="196" x2="316" y2="316"/>
    <line x1="316" y1="196" x2="196" y2="316"/>
  </g>
</svg>`;

const ogCard = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${LIME}"/>
      <stop offset="100%" stop-color="${SKY}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="${INK}"/>
  <circle cx="1050" cy="90" r="260" fill="${SKY}" opacity="0.10"/>
  <circle cx="150" cy="560" r="220" fill="${LIME}" opacity="0.10"/>
  <rect x="80" y="150" width="240" height="300" rx="36" fill="url(#g)"/>
  <g stroke="${INK}" stroke-width="30" stroke-linecap="round">
    <line x1="152" y1="252" x2="248" y2="348"/>
    <line x1="248" y1="252" x2="152" y2="348"/>
  </g>
  <text x="380" y="252" font-family="Georgia, 'Times New Roman', serif" font-size="86" font-weight="700" fill="#eef4ff">School Skills</text>
  <text x="380" y="330" font-family="Helvetica, Arial, sans-serif" font-size="38" fill="${LIME}">Learning games that feel like games</text>
  <text x="382" y="400" font-family="Helvetica, Arial, sans-serif" font-size="29" fill="#93a3bd">Free · no sign-up · progress stays on your device</text>
  <rect x="380" y="446" width="360" height="4" rx="2" fill="${SKY}" opacity="0.5"/>
  <text x="380" y="512" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#93a3bd">schoolskills.app</text>
</svg>`;

const outputs = [
  ["favicon.svg", Buffer.from(mark(512))],
  [
    "icon-192.png",
    await sharp(Buffer.from(mark(192)))
      .png()
      .toBuffer(),
  ],
  [
    "icon-512.png",
    await sharp(Buffer.from(mark(512)))
      .png()
      .toBuffer(),
  ],
  [
    "apple-touch-icon.png",
    await sharp(Buffer.from(mark(180)))
      .png()
      .toBuffer(),
  ],
  ["og-default.png", await sharp(Buffer.from(ogCard)).png().toBuffer()],
];

for (const [name, data] of outputs) {
  writeFileSync(join(PUBLIC, name), data);
  console.log(`✓ public/${name} (${(data.length / 1024).toFixed(1)} kB)`);
}
