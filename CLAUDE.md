# School Skills — schoolskills.app

Free learning games for kids, as a **static site**. No server, no accounts, no
sign-up. A player's progress lives in their own browser and never leaves it.

## The three constraints everything else follows from

1. **Static.** The build emits HTML on disk. There is no origin server to run a
   query, hold a session, or read a request. Anything that wants a backend is a
   design error until proven otherwise.
2. **The player's data is theirs.** Profiles and session history live in
   IndexedDB on their device. Nothing is uploaded, and there is no identifier
   that could follow a child anywhere. Under COPPA a persistent identifier _is_
   personal information, so this isn't only a privacy preference — adding
   server-side storage of a kid's data is a compliance step change, not a
   feature.
3. **SEO is a first-class requirement.** Content pages must be real prerendered
   HTML with a title, a description, a canonical URL and structured data. The
   games are React islands _inside_ those pages, never a replacement for them.

## Architecture — enforced by lint, not by convention

`eslint.config.mjs` is the spec; read its header before adding a boundary. The
short version:

| Layer          | Directory                                                  | May import             | Must not                                      |
| -------------- | ---------------------------------------------------------- | ---------------------- | --------------------------------------------- |
| **Model**      | `src/engine/`                                              | nothing but itself     | React, Astro, services, components            |
| **Controller** | `src/services/`                                            | engine                 | React, Astro, the view layer                  |
| **Storage**    | `src/services/storage/`                                    | `idb`, browser storage | — (this is the only layer that may)           |
| **View**       | `src/pages/` `src/layouts/` `src/components/` `src/games/` | services, engine types | `src/services/storage/*`, raw storage globals |
| **Kit**        | `src/components/ui/`                                       | nothing domain-shaped  | engine values, services, game code            |

Two rules people trip over:

- **Never touch `localStorage` / `indexedDB` directly.** Call a service. Schema,
  migrations and quota handling live in one place so they can change once.
- **Never hand-roll `<button>` / `<input>` / `<select>` / `<label>` outside
  `src/components/ui/`.** Hit targets and focus rings are not cosmetic here —
  the youngest player is five. If the kit lacks a primitive, add it to the kit.

Components cap at **300 lines**, counted with `skipComments` and
`skipBlankLines`. The cap measures how much a module _does_, so documenting it
well never counts against it — and padding it with commentary never buys room,
because whether a comment belongs is settled by the standard below, not by this
rule. Over the cap, split the module or move the doc block onto the thing it now
describes. There is no allowlist to add a file to; an exemption means editing
the rule.

## Comments

Almost every line here was written by an agent, and an agent works from the
context it is handed. Too little and it guesses; too much and the one line it
needed is buried in prose restating the code around it. So comments are
scrutinised rather than accumulated, and each has to pass the same test:

**Does it say something the code cannot?** An invariant, a constraint, an
alternative that was tried and rejected, or a consequence a reader would not see
coming. If it does, it can be as long as it needs to be. If it doesn't, the fix
isn't a shorter comment — it's no comment.

Three questions before writing one:

- **Would a rename do this instead?** A comment that exists to explain what a
  name means is a naming bug. Change the name and delete the comment.
- **Could a reader work this out from the code, its neighbours and its
  callers?** If so, let them.
- **Are these plain words?** Reaching for the precise technical term reads as
  authority and lands as fog.

Four habits to delete on sight — the ones this codebase actually grew:

- **Restating the code.** `// bump the streak` over `streak + 1`.
- **Narrating history.** "There WAS an allowlist here…" A comment says what is
  true now; git holds what used to be true.
- **Repeating `docs/`.** Design rationale lives in `docs/`, written once. A
  module comment may summarise the decision it implements and cite the section
  (`docs/typing.md §8.6`), but copying the reasoning across gives one fact two
  owners, and two owners drift.
- **Ornate phrasing.** The plain word beats the exact one. From
  `BackupPanel.tsx`:

  > **Before:** Ids are preserved on both sides, so re-importing the same file
  > is idempotent rather than duplicating every run.
  >
  > **After:** Ids are preserved on both sides, so importing the same file twice
  > adds nothing the second time.

