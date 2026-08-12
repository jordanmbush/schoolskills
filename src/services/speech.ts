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
    // A local voice never needs the network. Beyond that, prefer a British
    // one: the word lists are read to children in a house that says "bath",
    // and a mismatched accent is a genuine obstacle when the whole exercise
    // is mapping a sound onto letters.
    const english = voices.filter((v) => v.lang.startsWith("en"));
    voice =
      english.find((v) => v.lang === "en-GB" && v.localService) ??
      english.find((v) => v.lang === "en-GB") ??
      english.find((v) => v.localService) ??
      english[0] ??
      null;
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
 * Says a word, cancelling anything already speaking.
 *
 * Without the cancel, tapping replay three times queues three readings and the
 * card falls out of sync with what's being said. Slightly under normal pace:
 * these are children, and several of the words are ones they're hearing
 * carefully for the first time.
 */
export function say(text: string): boolean {
  const engine = synth();
  if (!engine) return false;
  primeVoices();
  try {
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
    utterance.lang = voice?.lang ?? "en-GB";
    utterance.rate = 0.85;
    engine.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/** Stops mid-word — called when a race ends or the player quits. */
export function hush() {
  synth()?.cancel();
}
