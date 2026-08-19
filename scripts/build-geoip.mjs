#!/usr/bin/env node
/**
 * Build the geo-IP artifact the rollup reads, and put it in S3.
 *
 * This is the slow, occasional half of the country/city lookup. It downloads
 * ~50MB of published CSV, merges two databases, sorts and flattens them into
 * one non-overlapping partition of the address space, and writes a binary file
 * the reader can use with no parsing at all. `scripts/geoip.mjs` then fetches
 * that one artifact and is ready in a tenth of a second.
 *
 * Run it when you want fresher data — see the cadence note below, which is a
 * licence obligation rather than a preference:
 *
 *   npm run analytics:geoip          build and upload
 *   npm run analytics:geoip -- --dry build locally, upload nothing
 *
 * ## Two databases, because they are good at different things
 *
 * | Source                                   | Gives         | Licence     |
 * | ---------------------------------------- | ------------- | ----------- |
 * | `@ip-location-db/geo-whois-asn-country`   | country       | CC0-1.0     |
 * | `@ip-location-db/geolite2-city`           | region, city  | MaxMind EULA|
 *
 * **The country always comes from the CC0 table when it has an answer.** That
 * is not arbitrary: it is the table the country counts already shipped on, it
 * is built from whois and geofeed records rather than inference, and keeping it
 * authoritative means adding cities did not silently move anybody between
 * countries. GeoLite2 fills in the country only where whois is silent.
 *
 * ## ⚠️ Rebuild this periodically — it is a term of the licence
 *
 * The GeoLite2 redistribution says you "may not prevent the Library from
 * updating local copies of the GeoLite2 Databases to honor Do Not Sell requests
 * submitted to MaxMind". MaxMind honours those requests by dropping records
 * from later releases, so a snapshot pinned in S3 forever is precisely the
 * thing that clause forbids. `.github/workflows/refresh-geoip.yml` re-runs this
 * monthly so the obligation is discharged by the pipeline rather than by
 * somebody remembering; the artifact carries its build date, and the reader
 * warns when it is reading a stale one.
 *
 * ## Why an artifact at all
 *
 * The first version had the rollup download both CSVs and do this work every
 * run. That was ~900ms for country alone and would have been many seconds with
 * cities — the same sort, the same overlap sweep, the same allocation, over
 * again, to produce a byte-identical result. Doing it once and storing the
 * answer costs one S3 object and removes the whole cost from the read path.
 */

import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createGunzip, gzipSync } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  ARTIFACT,
  MAGIC,
  VERSION,
  cacheDir,
  ipv4ToInt,
  ipv6ToBigInt,
} from "./geoip.mjs";

/**
 * A 128-bit address as the four 32-bit words the artifact stores.
 *
 * The build works in BigInt because sorting and merging need ordered
 * arithmetic; the reader works in words because comparing four integers is
 * faster than comparing BigInts. This is the one place the two meet.
 */
const wordsOf = (value) => [
  Number((value >> 96n) & 0xffffffffn),
  Number((value >> 64n) & 0xffffffffn),
  Number((value >> 32n) & 0xffffffffn),
  Number(value & 0xffffffffn),
];

const CDN = "https://cdn.jsdelivr.net/npm/@ip-location-db";

/**
 * The four files that go in. `gz` marks the ones published compressed — the
 * country tables are small enough to be served plain, the city tables are not.
 */
const SOURCES = {
  country4: {
    url: `${CDN}/geo-whois-asn-country/geo-whois-asn-country-ipv4.csv`,
    gz: false,
  },
  country6: {
    url: `${CDN}/geo-whois-asn-country/geo-whois-asn-country-ipv6.csv`,
    gz: false,
  },
  city4: {
    url: `${CDN}/geolite2-city/geolite2-city-ipv4.csv.gz`,
    gz: true,
  },
  city6: {
    url: `${CDN}/geolite2-city/geolite2-city-ipv6.csv.gz`,
    gz: true,
  },
};

const DOWNLOADS = join(tmpdir(), "schoolskills-geoip-src");
const PROFILE = process.env.AWS_PROFILE ?? "schoolskills";

const run = (cmd, args) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const say = (message) => process.stderr.write(`${message}\n`);