Never trade clarity for brevity, though: a short comment that loses the point is
worse than the long one it replaced.

**The standard cuts both ways.** A 245-line component carrying three comment
lines fails it as surely as a page of narration does — whatever makes that file
long, an ordering that matters or a browser quirk worked around, is going
undocumented. Ratio alone is a smell rather than a verdict: run
`npm run audit:comments` to find the files worth reading, then apply the test
above one comment at a time.

### The three documents, and what a bare `§` means

Rationale that outgrew a comment lives in `docs/`, written once:

- **`docs/typing.md`** — Frost Keys. The keyboard as a model, the board on
  screen, the hundred-lesson ladder, what passing is, badges, and Hailstorm.
- **`docs/printables.md`** — The Print Shop. Paper in real inches, the rulings,
  tracing without a tracing font, answer keys and seeds, the catalog routes and
  the sitemap landmine, Scripture, phonics, and the builder.
- **`docs/analytics.md`** — counting visits with no analytics service: the
  CloudFront logs, the rollup, Athena, and the 90-day ceiling.

Most citations name no document — `(§8.6)` — and resolve by where the file
sits:

| Subtree                                                                                        | Document             |
| ---------------------------------------------------------------------------------------------- | -------------------- |
| `src/engine/sheets/`, `src/components/sheet/`, `src/games/printshop/`, `src/pages/printables/` | `docs/printables.md` |
| `src/engine/typing/`, `src/games/typing/`                                                      | `docs/typing.md`     |

A file outside those that still belongs to one subject resolves the same way:
`src/engine/keyboard.ts` and typing's four stylesheets — `src/styles/game/`'s
`ladder.css`, `lesson.css`, `keyboard.css` and `storm.css` — are typing's, and
`src/styles/sheet.css`, `src/styles/print.css`, `src/styles/printshop.css` and
`src/styles/fonts.css` are the Print Shop's. Shared code that names one
document and no other — `src/engine/progress.ts`, whose citations are all
typing's — resolves to that one. Anywhere genuinely shared, name the document —
`docs/typing.md §8.6` — because a bare number in a file with two subjects has
no rule to resolve it by. `docs/analytics.md` numbers nothing, so it is always
cited by name.

`scripts/section-guard.mjs` holds that convention as data and enforces it: the
build reads every heading in `docs/` and every `§` in `src/`, resolves each one
and fails on a reference to a section that doesn't exist. So renumbering a
section is safe — the build names every citation that pointed at the old
number. Adding a subtree here means adding it there in the same change.

## Worlds — one game, several biomes

The site presents itself as a single game with a map and a world per subject.
That is a real structure, not a metaphor in the copy:

| World    | Where                               | Subject                    |
| -------- | ----------------------------------- | -------------------------- |
| `map`    | `/`                                 | the overworld, not a world |
| `grid`   | `/flash-cards`, `/multiplication/*` | times tables (space)       |
| `jungle` | `/spelling/play`, `/spelling`       | spelling and sight words   |
| `ice`    | `/typing`                           | touch typing (glacier)     |
| `paper`  | `/printables/*`                     | worksheets (a press room)  |
| `line`   | `/privacy`, `/terms`, `/about`      | the pause menu             |
| `empty`  | `/404`                              | literally nothing          |

A world is `data-world` on `<html>` and **nothing else**. Every screen already
reads its colours through `--ink-*`, `--chalk-*`, `--accent`, `--go` and
`--terrain`, so `src/styles/worlds.css` swaps eleven custom properties and the
whole app changes biome without a box moving. Adding one is a block in that file
plus an entry in `src/engine/worlds.ts` — the registry both halves read, and the
only place a world's name, blurb or theme colour is written down.

Three rules:

- **The telemetry five never change.** `--lime` (correct), `--flare` (wrong),
  `--sky` (the ghost), `--gold` (records), `--grape` (badges) live in
  `tokens.css` and mean the same thing in every world. Use `--go` for "press
  this", which _is_ per-world; a world that recoloured `--lime` would teach a
  child to re-learn the signal every time the background changed.
