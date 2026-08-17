/**
 * Handwriting: the ruling, the model, and how many times over.
 *
 * Four questions, and every one of them is on the page rather than behind a
 * mode: which paper, what is written on it, how the model is drawn, and how
 * many times each thing is written before the child is left on their own. The
 * §17 line "ruling and rule size · line spacing" is the first of those, and it
 * is the same control the paper family uses — on ruled paper the spacing
 * between the lines *is* the ruling.
 *
 * What is written changes with the style and nothing else does, which is why
 * only one content control is on screen at a time: a word list on a sheet of
 * the alphabet is a box that does nothing, and a box that does nothing is worse
 * than a missing one.
 */
import { MAX_REPEATS } from "@/engine/sheets/writing/handwriting";
import { RULINGS, rulingOf } from "@/engine/sheets/paper";
import type {
  HandwritingConfig,
  HandwritingStyle,
  LetterCase,
  Midline,
  RuleStyle,
  TraceStyle,
} from "@/engine/sheets/types";

import {
  Checkbox,
  Field,
  FieldSet,
  NumberStepper,
  TextArea,
} from "@/components/ui/kit";
import { parseWords } from "@/services/decks";

import { Choice, WordList, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<HandwritingStyle>("letters", "Letters"),
  opt<HandwritingStyle>("numbers", "Numbers"),
  opt<HandwritingStyle>("words", "Words"),
  opt<HandwritingStyle>("passage", "Passage"),
];

const CASES = [
  opt<LetterCase>("both", "Aa", "both cases"),
  opt<LetterCase>("upper", "A", "capitals"),
  opt<LetterCase>("lower", "a", "small letters"),
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

const RULES = Object.values(RULINGS).map((ruling) =>
  opt<RuleStyle>(ruling.id, ruling.label),
);

const MIDLINES = [
  opt<Midline>("dashed", "Dashed", "the usual"),
  opt<Midline>("solid", "Solid", "youngest"),
  opt<Midline>("none", "None", "oldest"),
];

export function HandwritingPanel({
  config,
  set,
}: PanelProps<HandwritingConfig>) {
  const ruling = rulingOf(config.rule);
  const rule = (patch: Partial<HandwritingConfig["rule"]>) =>
    set({ rule: { ...config.rule, ...patch } });

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

      {config.style === "words" && (
        <WordList
          label="Words"
          text={(config.words ?? []).join("\n")}
          onChange={(text) => set({ words: parseWords(text) })}
        />
      )}

      {config.style === "passage" && (
        <Field
          label="Passage"
          hint="Broken where the line runs out. A line break of your own is kept."
        >
          <TextArea
            value={config.text ?? ""}
            rows={4}
            onChange={(text) => set({ text })}
          />
        </Field>
      )}

      <Choice
        label="Ruling and line spacing"
        value={config.rule.style}
        onChange={(style) => rule({ style })}
        options={RULES}
        hint="Handwriting sizes are named by the space between one set of lines and the next."
      />

      {ruling.handwriting && (
        <>
          <Choice
            label="Midline"
            value={config.rule.midline ?? "dashed"}
            onChange={(midline) => rule({ midline })}
            options={MIDLINES}
          />
          <Checkbox
            label="Room for descenders"
            hint="Space below the baseline for the tail of a g."
            checked={config.rule.descender === true}
            onChange={(descender) => rule({ descender })}
          />
        </>
      )}

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
