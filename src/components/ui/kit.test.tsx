import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Checkbox } from "./Checkbox";
import { NumberStepper, commitValue } from "./NumberStepper";
import { Range } from "./Range";
import { SegmentedControl } from "./SegmentedControl";

/**
 * What the four option-panel primitives owe an assistive technology.
 *
 * These assertions all have the same shape, because the design decision they
 * are protecting is the same one: **every primitive is a real control.** A
 * radio group built from `<Button pressed>`, a spinbutton built from a span,
 * a slider built from a draggable div — each of them looks identical on screen
 * and each of them costs the keyboard, the announced role and the announced
 * value. So the test does not simulate a key press; it checks that the element
 * which receives one is the element the platform already knows how to drive.
 *
 * The other half is naming. A control announces as "checkbox" whether or not
 * anyone said what it is for, so an unnamed one fails silently in exactly the
 * place nobody looks — which is why `label` is required on three of the four
 * and asserted here rather than trusted.
 */

const render = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("Checkbox", () => {
  it("is a real checkbox inside its label, so the row is the hit target", () => {
    const html = render(
      <Checkbox
        checked
        onChange={() => {}}
        label="Include negatives"
        hint="Answers below zero"
      />,
    );
    expect(html).toContain("<label");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
    expect(html).toContain("Include negatives");
    expect(html).toContain("Answers below zero");
  });

  it("says when it is off, rather than leaving the attribute out", () => {
    const html = render(
      <Checkbox checked={false} onChange={() => {}} label="Answer key" />,
    );
    expect(html).not.toContain("checked");
  });
});

