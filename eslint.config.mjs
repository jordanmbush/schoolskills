import path from "node:path";

import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier/flat";

/**
 * Architecture enforced by lint, not by convention.
 *
 * Ported from monilibrium_2's `apps/web/eslint.config.mjs`, whose own rule
 * comments record why: the boundary that was merely a convention drifted from
 * 30 to 37 violating files while the lint-enforced one held perfectly. So every
 * boundary that matters here is a rule with a message naming the alternative.
 *
 * The layers, and what plays each MVC role in this codebase:
 *
 *   src/engine/     MODEL. Decks, scoring, records, progress. Pure functions
 *                   over plain data. Framework-agnostic so a future native app
 *                   or a build-time script can import it.
 *   src/services/   CONTROLLER. Profiles, sessions, persistence. Owns all
 *                   storage access. Also framework-agnostic.
 *   src/pages/      VIEW. Astro pages (static HTML) and React islands. Calls
 *   src/layouts/    services; never reaches past them into storage.
 *   src/components/
 *   src/games/
 *   src/components/ui/   The primitive kit. Domain-free and prop-driven.
 *
 * ── The flat-config clobbering hazard ────────────────────────────────────────
 * Flat config REPLACES same-rule options across matching blocks rather than
 * merging them. Two blocks naming `no-restricted-imports` over overlapping file
 * sets means the later one silently wins and the earlier one is dead. This bit
 * monilibrium (its MVC view boundary was inert for a while), so the rule ids
 * here are allocated deliberately:
 *
 *   `@typescript-eslint/no-restricted-imports`  layer boundaries (A/B/C/E),
 *                                               whose file sets are DISJOINT —
 *                                               note C explicitly ignores the
 *                                               kit so it doesn't overlap E.
 *   `no-restricted-imports` (base)              the storage-package ban (D),
 *                                               which spans everything.
 *   `no-restricted-syntax`                      the native-controls ban only.
 *   `local/*`                                   anything else needing its own
 *                                               severity or its own file scope.
 *
 * Before adding a block, check whether its rule id is already used over files
 * yours would also match. If it is, use a local plugin rule instead.
 */

// ── Component size cap ───────────────────────────────────────────────────────
// No view-layer module may exceed 300 lines. The real test is whether a reader
// can tell what a component does at a glance; the number is the proxy.
//
// Counted with `skipComments` + `skipBlankLines` DELIBERATELY: the cap is about
// how much a module DOES, so documenting it well must never count against it.
// Nor is it a reason to keep a comment — whether one belongs is decided by the
// standard in CLAUDE.md ("Comments"), which this rule says nothing about.
// Over the number, split the module or move the doc block onto the thing it now
// describes.
const MAX_COMPONENT_LINES = 300;

// Storage is an implementation detail of the service layer — the direct
// analogue of monilibrium's "Prisma client only in services/" boundary. A React
// component that reaches for `localStorage` bypasses the profile/session
// schema, the quota handling, and `navigator.storage.persist()`.
const STORAGE_BAN =
  "Storage is owned by src/services/storage/. Don't touch localStorage, sessionStorage or indexedDB directly — call a service (e.g. profiles.load(), sessions.record()). Storage shape, migrations and quota handling live in one place on purpose.";

const FRAMEWORK_BAN =
  "This layer must stay framework-agnostic so it can be reused by a build-time script, a test, or a future native app. Don't import React or Astro here — return plain data and let the view render it.";

