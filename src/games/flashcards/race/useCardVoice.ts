import { useCallback, useEffect, useState } from "react";
import { canSpeak, hush, say } from "@/services/speech";
import type { Card } from "@/engine/types";

/**
 * Reading a card out, for a deck whose prompt can't be shown.
 *
 * A spelling card that displays its own word is a copying exercise, so the
 * word is spoken instead — see `Card.speak`. Whether this device can speak at
 * all is decided ONCE, at mount: re-checking per card would let the prompt
 * change form halfway through a race, so a child who has been listening
 * suddenly has to read.
 */
export function useCardVoice({
  card,
  racing,
}: {
  card: Card;
  racing: boolean;
}) {
  const [audible, setAudible] = useState(canSpeak);

  // Keyed on the card rather than on its index, so the same word coming round
  // twice still gets read out. Gated on `racing` so nothing talks over the
  // countdown or carries on into the results screen.
  //
  // If the engine turns out not to work after all, drop to showing the word.
  // A card that can neither be heard nor read is unanswerable, and the clock
  // is running. That verdict arrives two ways, and the second one matters
  // more: `say` returns false when it couldn't even start, and calls back
  // when a voice accepted the word and then failed to say it — a stalled
  // engine, a revoked autoplay permission, a device that simply went quiet.
  // Only the first was ever handled, so the commonest silent card wasn't.
  //
  // Demotion is one-way. Re-testing per card would let a child who has settled
  // into listening be handed a flashing word halfway through a race, which is
  // the change of exercise this hook exists to prevent.
  useEffect(() => {
    if (!racing || !audible || !card.speak) return;
    const mute = () => setAudible(false);
    if (!say(card.speak, mute)) mute();
  }, [card, racing, audible]);

  // Leaving mid-word must not leave a voice talking over the next screen —
  // nor a pending verdict about a word nobody is waiting for any more.
  useEffect(() => hush, []);

  const replay = useCallback(() => {
    if (!card.speak) return;
    const mute = () => setAudible(false);
    if (!say(card.speak, mute)) mute();
  }, [card]);

  return { audible, replay };
}