/** Download once into a temp directory; a rebuild the same day re-reads it. */
async function fetchSource(name, { url, gz }) {
  mkdirSync(DOWNLOADS, { recursive: true });
  const path = join(DOWNLOADS, `${name}.csv`);

  // A day is the right staleness here rather than the reader's thirty: this
  // script exists to be run when you WANT new data, so re-reading a
  // week-old download would defeat the point of running it.
  if (existsSync(path) && Date.now() - statSync(path).mtimeMs < 86400000) {
    say(`  ${name}: cached`);
    return readFile(path, "utf8");
  }

  say(`  ${name}: downloading`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);

  // Streamed and gunzipped on the way to disk: the city file is 36MB
  // compressed and several hundred megabytes as one JavaScript string, so
  // buffering the whole response first is how this runs out of memory.
  const body = Readable.fromWeb(response.body);
  await pipeline(
    ...(gz ? [body, createGunzip()] : [body]),
    createWriteStream(`${path}.part`),
  );
  await rename(`${path}.part`, path);
  return readFile(path, "utf8");
}

/**
 * A partition of the address space: `starts[i]` up to `starts[i+1] - 1` holds
 * `values[i]`, with `null` for the stretches no database covers.
 *
 * Modelling gaps as explicit entries rather than as a separate `ends` array is
 * what makes both the merge below and the reader's binary search trivial —
 * every address is inside exactly one entry, always, so a lookup never has to
 * ask a second question after finding its index.
 */
export const partition = (ranges, zero) => {
  const starts = [];
  const values = [];
  let cursor = zero;

  for (const [start, end, value] of ranges) {
    if (start > cursor) {
      starts.push(cursor);
      values.push(null);
      cursor = start;
    }
    if (end < cursor) continue; // wholly inside a range already claimed
    starts.push(cursor);
    values.push(value);
    cursor = end + 1n;
  }
  return { starts, values };
};

/**
 * Parse one CSV into sorted, non-overlapping ranges.
 *
 * The two published files disagree about tidiness — GeoLite2 arrives sorted and
 * disjoint, the whois country file has 568 IPv4 rows that begin inside the row
 * before them — so both get sorted and swept regardless. Where ranges overlap
 * the earlier start wins, and the narrower one on a tie; it decides 0.17% of
 * the whois table and the only thing that matters is that it decides them the
 * same way every build.
 */
export const readRanges = (text, parse, pick) => {
  const ranges = [];
  let skipped = 0;

  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const fields = line.split(",");
    const start = parse(fields[0]);
    const end = parse(fields[1]);
    const value = pick(fields);
    if (start === null || end === null || end < start || value === null) {
      skipped += 1;
      continue;
    }
    ranges.push([start, end, value]);
  }

  if (ranges.length === 0 || skipped > ranges.length / 100) {
    throw new Error(
      `source did not parse: ${ranges.length} usable row(s), ${skipped} skipped.\n` +
        `The CSV format probably moved. Delete ${DOWNLOADS} and look at one.`,
    );
  }

  ranges.sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0,
  );
  return ranges;
};

/**
 * Walk two partitions together, emitting a new entry wherever either changes.
 *
 * The result is the coarsest partition on which both inputs are constant, which
 * is the only way to combine them without either losing a boundary or inventing
 * one. Both inputs are sorted, so this is a single pass over each.
 */
export const merge = (a, b, combine, zero) => {
  const starts = [];
  const values = [];
  let i = 0;
  let j = 0;
  let cursor = zero;

  const nextBoundary = () => {
    const ai = i + 1 < a.starts.length ? a.starts[i + 1] : null;
    const bj = j + 1 < b.starts.length ? b.starts[j + 1] : null;
    if (ai === null) return bj;
    if (bj === null) return ai;
    return ai < bj ? ai : bj;
  };

  for (;;) {
    starts.push(cursor);
    values.push(combine(a.values[i] ?? null, b.values[j] ?? null));

    const next = nextBoundary();
    if (next === null) break;
    cursor = next;
    if (i + 1 < a.starts.length && a.starts[i + 1] === cursor) i += 1;
    if (j + 1 < b.starts.length && b.starts[j + 1] === cursor) j += 1;
  }
  return { starts, values };
};

