/**
 * A letter taught in more than one shape (`docs/printables.md` §25).
 *
 * A hand's `hand.json` lists the letters it draws more than once and the
 * forms it draws them in, first the hand's own: `"t": ["curved",
 * "straight"]`. Each form is a drawing of its own, named for it — `t.curved.svg`,
 * `t.straight.svg` — and the ingest folds them into one glyph: the hand's own
 * form is the glyph, and the rest sit under it by name. This is the naming
 * and the folding; `drawing.mjs` reads the files.
 */
import { CHARACTERS, FORMS } from "./names.mjs";

/**
 * A drawing's id, `a.double`, split into the stem the names table knows and
 * the form after the dot. `period` has no dot and no form.
 */
export function splitId(id) {
  const dot = id.indexOf(".");
  return dot < 0
    ? { stem: id, form: undefined }
    : { stem: id.slice(0, dot), form: id.slice(dot + 1) };
}

/**
 * The character and form a drawing id names, or a thrown reason it names
 * none: a stem the table lacks, a form no hand has, or a form this hand does
 * not draw the letter in. A letter the hand lists must be named with a form,
 * since an unnamed `t.svg` beside `t.straight.svg` would be two claims to be
 * the hand's own `t`.
 */
export function identify(hand, id, file) {
  const { stem, form } = splitId(id);
  const character = CHARACTERS[stem];
  if (character === undefined) {
    throw new Error(`${file}: "${stem}" is not a glyph the names table knows`);
  }
  const forms = hand.forms?.[character];
  if (form === undefined) {
    if (forms) {
      throw new Error(
        `${file}: "${character}" is drawn in more than one form; name this one ${stem}.${forms[0]}.svg`,
      );
    }
    return { character, form };
  }
  if (!FORMS.includes(form)) {
    throw new Error(`${file}: "${form}" is not a form the names table knows`);
  }
  if (!forms?.includes(form)) {
    throw new Error(
      `${file}: hand.json does not list a "${form}" form of "${character}"`,
    );
  }
  return { character, form };
}

/**
 * The glyph table from the drawings read, one glyph per character. A letter
 * with forms takes the hand's own as the glyph and the others as its
 * alternates; a form listed but not yet drawn is a warning, since the table
 * is written before the drawing is, and a missing own form is a failure,
 * since there is then no letter to fall back on.
 */
export function assemble(hand, drawings, warnings = []) {
  const glyphs = {};
  const byCharacter = new Map();
  for (const { character, form, glyph } of drawings) {
    if (!byCharacter.has(character)) byCharacter.set(character, new Map());
    byCharacter.get(character).set(form, glyph);
  }
  for (const [character, drawn] of byCharacter) {
    const forms = hand.forms?.[character];
    if (!forms) {
      glyphs[character] = drawn.get(undefined);
      continue;
    }
    const [own, ...others] = forms;
    const glyph = drawn.get(own);
    if (glyph === undefined) {
      throw new Error(
        `${character}: the hand's own "${own}" form is not drawn, so there is nothing for the others to stand in for`,
      );
    }
    const alternates = {};
    for (const form of others) {
      const drawing = drawn.get(form);
      if (drawing === undefined) {
        warnings.push(`${character}: no "${form}" form drawn yet`);
      } else {
        alternates[form] = drawing;
      }
    }
    glyphs[character] = { ...glyph, forms: { own, alternates } };
  }
  return glyphs;
}
