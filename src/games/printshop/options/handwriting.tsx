/**
 * Handwriting: the ruling, the model, and how many times over.
 *
 * The paper question is `RulingControls`, literally the control the paper family
 * uses, because on ruled paper the spacing between the lines *is* the ruling.
 * All it passes is a shorter list: blank paper has no pitch, so it has no rows
 * to write on, and offering it would name a ruling the sheet then quietly
 * refuses (`ruleOf`).
 *
 * What is written changes with the style and nothing else does, which is why
 * only one content control is on screen at a time: a word list on a sheet of the
 * alphabet is a box that does nothing, and a box that does nothing is worse than
 * a missing one.
 *
 * The one thing not on this panel is the hand. Cursive is a *face* rather than a
 * style of handwriting sheet — the letters, words and passages above are the
 * same exercises joined up — so it is chosen under Face with the rest of the
 * page's presentation, and a joins sheet resolves one for itself whatever is
 * picked there (`fontOf`).
 */
import { MAX_REPEATS } from "@/engine/sheets/writing/handwriting";
import { JOIN_FAMILIES } from "@/engine/sheets/writing/joins";
import type {
  HandwritingConfig,
  HandwritingStyle,
  JoinFamily,
  LetterCase,
  TraceStyle,
} from "@/engine/sheets/types";

import { Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";
import { parseWords } from "@/services/decks";

import { PassageControls } from "./passages";
import { Choice, WordList, opt, type PanelProps } from "./parts";
import { RULED_STYLES, RulingControls } from "./ruling";

const STYLES = [
  opt<HandwritingStyle>("letters", "Letters"),
  opt<HandwritingStyle>("numbers", "Numbers"),
  opt<HandwritingStyle>("joins", "Joins"),
  opt<HandwritingStyle>("words", "Words"),
  opt<HandwritingStyle>("passage", "Passage"),
];

const CASES = [
  opt<LetterCase>("both", "Aa", "both cases"),
  opt<LetterCase>("upper", "A", "capitals"),
  opt<LetterCase>("lower", "a", "small letters"),
];

/**
 * Every family, or one of them — and "every" first, because the whole
 * progression on one page is what a parent means by a joins sheet. The empty
 * string rather than a seventh id: absent is what the config already means by
 * all of them.
 */
const ALL_JOINS = "";

const JOINS = [
  opt<JoinFamily | typeof ALL_JOINS>(ALL_JOINS, "All", "the whole progression"),
  ...JOIN_FAMILIES.map((family) =>
    opt<JoinFamily | typeof ALL_JOINS>(family.id, family.label, family.blurb),
  ),
];

/** The five appearances of §6, plus the sheet with nothing to trace at all. */
const TRACES = [
  opt<TraceStyle>("dotted", "Dotted", "the usual"),
  opt<TraceStyle>("dashed", "Dashed"),
  opt<TraceStyle>("hollow", "Hollow"),
  opt<TraceStyle>("dim", "Grey"),
  opt<TraceStyle>("solid", "Solid"),
  opt<TraceStyle>("none", "None", "a model, then empty lines"),
];

export function HandwritingPanel({
  config,
  set,
}: PanelProps<HandwritingConfig>) {
  return (
    <>
      <Choice
        label="What to write"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />

      {config.style === "letters" && (
        <Choice
          label="Which letters"
          value={config.letters ?? "both"}
          onChange={(letters) => set({ letters })}
          options={CASES}
          hint="Both cases writes each letter as a pair — Aa, then Bb."
        />
      )}

      {config.style === "joins" && (
        <Choice
          label="Which joins"
          value={config.joins ?? ALL_JOINS}
          onChange={(joins) => set({ joins: joins || undefined })}
          options={JOINS}
          hint="A joins sheet is set in a joined hand whatever face is chosen above — two letters that don't touch are not a join. Pick the model under Face."
        />
      )}

      {config.style === "words" && (
        <WordList
          label="Words"
          text={(config.words ?? []).join("\n")}
          onChange={(text) => set({ words: parseWords(text) })}
        />
      )}

      {config.style === "passage" && (
        <PassageControls
          passage={config.passage}
          translation={config.translation}
          text={config.text}
          onChange={set}
        />
      )}

      <RulingControls
        rule={config.rule}
        onChange={(patch) => set({ rule: { ...config.rule, ...patch } })}
        options={RULED_STYLES}
      />

      <Choice
        label="How the model is drawn"
        value={config.trace}
        onChange={(trace) => set({ trace })}
        options={TRACES}
      />

      <FieldSet
        legend="Times each is written"
        hint="Capped at what the line holds."
      >
        <NumberStepper
          label="Times each is written"
          value={config.repeats}
          min={1}
          max={MAX_REPEATS}
          onChange={(repeats) => set({ repeats })}
        />
      </FieldSet>

      <Checkbox
        label="Trace, then write it alone"
        hint="A solid model first and an empty place last, with the tracing in between."
        checked={config.progression !== false}
        onChange={(progression) => set({ progression })}
      />
    </>
  );
}
