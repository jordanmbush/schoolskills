import { afterEach, describe, expect, it, vi } from "vitest";

import { chooseVoice } from "./speech";

/**
 * The voice picker is a ranking rule over a list the operating system hands
 * us, which makes it both the most platform-dependent thing in the app and the
 * easiest to get quietly wrong — a bad pick doesn't throw, it just mumbles.
 *
 * `chooseVoice` is pure for exactly this reason. The lists below are real:
 * they're what Chrome and Safari actually report on the machines named.
 */
const v = (
  name: string,
  lang: string,
  localService = true,
  isDefault = false,
): SpeechSynthesisVoice =>
  ({
    name,
    lang,
    localService,
    default: isDefault,
    voiceURI: name,
  }) as SpeechSynthesisVoice;

/** macOS out of the box: nothing neural installed, Samantha as System Voice. */
const MAC_STOCK = [
  v("Samantha", "en-US", true, true),
  v("Albert", "en-US"),
  v("Daniel", "en-GB"),
  v("Karen", "en-AU"),
  v("Moira", "en-IE"),
  v("Zarvox", "en-US"),
];

/** The same Mac after downloading two voices in Spoken Content settings. */
const MAC_PREMIUM = [
  v("Samantha", "en-US", true, true),
  v("Ava (Premium)", "en-US"),
  v("Serena (Premium)", "en-GB"),
  v("Daniel", "en-GB"),
];

/** Desktop Chrome: macOS voices, plus Google's synthesised on Google's servers. */
const CHROME_DESKTOP = [
  ...MAC_STOCK,
  v("Google US English", "en-US", false),
  v("Google UK English Female", "en-GB", false),
];

describe("choosing a voice", () => {
  it("never picks a voice that synthesises off the device", () => {
    // The one that must not regress. "Google US English" is the best-sounding
    // thing in desktop Chrome's list and it reaches Google's servers to say a
    // word, carrying the child's IP with it. No accent or clarity score is
    // allowed to outrank that — see the header of speech.ts.
    const picked = chooseVoice(CHROME_DESKTOP, "en-us");
    expect(picked!.localService).toBe(true);
    expect(picked!.name).not.toMatch(/^Google/);
  });

  it("prefers a neural voice over the one the system defaults to", () => {
    expect(chooseVoice(MAC_PREMIUM, "en-us")!.name).toBe("Ava (Premium)");
  });

  it("prefers the accent the device is set to, all else equal", () => {
    // Two premium voices, nothing between them but the accent a child hears
    // all day.
    expect(chooseVoice(MAC_PREMIUM, "en-gb")!.name).toBe("Serena (Premium)");
  });

  it("takes a clear voice in the wrong accent over a mumbler in the right one", () => {
    // The deliberate tradeoff. A British device with only an American premium
    // voice installed gets it over Daniel, because re-listening twice to work
    // out which word was said costs more than the accent does.
    const list = [
      v("Daniel", "en-GB", true, true),
      v("Ava (Premium)", "en-US"),
    ];
    expect(chooseVoice(list, "en-gb")!.name).toBe("Ava (Premium)");
  });

  it("falls back to the system voice when nothing is neural", () => {
    expect(chooseVoice(MAC_STOCK, "en-us")!.name).toBe("Samantha");
  });

  it("takes Google's engine where it really is on the device", () => {
    // Android and ChromeOS ship it locally, and there it's the best available.
    // Same name, opposite verdict from the desktop case above — the difference
    // is `localService`, which is the whole point of the gate.
    const android = [
      v("Google US English", "en-US", true, true),
      v("English United States", "en-US"),
    ];
    expect(chooseVoice(android, "en-us")!.name).toBe("Google US English");
  });

  it("expresses no accent preference on a device that isn't set to English", () => {
    // A Spanish-language household practising English spellings. We know
    // nothing about which English they hear, so clarity alone decides.
    expect(chooseVoice(MAC_PREMIUM, null)!.name).toMatch(/\(Premium\)/);
  });

  it("keeps the platform's own order between voices it rates equally", () => {
    // Array.prototype.sort is stable, so an unranked list comes back as the
    // platform offered it — a better tiebreak than anything we'd invent.
    const list = [v("Albert", "en-US"), v("Zarvox", "en-US")];
    expect(chooseVoice(list, "en-us")!.name).toBe("Albert");
  });

  it("ignores voices that aren't English at all", () => {
    // The word lists are English. A French voice reading "because" is worse
    // than no voice, because it teaches the wrong sound.
    const list = [v("Amélie", "fr-CA", true, true), v("Daniel", "en-GB")];
    expect(chooseVoice(list, null)!.name).toBe("Daniel");
    expect(chooseVoice([v("Amélie", "fr-CA")], null)).toBeNull();
  });

  it("would rather speak over the network than not speak at all", () => {
    // A device with no local English voice — some Linux builds, some managed
    // Chromebooks. The alternative here isn't privacy, it's silence with the
    // clock running, so the old fallback stands.
    const list = [v("Google US English", "en-US", false)];
    expect(chooseVoice(list, "en-us")!.name).toBe("Google US English");
  });

  it("returns nothing rather than throwing for an empty list", () => {
    expect(chooseVoice([], "en-us")).toBeNull();
  });
});

