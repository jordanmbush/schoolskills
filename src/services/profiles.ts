import type { KeyboardMode, Profile } from "@/engine/types";

import * as store from "./storage/db";

/**
 * Profile CRUD, and the validation that used to live in the Express handlers.
 *
 * Moving validation to the client doesn't make it weaker here: there is no
 * server left to protect, and the only person who can send bad input is the
 * person whose own data it is. What it still buys is a single place that turns
 * a typo into a readable message instead of a corrupt record.
 */

export type NewProfile = Pick<Profile, "name" | "emoji" | "color" | "age">;

export class InvalidInput extends Error {}

const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string")
    throw new InvalidInput(`${field} must be text`);
  const trimmed = value.trim();
  if (!trimmed) throw new InvalidInput(`${field} can't be empty`);
  if (trimmed.length > max) {
    throw new InvalidInput(`${field} must be ${max} characters or fewer`);
  }
  return trimmed;
}

function validate(input: Partial<NewProfile>, partial: boolean) {
  const out: Partial<Profile> = {};
  const has = (key: keyof NewProfile) => Object.hasOwn(input, key);

  if (!partial || has("name")) out.name = text(input.name, "Name", 24);
  if (!partial || has("emoji")) out.emoji = text(input.emoji, "Avatar", 8);
  if (!partial || has("color")) {
    const color = text(input.color, "Colour", 24);
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      throw new InvalidInput("Colour must be a hex value like #38bdf8");
    }
    out.color = color;
  }
  if (!partial || has("age")) {
    const age = Number(input.age);
    if (!Number.isInteger(age) || age < 3 || age > 18) {
      throw new InvalidInput("Age must be a whole number between 3 and 18");
    }
    out.age = age;
  }
  return out;
}

/**
 * The three modes, as a runtime check.
 *
 * The type stops a caller in this codebase writing "gide"; nothing stops a
 * restored backup or a hand-edited record, and this is the layer that turns bad
 * input into no change rather than a corrupt profile. Absent is a legal state
 * (it reads as "guide"), so failing the check simply leaves the field alone.
 */
const isKeyboardMode = (value: unknown): value is KeyboardMode =>
  value === "off" || value === "keys" || value === "guide";

/** Names are the only thing players use to tell each other apart on the picker. */
async function assertNameFree(name: string, exceptId?: string) {
  const existing = await store.allProfiles();
  const clash = existing.find(
    (p) => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase(),
  );
  if (clash)
    throw new InvalidInput(`There's already a player called ${clash.name}`);
}

export async function create(input: NewProfile): Promise<Profile> {
  const clean = validate(input, false);
  await assertNameFree(clean.name!);
  const profile: Profile = {
    id: nextId("p"),
    name: clean.name!,
    emoji: clean.emoji!,
    color: clean.color!,
    age: clean.age!,
    soundOn: true,
    xp: 0,
    badges: [],
    createdAt: new Date().toISOString(),
  };
  await store.putProfile(profile);
  // Worth asking exactly once, at the moment there is finally something to
  // lose. Asking on first page load would be a prompt about nothing.
  void store.requestPersistence();
  return profile;
}

export async function update(
  id: string,
  patch: Partial<Profile>,
): Promise<Profile> {
  const existing = (await store.allProfiles()).find((p) => p.id === id);
  if (!existing) throw new InvalidInput("No player with that id");

  const clean = validate(patch, true);
  if (clean.name) await assertNameFree(clean.name, id);

  const updated: Profile = {
    ...existing,
    ...clean,
    // Not part of the validated set — it's a toggle, not user-entered text.
    ...(Object.hasOwn(patch, "soundOn")
      ? { soundOn: Boolean(patch.soundOn) }
      : {}),
    // Same reasoning as `soundOn`: a setting, not text. Only the three modes
    // are written, so a patch carrying anything else leaves the profile on
    // whatever it was on — a bad value here would otherwise sit in storage
    // until a child chose again, and the read site would have to defend
    // against it forever.
    ...(isKeyboardMode(patch.keyboard) ? { keyboard: patch.keyboard } : {}),
  };
  await store.putProfile(updated);
  return updated;
}

export async function remove(id: string): Promise<void> {
  await store.removeProfileCascade(id);
}
