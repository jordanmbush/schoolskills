# School Skills

Learning games for kids that feel like games, at
[schoolskills.app](https://schoolskills.app). Static site, no accounts, no
sign-up — a player's progress lives in their own browser and never leaves it.

First game: **Times Trial**, a gamified multiplication flash-card racer with
ghost racing and a per-card clock.

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
src/services/     profiles, sessions, persistence
src/services/storage/   the only code allowed to touch IndexedDB
src/components/   feature components
src/components/ui/      the primitive kit: domain-free, prop-driven
src/games/        one directory per game
src/pages/        Astro routes — real prerendered HTML
src/layouts/      the page shell (SEO metadata contract lives here)
```

The layer boundaries are enforced by `eslint.config.mjs`, not by convention.
Read `CLAUDE.md` before adding a module.

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

## Deployment

SST v4 → S3 + CloudFront + ACM, in its own AWS account. DNS is Cloudflare.
GitHub Actions deploys from `main` via OIDC; there are no long-lived AWS keys.