- **The deck decides the world, via `DeckSpec.world`.** Keyed off `mode`, so a
  race saved three months ago still opens in the scenery it was run in. The
  engine never interprets the value — to it a world id is an opaque string.
  `useWorld()` in `src/components/state/` is what writes it from the client.
- **World blocks are scoped to `[data-world]`, not `:root[data-world]`.** That is
  what lets the overworld map render every world at once: each card carries
  `data-world` and is built out of that world's own tokens.

Content pages use `src/layouts/Content.astro` (masthead + footer). The two
racing islands — flash cards at `/flash-cards` and `/spelling/play`, typing at
`/typing` — use `Base.astro` directly, so **site chrome can never appear over a
race** and there is no prop to set wrong. The way out of one is the map icon in
its top bar.

The third island is the sheet builder at `/printables/make`, and it keeps
`Content.astro` on purpose: `print.css` hides the masthead, the footer and
everything marked `.no-print`, so the builder can have the site around it while
choosing and lose it at the moment a sheet goes to paper.

**`href` is the front door; `island` is the app.** Both live on `WorldInfo`,
and only `island` decides what search engines are kept away from — it carries
`noindex` via `Base.astro`, and `astro.config.mjs` filters the sitemap on that
field. For the three game worlds the two are the same route, because the game
_is_ the front door. The Print Shop is why the field had to exist: its `href` is
`/printables`, a catalog of prerendered worksheets and the largest crawlable
surface on the site, while its `island` is the builder, which must stay out of
the sitemap. Filtering on `href` instead would have deleted the whole catalog
with nothing failing, so `scripts/sitemap-guard.mjs` reads the registry back
against the sitemap that actually shipped and fails the build instead
(docs/printables.md §8).

## Validation

```bash
npm run type-check   # astro check + tsc
npm run lint         # the boundaries above
npm run build        # must stay static
npm run test:unit
```

CI runs all of these on every PR. Husky runs the fast ones pre-commit/pre-push.

## Branching

`develop` is the default branch and where day-to-day PRs land. Releasing is a
`develop` → `main` merge commit (**never squash** — squashing diverges the two
branches permanently). Production deploys only from `main`.

## Infrastructure

SST v4 → S3 + CloudFront + ACM in AWS account `578771850338` (`schoolskills`
profile, `us-west-1`). DNS is Cloudflare-authoritative; SST's Cloudflare adapter
writes the app record and the ACM validation records. GitHub Actions deploys via
OIDC — there are no long-lived AWS keys anywhere.

## Adding a game

The card loop, XP, ghost racing and stats work off `Card` and `CardResult`,
which are text in and text out — `answer` is `"56"`, not `56`, and `factId` is
`"7:8"` or `"because"`. Nothing in the loop knows about arithmetic.

The three judgements a loop can't make generically live on a **`DeckSpec`**
(`src/engine/decks/spec.ts`): fold two cards onto one fact (`masteryKey`,
`drillKey`), name a fact on screen (`factLabel`), and decide whether what was
typed matches (`normalise`). A new deck family implements that and routes in
`src/engine/decks/index.ts` — the front door, and the **only** place the
`RaceConfig` union is narrowed. `deckSpec(mode)` never throws, because sessions
outlive the decks they were played on.

Three families exist: `decks/flashcards.ts` (arithmetic), `decks/words.ts`
(spelling and sight words) and `decks/typing.ts` (passages).

**A deck is not a game, but a subject is a front door.** Words are a deck —
they play in the flash-card loop, using the same clock, ghost and record book.
What they don't share is a route: `src/games/flashcards/App.tsx` is mounted
twice, at `/flash-cards` (The Grid) and `/spelling/play` (Word Jungle), with a
`subject` prop deciding which decks exist inside. A child sent to practise
spellings should not have to walk past a times-table picker to get there.
`src/components/state/SubjectContext.tsx` is where a subject is defined and
where the reasoning lives; `/spelling` remains the crawlable page about it.

Typing is a different game, not a different subject — no discrete cards to
submit, no input mode to choose, a passage that stays on screen — so it is its
own island at `src/games/typing/`.

