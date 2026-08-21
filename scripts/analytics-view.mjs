/**
 * The eight breakdowns `npm run analytics` prints, and the two ways to read
 * them.
 *
 * The counts arrive already broken down by day: `scripts/rollup-analytics.mjs`
 * writes `days[date][section][key]` and always has. The only thing that
 * differs between the two views is what happens to that middle key — the
 * default folds every day in the window into one total per row, and
 * `--by-day` keeps the days as columns. Both walk the same `SECTIONS` table,
 * so a heading, a label or a caveat is written once and cannot come out
 * saying two different things in the two views.
 *
 * Split out of scripts/analytics.mjs so the column arithmetic can be exercised
 * without a terminal, an S3 sync or a rollup run behind it.
 */

/** Rows per section. `events` opts out: there are a handful and all matter. */
const TOP = 10;

/** How wide a row label may get before the middle of it is dropped. */
const LABEL_MAX = 36;

/**
 * `BR` → `Brazil`, via `Intl` rather than a table in this repo.
 *
 * A two-letter code is exactly as unreadable as the airport codes below it,
 * which is what prompted the country lookup in the first place — printing
 * `SG 6` and calling it an improvement would have missed the point. Node has
 * shipped the region names since v14, so the alternative was carrying 250
 * country names in a source file and letting them go stale.
 */
const REGIONS = new Intl.DisplayNames(["en"], { type: "region" });
export const countryName = (code) => {
  if (code === "(unknown)") return "address not in the table";
  try {
    return REGIONS.of(code) ?? code;
  } catch {
    // `of` throws on anything that isn't a well-formed region code. A code the
    // table produced but Intl doesn't know is worth printing bare, not worth
    // taking the summary down for.
    return code;
  }
};

/**
 * `US / Iowa / Council Bluffs` → `United States / Iowa / Council Bluffs`.
 *
 * The rollup stores places qualified by the level above them, because place
 * names are not unique — Ontario is a Canadian province and a Californian
 * city, and there are around thirty Springfields. Only the leading country
 * code is expanded; the rest is already what the source called it.
 */
export const placeLabel = (key) => {
  const cut = key.indexOf(" / ");
  if (cut === -1) return key;
  return `${countryName(key.slice(0, cut))}${key.slice(cut)}`;
};

/**
 * Every breakdown, in the order they print.
 *
 * `title` heads the default view and `short` heads the same section in the
 * by-day grid, where the heading shares a line with the date columns and a
 * long one would cost several days of width. The caveats the long headings
 * carry are repeated in the footer under both views, so nothing is only said
 * in the version the grid drops.
 *
 * `label` receives every key in the section alongside the one being drawn,
 * because a label can depend on its neighbours: country codes are padded to
 * the widest present, and `(unknown)` is nine characters against everyone
 * else's two.
 *
 * `compact` is the same row in the grid, where every character spent on a
 * label is taken off the days that fit beside it. Only the places want one:
 * spelling `US` out to `United States` on each of ten city rows buys nothing
 * when the COUNTRY grid three sections up has just named it, and costs about
 * two days of width.
 */
const SECTIONS = [
  { key: "pages", title: "TOP PAGES", short: "TOP PAGES" },
  { key: "referrers", title: "CAME FROM", short: "CAME FROM" },
  {
    key: "countries",
    title: "COUNTRY (the visitor's own IP, resolved locally)",
    short: "COUNTRY",
    label: (code, all) =>
      `${code.padEnd(Math.max(...all.map((c) => c.length)))}  ${countryName(code)}`,
  },
  {
    key: "regions",
    title: "REGION",
    short: "REGION",
    label: placeLabel,
    compact: (key) => key,
  },
  {
    key: "cities",
    // The count of distinct cities, not just the ten printed, because the
    // shape of the tail is the thing worth knowing here: a long tail of ones
    // is what a city breakdown looks like at this traffic, and it is the
    // reason the caveat at the bottom of this output exists.
    title: (rows) => `CITY (${rows.length} distinct)`,
    short: "CITY",
    label: placeLabel,
    compact: (key) => key,
    note: (rows) => {
      const once = rows.filter((row) => row.total === 1).length;
      return once
        ? `${once} of them seen exactly once — see the note below`
        : null;
    },
  },
  {
    key: "edges",
    title: "SERVED FROM (nearest CloudFront edge, not the visitor)",
    short: "SERVED FROM",
  },
  { key: "events", title: "EVENTS", short: "EVENTS", limit: Infinity },
  { key: "decks", title: "DECKS RACED", short: "DECKS RACED" },
];

const limitOf = (section) => section.limit ?? TOP;
const titleOf = (section, rows) =>
  typeof section.title === "function" ? section.title(rows) : section.title;
const labelOf = (section, name, names) =>
  section.label ? section.label(name, names) : name;
const compactOf = (section, name, names) =>
  section.compact
    ? section.compact(name, names)
    : labelOf(section, name, names);

/**
 * One section as rows: every key it holds anywhere in `dates`, a cell per day,
 * and a total across them.
 *
 * A cell is `null` only where the day has no such section at all, which is a
 * different fact from a zero and is why the grid draws the two differently.
 * Days counted before the place lookup shipped carry no `countries` key and
 * days counted before referrers were recorded carry no `referrers`; filing
 * either as zero would read as "nobody came from anywhere that day" rather
 * than "nobody looked".
 *
 * Totals cover the days passed in and nothing wider, so narrowing the window
 * — or a terminal too narrow to hold it — leaves a table whose rows add up to
 * what is on screen.
 */
