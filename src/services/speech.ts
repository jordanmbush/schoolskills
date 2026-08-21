/**
 * Saying a word out loud.
 *
 * A spelling card can't show the word — that would be copying — so it has to
 * be heard. Every browser has had `speechSynthesis` for a decade and the
 * voices are already on the device, so this costs no download, works with the
 * network unplugged, and sends nothing anywhere. That last part is not
 * incidental: shipping a child's spelling list to a cloud text-to-speech
 * service would break the one promise this app makes.
 *
 * It is not universal, though. Linux without a speech engine installed, some
 * locked-down school Chromebooks and a few Android builds report the API and
 * then have no voices at all. `canSpeak()` is what the race asks before
 * choosing between hearing the word and being shown it briefly.
 */

let voice: SpeechSynthesisVoice | null = null;
let looked = false;

const synth = () =>
  typeof window === "undefined" ? null : (window.speechSynthesis ?? null);

/**
 * Names that mark a voice as neural rather than concatenative.
 *
 * This is the difference a parent actually hears. The voices installed by
 * default on most machines — macOS's Daniel and Samantha, say — are built by
 * stitching recorded fragments together, and they slur exactly the contrast a
 * spelling card depends on: "sleep" arrives one soft consonant away from
 * "sleeve". The neural voices every platform now ships don't, and they are
 * free, on-device and already there — just not switched on.
 *
 * Matching on the name is crude, but the Web Speech API exposes no quality
 * field, and these markers are what the platforms actually put in the string:
 * Apple appends "(Premium)" or "(Enhanced)", Microsoft appends "(Natural)".
 *
 * "Google …" is here for Android and ChromeOS, where Google's engine is
 * installed on the device and is the best thing available. It reads as a
 * contradiction on desktop Chrome, where the identically-named voices are
 * synthesised on Google's servers — but those never reach this test, because
 * only local voices are ranked at all. The `localService` gate below is what
 * makes one rule correct on both platforms.
 */
const CLEAR = /\((?:premium|enhanced|natural)\)|\bneural\b|^google /i;

/**
 * The English locale this device is set to, or null if it isn't set to one.
 *
 * A mismatched accent is a genuine obstacle when the whole exercise is mapping
 * a sound onto letters, so the accent a child hears all day is worth
 * preferring — and the device's own language is the only evidence of it we
 * have. A device set to something other than English gives us none, so we
 * express no preference there and let clarity decide.
 */
function deviceEnglish(): string | null {
  const tag =
    typeof navigator === "undefined" ? "" : (navigator.language ?? "");
  return /^en\b/i.test(tag) ? tag.toLowerCase() : null;
}

/**
 * How much we want a given voice, higher is better.
 *
 * Clarity outranks accent deliberately. A child who has to re-listen twice to
 * work out which word was said has lost more than one who heard it said in the
 * wrong accent — and enunciation is the whole reason this ranking exists.
 * `default` breaks ties last: on macOS it is the System Voice someone actually
 * chose, which is weak evidence but better than none.
 */
const rank = (v: SpeechSynthesisVoice, want: string | null): number =>
  (CLEAR.test(v.name) ? 2 : 0) +
  (want && v.lang.toLowerCase() === want ? 1 : 0) +
  (v.default ? 0.5 : 0);

/**
 * Picks the voice a word will be read in. Pure, so it can be tested.
 *
 * Only voices that live on the device are ranked. A network voice would sound
 * better on Chrome and cost a spelling word leaving the house — see the header
 * — so the filter is a hard gate rather than a preference. The one exception is
 * a device with no local English voice at all, which falls through to whatever
 * English exists: at that point the alternative is silence.
 *
 * Sort is stable, so voices we rate equally stay in the order the platform
 * offered them — which is the platform's own preference, and a better
 * tiebreak than anything we could invent.
 */
export function chooseVoice(
  voices: readonly SpeechSynthesisVoice[],
  want: string | null,
): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => /^en\b/i.test(v.lang));
  const local = english.filter((v) => v.localService);
  const best = [...local].sort((a, b) => rank(b, want) - rank(a, want));
  return best[0] ?? english[0] ?? null;
}

