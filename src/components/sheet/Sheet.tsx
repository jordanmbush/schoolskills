/**
 * A `Sheet`, as HTML.
 *
 * This is the component the whole Print Shop rests on. A sheet is real
 * elements laid out in real inches — not a canvas, not a PDF blob, not an image
 * — and everything good about the feature falls out of that one decision (§2):
 * the catalog pages ship zero JavaScript, the problems on a multiplication
 * sheet are text a search engine can read, the page is selectable and
 * accessible at any zoom, and it works offline through the existing service
 * worker with nothing added.
 *
 * **It takes a `Sheet` and nothing else.** No context, no service, no storage,
 * no state. That is what lets the same component render at build time on a
 * prerendered catalog page and at runtime inside the builder — exactly the
 * trick `App.tsx` already pulls by mounting twice — and it is why the zero-JS
 * property is structural rather than a rule someone has to remember. A renderer
 * with nothing to hydrate needs no `client:*` directive; if one of these ever
 * needs a hook, the hook belongs in the builder around it, not in here.
 *
 * The stylesheets travel with the component rather than with a layout, so a
 * page that renders a sheet cannot forget to print it properly.
 */
import { contentBox } from "@/engine/sheets/layout";
import { marginOf, pageSize } from "@/engine/sheets/paper";
import type { Paper, Sheet } from "@/engine/sheets/types";
import type { CSSProperties } from "react";

import "@/styles/sheet.css";
import "@/styles/print.css";

import { BlockView } from "./blocks";
import type { SheetMetrics } from "./metrics";
import { SheetFoot } from "./SheetFoot";
import { SheetHead } from "./SheetHead";
import { DASH_CUT, HEAVY, inch, pt } from "./units";

export function SheetView({ sheet }: { sheet: Sheet }) {
  const page = pageSize(sheet.paper);
  const metrics: SheetMetrics = {
    box: contentBox(sheet.paper),
    fontPt: sheet.fontPt,
    font: sheet.font,
    answers: sheet.answers,
  };

  return (
    <article
      className="sheet"
      // Not a class, because a key is the same sheet in a different state
      // rather than a different kind of sheet — and a stylesheet that wants to
      // mark up the answers can reach it either way.
      data-answers={sheet.answers ? "true" : undefined}
      // The same reasoning twice more. A face and a boxed answer place are how
      // this sheet is drawn rather than what is on it, so both are one
      // attribute here and one rule in sheet.css — where a font stack belongs
      // anyway — instead of a class threaded down through every block.
      data-font={sheet.font}
      data-answer-box={sheet.answerBox ? "true" : undefined}
      style={
        {
          "--sheet-w": inch(page.width),
          "--sheet-h": inch(page.height),
          "--sheet-margin": inch(marginOf(sheet.paper)),
          "--sheet-pt": pt(sheet.fontPt),
        } as CSSProperties
      }
    >
      <PageSize paper={sheet.paper} />
      {sheet.cutLines && <CutLines paper={sheet.paper} />}
      <SheetHead header={sheet.header} />
      <div className="sheet__blocks">
        {/* Indexed keys: a block has no identity of its own, the list is
            rebuilt whole on every change of config, and nothing in it is
            stateful — there is nothing for a stable key to preserve. */}
        {sheet.blocks.map((block, index) => (
          <BlockView key={index} block={block} metrics={metrics} />
        ))}
      </div>
      <SheetFoot footer={sheet.footer} />
    </article>
  );
}

/**
 * `@page` for a sheet that isn't on the default stock.
 *
 * `print.css` sets Letter portrait with no margin, which is what most of this
 * audience prints on. `@page` is a document rule with no way to scope it to a
 * class, so the only way a sheet can state its own stock is to emit one — and
 * getting this wrong is not a cosmetic bug: print is the whole of the output
 * path here (§10), so a sheet whose paper and page size disagree is one that
 * prints across two pages or gets scaled down to fit, and there is no PDF to
 * fall back on.
 *
 * A `<style>` element, not a script. It costs nothing at run time and keeps the
 * page free of JavaScript.
 */
/**
 * Where to cut, drawn over the paper rather than in the flow.
 *
 * The `cutline` block is the other way of saying this and the two are not
 * interchangeable: a block is a row in the document that takes a quarter of an
 * inch a family had to reserve for it, which is why only a family can emit one.
 * This is the parent's switch (§17), so it has to cost nothing — an overlay
 * takes no height at all, which is the only reason `cutLines` can be an option
 * every family shares without any of them re-doing their capacity arithmetic.
 *
 * Both halves of the page, always. Cutting once down the middle and cutting
 * into quarters are the 2-up and 4-up layouts of §17, and which one a parent
 * wanted is a decision they make with the scissors — a guide that is not
 * followed costs nothing, and a guide that is missing costs a re-print.
 */
function CutLines({ paper }: { paper: Paper }) {
  const { width, height } = pageSize(paper);
  return (
    <svg
      className="sheet__ink sheet__cuts"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Cut along these lines"
    >
      {/* HEAVY and the long dash for the same reason `Cutline` uses them: a cut
          line is read before it is used, and it must not be mistaken for a rule
          to write on. */}
      <line
        className="sheet__rule sheet__rule--cut"
        x1={0}
        x2={width}
        y1={height / 2}
        y2={height / 2}
        strokeWidth={HEAVY}
        strokeDasharray={DASH_CUT}
      />
      <line
        className="sheet__rule sheet__rule--cut"
        x1={width / 2}
        x2={width / 2}
        y1={0}
        y2={height}
        strokeWidth={HEAVY}
        strokeDasharray={DASH_CUT}
      />
    </svg>
  );
}

function PageSize({ paper }: { paper: Paper }) {
  if (paper.size === "letter" && paper.orientation === "portrait") return null;
  const { width, height } = pageSize(paper);
  return <style>{`@page{size:${inch(width)} ${inch(height)};margin:0}`}</style>;
}
