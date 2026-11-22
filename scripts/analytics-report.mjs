/**
 * `npm run analytics -- --report`: the counts as one self-contained HTML page.
 *
 * ⚠️ **This is a local file, not a page on the site.** The site is static and
 * public, and these numbers include countries and a crawler census that belong
 * to us, not to visitors. Putting a dashboard behind a route would mean either
 * publishing them or adding the origin server the site is built without, so
 * the report is written to the temp directory next to the counts and opened
 * from disk. Like everything else `npm run analytics` makes, it is not kept.
 *
 * Cities are left out on purpose: at this traffic a row is often one household
 * (docs/analytics.md). Countries and states are as fine as the report goes.
 *
 * The page has no dependencies and makes no requests. The data is embedded as
 * JSON and the charts are drawn as SVG by the script at the bottom, so the
 * bot filter is instant and the file works offline.
 *
 * Bots: `bots` on each day (scripts/rollup-analytics.mjs) holds crawler page
 * views apart from the people. Referrers, events and decks are counted for
 * people only, so those panels do not change with the filter and say so.
 */

import { countryName } from "./analytics-view.mjs";

/** What the page needs from a day, with country codes already spelled out. */
export const reportData = (days) => {
  const out = {};
  for (const [date, day] of Object.entries(days)) {
    const named = (counts) =>
      Object.fromEntries(
        Object.entries(counts ?? {}).map(([code, n]) => [countryName(code), n]),
      );
    out[date] = {
      visitors: day.visitors ?? 0,
      pageViews: day.pageViews ?? 0,
      pages: day.pages ?? {},
      countries: day.countries ? named(day.countries) : null,
      referrers: day.referrers ?? {},
      events: day.events ?? {},
      decks: day.decks ?? {},
      // Absent on days counted before bots were kept, which is not zero bots.
      bots: day.bots
        ? {
            visitors: day.bots.visitors ?? 0,
            pageViews: day.bots.pageViews ?? 0,
            pages: day.bots.pages ?? {},
            countries: day.bots.countries ? named(day.bots.countries) : null,
            kinds: day.bots.kinds ?? {},
          }
        : null,
    };
  }
  return out;
};

/** `<` becomes `<` so no value can close the script element it sits in. */
const embed = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