// The typing corpus, banned from the one layer every island imports. This is
// the only boundary here that was drawn by a measurement rather than by a
// principle, so the measurement is in the message: a reader who deletes the
// rule should have to argue with the number.
//
// The requirement is REACHABILITY, not a direct import ("this file must never
// become reachable from decks/index.ts", docs/typing.md §5.3), so the message
// names the one hop that would otherwise slip through: `engine/typing/
// lessons.ts` is deliberately importable from the deck layer, and a corpus
// import inside it lands in the shared chunk exactly as a corpus import inside
// `decks/typing.ts` would.
const CORPUS_BAN =
  "The typing corpus and its generator must not be REACHABLE from src/engine/decks/. decks/index.ts is the front door for every island — flash cards, spelling, the record book, the print shop — and a module in its import graph ships to all of them: an import of the passage library from decks/typing.ts took the shared chunk from 46 KB to 222 KB once already, which is why thirty-three verses are written out by hand in that file today. Reachability is transitive, so the ban covers the whole engine and not decks/ alone — engine/typing/lessons.ts is deliberately importable from the deck layer, so a corpus import there would ship to every island one hop away, with nothing in decks/ looking wrong. Only lexicon.ts, generate.ts and their tests may read the corpus. Everywhere else: generate the words inside the typing island and hand them over in TypingConfig.words — the deck layer builds cards from config.words and never has to know where they came from (docs/typing.md §5.3, decision 7).";

/**
 * Local rules, defined ONCE and registered in a single global block below.
 *
 * They cannot be declared inline on the blocks that use them: a plugin
 * namespace may be defined only once per file, and these rules apply to
 * overlapping file sets (`src/components/**\/*.tsx` matches both the storage
 * ban and the button ban). Declaring `plugins: { local }` in each block makes
 * ESLint fail hard with `Cannot redefine plugin "local"` for exactly the files
 * in the overlap — and pass everywhere else, so it looks fine until it isn't.
 * Registering once and referencing the rule ids by name avoids that entirely.
 *
 * The check is by object IDENTITY, not by name: repeating
 * `plugins: { local: localPlugin }` with this same reference is tolerated, and
 * only a fresh object literal throws. That is a trap rather than a reprieve —
 * it means the failure depends on how someone happens to write the duplicate.
 * Don't rely on it; keep the single registration below.
 * `eslint.config.test.mjs` pins both halves of this behaviour.
 */
const localPlugin = {
  rules: {
    // `window.localStorage` is a member expression, invisible to
    // `no-restricted-globals`, and the one `no-restricted-syntax` id is already
    // spent on the native-controls ban over an overlapping file set.
    "no-window-storage": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Ban window.localStorage/sessionStorage/indexedDB outside the storage service.",
        },
        schema: [],
        messages: { banned: STORAGE_BAN },
      },
      create(context) {
        return {
          "MemberExpression[object.name='window'][property.name=/^(localStorage|sessionStorage|indexedDB)$/]"(
            node,
          ) {
            context.report({ node, messageId: "banned" });
          },
        };
      },
    },
    // Companion to the native-controls ban: role="button" on a non-button
    // hand-rolls focus, Enter/Space activation and disabled handling that a
    // real control gives for free. Its own rule id so its severity can move
    // independently of the syntax ban.
    "prefer-button-component": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            'Prefer the <Button> primitive over a hand-rolled role="button".',
        },
        schema: [],
        messages: {
          preferButton:
            'Avoid role="button" on a non-button element — it hand-rolls button semantics. Use the <Button> primitive.',
        },
      },
      create(context) {
        return {
          "JSXAttribute[name.name='role'][value.value='button']"(node) {
            context.report({ node, messageId: "preferButton" });
          },
        };
      },
    },
    // The corpus ban (CORPUS_BAN above), which has to be a local rule rather
    // than another `no-restricted-imports` block: block A already spends the
    // `@typescript-eslint` id over `src/engine/**` and block D spends the base
    // id over everything, and block A2 below covers the same engine files. A
    // third block over either id would silently switch one of them off for the
    // whole model layer — trading the boundary that keeps React out of the
    // engine for the one that keeps the corpus out of the bundle (see the
    // header). It also could not be expressed as a pattern list: which module
    // `./lexicon` names depends on the file doing the importing, and only a
    // rule with `context.filename` in hand can answer that.
    "no-corpus-in-decks": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Ban the typing corpus and generator from every engine module the deck layer can reach.",
        },
        schema: [],
        messages: { banned: CORPUS_BAN },
      },
      create(context) {
        // The two modules, as repo-relative paths. Matching on the RESOLVED
        // path rather than on the specifier as written is what closes the
        // one-hop gap: from `src/engine/typing/lessons.ts` — the one file in
        // this directory the deck layer may import — the corpus is spelled
        // `./lexicon`, which no pattern containing a `typing/` segment would
        // ever have matched.
        const BANNED = /^src\/engine\/typing\/(lexicon|generate)(\.[jt]s)?$/;

        /** A specifier as a repo-relative path, or null if it names a package. */
        const resolve = (specifier) => {
          if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
          if (!specifier.startsWith(".")) return null;
          const here = path.relative(context.cwd, context.filename);
          return path.posix.join(
            path.dirname(here).split(path.sep).join("/"),
            specifier,
          );
        };

        // Every way a module can end up in the graph: the import, the
        // re-export — which bloats the chunk exactly as an import does — and
        // the dynamic form, which would get its own chunk but cannot be read
        // from a synchronous `deckSpec` anyway, so reaching for it is a sign
        // the words are being fetched from the wrong side of the wall.
        const check = (node) => {
          const source = node.source;
          if (source?.type !== "Literal") return;
          if (typeof source.value !== "string") return;
          const target = resolve(source.value);
          if (target && BANNED.test(target))
            context.report({ node: source, messageId: "banned" });
        };
        return {
          ImportDeclaration: check,
          ImportExpression: check,
          ExportNamedDeclaration: check,
          ExportAllDeclaration: check,
        };
      },
    },
  },
};

