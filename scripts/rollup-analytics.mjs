#!/usr/bin/env node
/**
 * Turn a pile of access logs into numbers worth keeping.
 *
 * Raw CloudFront log lines expire after 90 days (LOG_RETENTION_DAYS in
 * sst.config.ts) because each one contains an IP address. This script reduces
 * a pile of them to per-day totals that carry no address and no identifier,
 * so the output is safe to keep — but it does NOT decide where.
 *
 * ⚠️ **Nothing here is a durable store, and 90 days is currently the whole of
 * the site's memory.** These counts used to be committed to this repo, which
 * confused two different things: a repo keeps CODE forever, and that is what
 * it is for. Generated analytics are not code. Committing them grew the tree
 * without bound and put a manual PR merge on the calendar every month.
 *
 * That leaves a real gap rather than closing one: when a day ages past the
 * retention window it is gone, and no amount of re-running brings it back.
 * Somewhere durable to put these numbers is owed before that starts to bite —
 * docs/analytics.md carries the shape of the problem.
 *
 * Deliberately not Athena. The GitHub role already has S3 read, the logs are
 * small at this traffic, and a Glue catalogue plus a query-results bucket plus
 * a manual CREATE TABLE is a lot of moving parts to count some lines. Athena
 * stays documented in docs/analytics.md for ad-hoc digging.
 *
 * Usage:  node scripts/rollup-analytics.mjs <dir-of-gz-logs> <out.json>
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
  "cs(Referer)",
  "x-edge-location",
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
 * Undo the encoding CloudFront applies to log FIELDS.
 *
 * Every field it writes is percent-encoded on the way into the file, on top of
 * whatever encoding the value already carried. A beacon sent as
 * `deck=words%3Adolch-1` is therefore logged as `deck=words%253Adolch-1`, and
 * anything that decodes only once — `URLSearchParams`, for instance — yields
 * `words%3Adolch-1` and writes that mangled id into a file that is kept
 * forever.
 *
 * `try` because the input is a query string from the open internet and
 * `decodeURIComponent` throws on a malformed sequence — a single stray `%`
 * from a scanner would otherwise take down the whole monthly run. A line we
 * can't decode is worth skipping; it is not worth losing the month over.
 */
const decodeField = (value) => {
  try {
    return decodeURIComponent(value ?? "");
  } catch {
    return value ?? "";
  }
};

/**
 * Obvious crawlers.
 *
 * The times-table pages exist to be found in search, so they are crawled
 * heavily and counting a bot as a visitor would make the headline number a
 * lie. This is a floor, not a complete list — anything that says it is a bot
 * is taken at its word, and anything that lies is counted as a person.
 */
/**
 * Where a page view came from, reduced to a bare hostname.
 *
 * **The host is the whole of it — never the path, never the query string.**
 * A referrer arrives as a full URL, and full URLs from search engines and
 * social apps routinely carry what someone typed, which post they tapped, and
 * occasionally a session token in a link that was pasted somewhere. This file
 * is committed to a public repo and kept forever, so the only safe thing to
 * write into it is the site's name. `https://www.google.com/search?q=how+do+i
 * +teach+the+7+times+table` becomes `google.com` and nothing else survives.
 *
 * Returns a key to count under, or `null` for a line that shouldn't be counted:
 *
 * - **`"(none)"`** — no referrer was sent. Not the same as "typed the address
 *   in": an https→http hop, a privacy-preserving browser, most native apps and
 *   every link out of a PDF or a message all arrive bare. It is a floor on
 *   direct traffic, not a measurement of it.
 * - **`null` for our own pages**, because internal navigation is every click a
 *   visitor makes and would bury the handful of links that are the actual
 *   question here. `www.` is stripped before the comparison, which also folds
 *   `www.example.com` into `example.com` for everyone else — the same site.
 * - **`null` for anything `URL` won't parse**, which in practice is scanners
 *   sending junk in the header.
 */
const SELF = new Set(["schoolskills.app"]);

export const referrerHost = (raw) => {
  const value = decodeField(raw).trim();
  if (!value || value === "-") return "(none)";

  let host;
  try {
    host = new URL(value).hostname;
  } catch {
    return null;
  }

  host = host.toLowerCase().replace(/^www\./, "");
  return host && !SELF.has(host) ? host : null;
};

