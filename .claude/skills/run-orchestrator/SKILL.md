---
name: run-orchestrator
description: Orchestrate a GitHub epic to completion by driving each child issue through a four-agent pipeline (implement → review → fix → ship), one issue at a time. Use when asked to "run the orchestrator", "drive/orchestrate an epic", "work the epic", or "point an orchestrator at epic #N" — you coordinate the agents and never implement yourself. Supports an optional integration branch so a whole epic lands on develop in one merge (say "into <branch>", "onto the epic branch", or "as a single release").
---

You become the **orchestrator** for a GitHub epic. You drive it to completion by
running each child issue through a **four-agent pipeline** — one fresh sub-agent
per role, one issue at a time, in dependency order. You coordinate; you never
implement.

Per issue, in order:

1. **Story** — implements the issue on a fresh branch and commits. No PR.
2. **Review** — reviews the branch (acceptance criteria + code quality), records
   findings to the **session-context MCP**, and reports back _only_ whether a fix
   is needed.
3. **Fixer** — _only if Review flagged fixes_ — reads the recorded findings and
   applies them. **Runs once** (single pass; no re-review).
4. **Wrap-up** — validates, opens the PR, squash-merges into the base branch,
   returns to a clean base, ticks the epic box.

## The base branch (`<BASE>`)

Every issue branches off, and every PR merges into, a single **base branch**.
Resolve it once, up front, from how you were invoked:

- **Default — `<BASE>` = `develop`.** Plain `/run-orchestrator <EPIC>` merges
  one PR per issue straight to `develop` (the default branch). Nothing deploys:
  production deploys only happen on the `develop` → `main` release merge, which
  stays a deliberate human step outside this skill.
- **Integration branch.** If asked to roll the epic up so it lands on `develop`
  in a **single merge**, use a dedicated integration branch as `<BASE>`. Every
  issue PR merges into it; at the very end **one** consolidated PR goes
  `<BASE>` → `develop`.
  - Take the branch name from the request: `into <branch>`, `onto <branch>`,
    `--base <branch>`, or a bare non-numeric token after the epic number.
  - If a single-release rollout is requested but **no name** is given, default
    `<BASE>` = `epic/<EPIC>`.

The epic number is your first argument. All paths are relative to repo root. The
driver `.claude/skills/run-orchestrator/driver.mjs` is your oracle: it reads
progress, runs preflight, tracks where the current story sits in the pipeline,
and renders the one **status block** you report with.

## Prerequisites

`gh` authenticated, `node` on PATH, and the **session-context MCP** available (the
Review→Fixer handoff uses it).

## Hard rules (do not break these)

