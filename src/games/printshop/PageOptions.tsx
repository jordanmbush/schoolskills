/**
 * The options every sheet has, whatever is printed on it.
 *
 * `SheetOptions` in the engine is the same list, which is the point: these are
 * the fields no family owns, so they sit above the family panel and stay put
 * while a parent tries three families underneath them. Paper is even carried
 * across a family change (see `setFamily`) — somebody who has chosen A4 has
 * chosen it about their printer, not about long division.
 *
 * Every §17 option that isn't a family's own is here: type size in points, the
 * face, Letter/A4/Legal, portrait/landscape, margins, the name line, answer
 * boxes and cut lines.
 */
import {
  Checkbox,
  Field,
  FieldSet,
  Input,
  NumberStepper,
  TextArea,
} from "@/components/ui/kit";
import { FONT_PT } from "@/engine/sheets/paper";
import { MAX_INSTRUCTIONS, MAX_TITLE } from "@/engine/sheets/share";
import type {
  HeaderField,
  MarginSize,
  Orientation,
  PaperSize,
  SheetFont,
} from "@/engine/sheets/types";

import { Choice, opt, type PanelProps } from "./options/parts";

const SIZES = [
  opt<PaperSize>("letter", "Letter"),
  opt<PaperSize>("a4", "A4"),
  opt<PaperSize>("legal", "Legal"),
];

const ORIENTATIONS = [
  opt<Orientation>("portrait", "Portrait"),
  opt<Orientation>("landscape", "Landscape"),
];

const MARGINS = [
  opt<MarginSize>("none", "None"),
  opt<MarginSize>("narrow", "Narrow"),
  opt<MarginSize>("normal", "Normal"),
  opt<MarginSize>("wide", "Wide"),
];

/**
 * Named by shape, and never by a teaching model: D'Nealian® and Zaner-Bloser®
 * are trademarks with per-seat fonts behind them, and what a parent is picking
 * here is letterforms — a single-storey `a`, or a joined hand.
 *
 * Three of the five are cursive, and describing them by what the pencil does is
 * the only honest way to offer them: the hands taught in different countries
 * disagree about whether an ascender loops and about which letters join at all,
 * so there is no one of them to ship and call correct. Five is the last count
 * `Choice` still draws as a row of pills — the threshold is *past* five, not at
 * it (`options/parts.tsx`) — so all five faces stay on screen at once, which is
 * what a list where two entries differ by a detail worth reading needs. Each
 * carries a `hint`, and a sixth face would take the row to a dropdown and the
 * hints with it.
 */
const FONTS = [
  opt<SheetFont>("print", "Print", "single-storey a and g"),
  opt<SheetFont>("cursive", "Cursive, looped", "the traditional joined hand"),
  opt<SheetFont>(
    "cursive-modern",
    "Cursive, unlooped",
    "simpler shapes; the pencil lifts after b, f, g, j, p, q, s and y",
  ),
  opt<SheetFont>(
    "cursive-uk",
    "Cursive, fully joined",
    "lead-in strokes, and a join out of every letter",
  ),
  opt<SheetFont>("dyslexic", "Dyslexia", "weighted letters that can't mirror"),
];

/** The three blanks a worksheet asks for, and the order they are printed in. */
const FIELDS: Array<{ id: HeaderField; label: string }> = [
  { id: "name", label: "Name" },
  { id: "date", label: "Date" },
  { id: "class", label: "Class" },
];

export function PageOptions({ config, set }: PanelProps) {
  const paper = (patch: Partial<typeof config.paper>) =>
    set({ paper: { ...config.paper, ...patch } });

  const toggleField = (id: HeaderField, on: boolean) =>
    set({
      // Rebuilt from the canonical order rather than pushed onto the end, so
      // ticking Class before Date still prints name, date, class.
      fields: FIELDS.map((field) => field.id).filter((field) =>
        field === id ? on : config.fields.includes(field),
      ),
    });

  return (
    <>
      <Choice
        label="Paper"
        value={config.paper.size}
        onChange={(size) => paper({ size })}
        options={SIZES}
      />
      <Choice
        label="Orientation"
        value={config.paper.orientation}
        onChange={(orientation) => paper({ orientation })}
        options={ORIENTATIONS}
      />
      <Choice
        label="Margins"
        value={config.paper.margin}
        onChange={(margin) => paper({ margin })}
        options={MARGINS}
      />

      <FieldSet
        legend="Type size"
        hint="Points, as a type size is quoted on paper. Bigger type is an option here rather than something to zoom."
      >
        <NumberStepper
          label="Type size in points"
          value={config.fontPt}
          min={FONT_PT.min}
          max={FONT_PT.max}
          unit="pt"
          onChange={(fontPt) => set({ fontPt })}
        />
      </FieldSet>

      <Choice
        label="Face"
        value={config.font ?? "print"}
        onChange={(font) => set({ font })}
        options={FONTS}
        hint="Print is a single-storey a and g, the three cursive models are the joined hands different countries teach, and the dyslexia-friendly face has weighted letters that can't be mirrored. All five come with the sheet."
      />

      <Field label="Title">
        <Input
          value={config.title ?? ""}
          maxLength={MAX_TITLE}
          placeholder="The family's own title"
          onChange={(title) => set({ title: title || undefined })}
        />
      </Field>

      <Field label="Instructions">
        <TextArea
          value={config.instructions ?? ""}
          maxLength={MAX_INSTRUCTIONS}
          rows={2}
          placeholder="One line, printed under the title"
          onChange={(instructions) =>
            set({ instructions: instructions || undefined })
          }
        />
      </Field>

      <FieldSet
        legend="Lines to fill in"
        hint="Printed blank and filled in with a pencil. Nothing here holds a child's name — there is nowhere in a sheet to put one."
      >
        <span className="pool">
          {FIELDS.map((field) => (
            <Checkbox
              key={field.id}
              label={field.label}
              checked={config.fields.includes(field.id)}
              onChange={(on) => toggleField(field.id, on)}
            />
          ))}
        </span>
      </FieldSet>

      <Checkbox
        label="Answer boxes"
        hint="A box round the answer place rather than a rule under it."
        checked={config.answerBox === true}
        onChange={(answerBox) => set({ answerBox })}
      />
      <Checkbox
        label="Cut lines"
        hint="Dashed guides across the middle of the page, for a sheet you cut up."
        checked={config.cutLines === true}
        onChange={(cutLines) => set({ cutLines })}
      />
    </>
  );
}
