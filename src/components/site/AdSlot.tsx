import { useEffect, useRef } from "react";
import { AD_CLIENT, adSlotId, type AdSlotName } from "./ads";

/**
 * An ad unit inside a React island.
 *
 * The Astro twin of this is AdSlot.astro; they render the same markup and
 * reserve the same space. Two files rather than one because the game screens
 * are a client island and the content pages are static HTML, and neither can
 * host the other's component.
 *
 * The space is reserved by CSS whether or not anything fills it (see
 * styles/ads.css). That is the load-bearing part on a game screen: the band
 * sits above a race that is on a clock, so an ad arriving late must not be
 * able to move the card or the keypad. It renders into a box that already
 * exists at first paint.
 */
export function AdSlot({
  name,
  className = "",
}: {
  name: AdSlotName;
  className?: string;
}) {
  const slot = adSlotId(name);
  const pushed = useRef(false);

  useEffect(() => {
    if (!slot || pushed.current) return;
    // Once per mounted unit. React 18's development double-effect would
    // otherwise push twice for one <ins>, which AdSense counts as an error and
    // logs loudly; the ref is what makes a remount safe too.
    pushed.current = true;
    try {
      const ads = ((
        window as unknown as { adsbygoogle?: unknown[] }
      ).adsbygoogle ??= []);
      ads.push({});
    } catch {
      // A blocked or failed loader is not this screen's problem. The reserved
      // box stays exactly as it is and the game carries on.
    }
  }, [slot]);

  // No unit id yet, or ads are off in this build. Keep the reservation so
  // turning a slot on later can't shift a layout people already know.
  if (!slot) return <div className={`ad ad--blank ${className}`} aria-hidden />;

  return (
    <aside className={`ad ${className}`} aria-label="Advertisement">
      <span className="ad__label">Ad</span>
      <ins
        className="adsbygoogle ad__unit"
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
      />
    </aside>
  );
}
