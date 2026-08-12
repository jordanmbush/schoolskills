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
`skipBlankLines`. The comment density in this codebase is deliberate and valued:
**never delete an explanatory comment to pass the cap** — split the module, or
move the doc block onto the thing it now describes. Files over the cap sit in
`maxLinesAllowlist` against the story that retires them; delete the entry in the
same PR that splits the file.

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
typed matches (`normalise`). A new deck family implements that and registers in
`src/engine/decks/registry.ts`; `deckSpec(mode)` never throws, because sessions
outlive the decks they were played on.

So a new game is a `DeckSpec`, an input control if the kit lacks one, and a
route under `src/pages/<game>/` — a **path, not a subdomain**, because separate
origins would partition browser storage and a player's profile could no longer
follow them between games.

**Saved runs are the constraint, not the code.** `configKey` decides which runs
may race each other as ghosts, so changing its format orphans every personal
best already saved. Cards written before a shape change are widened on read by
`src/engine/migrate.ts` — never by rewriting storage, because IndexedDB holds
the only copy there is.
