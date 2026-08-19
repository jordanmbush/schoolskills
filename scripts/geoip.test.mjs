import { describe, expect, it } from "vitest";

import {
  buildFamily,
  dedupe,
  merge,
  partition,
  readRanges,
  serialise,
} from "./build-geoip.mjs";
import {
  ipv4ToInt,
  ipv6ToBigInt,
  ipv6ToWords,
  readArtifact,
} from "./geoip.mjs";

/**
 * The lookup is the one place in this pipeline where a wrong answer is
 * *plausible* rather than obviously broken. A miscounted page view shows up as
 * a number that looks odd; an off-by-one at a range boundary produces a
 * perfectly reasonable city for the wrong visitor, in a table nobody can check
 * against the raw lines once they expire.
 *
 * The suite is therefore built around a ROUND TRIP: the builder's serialiser
 * writes an artifact and the reader reads it back, in-process. That is the
 * only contract two files have to agree about — byte offsets, alignment,
 * word order, the reserved zero location — and it is the one that would fail
 * silently, because a misread artifact still returns countries. They just
 * belong to somebody else.
 */

const V4_LINE = (start, end, cc) => `${start},${end},${cc}`;
/** GeoLite2 has ten columns; only 2, 3 and 5 are read. */
const CITY_LINE = (start, end, cc, region, city) =>
  `${start},${end},${cc},${region},,${city},,0,0,UTC`;

/** Enough rows to clear `readRanges`'s "did this parse at all" floor. */
const FILLER = Array.from({ length: 200 }, (_, i) =>
  V4_LINE(`10.${i}.0.0`, `10.${i}.255.255`, "ZZ"),
);
const CITY_FILLER = Array.from({ length: 200 }, (_, i) =>
  CITY_LINE(`10.${i}.0.0`, `10.${i}.255.255`, "ZZ", "Filler", "Filler"),
);

const parse4 = (text) => {
  const n = ipv4ToInt(text);
  return n === null ? null : BigInt(n);
};

/** Build a one-family artifact and read it back, the way the real job would. */
const roundTrip = ({ country, city }) => {
  const locations = new Map();
  const v4 = buildFamily({
    countryText: [...country, ...FILLER].join("\n"),
    cityText: [...city, ...CITY_FILLER].join("\n"),
    parse: parse4,
    label: "test",
    locations,
  });
  // IPv6 still has to be present and empty-ish, because the reader makes views
  // over every section unconditionally.
  const v6 = buildFamily({
    countryText: Array.from(
      { length: 200 },
      (_, i) => `2001:${i.toString(16)}::,2001:${i.toString(16)}::ffff,ZZ`,
    ).join("\n"),
    cityText: Array.from({ length: 200 }, (_, i) =>
      CITY_LINE(
        `2001:${i.toString(16)}::`,
        `2001:${i.toString(16)}::ffff`,
        "ZZ",
        "Filler",
        "Filler",
      ),
    ).join("\n"),
    parse: ipv6ToBigInt,
    label: "test6",
    locations,
  });

  return readArtifact(
    serialise({ v4, v6, locations, sources: [{ name: "test" }] }),
  );
};

describe("ipv4ToInt", () => {
  it.each([
    ["0.0.0.0", 0],
    ["0.0.0.1", 1],
    ["255.255.255.255", 4294967295],
  ])("packs %s", (ip, n) => expect(ipv4ToInt(ip)).toBe(n));

  // `<<` is signed 32-bit in JavaScript, so a shift-based version returns
  // -1408237567 here — which sorts below every address in the table and makes
  // half the internet unfindable rather than throwing.
  it("keeps the top half of the space positive", () =>
    expect(ipv4ToInt("172.217.0.1")).toBe(2899902465));

  it.each(["1.2.3", "1.2.3.4.5", "1.2.3.256", "1.2.3.x", "", "not-an-ip"])(
    "refuses %s",
    (ip) => expect(ipv4ToInt(ip)).toBeNull(),
  );
});

