// @ts-check
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Measures the commentary in `src/`, so "we cut the comments down" is a number
 * rather than an impression.
 *
 * The DEBT05–DEBT08 stories each ask for a before/after count over a subtree.
 * Counting by hand gives a different answer every time — whether a `*` line
 * inside a block counts, whether JSX comments count, whether tests count — and
 * two numbers measured differently do not subtract. So the method lives here
 * and both ends of a story read it from the same place.
 *
 * The two findings that shaped the epic are also computed here, because both
 * are invisible to a reader working one file at a time:
 *
 *   · Overlap with `docs/`. A phrase written in both a module and its own
 *     design doc is one fact with two owners, and they drift apart silently.
 *   · Long blocks. A 30-line header is usually a design document that landed
 *     in the wrong file, and it reads as normal until you count it.
 *
 * Run it with `npm run audit:comments`, or `-- --json` for a machine-readable
 * report to diff against a later run.
 */

/** Directories under `src/` that are data rather than prose, so ratios there mean nothing. */
const CORPUS = new Set(["passages", "release"]);

/**
 * Lines split three ways.
 *
 * Line-based, not tokenised: a `//` inside a string literal counts as a
 * comment here. That is wrong in principle and irrelevant in practice — the
 * point is a consistent yardstick across two runs, and it agrees with how
 * ESLint's `max-lines` counts with `skipComments`, which is the number the
 * component cap is already enforced against.
 *
 * @param {string} source
 * @returns {{ code: number, comment: number, blank: number }}
 */
export function classifyLines(source) {
  let inBlock = false;
  let code = 0;
  let comment = 0;
  let blank = 0;

  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line) {
      blank++;
      continue;
    }
    if (inBlock) {
      comment++;
      if (line.includes("*/")) inBlock = false;
      continue;
    }
    if (line.startsWith("/*") || line.startsWith("{/*")) {
      comment++;
      if (!line.includes("*/")) inBlock = true;
      continue;
    }
    if (line.startsWith("//")) {
      comment++;
      continue;
    }
    code++;
  }

  return { code, comment, blank };
}

/**
 * Runs of consecutive comment lines at or over `min`.
 *
 * A long run is the shape worth finding. `StormHud.tsx` carried an 80-line
 * header above a 25-line component, and every line of it read as reasonable on
 * its own — the length was the only thing that gave it away.
 *
 * @param {string} source
 * @param {number} [min]
 * @returns {{ start: number, length: number }[]}
 */
export function commentBlocks(source, min = 20) {
  const lines = source.split("\n");
  const blocks = [];
  let run = 0;

  const isComment = (/** @type {string} */ raw) => {
    const line = raw.trim();
    return (
      line.startsWith("/*") ||
      line.startsWith("*") ||
      line.startsWith("//") ||
      line.startsWith("{/*") ||
      line === "*/"
    );
  };

  for (let i = 0; i <= lines.length; i++) {
    if (i < lines.length && isComment(lines[i])) {
      run++;
      continue;
    }
    if (run >= min) blocks.push({ start: i - run + 1, length: run });
    run = 0;
  }

  return blocks;
}

/**
 * Every comment in a file, as one run of plain words.
 *
 * Punctuation and case go, so that a sentence reworded only by its em-dashes
 * still matches the doc it came from.
 *
 * @param {string} source
 * @returns {string}
 */
export function commentText(source) {
  const blocks = [...source.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => m[0]);
  const lines = [...source.matchAll(/^[ \t]*\/\/.*$/gm)].map((m) => m[0]);
  return normalise([...blocks, ...lines].join("\n"));
}

/**
 * @param {string} text
 * @returns {string}
 */
export function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Overlapping word runs, for comparing two bodies of prose.
 *
 * Eight words is long enough that a match is quotation rather than coincidence
 * — "the same curve cardXp pays a flash card at" is not a phrase two authors
 * arrive at separately.
 *
 * @param {string} text Already normalised.
 * @param {number} [size]
 * @returns {Set<string>}
 */
export function shingles(text, size = 8) {
  const words = text.split(" ").filter(Boolean);
  const out = new Set();
  for (let i = 0; i + size <= words.length; i++) {
    out.add(words.slice(i, i + size).join(" "));
  }
  return out;
}

/**
 * How much of `text` is quoted from `reference`.
 *
 * @param {string} text Already normalised.
 * @param {Set<string>} reference
 * @param {number} [size]
 * @returns {number}
 */
export function quotedPhrases(text, reference, size = 8) {
  const words = text.split(" ").filter(Boolean);
  let hits = 0;
  for (let i = 0; i + size <= words.length; i++) {
    if (reference.has(words.slice(i, i + size).join(" "))) hits++;
  }
  return hits;
}

