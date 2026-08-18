#!/usr/bin/env node
/**
 * Turn a pile of access logs into numbers worth keeping.
 *
 * Raw CloudFront log lines expire after 90 days (LOG_RETENTION_DAYS in
 * sst.config.ts) because each one contains an IP address. The counts derived
 * from them contain nothing of the sort, so THOSE are what get kept: this
 * script reduces the logs to per-day totals and merges them into
 * analytics/counts.json, which is committed to the repo and never expires.
 *
 * That inversion is the whole point. Retention length is not what protects the
 * site's history — this job is. If it stops running, the record of the first
 * year quietly becomes "the last ninety days".
 *
 * Deliberately not Athena. The GitHub role already has S3 read, the logs are
 * small at this traffic, and a Glue catalogue plus a query-results bucket plus
 * a manual CREATE TABLE is a lot of moving parts to count some lines. Athena
 * stays documented in docs/analytics.md for ad-hoc digging.
 *
 * Usage:  node scripts/rollup-analytics.mjs <dir-of-gz-logs> [counts.json]
 */

import { createReadStream, existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * CloudFront's standard log format, by position.
 *
 * The header line in each file declares this, and it has been stable for
 * years, but the fields we actually use are read by name from that header
 * rather than by index — a format change should produce a loud KeyError here
 * rather than silently miscounted numbers.
 */
const WANTED = [
  "date",
  "c-ip",
  "cs-uri-stem",
  "cs-uri-query",
  "sc-status",
  "cs(User-Agent)",
  "sc-content-type",
];

/**
 * Does this path name a document rather than an asset?
 *
 * Only consulted for 304s, which is the one case where the content-type can't
 * answer it (see `isPageView`). The rule is the filename: anything with an
 * extension is an asset, except `.html` itself. `/`, `/spelling/` and
 * `/printables/templates/chore-chart` are documents; `/sw.js`,
 * `/icon-192.png`, `/fonts/nunito-latin-var.woff2`, `/robots.txt` and
 * `/_astro/index.abc123.js` are not.
 */
export const isDocumentPath = (path) => {
  const file = path.slice(path.lastIndexOf("/") + 1);
  return file === "" || !file.includes(".") || /\.html?$/i.test(file);
};

/**
 * Requests that are a person arriving at a page, rather than an asset fetch.
 *
 * The two status codes are here for opposite reasons, and an earlier version
 * of this function — `status < 400 && content-type is text/html` — got both
 * of them wrong in the same line.
 *
 * **200 is the ordinary case** and the content-type settles it.
 *
 * **304 is the returning visitor.** HTML ships as
 * `max-age=3600, must-revalidate` (see `fileOptions` in sst.config.ts), so a
 * browser that has been here before revalidates and CloudFront answers 304 —
 * which carries NO content-type at all. The old test therefore threw away
 * every repeat visit, on top of the service-worker blind spot that
 * docs/analytics.md already warns about. Since there is no content-type to
 * read, the path has to decide it.
 *
 * **3xx redirects are not page views**, and `< 400` quietly counted them. The
 * http→https redirect is served as `text/html` with status 301, so every
 * visitor arriving over http counted twice, and a scanner probing
 * `/wp-admin/install.php` — which never got a page, only a redirect and then
 * a 404 — was recorded as a visitor on this pipeline's first day of data.
 */
export const isPageView = (row) => {
  const status = Number(row["sc-status"]);
  if (status === 200)
    return (row["sc-content-type"] ?? "").startsWith("text/html");
  if (status === 304) return isDocumentPath(row["cs-uri-stem"] ?? "");
  return false;
};

/**
 * Obvious crawlers.
 *
 * The times-table pages exist to be found in search, so they are crawled
 * heavily and counting a bot as a visitor would make the headline number a
 * lie. This is a floor, not a complete list — anything that says it is a bot
 * is taken at its word, and anything that lies is counted as a person.
 */
const BOT =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|headlesschrome|lighthouse|curl|wget|python-requests/i;

/** One day's tallies. Sets while counting, numbers by the time they're stored. */
const emptyDay = () => ({
  visitors: new Set(),
  pageViews: 0,
  pages: {},
  events: {},
  decks: {},
});

async function* lines(file) {
  const stream = createReadStream(file).pipe(createGunzip());
  for await (const line of createInterface({
    crlfDelay: Infinity,
    input: stream,
  })) {
    yield line;
  }
}

export async function tally(dir) {
  const days = new Map();
  const files = (await readdir(dir, { recursive: true })).filter((f) =>
    f.endsWith(".gz"),
  );
  if (files.length === 0) {
    console.error(`no .gz log files under ${dir}`);
  }

  for (const name of files) {
    let fields = null;
    for await (const line of lines(join(dir, name))) {
      // Two header lines per file: "#Version:" then "#Fields: date time ...".
      if (line.startsWith("#")) {
        if (line.startsWith("#Fields:"))
          fields = line.slice(8).trim().split(" ");
        continue;
      }
      if (!fields) continue;

      const parts = line.split("\t");
      const row = {};
      for (const key of WANTED) {
        const at = fields.indexOf(key);
        if (at === -1) throw new Error(`log format changed: no "${key}" field`);
        row[key] = parts[at];
      }

      const date = row["date"];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (BOT.test(decodeURIComponent(row["cs(User-Agent)"] ?? ""))) continue;

      if (!days.has(date)) days.set(date, emptyDay());
      const day = days.get(date);

      if (row["cs-uri-stem"] === "/_e/px.gif") {
        const q = new URLSearchParams(
          row["cs-uri-query"] === "-" ? "" : row["cs-uri-query"],
        );
        const event = q.get("e");
        if (!event) continue;
        // race_end is split by outcome, because started-minus-finished is the
        // number that says whether a deck is too long or simply broken.
        const key =
          event === "race_end" ? `race_end:${q.get("outcome") ?? "?"}` : event;
        day.events[key] = (day.events[key] ?? 0) + 1;
        const deck = q.get("deck");
        if (deck && event === "race_start") {
          day.decks[deck] = (day.decks[deck] ?? 0) + 1;
        }
        continue;
      }

      if (!isPageView(row)) continue;
      // The IP is used here and discarded here. Only its cardinality survives
      // this function, which is what lets the output live in a public repo.
      day.visitors.add(row["c-ip"]);
      day.pageViews += 1;
      const path = row["cs-uri-stem"];
      day.pages[path] = (day.pages[path] ?? 0) + 1;
    }
  }
  return days;
}

const sortObject = (o) =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

async function main(LOG_DIR, OUT) {
  const days = await tally(LOG_DIR);

  const existing = existsSync(OUT)
    ? JSON.parse(await readFile(OUT, "utf8"))
    : { note: "", days: {} };

  // Days present in this run overwrite what was stored. Logs arrive late, so a
  // day counted yesterday from partial data gets corrected rather than
  // double-added — which also makes re-running the job harmless.
  for (const [date, day] of days) {
    existing.days[date] = {
      visitors: day.visitors.size,
      pageViews: day.pageViews,
      pages: sortObject(day.pages),
      events: sortObject(day.events),
      decks: sortObject(day.decks),
    };
  }

  existing.note =
    "Generated by scripts/rollup-analytics.mjs from CloudFront access logs. " +
    "Contains no IP addresses and no identifiers — `visitors` is a count of " +
    "distinct addresses seen that day and is approximate by design (see " +
    "/privacy). Raw logs expire after 90 days; this file does not.";
  existing.days = sortObject(existing.days);

  await writeFile(OUT, JSON.stringify(existing, null, 2) + "\n");

  const dates = Object.keys(existing.days);
  console.log(
    `${days.size} day(s) counted from ${LOG_DIR}; ${dates.length} day(s) on record` +
      (dates.length ? ` (${dates[0]} → ${dates[dates.length - 1]})` : ""),
  );
}

/**
 * Only bootstrap when run as a script.
 *
 * scripts/rollup-analytics.test.mjs imports `tally` and `isPageView` directly,
 * and a bare `await main()` at module scope would make that import parse argv
 * and exit(2). The counting logic is the part worth testing, so it has to be
 * reachable without running the CLI around it.
 */
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [, , LOG_DIR, OUT = "analytics/counts.json"] = process.argv;

  if (!LOG_DIR) {
    console.error("usage: rollup-analytics.mjs <dir-of-gz-logs> [counts.json]");
    process.exit(2);
  }

  await main(LOG_DIR, OUT);
}