export const sectionRows = (days, dates, key) => {
  // A day that recorded the section contributes a zero to every key it didn't
  // mention; a day that didn't record it contributes nothing at all.
  const absent = dates.map((date) => (days[date]?.[key] ? 0 : null));
  const cells = new Map();

  for (const [at, date] of dates.entries()) {
    for (const [name, n] of Object.entries(days[date]?.[key] ?? {})) {
      if (!cells.has(name)) cells.set(name, [...absent]);
      cells.get(name)[at] = n;
    }
  }

  return [...cells]
    .map(([name, row]) => ({
      name,
      cells: row,
      total: row.reduce((sum, n) => sum + (n ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
};

/** The default view: one total per row, over the whole window. */
export const mergedLines = (days, dates) => {
  const out = [];
  for (const section of SECTIONS) {
    const rows = sectionRows(days, dates, section.key);
    // Days counted before a field existed have none of it, so a section with
    // nothing in it stays quiet rather than printing a heading over a window
    // that predates it. An empty heading and a genuine zero should not look
    // the same.
    if (rows.length === 0) continue;

    const names = rows.map((row) => row.name);
    out.push("", titleOf(section, rows));
    for (const row of rows.slice(0, limitOf(section))) {
      out.push(
        `  ${String(row.total).padStart(6)}  ${labelOf(section, row.name, names)}`,
      );
    }

    const note = section.note?.(rows);
    if (note) out.push(`         ${note}`);
  }
  return out;
};

/**
 * Drop the middle of an over-long label rather than its end.
 *
 * The most specific part of a place key is its last: cutting the tail off
 * `United States / Washington / Seattle` would take the city with it and
 * leave a column of rows all reading `United States / Washing…`.
 */
export const shorten = (text, max) => {
  if (text.length <= max) return text;
  const head = Math.ceil((max - 1) / 2);
  return `${text.slice(0, head)}…${text.slice(text.length - (max - 1 - head))}`;
};

const cellText = (n) => (n === null ? "—" : n === 0 ? "." : String(n));

/**
 * How many day columns fit across `terminal`.
 *
 * Each column costs its own width plus the two spaces in front of it. Fixed
 * either side: two spaces of row indent, the label column, and the total
 * column behind a wider three-space gap that keeps it from reading as one
 * more day. One column always "fits" — a terminal too narrow for that is
 * better overflowing than empty.
 */
export const fitDays = (terminal, { label, cell, total }) =>
  Math.max(1, Math.floor((terminal - 2 - label - total - 3) / (cell + 2)));

/** Rows, labels and column widths for a given set of days. */
const layout = (days, dates) => {
  const sections = SECTIONS.map((section) => {
    const rows = sectionRows(days, dates, section.key);
    const names = rows.map((row) => row.name);
    return {
      section,
      rows,
      drawn: rows.slice(0, limitOf(section)).map((row) => ({
        label: shorten(compactOf(section, row.name, names), LABEL_MAX),
        cells: row.cells.map(cellText),
        total: String(row.total),
      })),
    };
  }).filter((entry) => entry.rows.length > 0);

  const drawn = sections.flatMap((entry) => entry.drawn);
  return {
    sections,
    // Shared across every section, so a reader can compare one grid against
    // the one above it without re-reading the date row each time.
    label: Math.max(
      ...sections.map((entry) => entry.section.short.length),
      ...drawn.map((row) => row.label.length),
    ),
    cell: Math.max(
      5,
      ...drawn.flatMap((row) => row.cells.map((c) => c.length)),
    ),
    total: Math.max(5, ...drawn.map((row) => row.total.length)),
  };
};

const LEGEND = [
  "Down a column is one day; across a row is one key over time.",
  "  .  none that day",
  "  —  nothing measured that day: the field is missing from that day's",
  "     counts, which is not the same as a count of zero",
];

/**
 * `--by-day`: the same eight sections with the days kept as columns.
 *
 * @param terminal how many characters wide the output may be. Days that don't
 *   fit are dropped from the oldest end and said so — a table quietly showing
 *   half the window it was asked for is the failure this pipeline is least
 *   allowed to have.
 */
export const dailyLines = (days, dates, terminal) => {
  if (dates.length === 0) return [];
  let plan = layout(days, dates);
  if (plan.sections.length === 0) return [];

  const shown = dates.slice(-fitDays(terminal, plan));
  const dropped = dates.length - shown.length;
  // Re-measured against the days actually on screen, so which rows make the
  // top ten and what they add up to describe the table rather than a window
  // wider than it.
  if (dropped) plan = layout(days, shown);

  const out = [""];
  if (dropped) {
    out.push(
      `This terminal fits ${shown.length} of the window's ${dates.length} days, so the oldest`,
      `${dropped} are off the table and TOTAL adds up only the columns on it.`,
      "Widen the terminal, or pass --width to lay one out for a file.",
      "",
    );
  }
  out.push(...LEGEND);

  for (const { section, rows, drawn } of plan.sections) {
    out.push(
      "",
      [
        section.short.padEnd(2 + plan.label),
        ...shown.map((date) => date.slice(5).padStart(plan.cell)),
      ].join("  ") + `   ${"TOTAL".padStart(plan.total)}`,
    );
    for (const row of drawn) {
      out.push(
        [
          `  ${row.label.padEnd(plan.label)}`,
          ...row.cells.map((cell) => cell.padStart(plan.cell)),
        ].join("  ") + `   ${row.total.padStart(plan.total)}`,
      );
    }

    const hidden = rows.length - drawn.length;
    if (hidden > 0) out.push(`  … and ${hidden} more not shown`);

    const note = section.note?.(rows);
    if (note) out.push(`  ${note}`);
  }
  return out;
};