/** Collapse runs of identical values — the merge above creates many. */
export const dedupe = ({ starts, values }, key) => {
  const outStarts = [];
  const outValues = [];
  let previous = Symbol("none");

  for (let i = 0; i < starts.length; i += 1) {
    const id = key(values[i]);
    if (id === previous) continue;
    previous = id;
    outStarts.push(starts[i]);
    outValues.push(values[i]);
  }
  return { starts: outStarts, values: outValues };
};

/**
 * One family (v4 or v6), from two CSVs to a partition of location ids.
 *
 * `locations` is shared across both families so a city gets one id in the
 * whole artifact rather than one per address family.
 */
export function buildFamily({
  countryText,
  cityText,
  parse,
  label,
  locations,
  log = () => {},
}) {
  const countries = partition(
    readRanges(countryText, parse, (f) => {
      const code = (f[2] ?? "").trim().toUpperCase();
      return /^[A-Z]{2}$/.test(code) ? code : null;
    }),
    0n,
  );
  log(`  ${label}: ${countries.starts.length} country entries`);

  // GeoLite2 columns: start, end, country, state1, state2, city, postcode,
  // latitude, longitude, timezone. Only three are taken. The coordinates are
  // deliberately dropped — see the header of scripts/geoip.mjs.
  const cities = partition(
    readRanges(cityText, parse, (f) => {
      if (f.length < 10) return null;
      const code = (f[2] ?? "").trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(code)) return null;
      return {
        country: code,
        region: (f[3] ?? "").trim(),
        city: (f[5] ?? "").trim(),
      };
    }),
    0n,
  );
  log(`  ${label}: ${cities.starts.length} city entries`);

  const combined = dedupe(
    merge(
      countries,
      cities,
      (country, place) => {
        // The CC0 table is authoritative for the country; GeoLite2 supplies it
        // only where whois has nothing. Region and city can only come from
        // GeoLite2, and are kept only when they agree with the country we
        // settled on — a city in the wrong country is worse than no city.
        const settled = country ?? place?.country ?? null;
        if (!settled) return null;
        const sameCountry = place && place.country === settled;
        return {
          country: settled,
          region: sameCountry ? place.region : "",
          city: sameCountry ? place.city : "",
        };
      },
      0n,
    ),
    (value) =>
      value ? `${value.country}\t${value.region}\t${value.city}` : " ",
  );
  log(`  ${label}: ${combined.starts.length} merged entries`);

  // Location id 0 is reserved for "nothing known here", so a gap and a real
  // place can never be confused by an off-by-one in the reader.
  const ids = new Uint32Array(combined.starts.length);
  for (let i = 0; i < combined.values.length; i += 1) {
    const value = combined.values[i];
    if (!value) continue;
    const key = `${value.country}\t${value.region}\t${value.city}`;
    let id = locations.get(key);
    if (id === undefined) {
      id = locations.size + 1;
      locations.set(key, id);
    }
    ids[i] = id;
  }

  return { starts: combined.starts, ids };
}

/** Pad to an 8-byte boundary so a BigUint64Array view is legal at any offset. */
const align = (n) => (n + 7) & ~7;

/**
 * Serialise to the format `scripts/geoip.mjs` reads.
 *
 * The header is JSON, uncompressed and at the front, so that anyone who finds
 * this file in a bucket in three years can read what it is and how it is laid
 * out without this script. Everything after it is typed-array data, which is
 * the entire point — the reader maps it and searches it as-is.
 */