export default defineConfig([
  // Register the local plugin globally, exactly once. Rule severities are set
  // by the scoped blocks further down; this block turns nothing on.
  { plugins: { local: localPlugin } },

  globalIgnores([
    "dist/**",
    ".astro/**",
    ".sst/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Generated by `sst dev`/`sst deploy`; not ours to lint or fix.
    "sst-env.d.ts",
  ]),

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs["flat/recommended"],

  // React island rules. Registered explicitly rather than via a preset so the
  // plugin's flat-config export shape can't shift under a minor bump.
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // ── A · MODEL boundary ──────────────────────────────────────────────────────
  // src/engine/ is pure logic over plain data: build a deck, score a run, rank
  // trouble facts. Keeping React out of it is what lets the same functions run
  // in a vitest unit test and in a build-time script that pre-renders a
  // worksheet PDF. It may not import services either — the dependency direction
  // is services → engine, never back.
  {
    files: ["src/engine/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react/*", "react-dom/*"],
              message: FRAMEWORK_BAN,
            },
            {
              group: ["astro", "astro:*", "@astrojs/*"],
              message: FRAMEWORK_BAN,
            },
            {
              group: [
                "@/services",
                "@/services/*",
                "@/components",
                "@/components/*",
              ],
              message:
                "The engine is the bottom of the stack. Dependency direction is components → services → engine, never the reverse. If the engine needs a capability, take it as a parameter.",
            },
          ],
        },
      ],
    },
  },

  // ── A2 · The deck layer's bundle boundary ──────────────────────────────────
  // Inside the model, and about size rather than about direction. Every island
  // on the site imports `decks/index.ts`, so what the deck layer imports, all
  // of them download — and the typing corpus is the largest thing in the
  // codebase that only one screen needs. See CORPUS_BAN for the number this
  // was learnt from, and `local/no-corpus-in-decks` for why it is a local rule.
  //
  // Scoped to the whole engine despite the rule's name, because what §5.3 asks
  // for is that the corpus "must never become REACHABLE from decks/index.ts",
  // and reachability is transitive. `engine/typing/lessons.ts` is the case that
  // makes the difference: it sits beside the corpus and is deliberately
  // importable from the deck layer, so `import { WORDS } from "./lexicon"`
  // there is the same 222 KB with nothing in decks/ to see. Banning the engine
  // by default and exempting the corpus's own modules states the requirement
  // once, and does not need a new entry every time the engine grows a file —
  // whereas listing the reachable modules by hand would.
  //
  // The exemptions are the corpus itself, the generator that filters it
  // (LES04), and their tests. None of the three is importable from decks/,
  // which is what this rule is here to keep true.
  {
    files: ["src/engine/**/*.{ts,tsx}"],
    ignores: [
      "src/engine/typing/lexicon.ts",
      "src/engine/typing/generate.ts",
      "src/engine/typing/*.test.ts",
    ],
    rules: { "local/no-corpus-in-decks": "error" },
  },

  // ── B · CONTROLLER boundary ─────────────────────────────────────────────────
  // Services orchestrate the engine and own persistence. Framework-agnostic for
  // the same reason the engine is, and it may not reach up into the view.
  {
    files: ["src/services/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react/*", "react-dom/*"],
              message: FRAMEWORK_BAN,
            },
            {
              group: ["astro", "astro:*", "@astrojs/*"],
              message: FRAMEWORK_BAN,
            },
            {
              group: [
                "@/components",
                "@/components/*",
                "@/pages",
                "@/pages/*",
                "@/games",
                "@/games/*",
              ],
              message:
                "Services must not import the view layer. Return data; let the component decide how to render it.",
            },
          ],
        },
      ],
    },
  },

  // ── C · VIEW boundary ───────────────────────────────────────────────────────
  // Views call services. Reaching into src/services/storage/ directly skips the
  // service that owns the schema — the same mistake as a page running its own
  // SQL. Type-only imports are allowed: a component legitimately needs the
  // shape of what it renders.
  //
  // `ignores` the kit on purpose: src/components/ui/** is a SUBSET of
  // src/components/**, and block E below names the same rule id over it. Without
  // this ignore, E would clobber C for every kit file (see the header note).
  {
    files: [
      "src/pages/**/*.{ts,tsx,astro}",
      "src/layouts/**/*.{ts,tsx,astro}",
      "src/components/**/*.{ts,tsx}",
      "src/games/**/*.{ts,tsx}",
    ],
    ignores: ["src/components/ui/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/services/storage",
                "@/services/storage/*",
                "**/services/storage",
                "**/services/storage/*",
              ],
              allowTypeImports: true,
              message:
                "Views go through a service, not the storage layer. Import from @/services (profiles, sessions, settings) instead — those own the schema and the migration path. Types are fine.",
            },
          ],
        },
      ],
    },
  },

  // ── D · The storage primitive ───────────────────────────────────────────────
  // The `idb` package, banned everywhere except the module that wraps it. Uses
  // the BASE rule id so it doesn't collide with the layer boundaries above,
  // which all use the @typescript-eslint variant.
  {
    files: ["**/*.{ts,tsx,mts,astro}"],
    ignores: ["src/services/storage/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "idb", message: STORAGE_BAN }] },
      ],
    },
  },

  // The same ban at the globals level — `localStorage` and friends need no
  // import, so the import rule above would never see them. `local/no-window-storage`
  // covers the `window.`-prefixed form; see localPlugin above for why it's a
  // local rule rather than another `no-restricted-syntax` block.
  {
    files: ["**/*.{ts,tsx,mts,astro}"],
    ignores: ["src/services/storage/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: STORAGE_BAN },
        { name: "sessionStorage", message: STORAGE_BAN },
        { name: "indexedDB", message: STORAGE_BAN },
      ],
      "local/no-window-storage": "error",
    },
  },

  // ── E · Kit boundary ────────────────────────────────────────────────────────
  // The primitive kit is domain-free and prop-driven, so every game can compose
  // the same building blocks without dragging in another game's logic. A
  // type-only import from the engine is allowed — a primitive may implement a
  // shared vocabulary (a Button that covers a union of tones) without depending
  // on the domain's behavior. Value imports and services stay banned outright.
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/engine", "@/engine/*"],
              allowTypeImports: true,
              message:
                "UI primitives must be domain-free and prop-driven. Don't import engine values — pass the computed result in as a prop. (A type-only import of a contract the primitive implements is fine.)",
            },
            {
              group: ["@/services", "@/services/*", "@/games", "@/games/*"],
              message:
                "UI primitives must be domain-free and prop-driven. Don't import services or game code — pass data and callbacks in as props.",
            },
          ],
        },
      ],
    },
  },

  // ── Design-system boundary ──────────────────────────────────────────────────
  // Feature code composes the kit; it doesn't hand-roll native controls. Raw
  // elements drift away from the shared focus rings, hit-target sizing and
  // tone — and hit targets are not cosmetic here, the youngest player is five.
  {
    files: ["**/*.tsx"],
    // The kit is the only exception, and there is no allowlist beside it to
    // add a file to: an exemption means editing this rule, which is the point.
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name=/^(button|input|select|textarea|label)$/]",
          message:
            "Don't hand-roll native controls outside src/components/ui/. Use the kit: <button>→<Button>, <input>→<Input>, <select>→<Select>, <label>/<fieldset>→<Field>/<FieldSet>. If the kit is missing a primitive, add it there.",
        },
      ],
    },
  },

  // Companion to the ban above; see localPlugin for the rule itself.
  {
    files: ["**/*.tsx"],
    ignores: ["src/components/ui/**"],
    rules: { "local/prefer-button-component": "error" },
  },

  // ── Component size cap ──────────────────────────────────────────────────────
  // See MAX_COMPONENT_LINES above for the rationale and the counting rules.
  // Tests are exempt: a characterization suite is allowed to be long — its job
  // is coverage, not scannability.
  {
    files: ["src/components/**/*.{ts,tsx}", "src/games/**/*.{ts,tsx}"],
    // Tests only, and no allowlist beside it: a module over the cap is split.
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "max-lines": [
        "error",
        { max: MAX_COMPONENT_LINES, skipBlankLines: true, skipComments: true },
      ],
    },
  },

  // Node-context files: config, scripts, and the Playwright suite.
  {
    files: [
      "*.config.{js,mjs,ts}",
      // The boundary suite lints code SAMPLES containing deliberate
      // violations; the samples are strings, but the file itself is Node.
      "*.config.test.mjs",
      "scripts/**/*.{js,mjs,ts}",
      // The orchestrator driver — a Node CLI, not app code.
      ".claude/**/*.{js,mjs}",
      "e2e/**/*.{ts,mjs}",
      "sst.config.ts",
    ],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        // Node has had this since v10; the analytics rollup parses beacon
        // query strings with it.
        URLSearchParams: "readonly",
        // Global since Node 18. scripts/geoip.mjs downloads the country table
        // with it — the ONE network call anywhere in this pipeline, and it
        // fetches a public CSV rather than sending anything anywhere.
        fetch: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {
      "no-restricted-globals": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  {
    // SST loads its platform types through a triple-slash reference; there is
    // no import form, so the rule has nothing to suggest here.
    files: ["sst.config.ts"],
    rules: { "@typescript-eslint/triple-slash-reference": "off" },
  },

  {
    // The service worker runs in ServiceWorkerGlobalScope — not a window, not
    // Node — so it has its own globals and no `window` at all. Worth linting
    // rather than ignoring: a stray reference to `window` or `document` in here
    // is a runtime error that only shows up offline, which is the one place
    // nobody is watching the console.
    files: ["public/sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        clients: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Request: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-syntax": "off",
    },
  },

  {
    // The browser-driving suite straddles two runtimes: the file itself is
    // Node, but every `page.evaluate(() => …)` callback is serialised and run
    // inside the page. ESLint sees one scope, so both sets of globals have to
    // be declared — and the storage ban has to lift, since verifying what
    // landed in IndexedDB is precisely this suite's job.
    files: ["e2e/**/*.{ts,mjs}"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        document: "readonly",
        window: "readonly",
        location: "readonly",
        indexedDB: "readonly",
      },
    },
    rules: {
      "no-restricted-globals": "off",
      "local/no-window-storage": "off",
      "no-restricted-imports": "off",
    },
  },

  // Prettier last so it wins: it turns off the stylistic rules that would
  // otherwise fight the formatter.
  prettier,
]);
