// @ts-check
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Re-pull the Scripture releases the passage library quotes.
 *
 * eBible.org asks publishers to take a current release so that known typo
 * corrections travel; docs/printables.md §12 turns that into "record the source
 * and release date, and re-pull when the library is next touched". A sentence
 * in a design doc is not a mechanism, so this is the mechanism: one command
 * that fetches today's verse-per-line release of each translation, rewrites the
 * extracts under `src/engine/sheets/passages/release/`, and prints a diff of
 * any verse whose text has changed since the last pull.
 *
 *   node scripts/pull-scripture.mjs            report changes, write nothing
 *   node scripts/pull-scripture.mjs --write    rewrite the extracts
 *
 * The extracts are what `scripture.test.ts` compares the library against, so
 * after a `--write` that reported changes the suite fails, naming exactly which
 * entries in scripture.ts and kjv.ts need their verse copied across. That
 * failure is the point: a typo correction upstream should be a task, not a
 * silent divergence between what we print and what eBible publishes.
 *
 * Deliberately not part of `npm run build` or CI. A build that reaches out to
 * a third party is a build that fails when that third party is down, and the
 * text of a passage library is not something that should change without a
 * person reading the diff.
 */

const RELEASES = [
  { id: "engwebu", extract: "engwebu" },
  { id: "eng-kjv2006", extract: "eng-kjv2006" },
];

const DIR = new URL("../src/engine/sheets/passages/release/", import.meta.url);

/**
 * The current verse-per-line release as `BOOK C:V` → text.
 *
 * eBible ships the format only as a zip, so the fetch goes through `unzip`
 * rather than a dependency: this runs on a developer's machine, by hand, a
 * couple of times a year.
 *
 * @param {string} id
 * @returns {Promise<Map<string, string>>}
 */
async function fetchRelease(id) {
  const dir = mkdtempSync(join(tmpdir(), "scripture-"));
  const zip = join(dir, `${id}_vpl.zip`);
  const url = `https://ebible.org/Scriptures/${id}_vpl.zip`;
  const download = spawnSync("curl", ["-sSL", "--fail", "-o", zip, url]);
  if (download.status !== 0) throw new Error(`could not fetch ${url}`);
  const unzipped = spawnSync("unzip", ["-p", zip, `${id}_vpl.txt`], {
    maxBuffer: 64 * 1024 * 1024,
    encoding: "utf8",
  });
  if (unzipped.status !== 0) throw new Error(`could not read ${id}_vpl.txt`);
  return parse(unzipped.stdout);
}

/**
 * @param {string} text
 * @returns {Map<string, string>}
 */
function parse(text) {
  const verses = new Map();
  for (const line of text.split("\n")) {
    const match = /^(\S+ \d+:\d+) (.*)$/.exec(line);
    if (match) verses.set(match[1], match[2]);
  }
  return verses;
}

async function main() {
  const write = process.argv.includes("--write");
  let changed = 0;

  for (const { id, extract } of RELEASES) {
    const path = new URL(`${extract}.vpl.txt`, DIR);
    const held = parse(await readFile(path, "utf8"));
    const current = await fetchRelease(id);

    const lines = [];
    for (const [ref, was] of held) {
      const now = current.get(ref);
      if (now === undefined) {
        console.log(`${id} ${ref}\n  GONE from the current release`);
        changed += 1;
        lines.push(`${ref} ${was}`);
        continue;
      }
      if (now !== was) {
        changed += 1;
        console.log(`${id} ${ref}\n  was: ${was}\n  now: ${now}`);
      }
      lines.push(`${ref} ${now}`);
    }

    if (write) await writeFile(path, `${lines.join("\n")}\n`);
    console.log(`${id}: ${held.size} verses checked`);
  }

  if (changed === 0) {
    console.log("Up to date. Update the release dates in the file headers.");
    return;
  }
  console.log(
    `\n${changed} verse(s) changed.` +
      (write
        ? " Extracts rewritten — run the unit suite and copy each change into" +
          " scripture.ts / kjv.ts, then update the release dates in the headers."
        : " Re-run with --write to update the extracts."),
  );
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
