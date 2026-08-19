import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  edgeAirport,
  isDocumentPath,
  isPageView,
  placeOf,
  referrerHost,
  tally,
} from "./rollup-analytics.mjs";

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
  "date time c-ip cs-uri-stem cs-uri-query sc-status cs(User-Agent) sc-content-type cs(Referer) x-edge-location";

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
  ref = "-",
  edge = "SEA19-C1",
}) =>
  [date, "22:30:00", ip, uri, query, String(status), ua, type, ref, edge].join(
    "\t",
  );

/**
 * A stand-in for scripts/geoip.mjs.
 *
 * The real one downloads 23MB of CSV, which a unit test has no business doing:
 * it would make the suite need a network, and it would test jsDelivr rather
 * than this file. `geoip.test.mjs` exercises the actual lookup against
 * fixtures; here the only question is what the rollup does with an answer.
 */
const geoStub = (byIp) => ({ lookup: (ip) => byIp[ip] ?? null });

/** Shorthand for the `{ country, region, city }` the real lookup returns. */
const at = (country, region = null, city = null) => ({ country, region, city });

/** Write one gzipped log file and count it, the way the real job would. */
const count = async (rows, geo = null) => {
  const dir = mkdtempSync(join(tmpdir(), "rollup-"));
  const body = ["#Version: 1.0", `#Fields: ${FIELDS}`, ...rows, ""].join("\n");
  writeFileSync(
    join(dir, "E2B47B9IHQSJU0.2026-08-18-22.abc.gz"),
    gzipSync(body),
  );
  const days = await tally(dir, geo);
  return days.get("2026-08-18");
};

describe("an empty log directory", () => {
  // The failure this is built from: logging was off for a week, the job ran
  // twice over nothing and reported success both times. Silence there is
  // indistinguishable from a quiet month, and it is not recoverable — the raw
  // lines a fix would need have a 90-day clock on them.
  it("is a hard failure, not a quiet month", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rollup-empty-"));
    await expect(tally(dir)).rejects.toThrow(/No \.gz log files/);
  });

  it("says what to check, since the cause is never in this repo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rollup-empty-"));
    await expect(tally(dir)).rejects.toThrow(/DistributionConfig\.Logging/);
  });
});

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

describe("referrerHost", () => {
  // The reason this function exists. A search referrer must not carry the
  // search out of the log line — and a shared link can carry worse than a
  // search. Where the output later goes is not this function's business;
  // that is exactly why the reduction happens here.
  it("keeps the site and throws away the path and query", () =>
    expect(
      referrerHost("https://www.google.com/search?q=7%20times%20table"),
    ).toBe("google.com"));

  it("folds www. into the bare host, since they are one site", () =>
    expect(referrerHost("https://www.reddit.com/r/Teachers/")).toBe(
      "reddit.com",
    ));

  it("undoes CloudFront's field encoding first", () =>
    expect(referrerHost("https%3A%2F%2Ft.co%2FabC123")).toBe("t.co"));

  it("names the absent referrer rather than dropping it", () =>
    expect(referrerHost("-")).toBe("(none)"));

  // Internal navigation is every click anyone makes. Counting it would bury
  // the handful of inbound links that are the actual question.
  it.each(["https://schoolskills.app/typing", "https://www.schoolskills.app/"])(
    "does not count %s, which is us",
    (url) => expect(referrerHost(url)).toBeNull(),
  );

  it("drops junk rather than inventing a host for it", () =>
    expect(referrerHost("not a url")).toBeNull());
});

describe("edgeAirport", () => {
  it.each([
    ["SEA19-C1", "SEA"],
    ["LHR3-C2", "LHR"],
    ["MRS52-P1", "MRS"],
  ])("reduces %s to %s", (pop, code) => expect(edgeAirport(pop)).toBe(code));

  it("drops a missing location rather than counting one", () =>
    expect(edgeAirport("-")).toBeNull());
});

