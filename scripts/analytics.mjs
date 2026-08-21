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
 * ⚠️ **This is a viewer, not a store.** It writes its counts next to the
 * synced logs in the system temp directory, and nothing it produces is kept.
 * An earlier version committed them to `analytics/counts.json`. Version
 * control is the right home for code forever; it is not a home for analytics.
 * These counts were generated rather than authored, grew without bound, and
 * arrived through a PR somebody had to merge by hand every month — none of
 * which is what a source tree is for.
 *
 * What that means today: **the access logs are the only record, and they are
 * deleted after 90 days** (LOG_RETENTION_DAYS in sst.config.ts). Anything you
 * want to know beyond that window has to be asked before the window closes.
 * A durable home for the aggregates is still owed — see docs/analytics.md.
 *
 * Usage:
 *   npm run analytics                sync, count, summarise
 *   npm run analytics -- --no-sync   re-summarise what's already downloaded
 *   npm run analytics -- --days 7    narrow the table (default 30)
 *   npm run analytics -- --by-day    every breakdown with a column per day
 *   npm run analytics -- --width 200 lay the grid out for a file, not a tty
 *   npm run analytics -- --no-geoip  skip the country lookup
 *
 * `--no-geoip` is for working with no network at all. The country table is
 * cached in the temp directory next to the logs, so an ordinary second run
 * downloads nothing and the flag buys nothing — see scripts/geoip.mjs.
 *
 * `--width` exists because the by-day grid sizes itself to the terminal and
 * drops the oldest days that don't fit. Piped into a file there is no terminal
 * to measure, so without it a redirected run silently lays out for 100
 * columns — see `dailyLines` in scripts/analytics-view.mjs.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dailyLines, mergedLines } from "./analytics-view.mjs";
import { awsAuthHint, awsIdentityLabel, awsProfileArgs } from "./aws.mjs";

// Temp, deliberately. See the header: nothing this produces is kept, and
// writing into the repo is what this stopped doing.
const OUT = join(tmpdir(), "schoolskills-counts.json");
const ROLLUP = "scripts/rollup-analytics.mjs";
// Stable rather than a fresh mkdtemp: `aws s3 sync` is incremental, so keeping
// the directory between runs turns the second run into a no-op download.
const LOGS = join(tmpdir(), "schoolskills-cflogs");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
// Loud about a value it can't use, because both options this parses exist to
// bound what gets printed: a `--width` that quietly became NaN would disable
// the fitting whose whole job is to stop the grid overflowing unannounced.
const option = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  if (at === -1) return fallback;
  const value = Number(argv[at + 1]);
  if (Number.isFinite(value) && value > 0) return value;
  process.stderr.write(
    `--${name} ${argv[at + 1] ?? ""}: not a positive number, using ${fallback}\n`,
  );
  return fallback;
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
      ...awsProfileArgs(),
    ]).trim();
    return `schoolskills-access-logs-${account}`;
  } catch (error) {
    const detail = String(error.stderr ?? error.message).trim();
    throw new Error(
      `Could not reach AWS as ${awsIdentityLabel()}.\n${detail}\n\n` +
        awsAuthHint(),
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
    ...awsProfileArgs(),
    "--no-progress",
    "--only-show-errors",
  ]);
}

/** The widest value in a column, so the table doesn't wobble. */
const width = (rows, pick, header) =>
  Math.max(header.length, ...rows.map((row) => String(pick(row)).length));

function summarise(days, limit, { byDay, terminal }) {
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

  // The breakdowns themselves. Which shape they take is the only thing
  // --by-day changes; the counts behind both are the same per-day totals the
  // rollup has always written.
  console.log(
    (byDay ? dailyLines(days, shown, terminal) : mergedLines(days, shown)).join(
      "\n",
    ),
  );

  // Said every time rather than in a doc, because the number most likely to be
  // quoted out of context is the one at the top of a table.
  console.log(
    "\nvisitors = distinct IPs that day, and is NOT additive across days —\n" +
      "the same person on three days is three visitor-days, not three people.\n" +
      "Undeclared bots count as people. (none) is a floor on direct traffic,\n" +
      "not a measure of it. An edge code is a server near someone rather than\n" +
      "at them, and answers which PoPs serve the site, not who is here.\n" +
      "\n" +
      "COUNTRY, REGION and CITY are where the address is REGISTERED, which a\n" +
      "VPN, a school or a mobile carrier moves outright — and the finer the\n" +
      "level, the more often it is wrong and the fewer people are behind each\n" +
      "row. A city seen once is close to naming a household: read it, don't\n" +
      "publish it, and don't paste it anywhere. See docs/analytics.md.\n",
  );
}

try {
  if (!flag("no-sync")) sync();
  else process.stderr.write(`using logs already in ${LOGS}\n`);

  execFileSync(
    "node",
    [ROLLUP, LOGS, OUT, ...(flag("no-geoip") ? ["--no-geoip"] : [])],
    { stdio: "inherit" },
  );
  process.stderr.write(`counts written to ${OUT} (temporary)\n`);

  if (existsSync(OUT)) {
    summarise(
      JSON.parse(readFileSync(OUT, "utf8")).days ?? {},
      option("days", 30),
      {
        byDay: flag("by-day"),
        terminal: option("width", process.stdout.columns ?? 100),
      },
    );
  }
} catch (error) {
  console.error(`\n${error.message}`);
  process.exit(1);
}
