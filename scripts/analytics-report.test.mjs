import { describe, expect, it } from "vitest";

import { reportData, reportHtml } from "./analytics-report.mjs";

const day = {
  visitors: 2,
  pageViews: 3,
  pages: { "/": 3 },
  countries: { US: 3 },
  bots: {
    visitors: 1,
    pageViews: 5,
    pages: { "/": 5 },
    countries: { US: 5 },
    kinds: { Googlebot: 5 },
  },
};

describe("reportData", () => {
  it("spells out country codes", () => {
    expect(reportData({ "2026-10-01": day })["2026-10-01"].countries).toEqual({
      "United States": 3,
    });
  });

  it("marks days counted before bots were kept as unknown, not zero", () => {
    const old = { ...day, bots: undefined };
    expect(reportData({ "2026-09-01": old })["2026-09-01"].bots).toBeNull();
  });
});

describe("reportHtml", () => {
  it("cannot be broken out of its script element by a hostile key", () => {
    const html = reportHtml({
      "2026-10-01": { ...day, pages: { "/</script><script>alert(1)": 1 } },
    });
    expect(html).not.toContain("</script><script>alert(1)");
  });

  it("leaves cities out", () => {
    const html = reportHtml({
      "2026-10-01": { ...day, cities: { "US / WA / Seattle": 1 } },
    });
    expect(html).not.toContain("Seattle");
  });
});
