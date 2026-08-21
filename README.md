# School Skills

Learning games for kids that feel like games, at
[schoolskills.app](https://schoolskills.app). Static site, no accounts, no
sign-up — a player's progress lives in their own browser and never leaves it.

One game with a map and a world per subject:

- **The Grid** (`/flash-cards`) — times tables and the other three operations as
  timed cards, with a per-card clock and a ghost of your own best run.
- **Word Jungle** (`/spelling/play`) — the Dolch sight words, read aloud and
  typed from memory. This week's spellings paste in as a deck like any other.
- **Frost Keys** (`/typing`) — touch typing, from eight keys under eight fingers
  up to real punctuation.
- **The Print Shop** (`/printables`) — worksheets to print, with answer keys.
  The one stop on the map that is for the grown-up rather than the child.

## Running it

```bash
npm install
npm run dev       # http://localhost:4321
```

Requires **Node 24.16+** (`astro-eslint-parser` and `eslint-plugin-astro` set
that floor).

## Validation

```bash
npm run type-check   # astro check + tsc
npm run lint         # architecture boundaries — see CLAUDE.md
npm run build        # must stay static
npm run test:unit
```

## Layout

```
src/engine/       decks, scoring, records — pure logic, framework-free
src/engine/sheets/      worksheet families: paper, problems, answer keys
src/services/     profiles, sessions, persistence
src/services/storage/   the only code allowed to touch IndexedDB
src/components/   feature components
src/components/ui/      the primitive kit: domain-free, prop-driven
src/components/sheet/   the sheet renderer — real inches, no JavaScript shipped
src/games/        one directory per mounted app
src/pages/        Astro routes — real prerendered HTML
src/layouts/      the page shell (SEO metadata contract lives here)
```

The layer boundaries are enforced by `eslint.config.mjs`, not by convention.
Read `CLAUDE.md` before adding a module.

## The long-form docs

`CLAUDE.md` is the spec — the constraints, the layers and the shape of things.
Where a subsystem needed more than that, it has a document of its own, and
comments cite it by section rather than repeating it:

| Doc                  | Covers                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `docs/typing.md`     | Frost Keys: the keyboard model, the on-screen board, the hundred-lesson ladder, passing and badges, and the Hailstorm game |
| `docs/printables.md` | The Print Shop: paper in real inches, the rulings, tracing, answer keys and seeds, the catalog routes, and the builder     |
| `docs/analytics.md`  | Counting visits without an analytics service: CloudFront logs, the rollup, Athena, and the 90-day ceiling                  |

## Where progress is stored

IndexedDB, on the player's device. There is no account, no upload, and no
identifier that could follow anyone. Backup and restore is a file the player
exports themselves.

Two consequences worth knowing:

- **Clearing site data clears progress.** The app requests
  `navigator.storage.persist()` to keep the browser from evicting it, but a
  deliberate "clear browsing data" always wins.
- **Safari evicts script-writable storage after 7 days** without a first-party
  visit, and doesn't honour `persist()` the way Chrome does. Adding the site to
  the iOS Home Screen exempts it — which is why the PWA is a real feature here,
  not a nice-to-have.

## Scripts

| Script                   | What it does                                                            |
| ------------------------ | ----------------------------------------------------------------------- |
| `npm run dev`            | Astro dev server                                                        |
| `npm run type-check`     | `astro check` + `tsc`                                                   |
| `npm run lint`           | The architecture boundaries                                             |
| `npm run test:unit`      | Includes the lint-boundary suite                                        |
| `npm run test:smoke`     | Drives the built site in a real browser (needs `npm run preview` first) |
| `npm run build`          | Static output to `dist/`                                                |
| `npm run audit:comments` | Comment-to-code ratio per file, and broken `§` doc references           |

`scripts/` holds the one-off operational tools: `setup-github-oidc.sh`,
`setup-branch-protection.sh`, `post-deploy-smoke.sh`, `generate-icons.mjs`, and
`convert-legacy-hub.mjs` (migrates the old local-only `data/hub.json`).

## Deployment

SST v4 → S3 + CloudFront + ACM in AWS account `578771850338` (`schoolskills`
SSO profile, `us-west-1`), roughly $1–3/month. DNS is Cloudflare-authoritative;
SST's Cloudflare adapter writes the app record and the ACM validation records.
GitHub Actions deploys from `main` via OIDC — no long-lived AWS keys exist.

```bash
npx sst deploy --stage dev          # CloudFront URL only, no domain needed
npx sst deploy --stage production   # needs the two Cloudflare env vars
```

The `dev` stage deliberately needs no Cloudflare credentials, so the whole
pipeline is verifiable without them. `production` throws a named error if
`CLOUDFLARE_ZONE_ID` is missing rather than deploying without its domain — a
"successful" deploy leaving the real hostname pointing nowhere is the worse
failure.

After any deploy: `bash scripts/post-deploy-smoke.sh <url>`. It checks what
only breaks at delivery time — DNS, certificate, cache headers, the error
document, and that every non-document asset actually uploaded.

## Branching

`develop` is the default branch. Releasing is a `develop` → `main` **merge
commit** (never squash — squashing diverges the branches permanently), and
production deploys only from `main`. CI is a required check on both.
