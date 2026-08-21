// @ts-check
import { readFileSync } from "node:fs";
import path from "node:path";

import { allFiles, sectionRefs, sectionsIn } from "./comment-audit.mjs";

/**
 * The build-time check that every `§` in the source still points at a section
 * that exists.
 *
 * The comments here cite `docs/` more than a thousand times, and all but a
 * hundred of those citations are a bare number — `(§8.6)` — resolved by an
 * agreement about where the file sits rather than by anything written in the
 * reference itself. That is the cheapest form to write and the most fragile
 * one to keep: renumbering a heading in `docs/typing.md` silently repoints
 * every citation under `src/games/typing/`, and nothing about the code stops
 * working, so nothing tells you.
 *
 * So the agreement is written down twice — once in prose, in CLAUDE.md, and
 * once as `HOMES` below — and the build reads both ends: the headings each doc
 * defines, and every reference the source makes into them. A build that cites
 * a section nobody wrote fails rather than shipping a pointer to nowhere.
 *
 * The same shape as `sitemap-guard.mjs` and `search-index-guard.mjs`, for the
 * same reason: a disagreement between two files that are meant to say the same
 * thing is invisible to a test of either one.
 *
 * The parser is `comment-audit.mjs`'s, so the two can't read a citation
 * differently. They cast different nets: the audit measures commentary in code
 * and reads neither the stylesheets nor the passage corpus, which is why its
 * total is the smaller one.
 */

/**
 * The document a bare `§` belongs to, by where the file sits.
 *
 * This is the table in CLAUDE.md ("The three documents, and what a bare `§`
 * means") as data, and the two have to agree — a subtree added here without a
 * row there leaves the convention unwritten again, which is the thing this
 * guard exists to stop.
 *
 * `docs/analytics.md` numbers nothing and so owns no subtree: it is always
 * cited by name.
 */
const HOMES = {
  printables: [
    "src/engine/sheets",
    "src/components/sheet",
    "src/games/printshop",
    "src/pages/printables",
    "src/styles/sheet.css",
    "src/styles/print.css",
    "src/styles/printshop.css",
    "src/styles/fonts.css",
  ],
  typing: [
    "src/engine/typing",
    "src/games/typing",
    "src/engine/keyboard.ts",
    // Four of the game's seven stylesheets, and not the directory above them:
    // setup, race and card are drawn by both islands, so a bare § in one of
    // those has no subject to resolve by and has to name its document.
    "src/styles/game/ladder.css",
    "src/styles/game/lesson.css",
    "src/styles/game/keyboard.css",
    "src/styles/game/storm.css",
  ],
};

/**
 * @param {string} file A path relative to the repo root.
 * @returns {string | null} The doc that owns it, or null where none does.
 */
export function docFor(file) {
  const here = file.split(path.sep).join("/");
  for (const [doc, homes] of Object.entries(HOMES)) {
    const owned = homes.some(
      (home) => here === home || here.startsWith(`${home}/`),
    );
    if (owned) return doc;
  }
  return null;
}

/**
 * What a bare `§` in one file means, which is `docFor` plus one fallback: a
 * file no subtree owns but which cites exactly one document is that
 * document's for as long as that stays true. `engine/progress.ts` is the
 * case — shared code, eleven bare references, every named one of them typing's.
 *
 * A file that cites two documents, or none, gets null and its bare references
 * fail. That is the rule CLAUDE.md already states — anywhere genuinely shared,
 * name the document — with a build behind it.
 *
 * @param {string} file
 * @param {{ doc: string | null, section: string }[]} refs
 * @returns {string | null}
 */
function homeOf(file, refs) {
  const named = new Set(refs.map((ref) => ref.doc).filter(Boolean));
  return docFor(file) ?? (named.size === 1 ? [...named][0] : null);
}

/**
 * Every reference that doesn't land, as lines a human can act on. An empty
 * array is the passing case.
 *
 * Each line names the file, the reference and the document it was resolved
 * against, because with a bare citation the resolution is the half a reader
 * can't see: "§5.4 doesn't exist" is not actionable until you know which of
 * the three documents was asked.
 *
 * @param {Map<string, string>} sources Path → contents, under `src/`.
 * @param {Map<string, string>} docs Path → contents, under `docs/`.
 * @returns {string[]}
 */
export function auditSections(sources, docs) {
  const defined = new Map(
    [...docs].map(([file, text]) => [
      path.basename(file, ".md"),
      sectionsIn(text),
    ]),
  );
  if ([...defined.values()].every((sections) => sections.size === 0)) {
    return [
      "No numbered headings were found in docs/ at all, so every reference below would resolve against nothing. Either the headings stopped being numbered or this guard is reading the wrong directory.",
    ];
  }

  const problems = [];
  let checked = 0;

  for (const [file, source] of sources) {
    const refs = sectionRefs(source);
    const home = homeOf(file, refs);
    for (const ref of refs) {
      checked++;
      const doc = ref.doc ?? home;
      if (!doc) {
        problems.push(
          `${file} §${ref.section} — bare, and nothing resolves it: no document owns this file, and its other citations don't name exactly one. Write docs/<name>.md §${ref.section}.`,
        );
        continue;
      }
      if (!defined.get(doc)?.has(ref.section)) {
        const how = ref.doc ? "named" : "resolved by where the file sits";
        problems.push(
          `${file} §${ref.section} — docs/${doc}.md has no such section (${how}).`,
        );
      }
    }
  }

  if (checked === 0) {
    return [
      "No § references were found under src/ at all. The source carries over a thousand, so this guard is looking in the wrong place — a check that finds nothing passes forever.",
    ];
  }

  return problems.sort();
}

/**
 * Wired into `astro.config.mjs` at `astro:build:start` rather than
 * `astro:build:done`, unlike the other two guards: they read what the build
 * wrote and this one reads what it was built from, so there is no reason to
 * spend a full build before saying a citation is wrong.
 *
 * Paths are relative to the working directory, as `npm run audit:comments`
 * reads the same tree. A build run from somewhere else finds no files, which
 * is why finding none is a failure above rather than a pass.
 *
 * @returns {import("astro").AstroIntegration}
 */
export function sectionGuard() {
  return {
    name: "section-guard",
    hooks: {
      "astro:build:start": ({ logger }) => {
        const read = (
          /** @type {string} */ root,
          /** @type {string[]} */ extensions,
        ) =>
          new Map(
            allFiles(root, extensions).map((file) => [
              file,
              readFileSync(file, "utf8"),
            ]),
          );

        const sources = read("src", [".ts", ".tsx", ".astro", ".css"]);
        const problems = auditSections(sources, read("docs", [".md"]));
        if (problems.length > 0) {
          throw new Error(
            [
              "Comments cite sections of docs/ that don't exist:",
              ...problems.map((line) => `  · ${line}`),
              "",
              'A bare § resolves by where the file sits — see CLAUDE.md, "The three documents, and what a bare § means", and HOMES in scripts/section-guard.mjs.',
            ].join("\n"),
          );
        }

        const checked = [...sources.values()].reduce(
          (count, source) => count + sectionRefs(source).length,
          0,
        );
        logger.info(
          `§ references checked — ${checked} of them, every one a section that exists`,
        );
      },
    },
  };
}