describe("placeOf", () => {
  const geo = geoStub({
    "98.168.10.1": at("US", "Arizona", "Peoria"),
    "8.8.8.8": at("US"),
    "1.2.3.4": at("CA", "Ontario"),
  });

  it("qualifies each level by the one above it", () =>
    expect(placeOf(geo, "98.168.10.1")).toEqual({
      country: "US",
      region: "US / Arizona",
      city: "US / Arizona / Peoria",
    }));

  // Ontario is a province of Canada AND a city in California; there are some
  // thirty Springfields. Unqualified keys would add strangers together.
  it("keeps two places of the same name apart", () => {
    const canada = placeOf(geo, "1.2.3.4");
    expect(canada.region).toBe("CA / Ontario");
    expect(canada.region).not.toBe(placeOf(geo, "98.168.10.1").region);
  });

  // Filling these in from a country centroid is the mistake that makes geo-IP
  // data infamous. A missing city stays missing.
  it("leaves region and city absent rather than guessing them", () =>
    expect(placeOf(geo, "8.8.8.8")).toEqual({
      country: "US",
      region: null,
      city: null,
    }));

  // The distinction the whole field rests on. "Looked and found nothing" is a
  // fact about one address; "did not look" is a fact about the run, and a day
  // recorded as 107 unknowns would read as the first while meaning the second.
  it("says (unknown) when the table does not place an address", () =>
    expect(placeOf(geo, "203.0.113.9")).toEqual({
      country: "(unknown)",
      region: null,
      city: null,
    }));

  it("says nothing at all when no lookup was configured", () =>
    expect(placeOf(null, "98.168.10.1")).toBeNull());
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

  // Assets carry a referrer too — the page that asked for them — so counting
  // every request would measure how many images a page has.
  it("reads referrer and edge off page views only", async () => {
    const day = await count(FIRST_HOUR);
    expect(day.referrers).toEqual({ "(none)": 4 });
    expect(day.edges).toEqual({ SEA: 4 });
  });

  it("still records beacons, which are exempt from the page-view test", async () => {
    const day = await count(FIRST_HOUR);
    expect(day.events).toEqual({ race_start: 1 });
    expect(day.decks).toEqual({ multiply: 1 });
  });

  // Same basis as referrers and edges: page views, not every request. The
  // undeclared bot is in here, because nothing distinguishes it from a person.
  it("files places off page views, on the same basis as edges", async () => {
    const day = await count(
      FIRST_HOUR,
      geoStub({
        "98.168.10.1": at("US", "Arizona", "Peoria"),
        "34.171.68.1": at("US", "Iowa", "Council Bluffs"),
      }),
    );
    expect(day.countries).toEqual({ US: 4 });
    expect(Object.values(day.countries).reduce((a, b) => a + b, 0)).toBe(
      day.pageViews,
    );
  });

  // The three levels deliberately do NOT sum alike: an address can resolve to
  // a country and no further, and inventing a city to make the columns balance
  // is the one thing this must never do.
  it("lets the levels disagree when the table knows less", async () => {
    const day = await count(
      FIRST_HOUR,
      geoStub({
        "98.168.10.1": at("US", "Arizona", "Peoria"),
        "34.171.68.1": at("US"),
      }),
    );
    expect(day.countries).toEqual({ US: 4 });
    expect(day.regions).toEqual({ "US / Arizona": 3 });
    expect(day.cities).toEqual({ "US / Arizona / Peoria": 3 });
  });

  it("records nothing at all when no lookup is supplied", async () => {
    const day = await count(FIRST_HOUR);
    expect(day.countries).toEqual({});
    expect(day.regions).toEqual({});
    expect(day.cities).toEqual({});
  });
});

describe("an arrival from a link somewhere else", () => {
  const social = (ref, edge) =>
    row({
      ip: "98.168.10.1",
      uri: "/spelling/",
      status: 200,
      type: "text/html;charset=UTF-8",
      ref,
      edge,
    });

  it("is filed under the site that sent them, and where it landed", async () => {
    const day = await count([
      social("https://t.co/abC123", "LHR3-C2"),
      social("https://t.co/abC123", "LHR62-P2"),
      social("https://www.facebook.com/", "SEA19-C1"),
      social("-", "SEA19-C1"),
    ]);
    expect(day.referrers).toEqual({
      "(none)": 1,
      "facebook.com": 1,
      "t.co": 2,
    });
    // Two London PoPs are one place; the server within them is not a fact
    // about anybody.
    expect(day.edges).toEqual({ LHR: 2, SEA: 2 });
  });

  // Referrers are read off page views, so each is a share of that day — but
  // they do NOT sum to `pageViews`, because our own pages are dropped. The
  // first week bore this out: 11 views on 2026-08-18, 4 referrers, and the
  // missing 7 were a visitor clicking around the site. `edges` is the one
  // that reconciles, since nothing is dropped from it.
  it("leaves referrers short of pageViews by the internal navigation", async () => {
    const day = await count([
      social("https://t.co/abC123", "LHR3-C2"),
      social("https://schoolskills.app/", "LHR3-C2"),
    ]);
    expect(day.pageViews).toBe(2);
    expect(day.referrers).toEqual({ "t.co": 1 });
    expect(Object.values(day.edges).reduce((a, b) => a + b, 0)).toBe(
      day.pageViews,
    );
  });
});

describe("CloudFront's field encoding", () => {
  // The log holds `deck=words%253Adolch-1`: the beacon encoded the colon once,
  // and CloudFront encoded the whole field again on the way into the file.
  // Decoding only once wrote `words%3Adolch-1` into the permanent record.
  it("is undone before the query is parsed, so a deck id keeps its colon", async () => {
    const day = await count([
      row({
        ip: "1.2.3.4",
        uri: "/_e/px.gif",
        query: "e=race_start&deck=words%253Adolch-1&input=type&n=1",
        status: 200,
        type: "image/gif",
      }),
    ]);
    expect(day.decks).toEqual({ "words:dolch-1": 1 });
  });

  it("is undone for the user-agent too, so bots stay filtered", async () => {
    const day = await count([
      row({
        ip: "1.2.3.4",
        uri: "/",
        status: 200,
        type: "text/html;charset=UTF-8",
        ua: GOOGLEBOT,
      }),
    ]);
    expect(day).toBeUndefined();
  });

  // A stray `%` from a scanner makes decodeURIComponent throw. Losing the
  // month's numbers to one malformed request would be a poor trade.
  it("survives a malformed percent-sequence rather than losing the run", async () => {
    const day = await count([
      row({
        ip: "1.2.3.4",
        uri: "/_e/px.gif",
        query: "e=race_start&deck=%&n=1",
        status: 200,
        type: "image/gif",
      }),
      row({
        ip: "1.2.3.4",
        uri: "/",
        status: 200,
        type: "text/html;charset=UTF-8",
      }),
    ]);
    expect(day.pageViews).toBe(1);
    expect(day.events).toEqual({ race_start: 1 });
  });
});
