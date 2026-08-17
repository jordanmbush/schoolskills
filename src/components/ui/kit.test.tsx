import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Checkbox } from "./Checkbox";
import { NumberStepper } from "./NumberStepper";
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

  it("hides the readout from the screen reader that already has it", () => {
    // A range announces its own value on every change. A live number beside it
    // is either duplicate speech or speech in the wrong order.
    const html = render(
      <Range label="Columns" value={3} onChange={() => {}} min={1} max={6} />,
    );
    expect(html).toContain('aria-hidden="true"');
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

  it("stops offering a direction it can't go", () => {
    expect(stepper({ value: 5 })).toContain("disabled");
    expect(stepper({ value: 60 })).toContain("disabled");
    expect(stepper()).not.toContain("disabled");
  });

  it("prints a unit without letting it into the value", () => {
    const html = stepper({ label: "Type size in points", unit: "pt" });
    expect(html).toContain(">pt<");
    expect(html).toContain('value="20"');
  });
});
