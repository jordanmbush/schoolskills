#!/usr/bin/env node
// Orchestrator driver — the oracle the orchestrator agent calls to drive an
// epic. It reads the epic's task-list from GitHub, tracks where the current
// story sits in the four-agent pipeline, and renders ONE canonical status block
// so every progress report the user sees has the same shape. It runs a git
// preflight so the agent never launches a worker onto a dirty tree.
//
// Usage:
//   node driver.mjs status <epic#> [--full]  the status block (epic + current story)
//   node driver.mjs next <epic#>             just the next pending issue number, or "DONE"
//   node driver.mjs begin <epic#> <issue#> [base]
//                                            start a story: clears the pipeline, prints the block
//   node driver.mjs stage <epic#> <role> <state> [note…]
//                                            record a pipeline step and print the block
//                                            role  = story | review | fixer | wrapup
//                                            state = running | ok | skip | fail
//   node driver.mjs reset <epic#>            forget the tracked story (epic ticks are unaffected)
//   node driver.mjs ensure-base <branch>     create/reuse an integration branch off
//                                            latest develop, push it, and check it out
//   node driver.mjs preflight [base]         assert: on <base> (default develop), clean
//                                            tree, level with origin/<base>
//
// Progress truth is split deliberately: SHIPPED stories are the epic's ticked
// checkboxes on GitHub (survives anything), while the CURRENT story's pipeline
// position lives in a small JSON file under the worktree's git dir — untracked,
// never committed, and safe to delete. Aside from ensure-base — which creates
// the integration branch on request — the driver never commits code or merges
// PRs. That stays agent work.
//
// Exit codes: 0 ok · 10 all issues done (next/status) · 1 error/preflight-fail.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const RULE = "═".repeat(64);
const ROLES = [
  { key: "story", label: "Story", todo: "implement + commit on a branch" },
  {
    key: "review",
    label: "Review",
    todo: "acceptance + quality → findings key",
  },
  { key: "fixer", label: "Fixer", todo: "apply findings (skipped when CLEAN)" },
  { key: "wrapup", label: "Wrap-up", todo: "validate → PR → merge → tick box" },
];
const STATES = ["running", "ok", "skip", "fail"];
// All five marks are emoji-presentation, so every row stays aligned at 2 cells.
const MARK = { ok: "✅", skip: "➖", fail: "❌", running: "🔄", pending: "⬜" };

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();
}
function trySh(cmd, args) {
  try {
    return { ok: true, out: sh(cmd, args) };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") };
  }
}
function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

// Parse an epic body's markdown task list. Matches lines like:
//   - [ ] #193 — F1 · Display face … · _needs #196, #197_
// Captures done-state, the issue number, the label, and any numeric deps.
function parseChecklist(body) {
  const items = [];
  const re = /^\s*-\s*\[([ xX])\]\s*#(\d+)\s*(?:[—-]\s*(.*))?$/;
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(re);
    if (!m) continue;
    const label = (m[3] || "").trim();
    const needs = [];
    const nm = label.match(/_needs\s+([^_]+)_/i);
    if (nm) for (const d of nm[1].matchAll(/#(\d+)/g)) needs.push(Number(d[1]));
    items.push({
      done: m[1].toLowerCase() === "x",
      number: Number(m[2]),
      label,
      needs,
    });
  }
  return items;
}

function loadEpic(epic) {
  if (!/^\d+$/.test(String(epic)))
    die(`epic must be an issue number, got "${epic}"`);
  const r = trySh("gh", [
    "issue",
    "view",
    String(epic),
    "--json",
    "number,title,body,state",
  ]);
  if (!r.ok)
    die(`could not read epic #${epic} via gh (${r.out.split("\n")[0]})`);
  const j = JSON.parse(r.out);
  const items = parseChecklist(j.body || "");
  if (items.length === 0)
    die(`epic #${epic} has no "- [ ] #NNN" task list to drive`);
  return { ...j, items };
}

// ── Run state ───────────────────────────────────────────────────────────────
// Where the current story sits in the pipeline. Lives in the worktree's git dir
// so it is per-checkout, untracked, and disposable — the epic's checkboxes stay
// the durable record of what shipped.

function stateDir() {
  const r = trySh("git", ["rev-parse", "--absolute-git-dir"]);
  if (!r.ok) die("not a git repo (run from the repo root)");
  return join(r.out, "orchestrator");
}
function statePath(epic) {
  return join(stateDir(), `epic-${epic}.json`);
}
function loadState(epic) {
  const p = statePath(epic);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null; // A corrupt file is just a missing one — epic ticks still rule.
  }
}
function saveState(epic, st) {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(statePath(epic), JSON.stringify(st, null, 2) + "\n");
}
function blankStages() {
  return Object.fromEntries(ROLES.map((r) => [r.key, null]));
}

