#!/usr/bin/env node
/**
 * Converts the local-only hub's `data/hub.json` into a backup file this site
 * can import, so nobody loses progress in the move to schoolskills.app.
 *
 * The two schemas turned out to be identical — same profile fields, same
 * session fields — because the storage swap deliberately kept the shape and
 * only changed where it lives. So this is an envelope change, not a migration.
 * It still validates rather than assuming, since a silent mismatch would show
 * up as a kid's history quietly missing.
 *
 * ⚠️ The output contains children's names. It is written OUTSIDE the repo by
 * default — this repo is public. Do not move it in.
 *
 * Usage:
 *   node scripts/convert-legacy-hub.mjs [source hub.json] [output.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const source =
  process.argv[2] ?? join(homedir(), "repos/learning-hub/data/hub.json");
const target = process.argv[3] ?? join(homedir(), "schoolskills-backup.json");

const PROFILE_FIELDS = [
  "id",
  "name",
  "emoji",
  "color",
  "age",
  "soundOn",
  "xp",
  "badges",
  "createdAt",
];
const SESSION_FIELDS = [
  "id",
  "profileId",
  "game",
  "mode",
  "configKey",
  "config",
  "seed",
  "finishedAt",
  "durationMs",
  "correct",
  "incorrect",
  "bestStreak",
  "xpEarned",
  "cards",
];

const legacy = JSON.parse(readFileSync(source, "utf8"));

const problems = [];
for (const profile of legacy.profiles ?? []) {
  for (const field of PROFILE_FIELDS) {
    if (!(field in profile))
      problems.push(`profile ${profile.name}: missing ${field}`);
  }
}
for (const session of legacy.sessions ?? []) {
  for (const field of SESSION_FIELDS) {
    if (!(field in session))
      problems.push(`session ${session.id}: missing ${field}`);
  }
}
// An orphan would render as a run belonging to nobody.
const ids = new Set((legacy.profiles ?? []).map((p) => p.id));
for (const session of legacy.sessions ?? []) {
  if (!ids.has(session.profileId)) {
    problems.push(`session ${session.id}: no profile ${session.profileId}`);
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s) — not writing:`);
  for (const p of problems.slice(0, 20)) console.error(`   ${p}`);
  process.exit(1);
}

const backup = {
  version: 1,
  exportedAt: new Date().toISOString(),
  profiles: legacy.profiles ?? [],
  sessions: legacy.sessions ?? [],
};

writeFileSync(target, JSON.stringify(backup, null, 2));

const runsPer = new Map();
for (const s of backup.sessions) {
  runsPer.set(s.profileId, (runsPer.get(s.profileId) ?? 0) + 1);
}
console.log(`✓ Wrote ${target}`);
console.log(
  `  ${backup.profiles.length} profiles, ${backup.sessions.length} sessions`,
);
for (const p of backup.profiles) {
  console.log(
    `   ${p.emoji} ${p.name.padEnd(10)} age ${String(p.age).padStart(2)} · ${String(runsPer.get(p.id) ?? 0).padStart(3)} runs · ${p.xp} XP · ${p.badges.length} badges`,
  );
}
console.log("\n  Import it at /flash-cards → Backup & restore → Restore.");
console.log("  ⚠️  It holds real names. Keep it out of this public repo.");
