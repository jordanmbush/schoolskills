/**
 * Which sounds have been taught, and what to make out of them.
 *
 * The tick list is the panel. Every other family here asks for a range or a
 * list of words; this one asks the only question a phonics worksheet has ever
 * really turned on — how far have you got? — and everything on the page falls
 * out of the answer (§13). It is long, and it is meant to be: a parent ticks it
 * once, saves it under their own name, and never sees it again until the next
 * sound is taught.
 *
 * **There are no presets in this control and there will not be.** A named set
 * of sounds is somebody's course, and the two honest names for one are the ones
 * a parent writes: their child's, and their own. `services/phonics.ts` is where
 * a named list is kept.
 *
 * The three marking switches are independent for the same reason. Each is a
 * convention shared across phonics traditions; the combination of them under a
 * programme's name is that programme's modified alphabet, and nothing here
 * ships one.
 */
import { Checkbox, FieldSet } from "@/components/ui/kit";
import {
  CORRESPONDENCES,
  PHONEME_BY_ID,
  graphemeText,
  isTeachable,
  type Correspondence,
  type Inventory,
} from "@/engine/sheets/phonics";
import {
  PHONICS_STYLES,
  phonicsColumns,
  phonicsStyleLabel,
} from "@/engine/sheets/phonics/sheets";
import type { PhonicsConfig } from "@/engine/sheets/types";
import { parseWords } from "@/services/decks";

import { Choice, Sizing, WordList, opt, type PanelProps } from "./parts";

/** The seven, in the order the engine lists them — roughly by age. */
const STYLES = PHONICS_STYLES.map((style) =>
  opt(style, phonicsStyleLabel(style)),
);

/**
 * Whether a spelling is filed under the consonants or the vowels.
 *
 * By its first sound rather than by its letters, which is the same rule the
 * table itself is ordered by — `qu` is filed with the consonants because it
 * starts on /k/, and the `e` of `have`, which says nothing at all, sits with
 * the vowels where a parent would look for it.
 */
const isConsonant = (entry: Correspondence): boolean =>
  PHONEME_BY_ID.get(entry.phonemes[0] ?? "")?.kind === "consonant";

const TEACHABLE = CORRESPONDENCES.filter(isTeachable);

const GROUPS: Array<{ label: string; hint: string; sounds: Correspondence[] }> =
  [
    {
      label: "Consonants",
      hint: "A spelling and the sound it makes there — tick the ones you have taught.",
      sounds: TEACHABLE.filter(isConsonant),
    },
    {
      label: "Vowels",
      hint: "The same letters can say more than one thing. `ea` is three rows, because `eat` and `bread` are two different lessons.",
      sounds: TEACHABLE.filter((entry) => !isConsonant(entry)),
    },
  ];

export function PhonicsPanel({ config, set }: PanelProps<PhonicsConfig>) {
  const inventory: Inventory = config.inventory ?? { sounds: [], tricky: [] };
  const ticked = new Set(inventory.sounds);
  const marking = config.marking ?? {};

  const setSounds = (sounds: string[]) =>
    set({ inventory: { ...inventory, sounds } });

  return (
    <>
      <Choice
        label="Sheet"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
        hint="Seven sheets out of one list of sounds. Nothing on any of them uses a spelling that is not ticked below."
      />

      {GROUPS.map((group) => (
        <FieldSet
          key={group.label}
          legend={`${group.label} — ${group.sounds.filter((entry) => ticked.has(entry.id)).length} of ${group.sounds.length}`}
          hint={group.hint}
        >
          <span className="pool">
            {group.sounds.map((entry) => (
              <Checkbox
                key={entry.id}
                label={graphemeText(entry.grapheme)}
                hint={`as in ${entry.example}`}
                checked={ticked.has(entry.id)}
                onChange={(on) =>
                  setSounds(
                    on
                      ? // Filtered from the table rather than appended, so the
                        // list stays in teaching order however it was ticked.
                        TEACHABLE.filter(
                          (row) => row.id === entry.id || ticked.has(row.id),
                        ).map((row) => row.id)
                      : inventory.sounds.filter((id) => id !== entry.id),
                  )
                }
              />
            ))}
          </span>
        </FieldSet>
      ))}

      {/* The other half of the model, and the only door a word that follows no
          rule may come through. `said` is not decodable because `ai` was
          ticked, and never becomes so — it is here or it is nowhere. */}
      <WordList
        label="Words taught by sight"
        text={inventory.tricky.join("\n")}
        onChange={(text) =>
          set({
            inventory: {
              ...inventory,
              tricky: parseWords(text).map((word) => word.toLowerCase()),
            },
          })
        }
        rows={3}
        hint="The tricky words, heart words or red words your scheme teaches whole. A dictation line and a sentence strip may use them; nothing else will."
      />

      <FieldSet
        legend="Marking"
        hint="Three conventions many schemes share. Off is the usual, and none of these is anybody's alphabet."
      >
        <span className="pool">
          <Checkbox
            label="Long vowel bar"
            hint="cāke"
            checked={marking.macron === true}
            onChange={(macron) => set({ marking: { ...marking, macron } })}
          />
          <Checkbox
            label="Silent letters pale"
            hint="the e of cake"
            checked={marking.silent === true}
            onChange={(silent) => set({ marking: { ...marking, silent } })}
          />
          <Checkbox
            label="Joined digraphs"
            hint="sh, ck, igh"
            checked={marking.joined === true}
            onChange={(joined) => set({ marking: { ...marking, joined } })}
          />
        </span>
      </FieldSet>

      <Sizing
        label="How many"
        count={config.count}
        columns={phonicsColumns(config.style) > 1 ? config.columns : undefined}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
        maxColumns={phonicsColumns(config.style)}
      />
    </>
  );
}
