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
// Counted with `skipComments` + `skipBlankLines` DELIBERATELY. This codebase is
// comment-dense on purpose and that density is valued — a raw line count would
// quietly pressure people to strip documentation to pass the rule. Never delete
// an explanatory comment to hit the number; relocate the doc block onto the
// module it now describes.
const MAX_COMPONENT_LINES = 300;

// Files over the cap, each against the story that retires it. The list SHRINKS:
// delete the entry in the same PR that splits the file. Counts are non-comment,
// non-blank lines measured when the game was ported from the local-only app,
// where nothing enforced a cap.
const maxLinesAllowlist = [
  // Retired by the flash-cards decomposition stories (PORT epic). RaceTrack is
  // the race loop, the rAF ticker, the per-card clock and the keypad in one
  // module; the split follows those seams, not arbitrary line counts.
  "src/games/flashcards/RaceTrack.tsx", // 655
  "src/games/flashcards/RaceSetup.tsx", // 473
  "src/games/flashcards/RaceResults.tsx", // 351
  "src/components/screens/Progress.tsx", // 392
];

// Files that still hand-roll native controls, inherited wholesale from the
// local-only app where no kit boundary existed. 55 call sites across 8 files;
// converting them blind during the port would have been a large untested
// rewrite of every interactive surface at once, so the debt is recorded here
// instead of hidden.
//
// Retired by the kit-conversion stories: each file's controls move to <Button>,
// <Input>, <Select> and <Field> primitives, and its entry is deleted in the
// same PR. The list only shrinks.
const rawControlsAllowlist = [
  "src/games/flashcards/RaceSetup.tsx", // 19
  "src/components/PlayerEditor.tsx", // 13
  "src/games/flashcards/RaceTrack.tsx", // 12
  "src/games/flashcards/RaceResults.tsx", // 5
  "src/components/screens/PlayerSelect.tsx", // 4
  "src/components/screens/Progress.tsx", // 3
  "src/components/screens/PlayerHub.tsx", // 2
  "src/components/TopBar.tsx", // 1
  "src/games/flashcards/App.tsx", // 1
];

// Storage is an implementation detail of the service layer — the direct
// analogue of monilibrium's "Prisma client only in services/" boundary. A React
// component that reaches for `localStorage` bypasses the profile/session
// schema, the quota handling, and `navigator.storage.persist()`.
const STORAGE_BAN =
  "Storage is owned by src/services/storage/. Don't touch localStorage, sessionStorage or indexedDB directly — call a service (e.g. profiles.load(), sessions.record()). Storage shape, migrations and quota handling live in one place on purpose.";

const FRAMEWORK_BAN =
  "This layer must stay framework-agnostic so it can be reused by a build-time script, a test, or a future native app. Don't import React or Astro here — return plain data and let the view render it.";

/**
 * Local rules, defined ONCE and registered in a single global block below.
 *
 * They cannot be declared inline on the blocks that use them: a plugin
 * namespace may be defined only once per file, and these two rules apply to
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
    ignores: ["src/components/ui/**", ...rawControlsAllowlist],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name=/^(button|input|select|textarea|label)$/]",
          message:
            "Don't hand-roll native controls outside src/components/ui/. Use the kit: <button>→<Button>, <input>→<Input>/<NumberPad>, <select>→<Select>, <label>→<Field>. If the kit is missing a primitive, add it there.",
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
    ignores: ["**/*.test.{ts,tsx}", ...maxLinesAllowlist],
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
      "e2e/**/*.{ts,mjs}",
      "sst.config.ts",
    ],
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
