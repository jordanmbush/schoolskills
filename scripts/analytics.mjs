#!/usr/bin/env node
/**
 * `npm run analytics` — the two-step from docs/analytics.md, as one command.
 *
 * Sync the access logs out of S3, reduce them with the same rollup the monthly
 * job runs, and print what happened. The counting itself lives in
 * scripts/rollup-analytics.mjs and is deliberately NOT duplicated here: this
 * file is a front door, and a second implementation of `isPageView` is exactly
 * the kind of thing that drifts and then disagrees with the committed history.
 *
 * This writes `analytics/counts.json`, the same file the job commits. That is
 * intentional — running it by hand after a fix is how a miscounted day gets
 * corrected — but it does mean a local run leaves a diff. `git checkout
 * analytics/counts.json` if you only wanted to look.
 *
 * Usage:
 *   npm run analytics              sync, count, summarise
 *   npm run analytics -- --no-sync re-summarise what's already downloaded
 *   npm run analytics -- --days 7  narrow the table (default 30)
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = "analytics/counts.json";
const ROLLUP = "scripts/rollup-analytics.mjs";
// Stable rather than a fresh mkdtemp: `aws s3 sync` is incremental, so keeping
// the directory between runs turns the second run into a no-op download.
const LOGS = join(tmpdir(), "schoolskills-cflogs");
const PROFILE = process.env.AWS_PROFILE ?? "schoolskills";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? fallback : Number(argv[at + 1]);
};

const run = (cmd, args) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

/** Ask AWS who we are, which is also the bucket name. */
function bucket() {
  try {
    const account = run("aws", [
      "sts",
      "get-caller-identity",
      "--query",
      "Account",
      "--output",
      "text",
      "--profile",
      PROFILE,
    ]).trim();
    return `schoolskills-access-logs-${account}`;
  } catch (error) {
    const detail = String(error.stderr ?? error.message).trim();
    throw new Error(
      `Could not reach AWS as profile "${PROFILE}".\n${detail}\n\n` +
        `If the session has expired: aws sso login --profile ${PROFILE}`,
      { cause: error },
    );
  }
}

function sync() {
  const name = bucket();
  mkdirSync(LOGS, { recursive: true });
  process.stderr.write(`syncing s3://${name}/cf/ → ${LOGS}\n`);
  run("aws", [
    "s3",
    "sync",
    `s3://${name}/cf/`,
    LOGS,
    "--profile",
    PROFILE,
    "--no-progress",
    "--only-show-errors",
  ]);
}

/** The widest value in a column, so the table doesn't wobble. */
const width = (rows, pick, header) =>
  Math.max(header.length, ...rows.map((row) => String(pick(row)).length));

function summarise(days, limit) {
  const dates = Object.keys(days).sort();
  if (dates.length === 0) {
    console.log(
      "\nNo days on record yet.\n\n" +
        "CloudFront delivers logs minutes to hours after the request, so an\n" +
        "empty result shortly after a deploy is normal. If it stays empty,\n" +
        "check that logging is on:\n" +
        "  aws cloudfront get-distribution-config --id <id> --query DistributionConfig.Logging\n",
    );
    return;
  }

  const shown = dates.slice(-limit);
  const rows = shown.map((date) => {
    const day = days[date];
    const top = Object.entries(day.pages ?? {}).sort((a, b) => b[1] - a[1])[0];
    return {
      date,
      visitors: day.visitors ?? 0,
      pageViews: day.pageViews ?? 0,
      top: top ? `${top[0]} (${top[1]})` : "—",
      events: Object.values(day.events ?? {}).reduce((a, b) => a + b, 0),
    };
  });

  const w = {
    date: width(rows, (r) => r.date, "DATE"),
    visitors: width(rows, (r) => r.visitors, "VISITORS"),
    views: width(rows, (r) => r.pageViews, "VIEWS"),
    events: width(rows, (r) => r.events, "EVENTS"),
  };

  console.log(
    `\n${dates.length} day(s) on record (${dates[0]} → ${dates[dates.length - 1]})` +
      (shown.length < dates.length ? `, showing last ${shown.length}` : "") +
      "\n",
  );
  console.log(
    [
      "DATE".padEnd(w.date),
      "VISITORS".padStart(w.visitors),
      "VIEWS".padStart(w.views),
      "EVENTS".padStart(w.events),
      "TOP PAGE",
    ].join("  "),
  );
  for (const r of rows) {
    console.log(
      [
        r.date.padEnd(w.date),
        String(r.visitors).padStart(w.visitors),
        String(r.pageViews).padStart(w.views),
        String(r.events).padStart(w.events),
        r.top,
      ].join("  "),
    );
  }

  // Pages and decks across the whole window, which is the question the per-day
  // table can't answer: what is actually being used.
  const merge = (key) => {
    const total = {};
    for (const date of shown)
      for (const [k, n] of Object.entries(days[date][key] ?? {}))
        total[k] = (total[k] ?? 0) + n;
    return Object.entries(total).sort((a, b) => b[1] - a[1]);
  };

  const pages = merge("pages");
  if (pages.length) {
    console.log("\nTOP PAGES");
    for (const [path, n] of pages.slice(0, 10))
      console.log(`  ${String(n).padStart(6)}  ${path}`);
  }

  const events = merge("events");
  if (events.length) {
    console.log("\nEVENTS");
    for (const [name, n] of events)
      console.log(`  ${String(n).padStart(6)}  ${name}`);
  }

  const decks = merge("decks");
  if (decks.length) {
    console.log("\nDECKS RACED");
    for (const [name, n] of decks.slice(0, 10))
      console.log(`  ${String(n).padStart(6)}  ${name}`);
  }

  // Said every time rather than in a doc, because the number most likely to be
  // quoted out of context is the one at the top of a table.
  console.log(
    "\nvisitors = distinct IPs that day, and is NOT additive across days —\n" +
      "the same person on three days is three visitor-days, not three people.\n" +
      "Undeclared bots count as people; see docs/analytics.md.\n",
  );
}

try {
  if (!flag("no-sync")) sync();
  else process.stderr.write(`using logs already in ${LOGS}\n`);

  execFileSync("node", [ROLLUP, LOGS, OUT], { stdio: "inherit" });

  if (existsSync(OUT)) {
    summarise(
      JSON.parse(readFileSync(OUT, "utf8")).days ?? {},
      option("days", 30),
    );
  }
} catch (error) {
  console.error(`\n${error.message}`);
  process.exit(1);
}