// ── Rendering ───────────────────────────────────────────────────────────────

function trunc(s, n = 52) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
// Drop the trailing `_needs #…_` note however it was punctuated — the driver
// reports deps separately, and they crowd out the part of the title that reads.
function cleanLabel(item) {
  return trunc(
    item.label.replace(/\s*(?:·\s*)?_needs\s+[^_]+_\s*$/i, "").trim(),
  );
}
function since(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const m = Math.round(ms / 60000);
  return m < 60
    ? `${m}m`
    : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
}
function bar(done, inProgress, total, cells = 24) {
  const filled = total ? Math.round((done / total) * cells) : 0;
  const active = inProgress && filled < cells ? 1 : 0;
  return (
    "█".repeat(filled) +
    "▒".repeat(active) +
    "░".repeat(cells - filled - active)
  );
}
// Wrap a list of short tokens so the collapsed "done" line never runs off-screen.
function wrapTokens(tokens, indent, width = 62) {
  const lines = [];
  let cur = "";
  for (const t of tokens) {
    if (cur && (indent + cur + " " + t).length > width) {
      lines.push(cur);
      cur = t;
    } else {
      cur = cur ? `${cur} ${t}` : t;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function renderStories(e, current, full) {
  const out = ["STORIES"];
  const doneItems = e.items.filter((i) => i.done);
  const pending = e.items.filter((i) => !i.done);
  if (full || doneItems.length <= 3) {
    for (const i of doneItems)
      out.push(`  ${MARK.ok} #${i.number}  ${cleanLabel(i)}`);
  } else if (doneItems.length) {
    // Collapse the shipped tail — it grows all run and nobody re-reads it.
    const nums = doneItems.map((i) => `#${i.number}`);
    const [first, ...rest] = wrapTokens(nums, 14);
    out.push(`  ${MARK.ok} ${doneItems.length} done: ${first}`);
    for (const l of rest)
      out.push(`  ${" ".repeat(String(doneItems.length).length + 8)}${l}`);
  }
  for (const i of pending) {
    const isCurrent = current === i.number;
    const mark = isCurrent ? MARK.running : MARK.pending;
    const tail = isCurrent ? "   ← in progress" : "";
    out.push(`  ${mark} #${i.number}  ${cleanLabel(i)}${tail}`);
  }
  return out;
}

function renderPipeline(e, st) {
  const item = st?.issue ? e.items.find((i) => i.number === st.issue) : null;
  if (!st?.issue || !item) {
    const next = e.items.find((i) => !i.done);
    return [
      next
        ? `CURRENT STORY  none — next up #${next.number} · ${cleanLabel(next)}`
        : "CURRENT STORY  none — every story is shipped",
    ];
  }
  const el = since(st.startedAt);
  const out = [
    `CURRENT STORY  #${item.number} · ${cleanLabel(item)}${el ? `   (${el} in)` : ""}`,
  ];
  const left = [];
  ROLES.forEach((role, idx) => {
    const rec = st.stages?.[role.key];
    const state = rec?.state || "pending";
    const label = role.label.padEnd(8);
    let note = rec?.note || "";
    if (state === "running")
      note = `running…${since(rec.at) ? ` (${since(rec.at)})` : ""}`;
    if (state === "pending") note = role.todo;
    if (state !== "ok" && state !== "skip") left.push(role.label);
    out.push(`  ${MARK[state]} ${idx + 1} ${label}${trunc(note, 44)}`);
  });
  out.push(
    `  LEFT IN STORY: ${left.length ? left.join(" → ") : "none — story complete"}`,
  );
  return out;
}

function renderBlock(e, st, { full = false } = {}) {
  const total = e.items.length;
  const done = e.items.filter((i) => i.done).length;
  const currentItem =
    st?.issue && e.items.find((i) => i.number === st.issue && !i.done);
  const inProgress = currentItem ? 1 : 0;
  const queued = total - done - inProgress;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const lines = [
    RULE,
    `EPIC #${e.number} · ${trunc(e.title, 50)}  [${e.state}]`,
    `base ${st?.base || "develop"} · ${done}/${total} stories done · ${inProgress} in progress · ${queued} queued`,
    `[${bar(done, inProgress, total)}] ${pct}%`,
    RULE,
    ...renderStories(e, currentItem ? currentItem.number : null, full),
    "",
    ...renderPipeline(e, st),
  ];

  const shipped = st?.shipped || [];
  if (shipped.length) {
    const tail = shipped.slice(-6).map((s) => `#${s.issue}→PR#${s.pr || "?"}`);
    lines.push(
      "",
      `SHIPPED THIS RUN (${shipped.length}): ${shipped.length > 6 ? "… " : ""}${tail.join(" · ")}`,
    );
    // A merged story whose box is still empty means Wrap-up skipped step 4 —
    // the count above would silently under-report the epic until it's fixed.
    const doneNums = new Set(
      e.items.filter((i) => i.done).map((i) => i.number),
    );
    const untick = shipped
      .filter((s) => !doneNums.has(s.issue))
      .map((s) => `#${s.issue}`);
    if (untick.length)
      lines.push(
        `⚠️  merged but unticked in the epic: ${untick.join(", ")} — tick the box.`,
      );
  }

  const next = e.items.find((i) => !i.done && i.number !== currentItem?.number);
  lines.push("");
  if (!e.items.some((i) => !i.done)) {
    lines.push(
      "ALL STORIES DONE → run Close-out (promote comps, then finish the epic).",
    );
  } else if (currentItem) {
    lines.push(
      next
        ? `NEXT STORY  #${next.number} · ${cleanLabel(next)}`
        : "NEXT STORY  none — this is the last one",
    );
  } else if (next) {
    const doneSet = new Set(e.items.filter((i) => i.done).map((i) => i.number));
    const unmet = next.needs.filter((n) => !doneSet.has(n));
    if (unmet.length)
      lines.push(
        `⚠️  #${next.number} lists unmet deps: ${unmet.map((n) => "#" + n).join(", ")} — verify before launching.`,
      );
  }
  lines.push(RULE);
  console.log(lines.join("\n"));
}

// ── Commands ────────────────────────────────────────────────────────────────

function cmdStatus(epic, flags) {
  const e = loadEpic(epic);
  renderBlock(e, loadState(epic), { full: flags.includes("--full") });
  if (!e.items.some((i) => !i.done)) process.exit(10);
}

function cmdNext(epic) {
  const e = loadEpic(epic);
  const next = e.items.find((i) => !i.done);
  if (!next) {
    console.log("DONE");
    process.exit(10);
  }
  console.log(String(next.number));
}

function cmdBegin(epic, issue, base) {
  if (!issue || !/^\d+$/.test(String(issue)))
    die("usage: driver.mjs begin <epic#> <issue#> [base]");
  const e = loadEpic(epic);
  const n = Number(issue);
  const item = e.items.find((i) => i.number === n);
  if (!item)
    die(`#${n} is not in epic #${epic}'s checklist — check the number`);
  if (item.done)
    console.error(
      `warning: #${n} is already ticked in epic #${epic} — re-running it`,
    );
  const prev = loadState(epic);
  saveState(epic, {
    epic: Number(epic),
    base: base || prev?.base || "develop",
    issue: n,
    startedAt: new Date().toISOString(),
    stages: blankStages(),
    shipped: prev?.shipped || [],
  });
  renderBlock(e, loadState(epic));
}

function cmdStage(epic, role, state, noteParts) {
  const roleDef = ROLES.find((r) => r.key === role);
  if (!roleDef)
    die(
      `role must be one of ${ROLES.map((r) => r.key).join(" | ")}, got "${role}"`,
    );
  if (!STATES.includes(state))
    die(`state must be one of ${STATES.join(" | ")}, got "${state}"`);
  const st = loadState(epic);
  if (!st?.issue)
    die(
      `no story in progress for epic #${epic} — run "driver.mjs begin ${epic} <issue#>" first`,
    );
  const note = (noteParts || []).join(" ").trim();
  st.stages[role] = { state, note, at: new Date().toISOString() };
  if (state === "running") {
    // One line, not the whole block — this fires right before a long agent run.
    saveState(epic, st);
    console.log(
      `▶ epic #${epic} · #${st.issue} · ${roleDef.label} running${note ? ` — ${note}` : ""}`,
    );
    return;
  }
  // A CLEAN review IS the decision to skip the Fixer — record both at once so the
  // block never shows a phantom pending role.
  if (role === "review" && state === "ok" && /^clean\b/i.test(note))
    st.stages.fixer = {
      state: "skip",
      note: "review CLEAN",
      at: st.stages[role].at,
    };
  // Wrap-up landing a PR is what "shipped" means: bank it and take the story off
  // the board, so nothing reads as in-progress between issues.
  if (role === "wrapup" && state === "ok") {
    const pr = note.match(/(?:PR\s*)?#(\d+)/i);
    st.shipped = st.shipped || [];
    st.shipped.push({
      issue: st.issue,
      pr: pr ? Number(pr[1]) : null,
      at: st.stages[role].at,
    });
    st.issue = null;
    st.startedAt = null;
    st.stages = blankStages();
  }
  saveState(epic, st);
  renderBlock(loadEpic(epic), st);
}

function cmdReset(epic) {
  const p = statePath(epic);
  if (existsSync(p)) rmSync(p);
  console.log(
    `RESET: forgot the tracked story for epic #${epic} (checkboxes untouched).`,
  );
}

// Create (or reuse) the epic's integration branch so every child issue merges
// into it and the epic lands on develop in one merge (deploys still only happen
// on the develop → main release merge). Idempotent: reuses the branch
// if it already exists on origin or locally, otherwise cuts it from latest
// origin/develop. Requires a clean tree and leaves you checked out on <base>.
function cmdEnsureBase(base) {
  if (!base) die("usage: driver.mjs ensure-base <branch>");
  if (base === "main" || base === "develop")
    die(`ensure-base is for integration branches; "${base}" needs no setup`);
  const inRepo = trySh("git", ["rev-parse", "--is-inside-work-tree"]);
  if (!inRepo.ok) die("not a git repo (run from the repo root)");
  const dirty = sh("git", ["status", "--porcelain"]);
  if (dirty)
    die(
      `working tree dirty (${dirty.split("\n").length} path(s)) — clean it before setup`,
    );
  trySh("git", ["fetch", "--quiet", "origin"]);
  const onRemote = trySh("git", [
    "ls-remote",
    "--exit-code",
    "--heads",
    "origin",
    base,
  ]).ok;
  const onLocal = trySh("git", [
    "rev-parse",
    "--verify",
    "--quiet",
    `refs/heads/${base}`,
  ]).ok;
  let note;
  if (onRemote) {
    note = "reused origin branch";
  } else if (onLocal) {
    const p = trySh("git", ["push", "-u", "origin", base]);
    if (!p.ok)
      die(`could not push existing local ${base}: ${p.out.split("\n")[0]}`);
    note = "pushed existing local branch";
  } else {
    const om = trySh("git", [
      "rev-parse",
      "--verify",
      "--quiet",
      "refs/remotes/origin/develop",
    ]);
    if (!om.ok)
      die("origin/develop not found — cannot create integration branch");
    const c = trySh("git", ["branch", base, "origin/develop"]);
    if (!c.ok)
      die(
        `could not create ${base} off origin/develop: ${c.out.split("\n")[0]}`,
      );
    const p = trySh("git", ["push", "-u", "origin", base]);
    if (!p.ok) die(`created ${base} but push failed: ${p.out.split("\n")[0]}`);
    note = "created off origin/develop";
  }
  const co = trySh("git", ["checkout", base]);
  if (!co.ok) die(`could not checkout ${base}: ${co.out.split("\n")[0]}`);
  trySh("git", ["pull", "--ff-only", "--quiet"]);
  console.log(
    `ENSURE-BASE OK: on ${base}, level with origin/${base} (${note}).`,
  );
}

function cmdPreflight(base = "develop") {
  const branch = trySh("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branch.ok) die("not a git repo (run from the repo root)");
  const dirty = sh("git", ["status", "--porcelain"]);
  trySh("git", ["fetch", "--quiet", "origin", base]);
  const head = trySh("git", ["rev-parse", "HEAD"]);
  const origin = trySh("git", ["rev-parse", `origin/${base}`]);
  const problems = [];
  if (branch.out !== base)
    problems.push(`on branch "${branch.out}", expected ${base}`);
  if (dirty)
    problems.push(`working tree dirty (${dirty.split("\n").length} path(s))`);
  if (head.ok && origin.ok && head.out !== origin.out)
    problems.push(`${base} is not level with origin/${base} (pull first)`);
  if (problems.length) {
    console.log("PREFLIGHT FAIL:");
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    `PREFLIGHT PASS: on ${base}, clean tree, level with origin/${base}.`,
  );
}

const [cmd, ...rest] = process.argv.slice(2);
const args = rest.filter((a) => !a.startsWith("--"));
const flags = rest.filter((a) => a.startsWith("--"));
switch (cmd) {
  case "status":
    if (!args[0]) die("usage: driver.mjs status <epic#> [--full]");
    cmdStatus(args[0], flags);
    break;
  case "next":
    if (!args[0]) die("usage: driver.mjs next <epic#>");
    cmdNext(args[0]);
    break;
  case "begin":
    if (!args[0]) die("usage: driver.mjs begin <epic#> <issue#> [base]");
    cmdBegin(args[0], args[1], args[2]);
    break;
  case "stage":
    if (args.length < 3)
      die(
        "usage: driver.mjs stage <epic#> <story|review|fixer|wrapup> <running|ok|skip|fail> [note…]",
      );
    cmdStage(args[0], args[1], args[2], args.slice(3));
    break;
  case "reset":
    if (!args[0]) die("usage: driver.mjs reset <epic#>");
    cmdReset(args[0]);
    break;
  case "ensure-base":
    cmdEnsureBase(args[0]);
    break;
  case "preflight":
    cmdPreflight(args[0] || "develop");
    break;
  default:
    die(
      "usage: driver.mjs <status|next|begin|stage|reset|ensure-base|preflight> [args…]",
    );
}