1. **You never implement.** Every change is done by an agent you launch with the
   **Agent** tool. (Your only gh write is ticking the epic's checkbox.)
2. **`<BASE>` replaces `develop` everywhere in the per-issue pipeline.** `main`
   is never touched by this skill — it only moves via the deliberate
   `develop` → `main` release merge.
3. **Strictly sequential.** One agent at a time, one issue at a time. Parallel
   agents clobber each other's files.
4. **Protect your context.** Findings live in the session-context MCP under key
   `epic-<EPIC>-issue-<N>`, never in your prompt.
5. **Stop on failure.** On `❌` from any role, halt and surface the one-line
   reason. Never skip ahead or fix it yourself.
6. **Report progress only through the status block** rendered by
   `driver.mjs stage …`. Never hand-write a progress summary.

## This repo's specifics

**Validation** — every role runs these; there is no database and no integration
tier:

```bash
npm run type-check     # astro check + tsc
npm run lint           # the architecture boundaries
npm run test:unit      # includes the lint-boundary suite
npm run build          # must stay static
```

Wrap-up additionally runs the browser smoke test against the built output:

```bash
npm run preview &      # astro preview on :4322
npm run test:smoke     # create profile → race → results → reload
```

**Architecture boundaries are lint-enforced** (`eslint.config.mjs`, and
`CLAUDE.md` summarises them). A story that needs to cross a boundary has almost
certainly mis-placed a module — the fix is to move the code, not to add an
`eslint-disable`. Review must flag any new suppression on a layer, kit, or
storage rule.

**Two allowlists shrink, never grow** — `maxLinesAllowlist` and
`rawControlsAllowlist` in `eslint.config.mjs`. A story that splits a file or
converts its controls to kit primitives deletes that file's entry in the same
PR. Adding an entry requires an explicit reason in the PR description.

**No design-comp promotion step.** monilibrium's close-out promotes
`specs/designs/prospective/*`; this repo has no such convention, so close-out is
simply: verify every box is ticked, `gh issue close <EPIC>`, and report.

**Never commit a progress backup.** `*-backup.json` files contain children's
names and this repo is public. They're gitignored; don't override that.

## Status — one block, every time

The driver renders a single **status block**; you paste it verbatim. Same shape
at every transition.

| Command                                                  | When                                | Prints     |
| -------------------------------------------------------- | ----------------------------------- | ---------- |
| `driver.mjs begin <EPIC> <N> <BASE>`                     | once, after preflight, before Story | full block |
| `driver.mjs stage <EPIC> <role> running`                 | right before launching a role       | one line   |
| `driver.mjs stage <EPIC> <role> ok\|skip\|fail "<note>"` | as soon as that role returns        | full block |
| `driver.mjs status <EPIC> [--full]`                      | any time, incl. when the user asks  | full block |
| `driver.mjs reset <EPIC>`                                | only if the tracked story is wrong  | one line   |

Roles are `story`, `review`, `fixer`, `wrapup` — in that order, all four always
accounted for (a skipped Fixer shows as `skip`, not silence).

## Agent briefs

Launch each with the **Agent** tool (`subagent_type: general-purpose`).

### STORY brief

> Implement GitHub issue **#N** in this repo, staying strictly within its scope.
> Do **not** open a PR or merge — stop once it's implemented and committed on a
> branch.
>
> 1. Read it: `gh issue view N` — implement exactly its acceptance criteria.
> 2. Read `CLAUDE.md` first. The MVC layer boundaries are enforced by
>    `eslint.config.mjs`; put code in the layer that the rules allow rather than
>    suppressing a rule.
> 3. Branch from `<BASE>` (`feat/…` or `fix/…`): `git checkout <BASE> && git pull
--ff-only`, then `git checkout -b <name>`. Match surrounding code style,
>    including its comment density.
> 4. **Validate:** `npm run type-check`, `npm run lint`, `npm run test:unit`,
>    `npm run build`. If the change touches the game or storage, also run the
>    smoke test (`npm run preview &` then `npm run test:smoke`).
> 5. **QUICK WIN:** before committing, make **one** small bounded improvement to
>    code this issue already touches — ≤ ~20 changed lines, only files already
>    in your diff, zero behaviour change. Best candidates: delete an entry from
>    `maxLinesAllowlist` or `rawControlsAllowlist` if your change retired it. If
>    nothing qualifies, skip it. Note it in the commit body as
>    `quick-win: <what>` (or `quick-win: none`).
> 6. Commit. Stage only this issue's files — never `git add -A`. Leave the
>    branch checked out; **do not push**.
> 7. **Report exactly one line:** `✅ #N implemented — branch <name>` or
>    `❌ #N blocked — <one-line reason>`.

### REVIEW brief

> Review the work for GitHub issue **#N** on the current branch. **Read-only.**
>
> 1. Read the issue: `gh issue view N`. Diff: `git diff <BASE>...HEAD`.
> 2. Check: (a) every acceptance criterion is met, (b) code quality and
>    `CLAUDE.md` conventions, (c) tests cover the change, (d) **no new
>    `eslint-disable` on a layer, kit or storage rule**, and no new entry added
>    to either allowlist without a stated reason.
> 3. Record every must-fix finding to the session-context MCP under key
>    `epic-<EPIC>-issue-<N>` (`write_context`). Each must be actionable — file,
>    line, what's wrong, what to do. If clean, write nothing.
> 4. **Report exactly one line:** `FIX epic-<EPIC>-issue-<N>` or `CLEAN`.

### FIXER brief _(only when Review reported `FIX …`)_

> Address the review findings for GitHub issue **#N**, in the session-context
> MCP under key `epic-<EPIC>-issue-<N>` (`read_context`). You get **one pass**.
>
> 1. Apply each fix on the current branch, within the issue's scope.
> 2. Re-validate: `npm run type-check`, `npm run lint`, `npm run test:unit`,
>    `npm run build`.
> 3. Commit. Stage only changed files.
> 4. **Report exactly one line:** `✅ #N fixes applied` or `❌ #N blocked — <reason>`.

### WRAP-UP brief

> Ship GitHub issue **#N** from the current branch into base branch `<BASE>`.
>
> 1. **Final gate:** `npm run type-check`, `npm run lint`, `npm run test:unit`,
>    `npm run build`, then the browser smoke test — `npm run preview &` and
>    `npm run test:smoke`. If anything fails, stop and report `❌`.
> 2. Push; open a PR **targeting `<BASE>`**: `gh pr create --base <BASE>`.
> 3. Merge: `gh pr merge <PR> --squash --delete-branch`, then
>    `git checkout <BASE> && git pull --ff-only`.
> 4. Tick issue #N's checkbox in the epic body (`gh issue edit <EPIC>`).
> 5. **Report exactly one line:** `✅ #N done — PR #<num> merged into <BASE>` or
>    `❌ #N blocked — <reason>`.

## Run

**0. Setup (integration branch only):**
`node .claude/skills/run-orchestrator/driver.mjs ensure-base <BASE>`

**1. Progress + next issue:**
`node .claude/skills/run-orchestrator/driver.mjs status <EPIC>` — exits `10`
when every box is ticked.

**2. Preflight (before Story only):**
`node .claude/skills/run-orchestrator/driver.mjs preflight <BASE>`

**3. The pipeline for #N:** `begin`, then per role: `stage … running` → launch →
`stage … ok|skip|fail "<note>"` and paste the block.

**4. Loop.** On `❌`, halt with the block plus one line.

**5. Close-out** (status exits 10): confirm every box is ticked,
`gh issue close <EPIC>`, and report the final block. Remind the user the epic
ships to production on the next `develop` → `main` release merge.

## Gotchas

- **`preflight` fails on untracked files too** — a stray scratch file blocks the
  next issue. That's intentional; clean or commit it.
- **The checkbox is the progress source of truth**, not issue open/closed state.
- **CI is a required check on `develop`** here (unlike monilibrium, where the
  repo is private and protection isn't available), so Wrap-up's `gh pr merge`
  waits for CI. That's expected — don't retry it as though it hung.
- **Never mark a stage from expectation.** Record `ok` only after the agent
  actually returned its line.
