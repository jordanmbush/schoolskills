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
 * 1. The age signal in Base.astro is NOT PROVEN. `tagForChildDirectedTreatment`
 *    used to be set there and did nothing: the live ad request was captured
 *    from production and carried `npa=1` but no `tfcd` and no
 *    `tag_for_child_directed_treatment` at all. It is a GPT/AdMob mechanism
 *    that AdSense's loader ignores, so it has been replaced with the variable
 *    AdSense actually documents — `google_tag_for_age_treatment = 1`, where 1
 *    is child-restricted (support.google.com/adsense/answer/3248194).
 *
 *    That replacement is UNVERIFIED. Nothing has served yet, so no ad request
 *    exists to check it against, and the last thing believed about this line
 *    turned out to be false. Capture a live request the first time an ad
 *    fills and confirm `tfat=1` is on it. Until then assume it does nothing.
 *
 *    Which means: the site-level child-directed declaration in SEARCH CONSOLE
 *    (search.google.com/search-console/coppa — not the AdSense UI) is the only
 *    thing known to set this signal, and it is where Google's own COPPA
 *    guidance points publishers. `requestNonPersonalizedAds`, by contrast, was
 *    confirmed working: `npa=1` was present on every request.
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
  /**
   * In-article, between sections of a content page. Placed by hand at points
   * where a reader has just finished something rather than mid-thought, and
   * reused at more than one such point on a long page — this is where the
   * viewable impressions are, because the reader is still on screen.
   */
  article: "",
  /** Content pages: after the article, above the footer. */
  foot: "",
  /** The game islands: a band above the game, on every screen. */
  game: "",
} as const;

export type AdSlotName = keyof typeof AD_SLOTS;

/**
 * Should the loader ship at all?
 *
 * TRUE. Turning it off is a one-line kill switch for every ad request the site
 * makes — reach for it if the account is suspended, if a placement turns out
 * to be wrong on a child's screen, or if anything about Google's behaviour
 * stops matching what /privacy says.
 *
 * It moves TOGETHER with the advertising sections of /privacy, in both
 * directions. That page has to describe what the site actually does, and a
 * policy claiming ad requests that aren't happening is as wrong as one hiding
 * requests that are. It was false for exactly that reason once already: the
 * site was removed from AdSense while the loader kept calling
 * pagead2.googlesyndication.com on every page load, from a child's device,
 * getting `unfilled` back — all of the privacy cost, none of the revenue.
 *
 * Note what true does NOT mean. Verification and review never needed it:
 * AdSense accepts ad code, ads.txt, OR a meta tag, and Base.astro emits the
 * meta tag unconditionally while public/ads.txt names the same publisher. So
 * this being false was never what stood between the site and approval.
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
 * Looking at the layout rather than at real ads.
 *
 * Before the units exist in the AdSense account there is nothing to render,
 * and a reserved box with nothing in it is invisible — which makes a preview
 * build useless for the one question worth asking early: does the band change
 * how the game feels, and does it crowd the race on a small screen?
 *
 * So in preview only, an empty slot draws itself at exactly the reserved size.
 * Never in production: there the same absence is silence, because a visible
 * frame with no advert in it reads as broken rather than empty.
 */
export const ADS_PREVIEW = import.meta.env.PUBLIC_ADS_PREVIEW === "1";

/** A slot is live only when ads are on AND its unit exists. */
export const adSlotId = (name: AdSlotName): string | null =>
  ADS_ENABLED && AD_SLOTS[name] ? AD_SLOTS[name] : null;
