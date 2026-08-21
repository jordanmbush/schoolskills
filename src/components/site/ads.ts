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
 *     thing from the other side.
 *
 * So: non-personalised only, everywhere, unconditionally. There is no toggle
 * and no per-page opt-out, because a page that got it wrong would be a
 * compliance incident rather than a bug.
 *
 * ── Two things here are NOT sufficient on their own ─────────────────────────
 * 1. The age signal in Base.astro is NOT PROVEN. It is
 *    `google_tag_for_age_treatment = 1`, where 1 is child-restricted, which is
 *    the variable AdSense documents (support.google.com/adsense/answer/3248194)
 *    — `tagForChildDirectedTreatment` is a GPT/AdMob mechanism the AdSense
 *    loader ignores, so do not reach for it.
 *
 *    UNVERIFIED because nothing has served yet, so there is no ad request to
 *    check it against. Capture a live request the first time an ad fills and
 *    confirm `tfat=1` is on it. Until then assume it does nothing.
 *
 *    Which means: the site-level child-directed declaration in SEARCH CONSOLE
 *    (search.google.com/search-console/coppa — not the AdSense UI) is the only
 *    thing known to set this signal, and it is where Google's own COPPA
 *    guidance points publishers. `requestNonPersonalizedAds` is confirmed
 *    working — `npa=1` is on every request.
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
 * Empty until they exist in the account. `adSlotId` answers null for an empty
 * one, so no `<ins>` is emitted — the reserved space stays reserved; see
 * `AdSlot.tsx`.
 */
export const AD_SLOTS = {
  /**
   * In-article, between sections of a content page. Placed by hand where a
   * reader has just finished a section rather than mid-thought, and reusable
   * at more than one such point on a long page.
   */
  article: "",
  /** Content pages: after the article, above the footer. */
  foot: "",
  /** The game islands: a band above the game, on every screen. */
  game: "",
} as const;

export type AdSlotName = keyof typeof AD_SLOTS;

/**
 * A one-line kill switch for every ad request the site makes — reach for it if
 * the account is suspended, if a placement turns out to be wrong on a child's
 * screen, or if anything about Google's behaviour stops matching /privacy.
 *
 * It moves TOGETHER with the advertising sections of /privacy, in both
 * directions. That page has to describe what the site actually does, and a
 * policy claiming ad requests that aren't happening is as wrong as one hiding
 * requests that are — a loader still calling pagead2.googlesyndication.com
 * from a child's device for an account that has been removed is all of the
 * privacy cost and none of the revenue.
 *
 * AdSense verification does not depend on this: it accepts ad code, `ads.txt`
 * OR a meta tag, and `Base.astro` emits the meta tag unconditionally while
 * `public/ads.txt` names the same publisher.
 */
const ADS_LIVE = true;

/**
 * Whether to emit the loader and the units at all.
 *
 * Off in dev regardless: `astro dev` should not be making requests to Google
 * on every save, and an unfilled unit in development tells you nothing. Set
 * PUBLIC_ADS_PREVIEW=1 to render them locally when you want to look at the
 * layout — that path draws placeholders and never loads the real script.
 */
export const ADS_ENABLED =
  (ADS_LIVE && import.meta.env.PROD) ||
  import.meta.env.PUBLIC_ADS_PREVIEW === "1";

/**
 * Looking at the layout rather than at real ads: in preview an empty slot draws
 * itself at the reserved size, so the band can be judged before any unit
 * exists. Never in production, where a visible frame with no advert in it
 * reads as broken rather than empty.
 */
export const ADS_PREVIEW = import.meta.env.PUBLIC_ADS_PREVIEW === "1";

export const adSlotId = (name: AdSlotName): string | null =>
  ADS_ENABLED && AD_SLOTS[name] ? AD_SLOTS[name] : null;
