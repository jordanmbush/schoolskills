import { describe, expect, it } from "vitest";

import { keyX, strokeFor } from "@/engine/keyboard";
import { fire, startStorm, tick } from "@/engine/typing/storm";

import { soundsFor } from "./stormSounds";

import type { StormLetter, StormState, WaveSpec } from "@/engine/typing/storm";

/**
 * What a storm sounds like (docs/typing.md §8.12).
 *
 * The whole point of `soundsFor` being a diff over two states is that this can
 * be asked without a mixer, a browser or a clock: every run below is built
 * from `fire` and `tick` — the same two functions the game is played through —
 * and the assertion is on the list of names that comes back. Nothing here
 * stubs `sfx`, because nothing here calls it; `playStormSounds` is a `switch`
 * over exactly these names and has no decision left in it.
 */

/** One letter, placed by hand, off the same board the game is played on. */
const at = (ch: string, spawnMs: number, fallMs: number): StormLetter => {
  const stroke = strokeFor(ch);
  if (!stroke || stroke.finger === "thumb")
    throw new Error(`${ch} cannot fall`);
  return {
    ch,
    code: stroke.code,
    finger: stroke.finger,
    lane: keyX(stroke.code) ?? 0,
    spawnMs,
    fallMs,
    // No queue: a hand-placed letter falls the instant it appears, so every
    // absolute moment below is the one the test wrote down. The beat a real
    // wave gives a letter (`QUEUE_MS`) is `buildWave`'s, and it belongs to the
    // tests of the schedule rather than to every test of what a landing costs.
    dropMs: spawnMs,
    landMs: spawnMs + fallMs,
  };
};

const runOf = (letters: StormLetter[], over: Partial<WaveSpec> = {}) =>
  startStorm({
    spec: {
      keys: ["f", "j"],
      count: letters.length,
      gap: [100, 100],
      fall: [1000, 1000],
      shield: 2,
      repairAt: 0,
      ...over,
    },
    seed: 11,
    letters,
    durationMs: letters.reduce((last, l) => Math.max(last, l.landMs), 0),
  });

/**
 * The same wave with a letter added far enough out that the run cannot end.
 *
 * A wave is `cleared` the instant its last letter is accounted for, however
 * that letter went (`settled`) — so a one-letter run announces its own ending
 * on the same frame as the thing under test, and every assertion below about
 * a shot or a crunch would be an assertion about the ending as well. This is
 * how a test says "the run is still going", and the tests that ARE about the
 * ending do not use it.
 */
const stillFalling = (letters: StormLetter[], over: Partial<WaveSpec> = {}) =>
  runOf([...letters, at("j", 60_000, 1000)], over);

/** Advance a run and say what it sounded like on the way. */
const heardOnTick = (state: StormState, dtMs: number) => {
  const next = tick(state, dtMs);
  return { next, sounds: soundsFor(state, next) };
};

/** Press a key and say what it sounded like. */
const heardOnKey = (state: StormState, code: string) => {
  const next = fire(state, code);
  return { next, sounds: soundsFor(state, next) };
};

describe("a stroke is heard as the shot plus its answer", () => {
  it("plays the trigger and then the stone, in that order", () => {
    // The shot first: a stroke's own sound must never arrive after the sound
    // of what it did.
    const mid = tick(stillFalling([at("f", 0, 1000)]), 300);
    expect(heardOnKey(mid, "KeyF").sounds).toEqual(["shoot", "hit"]);
  });

  it("plays the trigger and then the miss, for a wrong key", () => {
    const mid = tick(stillFalling([at("f", 0, 1000)]), 300);
    expect(heardOnKey(mid, "KeyJ").sounds).toEqual(["shoot", "miss"]);
  });

  it("plays the trigger and a miss at an empty sky", () => {
    // Nothing is falling at 50ms into a wave whose first letter spawns at 200,
    // and a stroke into that costs ten points like any other (§8.6). What it
    // must not do is sound like a hit, or sound like nothing at all.
    const early = tick(stillFalling([at("f", 200, 1000)]), 50);
    expect(heardOnKey(early, "KeyF").sounds).toEqual(["shoot", "miss"]);
  });

  it("is silent for a stroke the rules refuse", () => {
    // `fire` on an ended run returns the state it was handed. The gun is
    // already dead by then (`useStormClock`), so this is the belt to that
    // brace rather than a case the screen can reach.
    const done = tick(runOf([at("f", 0, 1000)]), 5000);
    expect(done.ending).not.toBeNull();
    expect(heardOnKey(done, "KeyF").sounds).toEqual([]);
  });

  it("says nothing on a frame where nothing happened", () => {
    // Sixty of these a second, and the reason `soundsFor` compares the shield
    // by identity before it compares its eight zones.
    const mid = tick(stillFalling([at("f", 0, 1000)]), 300);
    expect(heardOnTick(mid, 16).sounds).toEqual([]);
  });
});

