/**
 * Numbers, as text a person reads.
 *
 * One way only. Nothing here parses text back into a number, and nothing it
 * returns is safe to compare, sort or store: the values are rounded, clamped,
 * and — for a date — in whatever locale the browser is set to.
 *
 * The one string this app really does compare never comes through here. A
 * card's `answer` is already text in the engine ("56", not 56), and judging
 * what was typed against it is `DeckSpec.normalise`'s job. So no answer,
 * `factId` or `configKey` is formatted below, and changing how something here
 * reads can never change whether a card was marked right.
 */

/**
 * 74210 → "1:14.21" · 9840 → "9.84"
 *
 * Never negative: a clock that has run backwards is a bug upstream, and
 * "-0.03" on the HUD hands it to the child to worry about instead.
 */
export function clock(ms: number, { withMinutes = true } = {}) {
  const safe = Math.max(0, ms);
  const totalSeconds = safe / 1000;
  if (withMinutes && totalSeconds >= 60) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds - mins * 60;
    return `${mins}:${secs.toFixed(2).padStart(5, "0")}`;
  }
  return totalSeconds.toFixed(2);
}

/**
 * Signed split, rally style: "−1.42" when you're ahead. A real minus (U+2212)
 * and not a hyphen, so + and − are the same width down a mono column, and "±"
 * for dead level, which "+0.00" would make look like behind by a rounding
 * error.
 */
export function delta(ms: number) {
  const sign = ms > 0 ? "+" : ms < 0 ? "−" : "±";
  return `${sign}${(Math.abs(ms) / 1000).toFixed(2)}`;
}

/**
 * Coarse duration for totals: "45s", "12m", "3h 20m". Rounded to one unit, so
 * two of these must never be compared or subtracted — 61 seconds and 89
 * seconds are both "1m". `clock` is the one for a time that means something.
 */
export function duration(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Month and day, in the reader's own locale. An unreadable date gives "—"
 * rather than "Invalid Date", so a record from an older build, or one
 * hand-edited into a backup, still draws its row in the record book instead of
 * shouting about itself in the middle of a list.
 */
export function shortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
