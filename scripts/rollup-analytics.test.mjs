import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { isDocumentPath, isPageView, tally } from "./rollup-analytics.mjs";

/**
 * The rollup is the only record of the site's history that outlives the logs,
 * so a miscount here is permanent in a way a bug in a dashboard would not be —
 * by the time anyone notices, the raw lines it was derived from have expired.
 *
 * These cases are not invented. They are the first hour of real traffic after
 * access logging was switched on, which happened to contain every shape that
 * matters: a returning visitor served 304s, a scanner that only ever got a
 * redirect and a 404, a crawler that says it is one, and one undeclared bot
 * with a browser's user-agent. The old `status < 400 && text/html` test scored
 * that hour as "2 visitors, 2 page views" — and both of the things it counted
 * were bots, while the one human was invisible.
 */

/** CloudFront writes tab-separated rows under a `#Fields:` header. */
const FIELDS =
  "date time c-ip cs-uri-stem cs-uri-query sc-status cs(User-Agent) sc-content-type";

const HUMAN = "Mozilla/5.0%20(Macintosh;%20Intel%20Mac%20OS%20X%2010_15_7)";
const GOOGLEBOT =
  "Mozilla/5.0%20(Linux;%20Android%206.0.1)%20(compatible;%20Googlebot/2.1)";

const row = ({
  date = "2026-08-18",
  ip,
  uri,
  query = "-",
  status,
  ua = HUMAN,
  type = "-",
}) => [date, "22:30:00", ip, uri, query, String(status), ua, type].join("\t");

/** Write one gzipped log file and count it, the way the real job would. */
const count = async (rows) => {
  const dir = mkdtempSync(join(tmpdir(), "rollup-"));
  const body = ["#Version: 1.0", `#Fields: ${FIELDS}`, ...rows, ""].join("\n");
  writeFileSync(
    join(dir, "E2B47B9IHQSJU0.2026-08-18-22.abc.gz"),
    gzipSync(body),
  );
  const days = await tally(dir);
  return days.get("2026-08-18");
};

describe("isDocumentPath", () => {
  it.each([
    "/",
    "/spelling/",
    "/printables/templates/chore-chart",
    "/404.html",
  ])("treats %s as a document", (path) =>
    expect(isDocumentPath(path)).toBe(true),
  );

  it.each([
    "/sw.js",
    "/icon-192.png",
    "/fonts/nunito-latin-var.woff2",
    "/robots.txt",
    "/manifest.webmanifest",
    "/_astro/index.abc123.js",
  ])("treats %s as an asset", (path) =>
    expect(isDocumentPath(path)).toBe(false),
  );
});

describe("isPageView", () => {
  const at = (status, type, uri = "/") => ({
    "sc-status": String(status),
    "sc-content-type": type,
    "cs-uri-stem": uri,
  });

  it("counts a served page", () =>
    expect(isPageView(at(200, "text/html;charset=UTF-8"))).toBe(true));

  it("counts a revalidated page, which carries no content-type", () =>
    expect(isPageView(at(304, "-"))).toBe(true));

  it("does not count a revalidated asset", () =>
    expect(isPageView(at(304, "-", "/sw.js"))).toBe(false));

  // The http→https redirect is text/html with status 301. Counting it made
  // every visitor arriving over http count twice, and promoted a scanner that
  // never received a page into a visitor.
  it("does not count a redirect", () =>
    expect(isPageView(at(301, "text/html"))).toBe(false));

  it("does not count a 404", () =>
    expect(isPageView(at(404, "application/xml"))).toBe(false));

  it("does not count an image", () =>
    expect(isPageView(at(200, "image/png", "/icon-192.png"))).toBe(false));
});

describe("tally, over the first real hour of logs", () => {
  const FIRST_HOUR = [
    // A person, back for a second visit: three revalidated page loads and the
    // assets that come with them. Invisible to the old test, every one.
    row({ ip: "98.168.10.1", uri: "/", status: 304 }),
    row({ ip: "98.168.10.1", uri: "/", status: 304 }),
    row({ ip: "98.168.10.1", uri: "/", status: 304 }),
    row({ ip: "98.168.10.1", uri: "/sw.js", status: 304 }),
    row({
      ip: "98.168.10.1",
      uri: "/icon-192.png",
      status: 200,
      type: "image/png",
    }),
    // A WordPress scanner. Never got a page — a redirect, then a 404.
    row({
      ip: "104.23.221.1",
      uri: "/wp-admin/install.php",
      status: 301,
      type: "text/html",
    }),
    row({
      ip: "104.23.221.1",
      uri: "/wp-admin/install.php",
      status: 404,
      type: "application/xml",
    }),
    // Googlebot, which says so and is filtered on its word.
    row({
      ip: "192.178.4.1",
      uri: "/printables/graph-paper-5-mm/a4/",
      status: 200,
      ua: GOOGLEBOT,
      type: "text/html;charset=UTF-8",
    }),
    // An undeclared bot from a datacentre, wearing a browser's user-agent.
    // Nothing here can catch this one; it is counted as a person by design.
    row({
      ip: "34.171.68.1",
      uri: "/multiplication/10-times-table/",
      status: 200,
      type: "text/html;charset=UTF-8",
    }),
    // A beacon, which is neither a page nor an asset.
    row({
      ip: "98.168.10.1",
      uri: "/_e/px.gif",
      query: "e=race_start&deck=multiply&input=type",
      status: 200,
      type: "image/gif",
    }),
  ];

  it("counts the person and the undeclared bot, and nothing else", async () => {
    const day = await count(FIRST_HOUR);
    expect(day.visitors.size).toBe(2);
  });

  it("sees all three of the returning visitor's page loads", async () => {
    const day = await count(FIRST_HOUR);
    expect(day.pageViews).toBe(4);
    expect(day.pages).toEqual({
      "/": 3,
      "/multiplication/10-times-table/": 1,
    });
  });

  it("keeps the scanner out of the record entirely", async () => {
    const day = await count(FIRST_HOUR);
    expect(day.pages["/wp-admin/install.php"]).toBeUndefined();
  });

  it("still records beacons, which are exempt from the page-view test", async () => {
    const day = await count(FIRST_HOUR);
    expect(day.events).toEqual({ race_start: 1 });
    expect(day.decks).toEqual({ multiply: 1 });
  });
});