/**
 * Chrome populates `getVoices()` asynchronously and returns an empty list on
 * the first call, so a naive check answers "no voices" on a device that has
 * plenty. Call this early — the profile screen does — and the answer is ready
 * by the time a race starts.
 */
export function primeVoices() {
  const engine = synth();
  if (!engine || looked) return;
  const pick = () => {
    const voices = engine.getVoices();
    if (voices.length === 0) return;
    looked = true;
    voice = chooseVoice(voices, deviceEnglish());
  };
  pick();
  if (!looked) engine.addEventListener("voiceschanged", pick, { once: true });
}

export function canSpeak(): boolean {
  const engine = synth();
  if (!engine) return false;
  primeVoices();
  return engine.getVoices().length > 0;
}

/**
 * How long a voice gets to make a sound before we assume it never will.
 *
 * `speak()` is fire-and-forget: it accepts the utterance and returns, and a
 * voice that goes on to do nothing at all reports nothing at all. That is the
 * worst failure this screen has, because the fallback never runs — a child sits
 * in front of a card they cannot hear or read while the clock takes it away.
 *
 * A local voice starts in tens of milliseconds, so this is deliberately loose;
 * it is a backstop for silence, not a latency budget. Guessing wrong in the
 * generous direction costs nothing, and guessing wrong in the other direction
 * flashes a word that was about to be spoken.
 */
const SILENCE_MS = 1500;

let watchdog: ReturnType<typeof setTimeout> | undefined;

const stopWatching = () => {
  if (watchdog !== undefined) clearTimeout(watchdog);
  watchdog = undefined;
};

/**
 * Says a word, cancelling anything already speaking.
 *
 * Without the cancel, tapping replay three times queues three readings and the
 * card falls out of sync with what's being said. Slightly under normal pace:
 * these are children, and several of the words are ones they're hearing
 * carefully for the first time.
 *
 * `onFail` is how a caller learns the word did NOT get said. The return value
 * can't carry that: everything interesting happens after `speak()` has already
 * returned true. Call it at most once, and only for a genuine failure — see the
 * error triage below.
 */
export function say(text: string, onFail?: () => void): boolean {
  const engine = synth();
  if (!engine) return false;
  primeVoices();
  try {
    stopWatching();
    engine.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    try {
      // A voice reference can go stale — Chrome rebuilds the list on
      // `voiceschanged` and the old objects stop being accepted. Speaking in
      // the browser's default voice is a fine outcome; throwing out of here
      // would take down the race that's mid-card.
      if (voice) utterance.voice = voice;
    } catch {
      voice = null;
      looked = false;
    }
    utterance.lang = voice?.lang ?? deviceEnglish() ?? "en-US";
    utterance.rate = 0.85;

    // Per-utterance, not module-level: the one this closure was made for may
    // still be cancelled by a later card long after we stopped caring.
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      stopWatching();
      onFail?.();
    };

    // It made a sound, so the backstop has done its job. Errors after this
    // point still count — a voice can stop halfway.
    utterance.onstart = stopWatching;
    utterance.onend = () => {
      settled = true;
      stopWatching();
    };
    utterance.onerror = (event) => {
      // The trap. `cancel()` reports itself as an error on whatever it
      // interrupted, and we cancel before every single card — so treating
      // these as failures would silence the voice on card two of every race
      // and turn a spelling game into a copying exercise.
      const why = (event as SpeechSynthesisErrorEvent).error;
      if (why === "canceled" || why === "interrupted") {
        settled = true;
        stopWatching();
        return;
      }
      fail();
    };

    engine.speak(utterance);
    if (onFail) watchdog = setTimeout(fail, SILENCE_MS);
    return true;
  } catch {
    return false;
  }
}

/** Stops mid-word — called when a race ends or the player quits. */
export function hush() {
  stopWatching();
  synth()?.cancel();
}