/**
 * Section numbers a markdown file defines, from headings like `### 8.6 · …`.
 *
 * @param {string} markdown
 * @returns {Set<string>}
 */
export function sectionsIn(markdown) {
  const found = new Set();
  for (const m of markdown.matchAll(
    /^#{2,4} (?:§\s*)?([0-9]+(?:\.[0-9]+)*)\s*·/gm,
  )) {
    found.add(m[1]);
  }
  return found;
}

/**
 * `§` references in source, as `{ doc, section }`. `doc` is null when the
 * reference does not name one, which most of them do not.
 *
 * Legal citations are not doc references: `17 U.S.C. §105` in
 * `passages/documents.ts` is a copyright statute, and counting it as a pointer
 * into `docs/printables.md` would report a break that isn't one.
 *
 * A citation may wrap, so `*` and `/` are allowed between the doc and the `§`
 * — `(docs/typing.md\n * §5.4)` names its doc as plainly as the unwrapped form
 * does. Read as bare, it would be handed to `section-guard.mjs` to be resolved
 * by where the file sits, when it already said where it points.
 *
 * @param {string} source
 * @returns {{ doc: string | null, section: string }[]}
 */
export function sectionRefs(source) {
  const refs = [];
  for (const m of source.matchAll(
    /(?:(\d+\s+U\.S\.C\.\s*)|docs\/([a-z]+)\.md[\s*/]*)?§\s*([0-9]+(?:\.[0-9]+)*)/g,
  )) {
    if (m[1]) continue;
    refs.push({ doc: m[2] ?? null, section: m[3] });
  }
  return refs;
}

/**
 * Every file under `root` matching `extensions`.
 *
 * @param {string} root
 * @param {string[]} extensions
 * @returns {string[]}
 */
export function allFiles(root, extensions) {
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .map((entry) => path.join(root, entry))
    .filter((file) => extensions.includes(path.extname(file)));
}

/**
 * The same, minus the corpus directories — the file set this audit measures.
 *
 * `section-guard.mjs` reads `allFiles` instead, deliberately: a citation in
 * `passages/scripture.ts` is as breakable as any other, and only the ratios
 * are meaningless there.
 *
 * @param {string} root
 * @param {string[]} extensions
 * @returns {string[]}
 */
export function sourceFiles(root, extensions) {
  return allFiles(root, extensions).filter(
    (file) => !file.split(path.sep).some((part) => CORPUS.has(part)),
  );
}

/**
 * @typedef {object} FileReport
 * @property {string} file
 * @property {number} code
 * @property {number} comment
 * @property {number} blank
 * @property {number} quoted
 * @property {number} refs
 * @property {number} ratio
 */

/**
 * @typedef {object} Report
 * @property {{ code: number, comment: number, blank: number, quoted: number,
 *   refs: number, ratio: number, words: number, blocks: number,
 *   blockLines: number }} totals
 * @property {FileReport[]} files
 * @property {{ dir: string, code: number, comment: number, files: number }[]} directories
 * @property {{ file: string, start: number, length: number }[]} blocks
 * @property {string[]} broken
 */

/**
 * The whole report, as data. Printing it is a separate job so that `--json`
 * and the human-readable form can never disagree about a number.
 *
 * @param {Map<string, string>} sources Path → contents.
 * @param {Map<string, string>} docs Path → contents.
 * @returns {Report}
 */
export function audit(sources, docs) {
  const docShingles = shingles(normalise([...docs.values()].join("\n")));
  const defined = new Map(
    [...docs].map(([file, text]) => [
      path.basename(file, ".md"),
      sectionsIn(text),
    ]),
  );

  /** @type {FileReport[]} */
  const files = [];
  const totals = { code: 0, comment: 0, blank: 0, quoted: 0, refs: 0 };
  /** @type {{ file: string, start: number, length: number }[]} */
  const blocks = [];
  /** @type {string[]} */
  const broken = [];

  for (const [file, source] of sources) {
    const counted = classifyLines(source);
    const text = commentText(source);
    const quoted = quotedPhrases(text, docShingles);
    const refs = sectionRefs(source);

    totals.code += counted.code;
    totals.comment += counted.comment;
    totals.blank += counted.blank;
    totals.quoted += quoted;
    totals.refs += refs.length;

    for (const block of commentBlocks(source)) {
      blocks.push({ file, ...block });
    }
    for (const ref of refs) {
      if (ref.doc && !defined.get(ref.doc)?.has(ref.section)) {
        broken.push(`${file}: docs/${ref.doc}.md §${ref.section}`);
      }
    }

    files.push({
      file,
      ...counted,
      quoted,
      refs: refs.length,
      ratio: counted.code ? counted.comment / counted.code : Infinity,
    });
  }

  /** @type {Map<string, { code: number, comment: number, files: number }>} */
  const directories = new Map();
  for (const entry of files) {
    const key = entry.file.split(path.sep).slice(0, 3).join(path.sep);
    const seen = directories.get(key) ?? { code: 0, comment: 0, files: 0 };
    seen.code += entry.code;
    seen.comment += entry.comment;
    seen.files++;
    directories.set(key, seen);
  }

  return {
    totals: {
      ...totals,
      ratio: totals.comment / totals.code,
      words: [...sources.values()]
        .map((source) => commentText(source).split(" ").filter(Boolean).length)
        .reduce((a, b) => a + b, 0),
      blocks: blocks.length,
      blockLines: blocks.reduce((sum, block) => sum + block.length, 0),
    },
    files,
    directories: [...directories].map(([dir, v]) => ({ dir, ...v })),
    blocks,
    broken,
  };
}

