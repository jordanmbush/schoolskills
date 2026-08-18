/**
 * The sheet, on the press-room ground, small enough to see all of.
 *
 * A sheet is 8.5 inches wide and does not negotiate — that is the whole of §4 —
 * so the only honest way to show one next to an option panel is to scale it
 * down. `transform: scale()` and not a smaller sheet: every length on the paper
 * stays exactly what it says it is, the type is still real selectable text, and
 * what is on screen is the page that will come out of the printer rather than a
 * drawing of it.
 *
 * The scale is measured rather than guessed, because the frame's width depends
 * on the viewport and the sheet's on the stock: Letter portrait beside a panel
 * on a laptop is about 0.45, A4 landscape on a phone is about 0.25, and a
 * hard-coded number would be wrong on both.
 *
 * Print undoes all of it. `print.css` hides everything that isn't paper, and the
 * rules in printshop.css take the transform back off — a scaled sheet sent to a
 * printer is a sheet at 45% of the size it measures, which is the one bug this
 * screen exists to prevent.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { SheetView } from "@/components/sheet/Sheet";
import type { Sheet } from "@/engine/sheets/types";

export function Preview({ sheets }: { sheets: Sheet[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  // The room there is, and the stack's own unscaled size. ResizeObserver reports
  // layout boxes, which is exactly what is wanted here: the stack's box is what
  // it would measure at 1:1, uncontaminated by the transform applied to it.
  const [box, setBox] = useState({ room: 0, width: 0, height: 0 });

  useEffect(() => {
    const room = stage.current;
    const inner = stack.current;
    if (!room || !inner) return;

    const measure = () => {
      // The stage rather than the frame around it, because the frame has
      // padding and `clientWidth` includes it — a sheet scaled to the padded
      // width is a sheet a few pixels wider than the room it has.
      const next = {
        room: room.clientWidth,
        width: inner.offsetWidth,
        height: inner.offsetHeight,
      };
      // Same numbers, same object. The stage is measured *and* given a height,
      // so an unguarded update would re-render once more every time the height
      // it just set is observed coming back.
      setBox((current) =>
        current.room === next.room &&
        current.width === next.width &&
        current.height === next.height
          ? current
          : next,
      );
    };

    const observer = new ResizeObserver(measure);
    observer.observe(room);
    observer.observe(inner);
    measure();
    return () => observer.disconnect();
  }, []);

  // Never above 1. A sheet blown up past its own size on a wide monitor would be
  // a preview that lies in the other direction.
  const scale = box.width > 0 ? Math.min(1, box.room / box.width) : 1;

  return (
    <div className="preview no-print">
      {/* The stage is what holds the space the scaled stack takes up. A
          transform doesn't change layout, so without a height of its own the
          frame would be as tall as the unscaled paper and the page would scroll
          past the bottom of the preview by more than half its height. */}
      <div
        className="preview__stage"
        ref={stage}
        style={{ height: box.height * scale || undefined }}
      >
        <div
          className="preview__stack"
          ref={stack}
          style={{ "--preview-scale": scale } as CSSProperties}
        >
          {sheets.map((sheet, index) => (
            // Indexed keys: the stack is rebuilt whole on every change and
            // nothing in it is stateful, so there is nothing a stable key would
            // preserve — the same reasoning `SheetView` gives for its blocks.
            <SheetView key={index} sheet={sheet} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The same sheets again, at full size, for the printer alone.
 *
 * Two renders rather than one un-scaled at print time, and it is worth being
 * explicit about why: `transform` on an ancestor of a page box is one of the
 * reliable ways to lose the bottom of a sheet, and print is the entire output
 * path here (§10) — there is no PDF to notice it in first. So the preview is
 * screen-only and this is print-only, and neither has to be undone under
 * pressure.
 *
 * It costs a second copy of the markup in the DOM and nothing on paper.
 */
export function PrintCopy({ sheets }: { sheets: Sheet[] }) {
  return (
    <div className="print-only" aria-hidden="true">
      {sheets.map((sheet, index) => (
        <SheetView key={index} sheet={sheet} />
      ))}
    </div>
  );
}
