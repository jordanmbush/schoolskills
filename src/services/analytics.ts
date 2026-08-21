/**
 * Counting what happens, without learning who it happened to.
 *
 * The privacy page promises parents no analytics script, no cookies, no
 * third-party requests and nothing that follows a child anywhere. Measurement
 * here is the only kind that keeps every sentence of that true: ordinary
 * requests to our own CDN, read back out of the access logs it already writes.
 * `docs/analytics.md` covers reading them, and points back here for the rest.
 *
 * ── Why a GIF and not a real analytics call ─────────────────────────────────
 * There is no origin server, and nothing here accepts a POST — so
 * `navigator.sendBeacon`, which only sends POST, has nowhere to go. What
 * CloudFront *does* do for every request is write a log line containing the
 * path and the query string. So an event is a GET for a 43-byte transparent
 * GIF with the event in its query string: no JavaScript from anyone else, no
 * cookie, no identifier, no response worth reading, and the measurement is a
 * side effect of a request the CDN was going to log anyway.
 *
 * ── What is deliberately NOT here ───────────────────────────────────────────
 * No visitor id, no session id and no first-seen timestamp. Under COPPA a
 * persistent identifier IS personal information collected from a child, so
 * inventing one is the exact thing the privacy page says we don't do. "Unique
 * visitors" therefore comes from the logs' own IP column, in aggregate, at
 * query time — approximate on purpose. A household behind one router counts
 * once; a phone that changes network counts twice. That is the right trade for
 * a site whose audience is children.
 *
 * ── The event type is the safety mechanism ──────────────────────────────────
 * `Beacon` is a closed union rather than `track(name, props)`. Every field is
 * named here, so a future change cannot casually attach a profile name, an
 * age, a spelling word or a custom deck's id — the last of which is generated
 * per household and would be a tracking identifier in all but name. A new
 * event's new property gets added to this file, where the reviewer looking for
 * exactly that mistake will see it.
 */

import { OPERATION_ORDER } from "@/engine/decks/flashcards";
import { TYPING_LEVELS, typingMode } from "@/engine/decks/typing";
import { SHIPPED_LISTS } from "@/engine/decks/wordlists";
import { wordMode } from "@/engine/decks/words";

/** Where the beacon lands. Excluded from the service worker — see `public/sw.js`. */
const ENDPOINT = "/_e/px.gif";

/**
 * The complete set of things we measure, and every property they carry.
 *
 * Deliberately coarse. Which world a child is in is already visible from the
 * page they requested (`/flash-cards`, `/spelling/play`, `/typing`), so these
 * exist only for what a URL cannot show: whether a race was actually finished,
 * how it was answered, and whether the parent-authored deck feature is used at
 * all.
 */
export type Beacon =
  | {
      event: "race_start";
      /** Shipped deck id, or "custom" — never a household's own deck id. */
      deck: string;
      input: "type" | "choose";
    }
  | {
      event: "race_end";
      deck: string;
      /** Whether they played it out or left partway. */
      outcome: "finished" | "quit";
    }
  | { event: "deck_saved" }
  | { event: "profile_added" };

/**
 * Ids we are willing to put in a log line.
 *
 * Shipped decks are a fixed, public list, so naming one says nothing about a
 * household — everyone who picks "dolch-1" produces the same string. Anything
 * else — a parent's own deck, a mode from a build that no longer exists —
 * collapses to "custom", because a generated id that recurs in a log across
 * weeks is a tracking identifier however innocently it arrived.
 *
 * Built FROM the shipped registries rather than written out here: a list that
 * has to be kept in step with another list won't be, and the failure is silent
 * — a shipped deck reported as somebody's private one.
 *
 * `SHIPPED_LISTS` and not `WORD_LISTS`, for the same reason. `WORD_LISTS` is
 * Dolch alone — the typing pools, the age lookup and the spelling shelf all
 * legitimately mean that — while the shelf a child can actually pick from is
 * the whole of it, Bible lists included.
 */
const SHIPPED: ReadonlySet<string> = new Set<string>([
  ...OPERATION_ORDER,
  ...SHIPPED_LISTS.map((list) => wordMode(list.id)),
  ...TYPING_LEVELS.map((level) => typingMode(level.id)),
]);

export const deckLabel = (mode: string): string =>
  SHIPPED.has(mode) ? mode : "custom";

/**
 * Builds the URL for an event. Pure, so the rules above can be tested.
 *
 * The cache-buster is load-bearing rather than habit: without a unique URL the
 * browser would answer the second identical event from its own cache, the
 * request would never reach CloudFront, and the log line would not exist. It
 * is a counter, not a random value and not a timestamp — both of those would
 * be usable to correlate one visitor's events with each other.
 */
export function beaconUrl(beacon: Beacon, nth: number): string {
  const params = new URLSearchParams({ e: beacon.event });
  for (const [key, value] of Object.entries(beacon)) {
    if (key !== "event") params.set(key, String(value));
  }
  params.set("n", String(nth));
  return `${ENDPOINT}?${params.toString()}`;
}

let counter = 0;

/**
 * Records an event. Never throws, never blocks, never reports failure.
 *
 * A race is on a clock. Measurement is the least important thing happening on
 * this screen, so it gets no error handling, no retry and no await — if the
 * request is lost to a flaky network or a blocked request, the number is
 * slightly low and nothing else changes. An analytics call that can break a
 * spelling card has the priorities backwards.
 */
export function count(beacon: Beacon): void {
  if (typeof document === "undefined") return;
  try {
    // An Image avoids fetch's CORS and keepalive semantics entirely, and is
    // the one request kind that reliably survives the page going away.
    new Image().src = beaconUrl(beacon, (counter += 1));
  } catch {
    // Deliberately silent. See above.
  }
}