describe("ipv6ToWords", () => {
  it("expands ::", () => expect(ipv6ToWords("::")).toEqual([0, 0, 0, 0]));

  it("expands ::1", () => expect(ipv6ToWords("::1")).toEqual([0, 0, 0, 1]));

  it("packs two groups per word", () =>
    expect(ipv6ToWords("2001:4860:4860::8888")).toEqual([
      0x20014860, 0x48600000, 0, 0x8888,
    ]));

  // `<<` again: the top word of any address starting above 7fff would go
  // negative, and every comparison against it would then be backwards.
  it("keeps a high leading word positive", () =>
    expect(ipv6ToWords("ffff::")[0]).toBe(0xffff0000));

  // A dual-stack host can present its address this way, and dropping it would
  // silently file those visitors as unknown.
  it("reads the embedded-IPv4 form", () =>
    expect(ipv6ToWords("::ffff:203.0.113.9")).toEqual([
      0,
      0,
      0xffff,
      ipv4ToInt("203.0.113.9"),
    ]));

  it.each(["1.2.3.4", "2001::db8::1", "2001:db8:1", "zzzz::1", ""])(
    "refuses %s",
    (ip) => expect(ipv6ToWords(ip)).toBeNull(),
  );

  it("agrees with the BigInt form the builder sorts on", () =>
    expect(ipv6ToBigInt("2001:db8::1")).toBe(
      ipv6ToWords("2001:db8::1").reduce((a, w) => (a << 32n) | BigInt(w), 0n),
    ));
});

describe("partition", () => {
  // The invariant the reader's binary search depends on: every address is
  // inside exactly one entry, so a lookup never has to ask a second question.
  it("fills the gaps between ranges with an explicit nothing", () => {
    const { starts, values } = partition(
      [
        [10n, 20n, "A"],
        [30n, 40n, "B"],
      ],
      0n,
    );
    expect(starts).toEqual([0n, 10n, 21n, 30n]);
    expect(values).toEqual([null, "A", null, "B"]);
  });

  it("drops a range wholly inside one already claimed", () => {
    const { values } = partition(
      [
        [0n, 100n, "A"],
        [10n, 20n, "B"],
      ],
      0n,
    );
    expect(values).toEqual(["A"]);
  });
});

describe("merge", () => {
  // The point of the merge: a boundary in either input must survive into the
  // result, or one of the two databases silently loses resolution.
  it("splits at every boundary either side has", () => {
    const a = { starts: [0n, 50n], values: ["a1", "a2"] };
    const b = { starts: [0n, 20n, 70n], values: ["b1", "b2", "b3"] };
    const { starts, values } = merge(a, b, (x, y) => `${x}+${y}`, 0n);
    expect(starts).toEqual([0n, 20n, 50n, 70n]);
    expect(values).toEqual(["a1+b1", "a1+b2", "a2+b2", "a2+b3"]);
  });
});

describe("dedupe", () => {
  it("collapses a run of identical values", () => {
    const { starts } = dedupe(
      { starts: [0n, 10n, 20n, 30n], values: ["A", "A", "B", "B"] },
      (v) => v,
    );
    expect(starts).toEqual([0n, 20n]);
  });
});

describe("readRanges", () => {
  const pick = (f) => (/^[A-Z]{2}$/.test(f[2] ?? "") ? f[2] : null);

  it("sorts a file that arrived out of order", () => {
    const ranges = readRanges(
      [
        V4_LINE("9.0.0.0", "9.0.0.255", "GB"),
        V4_LINE("2.0.0.0", "2.0.0.255", "FR"),
        ...FILLER,
      ].join("\n"),
      parse4,
      pick,
    );
    expect(ranges[0][2]).toBe("FR");
  });

  it("skips a malformed row without taking the build down", () =>
    expect(() =>
      readRanges(
        [V4_LINE("1.0.0.0", "1.0.0.255", "AU"), "garbage", ...FILLER].join(
          "\n",
        ),
        parse4,
        pick,
      ),
    ).not.toThrow());

  // Loud, on the same reasoning as the rollup's empty-directory throw: a source
  // that parsed to nothing would answer every lookup "(unknown)", which is a
  // shape of failure that reads as a finding.
  it("refuses a file that parsed to nothing", () =>
    expect(() => readRanges("nonsense\nmore nonsense", parse4, pick)).toThrow(
      /did not parse/,
    ));

  it("refuses a file that mostly did not parse", () =>
    expect(() =>
      readRanges(
        [...FILLER, ...Array(50).fill("truncat")].join("\n"),
        parse4,
        pick,
      ),
    ).toThrow(/did not parse/));
});