describe("SegmentedControl", () => {
  const options = [
    { value: "letter" as const, label: "Letter" },
    { value: "a4" as const, label: "A4" },
    { value: "legal" as const, label: "Legal", disabled: true },
  ];

  it("is one named radio group, not a row of unrelated toggles", () => {
    const html = render(
      <SegmentedControl
        label="Paper"
        value="a4"
        onChange={() => {}}
        options={options}
      />,
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Paper"');

    // Three radios sharing one name is what makes them one group: arrow keys
    // move between them and Tab treats the set as a single stop.
    const names = [...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(names.length).toBe(3);
    expect(new Set(names).size).toBe(1);
    expect(html.match(/type="radio"/g)?.length).toBe(3);
    expect(html.match(/checked/g)?.length).toBe(1);
    expect(html).toContain("disabled");
  });

  it("gives a symbol its words", () => {
    // "×" is read as "times" by one screen reader and "multiplication sign" by
    // another; `title` is what settles it, and it doubles as the tooltip.
    const html = render(
      <SegmentedControl
        label="Operation"
        value="mul"
        onChange={() => {}}
        options={[{ value: "mul", label: "×", title: "Multiplication" }]}
      />,
    );
    expect(html).toContain('aria-label="Multiplication"');
    expect(html).toContain('title="Multiplication"');
    expect(html).toContain("×");
  });

  it("only lets the word hide when a symbol is left holding the pill", () => {
    // `.segmented__word` is the under-560px hide. On its own a label would
    // leave an empty pill behind, so the class is worn only beside a symbol.
    const withSymbol = render(
      <SegmentedControl
        label="Operation"
        value="mul"
        onChange={() => {}}
        options={[
          { value: "mul", label: "Multiply", symbol: "×", title: "Multiply" },
        ]}
      />,
    );
    expect(withSymbol).toContain('<span aria-hidden="true">×</span>');
    expect(withSymbol).toContain('class="segmented__word">Multiply');

    const wordOnly = render(
      <SegmentedControl
        label="Paper"
        value="a4"
        onChange={() => {}}
        options={options}
      />,
    );
    expect(wordOnly).not.toContain("segmented__word");
  });
});

describe("Range", () => {
  it("is a real slider, named, bounded and stepped", () => {
    const html = render(
      <Range
        label="Type size"
        value={14}
        onChange={() => {}}
        min={8}
        max={24}
        step={2}
        format={(pt) => `${pt} pt`}
      />,
    );
    expect(html).toContain('type="range"');
    expect(html).toContain('aria-label="Type size"');
    expect(html).toContain('min="8"');
    expect(html).toContain('max="24"');
    expect(html).toContain('step="2"');
    expect(html).toContain("14 pt");
  });

  it("says the formatted value rather than the number behind it", () => {
    // The whole reason `format` exists is that 14 reads as "14 pt" and 625 as
    // "⅝ in". Hiding the readout without this leaves a screen-reader user with
    // the raw slider number in exactly the case the formatting was for.
    const html = render(
      <Range
        label="Type size"
        value={14}
        onChange={() => {}}
        min={8}
        max={24}
        format={(pt) => `${pt} pt`}
      />,
    );
    expect(html).toContain('aria-valuetext="14 pt"');
  });

  it("hides the readout only because aria-valuetext carries it", () => {
    // Unformatted, there is nothing to add: the attribute is left off so the
    // platform's own announcement stands rather than being restated.
    const html = render(
      <Range label="Columns" value={3} onChange={() => {}} min={1} max={6} />,
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("aria-valuetext");
  });
});

describe("NumberStepper", () => {
  const stepper = (props: Partial<Parameters<typeof NumberStepper>[0]> = {}) =>
    render(
      <NumberStepper
        label="Problems"
        value={20}
        onChange={() => {}}
        min={5}
        max={60}
        {...props}
      />,
    );

  it("is a real number field between two named buttons", () => {
    const html = stepper();
    expect(html).toContain('type="number"');
    expect(html).toContain('aria-label="Problems"');
    expect(html).toContain('value="20"');
    // Named after the thing they change, so a panel of steppers doesn't
    // announce as "increase, increase, increase".
    expect(html).toContain('aria-label="Decrease problems"');
    expect(html).toContain('aria-label="Increase problems"');
  });

  it("marks the direction it can't go without taking the focus with it", () => {
    // Which button says it is out of road matters, so the assertion is
    // positional: disabling both, or the wrong one, would pass a bare
    // `toContain("disabled")`.
    const atMin = stepper({ value: 5 });
    expect(atMin).toMatch(
      /aria-label="Decrease problems"[^>]*aria-disabled="true"/,
    );
    expect(atMin).not.toMatch(
      /aria-label="Increase problems"[^>]*aria-disabled/,
    );

    const atMax = stepper({ value: 60 });
    expect(atMax).toMatch(
      /aria-label="Increase problems"[^>]*aria-disabled="true"/,
    );
    expect(atMax).not.toMatch(
      /aria-label="Decrease problems"[^>]*aria-disabled/,
    );

    expect(stepper()).not.toContain("aria-disabled");

    // And never the real attribute for a bound: a browser blurs a disabled
    // element, so a keyboard user pressing − to the minimum would land on
    // <body> and Tab would restart at the top of the page. The caller's own
    // `disabled` is a different thing and stays real.
    expect(atMin).not.toContain(" disabled");
    expect(stepper({ disabled: true })).toContain(" disabled");
  });

  it("prints a unit without letting it into the value", () => {
    const html = stepper({ label: "Type size in points", unit: "pt" });
    expect(html).toContain(">pt<");
    expect(html).toContain('value="20"');
  });
});

/**
 * The draft/commit rule, tested as a function.
 *
 * There is no jsdom here, so the state machine is only reachable as the pure
 * decision it was extracted into — which is the half worth protecting anyway:
 * what a box holding "12.5", "abc" or "300" should hand the caller.
 */
describe("commitValue", () => {
  const commit = (draft: string, current = 20, step = 1) =>
    commitValue(draft, current, 5, 60, step);

  it("keeps what was there when the box says nothing usable", () => {
    expect(commit("")).toBe(20);
    expect(commit("   ")).toBe(20);
    expect(commit("abc")).toBe(20);
  });

  it("clamps rather than refusing", () => {
    expect(commit("3")).toBe(5);
    expect(commit("300")).toBe(60);
    expect(commit("40")).toBe(40);
  });

  it("snaps to the step grid, measured from the minimum", () => {
    // "A small whole number" is the module's first line; 12.5 is not one.
    expect(commit("12.5")).toBe(13);
    // Grid of 5 from a minimum of 5: 5, 10, 15 … so 23 is not an option.
    expect(commit("23", 20, 5)).toBe(25);
    // Rounding up off the last cell is clamped back inside the bound.
    expect(commit("59", 20, 5)).toBe(60);
  });
});
