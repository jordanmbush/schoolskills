/**
 * A `Sheet`, as HTML.
 *
 * Real elements laid out in real inches — not a canvas, not a PDF blob, not an
 * image (§2).
 *
 * **It takes a `Sheet` and nothing else.** No context, no service, no storage,
 * no state. That is what lets the same component render at build time on a
 * prerendered catalog page and at runtime inside the builder, and it is why the
 * zero-JavaScript property is structural rather than a rule someone has to
 * remember. If one of these ever needs a hook, the hook belongs in the builder
 * around it, not in here.
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
      // Attributes rather than classes. A key is the same sheet in a different
      // state, and a face and a boxed answer place are how this sheet is drawn
      // rather than what is on it — so each is one attribute here and one rule
      // in sheet.css, instead of a class threaded down through every block.
      data-answers={sheet.answers ? "true" : undefined}
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
        {/* Indexed keys: the list is rebuilt whole on every change of config
            and nothing in it is stateful, so there is nothing for a stable key
            to preserve. */}
        {sheet.blocks.map((block, index) => (
          <BlockView key={index} block={block} metrics={metrics} />
        ))}
      </div>
      <SheetFoot footer={sheet.footer} />
    </article>
  );
}

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
 * Both halves of the page, always: which of 2-up and 4-up a parent wanted is a
 * decision they make with the scissors, and a guide that is not followed costs
 * nothing where a guide that is missing costs a re-print.
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
      {/* HEAVY and the long dash: a cut line is read before it is used, and it
          must not be mistaken for a rule to write on. */}
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

/**
 * `@page` for a sheet that isn't on the default stock.
 *
 * `print.css` sets Letter portrait with no margin. `@page` is a document rule
 * with no way to scope it to a class, so the only way a sheet can state its own
 * stock is to emit one — and print is the whole of the output path here (§10),
 * so a sheet whose paper and page size disagree prints across two pages or
 * scaled down to fit, with no PDF to fall back on.
 *
 * A `<style>` element, not a script, so the page stays free of JavaScript.
 */
function PageSize({ paper }: { paper: Paper }) {
  if (paper.size === "letter" && paper.orientation === "portrait") return null;
  const { width, height } = pageSize(paper);
  return <style>{`@page{size:${inch(width)} ${inch(height)};margin:0}`}</style>;
}