All of them are a **path, not a subdomain.** Storage is scoped to an origin,
not a route, so every mount shares one IndexedDB, one profile list and one
record book — which is the only reason a child's level and badges follow them
between subjects. Splitting by subdomain would partition that permanently;
splitting by path costs nothing. Whichever runs belong to a mount is decided by
`deckSpec(mode).world === subject.world` and nothing else.

**`src/games/race/` is the race minus the game** — the clock and its pause, the
3·2·1, the ghost lane, the HUD, the quit sheet, the rival list and
scoring-and-saving. Anything a second game would otherwise copy belongs there.
How an answer is entered, marked or displayed does not.

**Saved runs are the constraint, not the code.** `configKey` decides which runs
may race each other as ghosts, so changing its format orphans every personal
best already saved. Cards written before a shape change are widened on read by
`src/engine/migrate.ts` — never by rewriting storage, because IndexedDB holds
the only copy there is. Adding a store is a `DB_VERSION` bump with an
`oldVersion`-guarded block in `db.ts`; those blocks are additive only.

**Parent-authored decks live in storage but are read from the engine.**
`src/services/decks.ts` is the only writer, and it mirrors them into the engine
(`setCustomLists`) so `deckSpec(mode)` can name one from the record book
without the engine knowing storage exists. Every write goes through
`HubContext.saveDeck` — a service call that bypasses it lands in IndexedDB and
stays invisible until the next reload.

## Adding a sheet

The Print Shop is the paper half of the site and the larger half of the code:
`src/engine/sheets/` builds worksheets, `src/components/sheet/` draws them,
`src/pages/printables/` publishes them and `src/games/printshop/` is the bench
a parent tunes one on. Everything below is the short version of
`docs/printables.md`.

**A `Sheet` is plain data** (`src/engine/sheets/types.ts`): paper size, body
type size, a header, a list of blocks and a footer. `src/components/sheet/`
renders one as real elements in real inches — not a canvas, not a PDF, not an
image — and takes a `Sheet` and nothing else. No context, no service, no
storage. That is what lets one renderer run at build time on a catalog page and
at runtime in the builder, and why a catalog page ships zero JavaScript: a
component with nothing to hydrate needs no `client:*` directive.

**A `SheetSpec` is `DeckSpec` for paper** (`src/engine/sheets/spec.ts`). Paper,
rulings, capacity, the header and the footer generalise; what a problem is,
what its answer is, and how to describe the sheet in one line do not, so a
family states those: `build(config, seed)`, `key(sheet)` and `describe(config)`.
`key` is not optional on any family — an answer key is the most expected feature
of a worksheet and the most commonly botched one.

**`src/engine/sheets/index.ts` is the front door, and the registry _is_ the
narrowing.** A spec is keyed by the same string its config carries as `kind`, so
looking one up is the only place the `SheetConfig` union is narrowed — there is
no `if (isLined)` chain to keep in step. Adding a family is a `kind` in
`types.ts` plus an entry in that table. `sheetSpec(kind)` never throws for the
same reason `deckSpec(mode)` doesn't: a config bookmarked in March must still
open in June, so an unknown kind gets `UNKNOWN_SHEET`, which prints a page
saying so. `buildSheet` is deterministic in `(config, seed)`, and three
features fall out of that one property — the answer key is the same build with
the answers switched on, "another like this one" is `seed + 1`, and a shared URL
reproduces a sheet exactly because the seed is in it.

**The catalog pages are curated, not permuted.** Every page under
`/printables` is prerendered from an underscored data module in
`src/pages/printables/` — `_catalog.ts` for paper, `_maths.ts` for the
worksheets, one per shelf, with `_shelves.ts` naming the shelves so the grade
hubs can cut across them. Underscored means Astro leaves them out of the routing
table; each names the handful of sheets a parent actually searches for, and
`getStaticPaths` turns them into pages. The page **is** the sheet: prose that
answers the query, the paper itself as HTML under it, and ⌘P produces something
usable with nothing to click. Generating a page per permutation of a config
would be a doorway farm, which is what the builder exists for instead.

Saved sheets go through `src/services/sheets.ts`, the only writer of the
`sheets` store. Unlike custom decks, nothing is mirrored back into the engine —
a sheet's name and description are computable from the config it already
carries.
