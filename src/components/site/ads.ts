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
 * 1. `tagForChildDirectedTreatment` in Base.astro DOES NOTHING. That is not a
 *    guess: the live ad request was captured from production and carried
 *    `npa=1` but no `tfcd` and no `tag_for_child_directed_treatment` at all.
 *    The property is a GPT/AdMob mechanism and AdSense's loader ignores it.
 *
 *    So the child-directed declaration in the AdSense account is not a backup
 *    to the code — it is the ONLY thing that sets this signal. It is left in
 *    the markup because it is harmless and may one day be honoured, but do
 *    not read it as protection. `requestNonPersonalizedAds`, by contrast, was
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
 * Is this site actually live in the AdSense account?
 *
 * FALSE, and it stays false until the site is approved and serving. This is
 * not caution for its own sake — a loader on an unapproved site is the worst
 * of both worlds. It contacts pagead2.googlesyndication.com and
 * googleads.g.doubleclick.net on every page load, from a child's device, and
 * receives `unfilled` in return. All of the privacy cost, none of the revenue.
 *
 * That is exactly what production was doing after the site was removed from
 * AdSense, which is what this constant exists to prevent happening again.
 *
 * False does NOT block getting approved. AdSense verifies ownership by ad
 * code, by ads.txt, or by a meta tag, and Base.astro emits the meta tag
 * unconditionally while public/ads.txt names the same publisher. So the site
 * can be added, verified and reviewed with the loader still dark, and the
 * only thing waiting on approval is the moment ads actually serve.
 *
 * Flipping it to true is a one-line change and MUST be made in the same pull
 * request that restores the advertising sections of /privacy — that page has
 * to describe what the site does, in both directions. See the header there.
 */
const ADS_LIVE = false;

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
