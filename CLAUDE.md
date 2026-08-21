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

## Worlds — one game, several biomes

The site presents itself as a single game with a map and a world per subject.
That is a real structure, not a metaphor in the copy:

| World    | Where                               | Subject                    |
| -------- | ----------------------------------- | -------------------------- |
| `map`    | `/`                                 | the overworld, not a world |
| `grid`   | `/flash-cards`, `/multiplication/*` | times tables (space)       |
| `jungle` | `/spelling/play`, `/spelling`       | spelling and sight words   |
| `ice`    | `/typing`                           | touch typing (glacier)     |
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
  what lets the overworld map render three worlds at once: each card carries
  `data-world` and is built out of that world's own tokens.

Content pages use `src/layouts/Content.astro` (masthead + footer). The two games
use `Base.astro` directly, so **site chrome can never appear over a race** —
there is no prop to set wrong. The way out of an island is the map icon in its
top bar.

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