export const reportHtml = (days, generatedAt = new Date()) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>School Skills analytics</title>
<style>
:root {
  color-scheme: light;
  --page: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e;
  --muted: #898781; --grid: #e6e5e1; --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a;
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --page: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink-2: #c3c2b7;
    --grid: #383835; --s1: #3987e5; --s2: #d95926; --s3: #199e70;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font: 14px/1.45 system-ui, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 15px; margin: 0 0 12px; }
.sub, .note { color: var(--ink-2); font-size: 12.5px; }
.bar { display: flex; flex-wrap: wrap; gap: 16px; margin: 16px 0; align-items: center; }
.seg { display: inline-flex; border: 1px solid var(--grid); border-radius: 8px; overflow: hidden; }
.seg button { font: inherit; padding: 6px 12px; border: 0; background: var(--surface); color: var(--ink-2); cursor: pointer; }
.seg button + button { border-left: 1px solid var(--grid); }
.seg button[aria-pressed="true"] { background: var(--s1); color: #fff; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
.tile, .card { background: var(--surface); border: 1px solid var(--grid); border-radius: 10px; padding: 14px 16px; }
.tile b { display: block; font-size: 26px; font-variant-numeric: tabular-nums; }
.tile span { color: var(--ink-2); font-size: 12.5px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 16px; margin-bottom: 16px; }
.wide { grid-column: 1 / -1; }
.chart { position: relative; }
svg { display: block; width: 100%; height: auto; overflow: visible; }
svg text { fill: var(--muted); font-size: 11px; }
.legend { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 8px; color: var(--ink-2); font-size: 12.5px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; }
.rows { display: grid; gap: 6px; }
.row { display: grid; grid-template-columns: minmax(80px, 38%) 1fr auto; gap: 10px; align-items: center; }
.row .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row .track { height: 10px; }
.row .fill { height: 10px; background: var(--s1); border-radius: 0 4px 4px 0; min-width: 2px; }
.row .n { font-variant-numeric: tabular-nums; color: var(--ink-2); }
.tip { position: absolute; pointer-events: none; background: var(--ink); color: var(--page); padding: 6px 10px; border-radius: 6px; font-size: 12px; white-space: nowrap; transform: translate(-50%, -110%); }
.empty { color: var(--muted); }
</style>
</head>
<body>
<main>
  <h1>School Skills analytics</h1>
  <p class="sub">Built ${generatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC from CloudFront access logs. Local file — not for publishing.</p>

  <div class="bar">
    <div class="seg" id="who" role="group" aria-label="Who to count">
      <button data-v="people" aria-pressed="true">People only</button>
      <button data-v="all" aria-pressed="false">People + bots</button>
      <button data-v="bots" aria-pressed="false">Bots only</button>
    </div>
    <div class="seg" id="range" role="group" aria-label="Time range">
      <button data-v="7" aria-pressed="false">7 days</button>
      <button data-v="30" aria-pressed="true">30 days</button>
      <button data-v="90" aria-pressed="false">90 days</button>
      <button data-v="0" aria-pressed="false">All</button>
    </div>
  </div>
  <p class="note" id="warn" hidden></p>

  <div class="tiles" id="tiles"></div>

  <div class="grid">
    <section class="card wide"><h2>Page views and visitors per day</h2>
      <div class="legend"><span><i style="background:var(--s1)"></i>Page views</span><span><i style="background:var(--s2)"></i>Visitors</span></div>
      <div class="chart" id="trend"></div></section>
    <section class="card wide"><h2>People vs. bots, page views per day</h2>
      <div class="legend"><span><i style="background:var(--s1)"></i>People</span><span><i style="background:var(--s2)"></i>Bots</span></div>
      <div class="chart" id="split"></div></section>
    <section class="card"><h2>Pages</h2><div class="rows" id="pages"></div></section>
    <section class="card"><h2>Countries</h2><div class="rows" id="countries"></div></section>
    <section class="card"><h2>Which bots</h2><div class="rows" id="kinds"></div></section>
    <section class="card"><h2>Came from</h2><div class="rows" id="referrers"></div>
      <p class="note">People only; the bot filter does not apply.</p></section>
    <section class="card"><h2>Races</h2><div class="rows" id="events"></div>
      <p class="note">People only. Events are lost offline, so read these as a floor.</p></section>
    <section class="card"><h2>Decks started</h2><div class="rows" id="decks"></div>
      <p class="note">People only.</p></section>
  </div>
  <p class="note">Visitors are distinct IPs per day and are not additive across days. Undeclared bots count as people, and datacenter traffic often does too. Countries are where an address is registered; a VPN or school moves it.</p>
</main>
<script>
const DAYS = ${embed(reportData(days))};
const state = { who: "people", range: 30 };
const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString();
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const dates = () => {
  const all = Object.keys(DAYS).sort();
  return state.range ? all.slice(-state.range) : all;
};
const bots = (d) => DAYS[d].bots ?? { visitors: 0, pageViews: 0, pages: {}, countries: {}, kinds: {} };
const views = (d) => (state.who !== "bots" ? DAYS[d].pageViews : 0) + (state.who !== "people" ? bots(d).pageViews : 0);
const visitors = (d) => (state.who !== "bots" ? DAYS[d].visitors : 0) + (state.who !== "people" ? bots(d).visitors : 0);

/** Sum one keyed section over the window, honouring the bot filter where bots have it. */
function merge(section, botsToo) {
  const out = {};
  const add = (counts) => { for (const [k, n] of Object.entries(counts ?? {})) out[k] = (out[k] ?? 0) + n; };
  for (const d of dates()) {
    if (!botsToo || state.who !== "bots") add(DAYS[d][section]);
    if (botsToo && state.who !== "people") add(bots(d)[section]);
  }
  return out;
}

function rows(id, counts, limit = 10) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const el = $(id);
  if (!entries.length) { el.innerHTML = '<span class="empty">Nothing in this window.</span>'; return; }
  const top = entries[0][1];
  el.innerHTML = entries.slice(0, limit).map(([k, n]) =>
    '<div class="row"><span class="label" title="' + esc(k) + '">' + esc(k) + '</span>' +
    '<span class="track"><div class="fill" style="width:' + (100 * n / top) + '%"></div></span>' +
    '<span class="n">' + fmt(n) + '</span></div>').join("") +
    (entries.length > limit ? '<span class="note">… and ' + (entries.length - limit) + ' more</span>' : "");
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const tip = (host, x, html) => {
  let t = host.querySelector(".tip");
  if (!html) { t?.remove(); return; }
  if (!t) { t = document.createElement("div"); t.className = "tip"; host.append(t); }
  t.innerHTML = html; t.style.left = x + "px"; t.style.top = "12px";
};

/** A chart drawn in a fixed 800x240 box that scales with its container. */
function draw(host, series, kind) {
  const ds = dates();
  const W = 800, H = 240, L = 44, R = 8, T = 8, B = 24;
  if (!ds.length) { host.innerHTML = '<span class="empty">No days on record.</span>'; return; }
  const top = Math.max(1, ...ds.map((d) => kind === "stack" ? series.reduce((s, x) => s + x.at(d), 0) : Math.max(...series.map((x) => x.at(d)))));
  const step = 10 ** Math.floor(Math.log10(top));
  const max = Math.ceil(top / step) * step;
  const x = (i) => L + (ds.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (ds.length - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const bw = Math.max(2, ((W - L - R) / ds.length) * 0.7);
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4;
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="' + css("--grid") + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + fmt(Math.round(v)) + "</text>";
  }
  const every = Math.ceil(ds.length / 8);
  ds.forEach((d, i) => { if (i % every === 0 || i === ds.length - 1) g += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + d.slice(5) + "</text>"; });
  if (kind === "stack") {
    ds.forEach((d, i) => {
      let base = 0;
      series.forEach((s) => {
        const v = s.at(d); if (!v) return;
        g += '<rect x="' + (x(i) - bw / 2) + '" y="' + y(base + v) + '" width="' + bw + '" height="' + Math.max(1, y(base) - y(base + v) - 1) + '" rx="2" fill="' + css(s.color) + '"/>';
        base += v;
      });
    });
  } else {
    for (const s of series) {
      const pts = ds.map((d, i) => x(i) + "," + y(s.at(d))).join(" ");
      g += '<polyline fill="none" stroke="' + css(s.color) + '" stroke-width="2" stroke-linejoin="round" points="' + pts + '"/>';
      if (ds.length < 40) ds.forEach((d, i) => { g += '<circle cx="' + x(i) + '" cy="' + y(s.at(d)) + '" r="3" fill="' + css(s.color) + '" stroke="' + css("--surface") + '" stroke-width="2"/>'; });
    }
  }
  host.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img">' + g + "</svg>";
  host.onmousemove = (e) => {
    const r = host.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.min(ds.length - 1, Math.max(0, Math.round(((px - L) / (W - L - R)) * (ds.length - 1))));
    tip(host, (x(i) / W) * r.width, "<b>" + ds[i] + "</b><br>" + series.map((s) => s.name + ": " + fmt(s.at(ds[i]))).join("<br>"));
  };
  host.onmouseleave = () => tip(host, 0, "");
}

function render() {
  const ds = dates();
  const noBotData = ds.filter((d) => !DAYS[d].bots).length;
  $("warn").hidden = !(noBotData && state.who !== "people");
  $("warn").textContent = noBotData + " of these " + ds.length + " days were counted before bots were kept, so they show no bot traffic — which is unknown, not zero. Re-run with logs still inside the 90-day window to fill them in.";

  const tv = ds.reduce((s, d) => s + views(d), 0);
  const tb = ds.reduce((s, d) => s + bots(d).pageViews, 0);
  const tp = ds.reduce((s, d) => s + DAYS[d].pageViews, 0);
  const tiles = [[fmt(tv), "page views"], [fmt(ds.reduce((s, d) => s + visitors(d), 0)), "visitor-days"], [fmt(ds.length ? Math.round(tv / ds.length) : 0), "views per day"],
    [tb + tp ? Math.round((100 * tb) / (tb + tp)) + "%" : "—", "of all views are bots"]];
  $("tiles").innerHTML = tiles.map(([n, l]) => '<div class="tile"><b>' + n + "</b><span>" + l + "</span></div>").join("");

  draw($("trend"), [{ name: "Page views", color: "--s1", at: views }, { name: "Visitors", color: "--s2", at: visitors }], "line");
  draw($("split"), [{ name: "People", color: "--s1", at: (d) => DAYS[d].pageViews }, { name: "Bots", color: "--s2", at: (d) => bots(d).pageViews }], "stack");

  const pages = merge("pages", false), botPages = merge("pages", true);
  rows("pages", state.who === "people" ? pages : state.who === "bots" ? botPages : Object.fromEntries([...new Set([...Object.keys(pages), ...Object.keys(botPages)])].map((k) => [k, (pages[k] ?? 0) + (botPages[k] ?? 0)])));
  const c = merge("countries", false), bc = merge("countries", true);
  rows("countries", state.who === "people" ? c : state.who === "bots" ? bc : Object.fromEntries([...new Set([...Object.keys(c), ...Object.keys(bc)])].map((k) => [k, (c[k] ?? 0) + (bc[k] ?? 0)])));
  const kinds = {}; for (const d of ds) for (const [k, n] of Object.entries(bots(d).kinds)) kinds[k] = (kinds[k] ?? 0) + n;
  rows("kinds", kinds);
  rows("referrers", merge("referrers", false));
  rows("events", merge("events", false));
  rows("decks", merge("decks", false));
}

for (const [id, key] of [["who", "who"], ["range", "range"]]) {
  $(id).addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state[key] = key === "range" ? Number(b.dataset.v) : b.dataset.v;
    for (const o of $(id).children) o.setAttribute("aria-pressed", String(o === b));
    render();
  });
}
render();
</script>
</body>
</html>
`;