/**
 * Which CloudFront edge served the request: `SEA19-C1` → `SEA`.
 *
 * ⚠️ **This is the edge, not the visitor.** CloudFront routes to a nearby PoP,
 * so the airport code is a coarse proxy for where someone is and nothing
 * stronger — a visitor in Vancouver is served from Seattle, and one on a VPN
 * is served from wherever the exit node is. Read it as "roughly which part of
 * the world", never as a country count.
 *
 * The real field is `c-country`, and it does not exist in CloudFront's legacy
 * standard log format — the 33 fields are fixed. Getting it means moving the
 * distribution to standard logging v2, which is a different delivery mechanism
 * (CloudWatch vended logs) rather than a field to add here.
 *
 * The trailing `-C1`/`-P3` is the individual server within the PoP and is
 * dropped: it changes between requests from one household and means nothing to
 * anyone reading this file.
 */
export const edgeAirport = (raw) => {
  const match = /^[A-Z]+/.exec(decodeField(raw).toUpperCase());
  return match ? match[0] : null;
};

const BOT =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|headlesschrome|lighthouse|curl|wget|python-requests/i;

/** One day's tallies. Sets while counting, numbers by the time they're stored. */
const emptyDay = () => ({
  visitors: new Set(),
  pageViews: 0,
  pages: {},
  referrers: {},
  edges: {},
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
  // Loud, not a warning. An empty directory is indistinguishable from a quiet
  // month right up until you notice the site has had traffic all along — which
  // is exactly what happened: CloudFront logging was silently off for a week,
  // this job ran twice, found nothing, wrote nothing, and reported success
  // both times. A pipeline whose failure mode is "succeeds over nothing"
  // cannot be monitored, so this refuses to be that.
  //
  // There is no legitimate empty case. CloudFront logs every request including
  // the crawlers, so zero files means the logs are not arriving, not that
  // nobody visited.
  if (files.length === 0) {
    throw new Error(
      `No .gz log files under ${dir}.\n\n` +
        "That is a broken pipeline, not a quiet month — CloudFront logs every\n" +
        "request, crawlers included. Check that delivery is still switched on:\n" +
        "  aws cloudfront get-distribution-config --id <id> \\\n" +
        "    --query DistributionConfig.Logging",
    );
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
      if (BOT.test(decodeField(row["cs(User-Agent)"]))) continue;

      if (!days.has(date)) days.set(date, emptyDay());
      const day = days.get(date);

      if (row["cs-uri-stem"] === "/_e/px.gif") {
        // Decode CloudFront's field encoding FIRST, then parse. Parsing
        // first would leave every value still holding one layer of it.
        const q = new URLSearchParams(
          row["cs-uri-query"] === "-" ? "" : decodeField(row["cs-uri-query"]),
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

      // Both are counted on page views only, not on every request. An asset's
      // referrer is always the page that asked for it, so counting those would
      // measure the number of images on a page; and keeping `edges` on the same
      // basis as `pages` is what lets it be read as a share of a day's traffic.
      const from = referrerHost(row["cs(Referer)"]);
      if (from) day.referrers[from] = (day.referrers[from] ?? 0) + 1;

      const edge = edgeAirport(row["x-edge-location"]);
      if (edge) day.edges[edge] = (day.edges[edge] ?? 0) + 1;
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
      referrers: sortObject(day.referrers),
      edges: sortObject(day.edges),
      events: sortObject(day.events),
      decks: sortObject(day.decks),
    };
  }

  existing.note =
    "Generated by scripts/rollup-analytics.mjs from CloudFront access logs. " +
    "Contains no IP addresses and no identifiers — `visitors` is a count of " +
    "distinct addresses seen that day and is approximate by design (see " +
    "/privacy). `referrers` holds bare hostnames, never a path or a query " +
    "string; `edges` is the CloudFront location that served the request, " +
    "which is near the visitor rather than at them. Derived from logs that " +
    "are deleted after 90 days, so a day outside that window cannot be " +
    "recounted.";
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
  const [, , LOG_DIR, OUT] = process.argv;

  // No default output path. There used to be one pointing into the repo, and
  // a default that writes into a source tree is how a generated file ends up
  // committed by accident.
  if (!LOG_DIR || !OUT) {
    console.error("usage: rollup-analytics.mjs <dir-of-gz-logs> <out.json>");
    process.exit(2);
  }

  try {
    await main(LOG_DIR, OUT);
  } catch (error) {
    console.error(`\n${error.message}`);
    process.exit(1);
  }
}