describe("a letter that gets through is heard on the shield", () => {
  it("crunches once when armour takes it", () => {
    // Shield of 2, one letter: the zone goes to 1, which is damage and not a
    // hole.
    const run = stillFalling([at("f", 0, 1000)], { shield: 2 });
    expect(heardOnTick(run, 1000).sounds).toEqual(["shieldHit"]);
  });

  it("cracks when that was the zone's last point", () => {
    // The second letter on the same finger empties it. Louder than the first,
    // and instead of it rather than on top of it.
    const run = stillFalling([at("f", 0, 1000), at("f", 100, 1000)], {
      shield: 2,
    });
    const first = heardOnTick(run, 1000);
    expect(first.sounds).toEqual(["shieldHit"]);
    expect(heardOnTick(first.next, 100).sounds).toEqual(["shieldBreak"]);
  });

  it("is one sound however many letters a single tick lands", () => {
    // A backgrounded tab hands the loop a second of wave at once, and a dozen
    // crunches inside one frame says nothing about which zone or how many —
    // the same reasoning that makes several landings on one zone a single
    // tint (§8.10, decision 42).
    const many = stillFalling(
      Array.from({ length: 4 }, (_, i) => at("f", i * 20, 1000)),
      { shield: 9 },
    );
    const heard = heardOnTick(many, 1100);
    expect(heard.next.shield["l-index"]).toBe(5);
    expect(heard.sounds).toEqual(["shieldHit"]);
  });
});

describe("the end of a run says which end it was", () => {
  it("breaches without a crunch under it", () => {
    // The fatal landing damages nothing — the zone it fell on was already a
    // hole — so a breach is never a crunch followed by a breach.
    const run = runOf([at("f", 0, 1000)], { shield: 0 });
    expect(heardOnTick(run, 1000).sounds).toEqual(["breach"]);
  });

  it("clears when the last letter is shot", () => {
    const mid = tick(runOf([at("f", 0, 1000)]), 300);
    expect(heardOnKey(mid, "KeyF").sounds).toEqual(["shoot", "hit", "cleared"]);
  });

  it("announces an ending exactly once", () => {
    // `ending` is stamped once and then left alone, so every frame after it is
    // silent — which is what stops a frozen field from playing the same
    // fanfare sixty times a second.
    const run = runOf([at("f", 0, 1000)], { shield: 0 });
    const dead = heardOnTick(run, 1000);
    expect(heardOnTick(dead.next, 16).sounds).toEqual([]);
  });
});

describe("a mended zone is not a damaged one", () => {
  it("stays quiet when a streak puts a point back", () => {
    // Every second clean hit repairs the weakest zone (§8.5). The shield
    // object changes on that frame, and a diff that only asked whether it had
    // would hear armour growing back as armour breaking.
    // An `f` gets through first, so the left index zone is genuinely down a
    // point and there is something for the repair to put back. Without that
    // the zones are all at the cap, `repaired` hands the same shield back, and
    // this test passes without ever exercising the case.
    const run = stillFalling(
      [at("f", 0, 1000), at("j", 1200, 1000), at("j", 1300, 1000)],
      { shield: 2, repairAt: 2 },
    );
    const landed = heardOnTick(run, 1000);
    expect(landed.sounds).toEqual(["shieldHit"]);
    expect(landed.next.shield["l-index"]).toBe(1);

    const airborne = tick(landed.next, 400);
    const hit = heardOnKey(airborne, "KeyJ");
    const mend = heardOnKey(hit.next, "KeyJ");

    expect(mend.next.shield["l-index"]).toBe(2);
    expect(mend.sounds).toEqual(["shoot", "hit"]);
  });
});