describe("an artifact, written and read back", () => {
  const geo = roundTrip({
    country: [
      V4_LINE("1.0.0.0", "1.0.0.255", "AU"),
      V4_LINE("3.0.0.0", "3.0.255.255", "DE"),
    ],
    city: [
      CITY_LINE("1.0.0.0", "1.0.0.255", "AU", "New South Wales", "Sydney"),
      CITY_LINE("3.0.0.0", "3.0.0.255", "DE", "Berlin", "Berlin"),
    ],
  });

  it("finds a place inside a range", () =>
    expect(geo.lookup("1.0.0.128")).toEqual({
      country: "AU",
      region: "New South Wales",
      city: "Sydney",
    }));

  // Both ends are inclusive in the source format, and an exclusive read of
  // either would misplace exactly the addresses at a boundary — the least
  // likely thing for anyone to notice.
  it("includes both ends of a range", () => {
    expect(geo.lookup("1.0.0.0").city).toBe("Sydney");
    expect(geo.lookup("1.0.0.255").city).toBe("Sydney");
  });

  it("returns nothing for an address no source covers", () =>
    expect(geo.lookup("2.0.0.1")).toBeNull());

  // The whole reason the country comes from the CC0 table: the city source
  // covers only the first /24 of the German range, and the rest must still be
  // Germany rather than falling into a hole.
  it("keeps the country where only the city source runs out", () =>
    expect(geo.lookup("3.0.128.1")).toEqual({
      country: "DE",
      region: null,
      city: null,
    }));

  it("reserves location id 0 so a gap can never read as a place", () =>
    expect(geo.lookup("0.0.0.1")).toBeNull());

  it("carries its build date and source list", () => {
    expect(geo.builtAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(geo.stale).toBeNull();
  });

  it("searches IPv6 through the same artifact", () =>
    expect(geo.lookup("2001:5::1")).toEqual({
      country: "ZZ",
      region: "Filler",
      city: "Filler",
    }));

  it("refuses bytes that are not an artifact", () =>
    expect(() => readArtifact(Buffer.from("not an artifact at all"))).toThrow(
      /bad magic/,
    ));

  // A Buffer from `readFile` can be a view into a shared pool at any byte
  // offset, and a Uint32Array view demands alignment. This is the case that
  // would work on every machine until the day it didn't.
  it("reads correctly from a misaligned buffer", () => {
    const source = serialise({
      v4: roundTripParts().v4,
      v6: roundTripParts().v6,
      locations: roundTripParts().locations,
      sources: [],
    });
    const padded = Buffer.alloc(source.length + 1);
    source.copy(padded, 1);
    expect(readArtifact(padded.subarray(1)).lookup("1.0.0.128").city).toBe(
      "Sydney",
    );
  });
});

/** The pieces of the fixture above, for the alignment case. */
function roundTripParts() {
  const locations = new Map();
  const v4 = buildFamily({
    countryText: [V4_LINE("1.0.0.0", "1.0.0.255", "AU"), ...FILLER].join("\n"),
    cityText: [
      CITY_LINE("1.0.0.0", "1.0.0.255", "AU", "New South Wales", "Sydney"),
      ...CITY_FILLER,
    ].join("\n"),
    parse: parse4,
    label: "test",
    locations,
  });
  const v6 = buildFamily({
    countryText: Array.from(
      { length: 200 },
      (_, i) => `2001:${i.toString(16)}::,2001:${i.toString(16)}::ffff,ZZ`,
    ).join("\n"),
    cityText: Array.from({ length: 200 }, (_, i) =>
      CITY_LINE(
        `2001:${i.toString(16)}::`,
        `2001:${i.toString(16)}::ffff`,
        "ZZ",
        "Filler",
        "Filler",
      ),
    ).join("\n"),
    parse: ipv6ToBigInt,
    label: "test6",
    locations,
  });
  return { v4, v6, locations };
}
