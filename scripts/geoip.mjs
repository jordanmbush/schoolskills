#!/usr/bin/env node
/**
 * Turn the IP address on a log line into a place, without telling anyone.
 *
 * The access logs already carry `c-ip` — the visitor's own address, not the
 * edge's — and `scripts/rollup-analytics.mjs` already reads it to count
 * distinct visitors. This module is how that address becomes a country, a
 * region and a city.
 *
 * ⚠️ **The lookup is arithmetic on this machine, and that is the entire
 * point.** The obvious way to geolocate an address is to ask a geo-IP API,
 * which would mean sending a child's IP address to a third party — the exact
 * thing /privacy promises does not happen, and under COPPA a step change
 * rather than a feature. Instead a prepared table is downloaded from our own
 * bucket and searched locally. Nobody is asked anything about anybody.
 *
 * ## This is the read half only
 *
 * `scripts/build-geoip.mjs` does the downloading, merging, sorting and
 * flattening, once, and puts one binary artifact in S3. Everything here does is
 * fetch that artifact and binary-search it. There is deliberately no CSV
 * parsing, no sorting and no allocation on this path: the arrays below are
 * views straight onto the downloaded bytes, so a cold start is a download and
 * a warm one is a file read.
 *
 * ## What is deliberately NOT taken
 *
 * The GeoLite2 source carries latitude, longitude and postcode. None of them
 * are in the artifact and none should be added. A coordinate pair is a
 * different kind of fact about a child than a city name, and the accuracy is
 * not there to justify it either — the single most common coordinate in the
 * source is MaxMind's "somewhere in the United States" fallback, which nearly
 * a hundred thousand ranges point at. That fallback is how a Kansas farm ended
 * up on the receiving end of years of harassment from people who believed a
 * database when it said it knew where somebody was. City names inherit the
 * same fallback problem, which is why `city` is empty rather than guessed when
 * the source doesn't actually know.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Bumped when the binary layout changes; the reader refuses anything else. */
export const VERSION = 1;
export const MAGIC = "SSG1";
export const ARTIFACT = "geoip.bin";

/** A sibling of the log cache, so the two are cleaned up together. */
export const cacheDir = () => join(tmpdir(), "schoolskills-geoip");

/**
 * How old an artifact may be before the reader says something.
 *
 * Not an expiry — a stale table still answers, and losing a month of counts
 * because nobody re-ran a build would be the worse failure. But the GeoLite2
 * licence requires that local copies keep updating so MaxMind's Do Not Sell
 * requests propagate, so an artifact this old means the refresh has stopped
 * and somebody needs to know. See scripts/build-geoip.mjs.
 */
const STALE_DAYS = 45;

const PROFILE = process.env.AWS_PROFILE ?? "schoolskills";

/**
 * A dotted quad as a number. `null` for anything that isn't one.
 *
 * Multiplication rather than `<<`, because `<<` is a signed 32-bit operation
 * in JavaScript and every address from 128.0.0.0 up would come out negative —
 * which sorts and compares wrongly rather than failing.
 */
export const ipv4ToInt = (text) => {
  const parts = String(text).trim().split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    out = out * 256 + octet;
  }
  return out;
};

/**
 * An IPv6 address as four 32-bit words, most significant first.
 *
 * Words rather than a BigInt because this is the read path: comparing four
 * plain integers is several times faster than comparing BigInts, and the
 * artifact stores them in exactly this shape so no conversion happens at all.
 *
 * Handles the two forms that actually appear: `::` compression, and the
 * embedded-IPv4 tail (`::ffff:203.0.113.9`) a dual-stack host can present.
 */
