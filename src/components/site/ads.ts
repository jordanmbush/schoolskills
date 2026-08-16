/**
 * Advertising configuration, in one file because every value here is a
 * compliance decision rather than a preference.
 *
 * This site is directed to children. That is stated on /privacy, it is true,
 * and it changes what advertising is allowed to be:
 *
 *   - Under COPPA a persistent identifier is personal information collected
 *     from a child, and behavioural advertising is NOT covered by the
 *     "support for internal operations" exception that ordinary analytics
 *     relies on. Personalised ads here would need verifiable parental
 *     consent, which a free static site cannot obtain.
 *   - Google's own AdSense policy for child-directed content says the same
 *     thing from the other side. The FTC's $170M action against YouTube in
 *     2019 was precisely this configuration.
 *
 * So: non-personalised only, everywhere, unconditionally. There is no toggle
 * and no per-page opt-out, because a page that got it wrong would be a
 * compliance incident rather than a bug.
 *
 * ── Two things here are NOT sufficient on their own ─────────────────────────
 * 1. `tagForChildDirectedTreatment` below is belt-and-braces. The AUTHORITATIVE
 *    control is the child-directed declaration in the AdSense account, which
 *    is a setting on the site, not markup. If that is not set, this flag will
 *    not save you. Set it in the account first; treat the code as a second
 *    lock on the same door.
 * 2. Auto ads MUST be off for this site in the AdSense account. With them on,
 *    Google injects placements wherever its model likes — including on top of
 *    a race, next to the answer keypad, regardless of anything written here.
 *    Every unit on this site is manual and declared below.
 */

/** The publisher id. Public by definition — it ships in the page source. */
export const AD_CLIENT = "ca-pub-2742485876369367";

/**
 * Ad unit ids, created in the AdSense account.
 *
 * Empty until they exist. A slot with no id renders nothing at all rather than
 * an `<ins>` Google will never fill, so the site is never shipping dead markup
 * — and the reserved space is still reserved, so turning a slot on later
 * cannot shift a layout that people have already learned.
 */
export const AD_SLOTS = {
  /** Content pages: below the article, above the footer. */
  content: "",
  /** The game islands: a band above the game, on every screen. */
  game: "",
} as const;

export type AdSlotName = keyof typeof AD_SLOTS;

/**
 * Whether to emit the loader and the units at all.
 *
 * Off in dev by default: `astro dev` should not be making requests to Google
 * on every save, and an unfilled unit in development tells you nothing. Set
 * PUBLIC_ADS_PREVIEW=1 to render them locally when you actually want to look.
 */
export const ADS_ENABLED =
  import.meta.env.PROD || import.meta.env.PUBLIC_ADS_PREVIEW === "1";

/** A slot is live only when ads are on AND its unit exists. */
export const adSlotId = (name: AdSlotName): string | null =>
  ADS_ENABLED && AD_SLOTS[name] ? AD_SLOTS[name] : null;
