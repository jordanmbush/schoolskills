import { describe, expect, it } from "vitest";

import { beaconUrl, deckLabel } from "./analytics";
import { WORD_LISTS } from "@/engine/decks/wordlists";
import { wordMode } from "@/engine/decks/words";

/**
 * These are privacy tests wearing the clothes of unit tests.
 *
 * Everything this file guards ends up in a CloudFront access log next to an IP
 * address, kept for thirty days. The failure mode is not a crash — it is a
 * beacon that quietly carries a child's name, a spelling word or a per-
 * household deck id, and nobody noticing until someone reads the logs.
 */
describe("what a beacon is allowed to say", () => {
  it("names a shipped deck, because a shipped deck is a public list", () => {
    // Knowing that someone practised "dolch-1" says something about the site,
    // not about them: everyone who picks that list produces the same string.
    for (const list of WORD_LISTS) {
      expect(deckLabel(wordMode(list.id))).toBe(`words:${list.id}`);
    }
    for (const op of ["add", "subtract", "multiply", "divide"]) {
      expect(deckLabel(op)).toBe(op);
    }
  });

  it("collapses a parent's own deck to 'custom'", () => {
    // The one that matters. A custom deck's id is generated per household and
    // would recur in the logs week after week beside the same IP — a tracking
    // identifier by any other name, and exactly what /privacy says we don't
    // ship.
    expect(deckLabel("words:d_msvczpew94bi81")).toBe("custom");
    expect(deckLabel("words:week-12")).toBe("custom");
    expect(deckLabel("words:Spellings for Ada")).toBe("custom");
  });

  it("collapses a mode from a build that no longer exists", () => {
    // Sessions outlive the decks they were played on, so an unknown mode is a
    // normal thing to meet rather than a bug. It must not become a label.
    expect(deckLabel("some-future-game:level-3")).toBe("custom");
    expect(deckLabel("")).toBe("custom");
  });

  it("puts nothing in the URL that wasn't declared in the event", () => {
    const url = beaconUrl(
      { event: "race_start", deck: "multiply", input: "type" },
      1,
    );
    const params = new URL(url, "https://schoolskills.app").searchParams;
    expect([...params.keys()].sort()).toEqual(["deck", "e", "input", "n"]);
  });

  it("gives each beacon a distinct URL so it isn't answered from cache", () => {
    // Without this the second identical event never reaches CloudFront, no log
    // line exists, and the count is silently wrong rather than loudly broken.
    const one = beaconUrl({ event: "deck_saved" }, 1);
    const two = beaconUrl({ event: "deck_saved" }, 2);
    expect(one).not.toBe(two);
  });

  it("counts rather than timestamps, so events can't be correlated", () => {
    // A millisecond timestamp would let two beacons from one visitor be
    // stitched together in the logs. A small ordinal can't.
    const url = beaconUrl({ event: "profile_added" }, 3);
    expect(url).toContain("n=3");
    expect(url).not.toMatch(/\d{10,}/);
  });

  it("escapes anything that reaches the query string", () => {
    // deckLabel is the gate, but a URL built from unescaped input is its own
    // class of bug — an "&" in a value would silently invent a parameter.
    const url = beaconUrl(
      { event: "race_end", deck: deckLabel("a&b=c"), outcome: "quit" },
      1,
    );
    expect(url).toBe("/_e/px.gif?e=race_end&deck=custom&outcome=quit&n=1");
  });

  it("stays on our own origin", () => {
    // The whole point. A relative path is a request to schoolskills.app and
    // nowhere else — no DNS lookup a parent could not account for.
    expect(beaconUrl({ event: "deck_saved" }, 1).startsWith("/_e/")).toBe(true);
  });
});