/**
 * @param {Report} report
 * @returns {string}
 */
export function format(report) {
  const { totals: t, files, directories, blocks } = report;

  const pad = (/** @type {number} */ n, /** @type {number} */ w) =>
    String(n).padStart(w);
  const lines = [];

  lines.push("Comment audit — src/");
  lines.push("");
  lines.push(
    `  ${t.comment} comment lines over ${t.code} code lines  (ratio ${t.ratio.toFixed(3)})`,
  );
  lines.push(`  ${t.words} words of commentary`);
  lines.push(
    `  ${t.blocks} blocks of 20+ consecutive comment lines, totalling ${t.blockLines} lines`,
  );
  lines.push(`  ${t.quoted} eight-word phrases also present in docs/`);
  lines.push(`  ${t.refs} § references into docs/`);

  lines.push("", "Heaviest files, by comment lines");
  for (const f of [...files]
    .sort((a, b) => b.comment - a.comment)
    .slice(0, 15)) {
    lines.push(
      `  ${pad(f.comment, 5)} cmt ${pad(f.code, 5)} code  ratio ${f.ratio.toFixed(2).padStart(5)}  ${f.file}`,
    );
  }

  lines.push("", "Heaviest files, by ratio (60+ code lines)");
  const dense = files
    .filter((f) => f.code >= 60)
    .sort((a, b) => b.ratio - a.ratio);
  for (const f of dense.slice(0, 10)) {
    lines.push(
      `  ratio ${f.ratio.toFixed(2).padStart(5)}  ${pad(f.comment, 5)} cmt ${pad(f.code, 5)} code  ${f.file}`,
    );
  }

  lines.push("", "Most quoted from docs/");
  for (const f of [...files].sort((a, b) => b.quoted - a.quoted).slice(0, 10)) {
    if (f.quoted === 0) break;
    lines.push(`  ${pad(f.quoted, 5)} phrases  ${f.file}`);
  }

  lines.push("", "Longest single blocks");
  for (const b of [...blocks]
    .sort((a, b) => b.length - a.length)
    .slice(0, 10)) {
    lines.push(`  ${pad(b.length, 4)} lines  ${b.file}:${b.start}`);
  }

  lines.push("", "By directory");
  for (const d of [...directories]
    .sort((a, b) => b.comment - a.comment)
    .slice(0, 15)) {
    lines.push(
      `  ${pad(d.comment, 6)} cmt ${pad(d.code, 6)} code  ratio ${(d.comment / d.code).toFixed(2).padStart(5)}  ${pad(d.files, 3)} files  ${d.dir}`,
    );
  }

  if (report.broken.length > 0) {
    lines.push("", "Broken § references");
    for (const line of report.broken) lines.push(`  ${line}`);
  }

  return lines.join("\n");
}

/**
 * Reads the tree and prints the report. Kept apart from `audit` so the
 * measurement can be tested without a filesystem.
 *
 * @returns {void}
 */
function main() {
  const sources = new Map(
    sourceFiles("src", [".ts", ".tsx", ".astro"]).map((file) => [
      file,
      readFileSync(file, "utf8"),
    ]),
  );
  const docs = new Map(
    sourceFiles("docs", [".md"]).map((file) => [
      file,
      readFileSync(file, "utf8"),
    ]),
  );

  const report = audit(sources, docs);
  const json = process.argv.includes("--json");
  process.stdout.write(
    (json ? JSON.stringify(report, null, 2) : format(report)) + "\n",
  );
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(path.basename(process.argv[1]))
) {
  main();
}