export function serialise({ v4, v6, locations, sources }) {
  const blob = Buffer.from(
    ["", ...locations.keys()].join("\n"), // index 0 is the reserved empty slot
    "utf8",
  );

  const sections = {};
  let offset = 0;
  const place = (name, bytes) => {
    offset = align(offset);
    sections[name] = { offset, length: bytes };
    offset += bytes;
  };

  place("v4start", v4.starts.length * 4);
  place("v4loc", v4.ids.length * 4);
  place("v6words", v6.starts.length * 16);
  place("v6loc", v6.ids.length * 4);
  place("locations", blob.length);

  const header = Buffer.from(
    JSON.stringify({
      version: VERSION,
      builtAt: new Date().toISOString().slice(0, 10),
      // Typed arrays use the platform's byte order. Every target anyone will
      // run this on is little-endian, but recording it means a big-endian
      // reader fails loudly instead of returning nonsense countries.
      littleEndian: new Uint8Array(Uint32Array.of(1).buffer)[0] === 1,
      sources,
      counts: {
        v4: v4.starts.length,
        v6: v6.starts.length,
        locations: locations.size,
      },
      sections,
    }),
    "utf8",
  );

  const prologue = align(8 + header.length);
  const out = Buffer.alloc(prologue + offset);
  out.write(MAGIC, 0, "ascii");
  out.writeUInt32LE(header.length, 4);
  header.copy(out, 8);

  const at = (name) => prologue + sections[name].offset;

  const v4start = new Uint32Array(out.buffer, at("v4start"), v4.starts.length);
  for (let i = 0; i < v4.starts.length; i += 1)
    v4start[i] = Number(v4.starts[i]);
  new Uint32Array(out.buffer, at("v4loc"), v4.ids.length).set(v4.ids);

  // Four 32-bit words per address, most significant first, so a comparison is
  // four integer compares and never touches BigInt on the read path.
  const v6words = new Uint32Array(
    out.buffer,
    at("v6words"),
    v6.starts.length * 4,
  );
  for (let i = 0; i < v6.starts.length; i += 1) {
    v6words.set(wordsOf(v6.starts[i]), i * 4);
  }
  new Uint32Array(out.buffer, at("v6loc"), v6.ids.length).set(v6.ids);
  blob.copy(out, at("locations"));

  return out;
}

async function main({ dry }) {
  say("downloading sources");
  const [country4, country6, city4, city6] = await Promise.all([
    fetchSource("country4", SOURCES.country4),
    fetchSource("country6", SOURCES.country6),
    fetchSource("city4", SOURCES.city4),
    fetchSource("city6", SOURCES.city6),
  ]);

  const locations = new Map();
  say("merging");
  const v4 = buildFamily({
    countryText: country4,
    cityText: city4,
    parse: (text) => {
      const n = ipv4ToInt(text);
      return n === null ? null : BigInt(n);
    },
    label: "ipv4",
    locations,
    log: say,
  });
  const v6 = buildFamily({
    countryText: country6,
    cityText: city6,
    parse: ipv6ToBigInt,
    label: "ipv6",
    locations,
    log: say,
  });
  say(`  ${locations.size} distinct places`);

  const buffer = serialise({
    v4,
    v6,
    locations,
    sources: [
      {
        name: "@ip-location-db/geo-whois-asn-country",
        used: "country",
        licence: "CC0-1.0",
      },
      {
        name: "@ip-location-db/geolite2-city",
        used: "region, city",
        licence: "MaxMind GeoLite2 EULA (CC BY-SA 4.0 elements)",
        attribution:
          "This product includes GeoLite2 Data created by MaxMind, available from https://www.maxmind.com/",
      },
    ],
  });

  mkdirSync(cacheDir(), { recursive: true });
  const local = join(cacheDir(), ARTIFACT);
  await writeFile(local, buffer);
  say(`\nwrote ${local} (${(buffer.length / 1e6).toFixed(1)} MB)`);

  // Stored compressed and cached decompressed. The arrays are mostly ascending
  // integers, so this is a 4:1 saving on every download, and paying ~150ms to
  // gunzip once per week is cheaper than moving 40MB — but the read path wants
  // the raw bytes to make views over, so the local cache holds those.
  const packed = gzipSync(buffer, { level: 9 });
  const localGz = `${local}.gz`;
  await writeFile(localGz, packed);
  say(`packed to ${(packed.length / 1e6).toFixed(1)} MB`);

  if (dry) {
    say("--dry: not uploading");
    return;
  }

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
  const target = `s3://schoolskills-access-logs-${account}/geoip/${ARTIFACT}.gz`;

  // The `geoip/` prefix, not `cf/`. The 90-day expiry rule in sst.config.ts is
  // scoped to `cf/` precisely so that something kept here is not swept up by a
  // rule that was only ever about deleting IP addresses.
  say(`uploading → ${target}`);
  run("aws", [
    "s3",
    "cp",
    localGz,
    target,
    "--profile",
    PROFILE,
    "--only-show-errors",
  ]);
  say("done");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await main({ dry: process.argv.includes("--dry") });
  } catch (error) {
    console.error(`\n${error.message}`);
    process.exit(1);
  }
}
