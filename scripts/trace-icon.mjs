#!/usr/bin/env node
/**
 * Traces the master icon artwork into vector paths.
 *
 * The artwork arrived as a raster, but it is flat three-tone art — a navy
 * plate, black silhouettes, a near-white book — so it vectorises exactly
 * rather than approximately. That matters at favicon sizes: rendering curves
 * natively at 16px is sharp, whereas downsampling a 1792px bitmap to 16px is
 * the mush this replaces.
 *
 * Output is scripts/icons/mark-paths.mjs, which generate-icons.mjs consumes.
 * Splitting it this way keeps potrace out of the normal icon pipeline — the
 * trace runs once when the art changes, the icons regenerate whenever a size
 * or a colour does.
 *
 * potrace is deliberately NOT a dependency. Install it for the one run:
 *
 *   npm i --no-save potrace && node scripts/trace-icon.mjs
 *
 * Usage: node scripts/trace-icon.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, "icons", "source.png");
const TARGET = join(HERE, "icons", "mark-paths.mjs");

let Potrace;
try {
  ({ Potrace } = await import("potrace"));
} catch {
  console.error(
    "potrace is not installed. Run:\n\n  npm i --no-save potrace\n",
  );
  process.exit(1);
}

/**
 * The crop that became the shipped framing.
 *
 * The master is 1792x2390 with the figures breaking out of a 1481x1521 plate,
 * and its bottom edge cuts the feet off mid-stride — 346 opaque pixels sit on
 * the final row. No square crop can show whole figures, so this one stops at
 * the thighs, above the damage, and lets the plate go full bleed instead of
 * floating inside the frame.
 */
const CROP = { left: 158, top: 268, width: 1478, height: 1478 };

/**
 * Where one tone ends and the next begins.
 *
 * Navy sits at luma 41, black at 0, near-white at 248. The only defensible
 * thresholds are the midpoints between them: lower the black cut and the
 * silhouettes shed their antialiasing, raise it and they fatten.
 */
const LUMA_BLACK_MAX = 20;
const LUMA_WHITE_MIN = 144;

/**
 * How aggressively to drop small shapes, in source pixels.
 *
 * The page rules and the part-word on the book's cover are real marks, not
 * noise, but below about 64px they render as grit. `simple` discards them for
 * the sizes that cannot draw them; `detail` keeps everything.
 */
const DESPECKLE = { detail: 2, simple: 900 };

const { data, info } = await sharp(SOURCE)
  .extract(CROP)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

/** One tone as a 1-bit bitmap — shape in black on white, which is potrace's input. */
const maskOf = (tone) => {
  const mask = Buffer.alloc(W * H, 255);
  let count = 0;
  for (let i = 0, p = 0; p < W * H; p++, i += 4) {
    // Transparent means outside the original plate; the new plate covers it.
    if (data[i + 3] < 128) continue;
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (tone === "black" ? luma < LUMA_BLACK_MAX : luma > LUMA_WHITE_MIN) {
      mask[p] = 0;
      count++;
    }
  }
  return { mask, count };
};

const trace = (mask, turdSize) =>
  new Promise((resolve, reject) => {
    const p = new Potrace({
      threshold: 128,
      blackOnWhite: true,
      turdSize,
      alphaMax: 1,
      optCurve: true,
      optTolerance: 0.2,
      turnPolicy: Potrace.TURNPOLICY_MINORITY,
    });
    sharp(mask, { raw: { width: W, height: H, channels: 1 } })
      .png()
      .toBuffer()
      .then((png) =>
        p.loadImage(png, (err) => {
          if (err) return reject(err);
          // getPathTag returns a whole <path> element; the geometry is all we store.
          const d = /\sd="([^"]+)"/.exec(p.getPathTag());
          if (!d) return reject(new Error("potrace returned no path data"));
          resolve(d[1]);
        }),
      )
      .catch(reject);
  });

const tones = { black: maskOf("black"), white: maskOf("white") };
console.log(`black ${tones.black.count} px · white ${tones.white.count} px`);

const variants = {};
for (const [name, turdSize] of Object.entries(DESPECKLE)) {
  variants[name] = {
    black: await trace(tones.black.mask, turdSize),
    white: await trace(tones.white.mask, turdSize),
  };
  const kb = (variants[name].black.length + variants[name].white.length) / 1024;
  console.log(
    `${name.padEnd(6)} despeckle ${String(turdSize).padStart(3)} · ${kb.toFixed(1)} kB of path data`,
  );
}

const module = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Vector paths traced from scripts/icons/source.png by scripts/trace-icon.mjs.
 * Re-run that script if the artwork changes; everything else about the icons
 * (colour, corner radius, which sizes exist) is decided in generate-icons.mjs.
 *
 * The three tones tile the square without overlapping, so paint order is free:
 * plate, then black, then white, in any arrangement, gives the same picture.
 * Both path sets need fill-rule="evenodd" — the silhouettes have holes.
 *
 * \`detail\` keeps the book's page rules and the lettering on its cover.
 * \`simple\` drops them, for the sizes too small to draw them as anything but
 * grit. See DESPECKLE in the tracing script.
 */

/** Both path sets are authored against this square viewBox. */
export const SIDE = ${W};

export const DETAIL = {
  black: "${variants.detail.black}",
  white: "${variants.detail.white}",
};

export const SIMPLE = {
  black: "${variants.simple.black}",
  white: "${variants.simple.white}",
};
`;

writeFileSync(TARGET, module);
console.log(
  `\n✓ scripts/icons/mark-paths.mjs (${(module.length / 1024).toFixed(1)} kB)`,
);