/**
 * Reporting a word that didn't get said.
 *
 * `speechSynthesis.speak()` accepts an utterance and returns, so every way this
 * can go wrong goes wrong after the call that started it. The card downstream
 * has a good fallback — it flashes the word — but it only runs if something
 * tells it to, and the failure that matters most tells nobody anything: a
 * voice that accepts the word and then makes no sound at all.
 *
 * The fake below is the Web Speech API reduced to what that triage depends on:
 * an utterance whose events a test can fire by hand.
 */
class FakeUtterance {
  lang = "";
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart?: () => void;
  onend?: () => void;
  onerror?: (event: { error: string }) => void;
  constructor(public text: string) {}
}

type Bench = {
  say: (text: string, onFail?: () => void) => boolean;
  hush: () => void;
  spoken: FakeUtterance[];
};

async function bench(): Promise<Bench> {
  const spoken: FakeUtterance[] = [];
  const engine = {
    getVoices: () => [v("Samantha", "en-US", true, true)],
    speak: (u: FakeUtterance) => void spoken.push(u),
    cancel: () => {},
    addEventListener: () => {},
  };
  Object.assign(globalThis, {
    SpeechSynthesisUtterance: FakeUtterance,
    window: { speechSynthesis: engine },
  });
  // The module caches its chosen voice and its pending watchdog, so each test
  // needs its own copy of it.
  vi.resetModules();
  const mod = await import("./speech");
  return { say: mod.say, hush: mod.hush, spoken };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("noticing a word that never got said", () => {
  it("says nothing when the next card interrupts this one", async () => {
    // The trap this whole triage exists for. We cancel before every card, and
    // cancelling reports itself as an error on whatever it stopped. Counting
    // that as a failure would mute the voice on card two of every race.
    const { say, spoken } = await bench();
    const onFail = vi.fn();
    say("sleep. Time to go to sleep.", onFail);
    spoken[0].onerror?.({ error: "interrupted" });
    expect(onFail).not.toHaveBeenCalled();
  });

  it("says nothing when the player quits mid-word", async () => {
    const { say, spoken } = await bench();
    const onFail = vi.fn();
    say("their. This is their house.", onFail);
    spoken[0].onerror?.({ error: "canceled" });
    expect(onFail).not.toHaveBeenCalled();
  });

  it("reports a voice that accepted the word and then failed", async () => {
    const { say, spoken } = await bench();
    const onFail = vi.fn();
    expect(say("because", onFail)).toBe(true); // it "worked", and yet
    spoken[0].onerror?.({ error: "synthesis-failed" });
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it("reports a voice blocked from speaking without a tap", async () => {
    // Chrome's autoplay policy. Reported like any other error, and a card that
    // silently never speaks is exactly what a child would meet.
    const { say, spoken } = await bench();
    const onFail = vi.fn();
    say("said", onFail);
    spoken[0].onerror?.({ error: "not-allowed" });
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it("reports a voice that makes no sound and no complaint", async () => {
    // The one that had no handling at all: no error, no start, no end. The
    // card believed it was audible and showed a blank sentence to a silent room.
    vi.useFakeTimers();
    const { say } = await bench();
    const onFail = vi.fn();
    say("eight", onFail);
    expect(onFail).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it("leaves a voice alone once it has actually started", async () => {
    // The false positive to avoid: a slow device is not a broken one, and
    // flashing the word turns the card into a copying exercise.
    vi.useFakeTimers();
    const { say, spoken } = await bench();
    const onFail = vi.fn();
    say("through", onFail);
    spoken[0].onstart?.();
    vi.advanceTimersByTime(10_000);
    expect(onFail).not.toHaveBeenCalled();
  });

  it("still reports a voice that gives up halfway through", async () => {
    // Starting is not surviving. The backstop is retired on start, but a real
    // error after it still counts.
    const { say, spoken } = await bench();
    const onFail = vi.fn();
    say("would. I would love to come.", onFail);
    spoken[0].onstart?.();
    spoken[0].onerror?.({ error: "audio-hardware" });
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it("says nothing at all about a word it finished saying", async () => {
    vi.useFakeTimers();
    const { say, spoken } = await bench();
    const onFail = vi.fn();
    say("know", onFail);
    spoken[0].onstart?.();
    spoken[0].onend?.();
    vi.advanceTimersByTime(10_000);
    expect(onFail).not.toHaveBeenCalled();
  });

  it("drops a pending verdict when the race is left", async () => {
    // Otherwise the watchdog outlives the screen and demotes a race nobody is
    // in any more — a setState on an unmounted island.
    vi.useFakeTimers();
    const { say, hush } = await bench();
    const onFail = vi.fn();
    say("four", onFail);
    hush();
    vi.advanceTimersByTime(10_000);
    expect(onFail).not.toHaveBeenCalled();
  });

  it("reports a failure once, however many ways it arrives", async () => {
    vi.useFakeTimers();
    const { say, spoken } = await bench();
    const onFail = vi.fn();
    say("write", onFail);
    spoken[0].onerror?.({ error: "synthesis-failed" });
    spoken[0].onerror?.({ error: "synthesis-unavailable" });
    vi.advanceTimersByTime(10_000);
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it("keeps the next card's backstop clear of the last card's", async () => {
    // One module-level timer serves every card, so starting a new word has to
    // retire the old word's watchdog rather than letting it fire against a
    // card that is speaking perfectly well.
    vi.useFakeTimers();
    const { say, spoken } = await bench();
    const first = vi.fn();
    const second = vi.fn();
    say("been", first);
    say("bean", second);
    spoken[1].onstart?.();
    vi.advanceTimersByTime(10_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });
});
