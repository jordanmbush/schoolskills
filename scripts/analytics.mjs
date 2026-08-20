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
 *   npm run analytics -- --no-geoip  skip the country lookup
 *
 * `--no-geoip` is for working with no network at all. The country table is
 * cached in the temp directory next to the logs, so an ordinary second run
 * downloads nothing and the flag buys nothing — see scripts/geoip.mjs.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

/**
 * `BR` → `Brazil`, via `Intl` rather than a table in this repo.
 *
 * A two-letter code is exactly as unreadable as the airport codes below it,
 * which is what prompted the country lookup in the first place — printing
 * `SG 6` and calling it an improvement would have missed the point. Node has
 * shipped the region names since v14, so the alternative was carrying 250
 * country names in a source file and letting them go stale.
 */
const REGIONS = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (code) => {
  if (code === "(unknown)") return "address not in the table";
  try {
    return REGIONS.of(code) ?? code;
  } catch {
    // `of` throws on anything that isn't a well-formed region code. A code the
    // table produced but Intl doesn't know is worth printing bare, not worth
    // taking the summary down for.
    return code;
  }
};

/**
 * `US / Iowa / Council Bluffs` → `United States / Iowa / Council Bluffs`.
 *
 * The rollup stores places qualified by the level above them, because place
 * names are not unique — Ontario is a Canadian province and a Californian
 * city, and there are around thirty Springfields. Only the leading country
 * code is expanded; the rest is already what the source called it.
 */
const placeLabel = (key) => {
  const cut = key.indexOf(" / ");
  if (cut === -1) return key;
  return `${countryName(key.slice(0, cut))}${key.slice(cut)}`;
};

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

  // Days counted before referrers were recorded simply have none of these, so
  // both blocks stay quiet rather than printing an empty heading over a window
  // that predates them.
  const referrers = merge("referrers");
  if (referrers.length) {
    console.log("\nCAME FROM");
    for (const [host, n] of referrers.slice(0, 10))
      console.log(`  ${String(n).padStart(6)}  ${host}`);
  }

  // Days counted before the place lookup existed have no `countries` key at
  // all, which is why these stay quiet rather than printing a heading over a
  // window that predates them. An empty heading and a genuine zero should not
  // look the same.
  const countries = merge("countries");
  if (countries.length) {
    const codeWidth = Math.max(...countries.map(([code]) => code.length));
    console.log("\nCOUNTRY (the visitor's own IP, resolved locally)");
    for (const [code, n] of countries.slice(0, 10))
      console.log(
        `  ${String(n).padStart(6)}  ${code.padEnd(codeWidth)}  ${countryName(code)}`,
      );
  }

  const regions = merge("regions");
  if (regions.length) {
    console.log("\nREGION");
    for (const [name, n] of regions.slice(0, 10))
      console.log(`  ${String(n).padStart(6)}  ${placeLabel(name)}`);
  }

  const cities = merge("cities");
  if (cities.length) {
    // The count of distinct cities, not just the top ten, because the shape of
    // the tail is the thing worth knowing here: a long tail of ones is what a
    // city breakdown looks like at this traffic, and it is the reason the
    // caveat at the bottom of this output exists.
    const singletons = cities.filter(([, n]) => n === 1).length;
    console.log(`\nCITY (${cities.length} distinct)`);
    for (const [name, n] of cities.slice(0, 10))
      console.log(`  ${String(n).padStart(6)}  ${placeLabel(name)}`);
    if (singletons)
      console.log(
        `         ${singletons} of them seen exactly once — see the note below`,
      );
  }

  const edges = merge("edges");
  if (edges.length) {
    console.log("\nSERVED FROM (nearest CloudFront edge, not the visitor)");
    for (const [code, n] of edges.slice(0, 10))
      console.log(`  ${String(n).padStart(6)}  ${code}`);
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
    );
  }
} catch (error) {
  console.error(`\n${error.message}`);
  process.exit(1);
}