export const ipv6ToWords = (text) => {
  let value = String(text).trim().toLowerCase();
  if (!value.includes(":")) return null;

  // Fold a dotted tail into two hex groups first, so everything below only has
  // to think in groups of sixteen bits.
  const dotted = /:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (dotted) {
    const packed = ipv4ToInt(dotted[1]);
    if (packed === null) return null;
    const high = Math.floor(packed / 0x10000).toString(16);
    const low = (packed % 0x10000).toString(16);
    value = `${value.slice(0, dotted.index + 1)}${high}:${low}`;
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

  let groups;
  if (halves.length === 1) {
    if (head.length !== 8) return null;
    groups = head;
  } else {
    const gap = 8 - head.length - tail.length;
    if (gap < 0) return null;
    groups = [...head, ...Array(gap).fill("0"), ...tail];
  }

  const words = new Array(4).fill(0);
  for (let i = 0; i < 8; i += 1) {
    const group = groups[i];
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    const half = parseInt(group, 16);
    // Two 16-bit groups per 32-bit word, and `>>> 0` because `<<` would make
    // any word with its top bit set negative.
    words[i >> 1] = i % 2 === 0 ? half * 0x10000 : (words[i >> 1] + half) >>> 0;
  }
  return words;
};

/** The same address as a BigInt — used by the builder, never on the read path. */
export const ipv6ToBigInt = (text) => {
  const words = ipv6ToWords(text);
  if (words === null) return null;
  let out = 0n;
  for (const word of words) out = (out << 32n) | BigInt(word);
  return out;
};

/**
 * The rightmost entry starting at or before `key`.
 *
 * Exact because the artifact is a PARTITION rather than a list of ranges:
 * every address falls inside exactly one entry, gaps included, so there is no
 * second question to ask once the index is found. `compare` is what lets one
 * search serve both address families.
 */
const search = (starts, count, key, compare) => {
  let low = 0;
  let high = count - 1;
  let found = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (compare(starts, mid, key) <= 0) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
};

const compare4 = (starts, index, key) =>
  starts[index] < key ? -1 : starts[index] > key ? 1 : 0;

const compare6 = (words, index, key) => {
  const at = index * 4;
  for (let i = 0; i < 4; i += 1) {
    if (words[at + i] < key[i]) return -1;
    if (words[at + i] > key[i]) return 1;
  }
  return 0;
};

/**
 * Fetch the artifact from S3 unless a fresh enough copy is already here.
 *
 * `aws s3 cp` rather than `fetch`, because the bucket is private and must stay
 * that way — it is the same bucket the access logs live in.
 */
function ensureArtifact({ maxAgeMs }) {
  mkdirSync(cacheDir(), { recursive: true });
  const path = join(cacheDir(), ARTIFACT);

  const age = existsSync(path) ? Date.now() - statSync(path).mtimeMs : Infinity;
  if (age <= maxAgeMs) return path;

  let account;
  try {
    account = execFileSync(
      "aws",
      [
        "sts",
        "get-caller-identity",
        "--query",
        "Account",
        "--output",
        "text",
        "--profile",
        PROFILE,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  } catch (error) {
    throw new Error(
      `Could not reach AWS as profile "${PROFILE}".\n` +
        `${String(error.stderr ?? error.message).trim()}\n` +
        `If the session has expired: aws sso login --profile ${PROFILE}`,
      { cause: error },
    );
  }

  const source = `s3://schoolskills-access-logs-${account}/geoip/${ARTIFACT}.gz`;
  const packed = `${path}.gz`;
  try {
    execFileSync(
      "aws",
      ["s3", "cp", source, packed, "--profile", PROFILE, "--only-show-errors"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    throw new Error(
      `Could not fetch ${source}\n` +
        `${String(error.stderr ?? error.message).trim()}\n` +
        "If the artifact has never been built:  npm run analytics:geoip",
      { cause: error },
    );
  }

  // Written via `.part` and renamed, because a half-written artifact cached
  // under the real name would be treated as fresh for the next week and would
  // fail the magic check on every run until somebody deleted it by hand.
  writeFileSync(`${path}.part`, gunzipSync(readFileSync(packed)));
  renameSync(`${path}.part`, path);
  rmSync(packed, { force: true });
  return path;
}

/**
 * The front door: a `{ lookup }` the rollup can hand an address to.
 *
 * Throws if the artifact can't be had — the caller decides whether that is
 * fatal. In the rollup it is not: a run with no place data omits those fields
 * entirely rather than recording every visitor as unknown, because an absent
 * key means "not looked up" and a present one full of `(unknown)` would be a
 * lie that looks like a measurement.
 */
export async function placeLookup({ maxAgeMs = 7 * 86400000 } = {}) {
  const path = ensureArtifact({ maxAgeMs });
  return readArtifact(await readFile(path), path);
}

/**
 * Turn artifact bytes into a `{ lookup }`, with no filesystem involved.
 *
 * Separate from `placeLookup` so the binary layout can be tested against the
 * builder that writes it, in-process, without a bucket. That contract is the
 * one thing here that two files have to agree about, so it is the one thing
 * worth pinning with a round trip.
 */
export function readArtifact(input, path = "<buffer>") {
  // A Buffer from `readFile` can be a view into a shared pool at an arbitrary
  // byte offset, and a Uint32Array view demands 4-byte alignment. Copying only
  // when that bites keeps the common case zero-copy and stops the uncommon one
  // from being a crash that appears at random.
  const file = input.byteOffset % 8 === 0 ? input : Buffer.from(input);

  if (file.length < 8 || file.toString("ascii", 0, 4) !== MAGIC) {
    throw new Error(
      `${path} is not a geo-IP artifact (bad magic).\n` +
        "A truncated download would do this. Delete it and re-run:\n" +
        `  rm -f ${path}`,
    );
  }

  const headerLength = file.readUInt32LE(4);
  const header = JSON.parse(file.toString("utf8", 8, 8 + headerLength));
  if (header.version !== VERSION) {
    throw new Error(
      `artifact is format v${header.version}, this reader speaks v${VERSION}.\n` +
        "Rebuild it:  npm run analytics:geoip",
    );
  }
  if (
    header.littleEndian !==
    (new Uint8Array(Uint32Array.of(1).buffer)[0] === 1)
  ) {
    throw new Error(
      "artifact was built on a machine of the opposite byte order",
    );
  }

  const prologue = (8 + headerLength + 7) & ~7;
  const view = (name, Type, per) => {
    const { offset, length } = header.sections[name];
    return new Type(
      file.buffer,
      file.byteOffset + prologue + offset,
      length / per,
    );
  };

  const v4start = view("v4start", Uint32Array, 4);
  const v4loc = view("v4loc", Uint32Array, 4);
  const v6words = view("v6words", Uint32Array, 4);
  const v6loc = view("v6loc", Uint32Array, 4);

  const { offset, length } = header.sections.locations;
  const places = file
    .toString("utf8", prologue + offset, prologue + offset + length)
    .split("\n")
    .map((line) => {
      if (!line) return null;
      const [country, region, city] = line.split("\t");
      return { country, region: region || null, city: city || null };
    });

  const builtAt = header.builtAt;
  const ageDays = Math.floor(
    (Date.now() - Date.parse(`${builtAt}T00:00:00Z`)) / 86400000,
  );

  return {
    builtAt,
    stale: ageDays > STALE_DAYS ? ageDays : null,
    places: header.counts.locations,
    ranges: header.counts.v4 + header.counts.v6,
    /** `{ country, region, city }` — region and city may be null. */
    lookup(ip) {
      if (!ip) return null;
      const text = String(ip).trim();
      if (text.includes(":")) {
        const key = ipv6ToWords(text);
        if (key === null) return null;
        return places[v6loc[search(v6words, v6loc.length, key, compare6)]];
      }
      const key = ipv4ToInt(text);
      if (key === null) return null;
      return places[v4loc[search(v4start, v4start.length, key, compare4)]];
    },
  };
}
