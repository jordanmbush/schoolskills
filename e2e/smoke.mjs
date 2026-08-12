import { chromium } from "playwright";

/**
 * Post-port smoke run: drives the real game in a real browser.
 *
 * The port swapped the entire persistence layer (Express + JSON file →
 * IndexedDB) and the router (BrowserRouter → HashRouter). Both are the kind of
 * change that type-checks perfectly and fails on first click, so this walks the
 * whole loop a player actually does: create a profile, race, finish, and — the
 * part that matters most — reload and confirm the run survived.
 */

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4322";
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on(
  "console",
  (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)),
);

let failures = 0;
const check = (label, ok, detail = "") => {
  log(`${ok ? "  ✓" : "  ✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

try {
  log("\n1. The island boots and reaches the profile picker");
  await page.goto(`${BASE}/flash-cards`, { waitUntil: "networkidle" });
  await page.waitForSelector(".driver, .empty, button", { timeout: 15000 });
  await page.waitForTimeout(800);
  check(
    "no boot error screen",
    (await page.locator(".boot__title").count()) === 0,
  );
  // HashRouter only writes the fragment once something navigates, so an
  // un-hashed URL on the entry screen is correct, not a failure.
  check(
    "picker rendered",
    (await page.getByRole("button", { name: /add a player/i }).count()) > 0,
  );

  log("\n2. Creating a profile writes to IndexedDB");
  await page
    .getByRole("button", { name: /add a player/i })
    .first()
    .click();
  await page.waitForSelector(".sheet__panel", { timeout: 8000 });
  // The name field carries no explicit type, and age is a −/+ stepper
  // rather than a number input — so target the panel, not input types.
  await page.locator(".sheet__panel input").first().fill("Smoke");
  await page.getByRole("button", { name: /^add player$/i }).click();
  await page.waitForSelector(".sheet__panel", {
    state: "detached",
    timeout: 8000,
  });
  await page.waitForTimeout(600);

  const stored = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("schoolskills");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return new Promise((res) => {
      const tx = db
        .transaction("profiles", "readonly")
        .objectStore("profiles")
        .getAll();
      tx.onsuccess = () => res(tx.result.map((p) => p.name));
    });
  });
  check(
    "profile persisted to IndexedDB",
    stored.includes("Smoke"),
    JSON.stringify(stored),
  );

  log("\n3. Entering the hub and starting a race");
  await page.getByText("Smoke", { exact: false }).first().click();
  await page.waitForTimeout(700);
  check("navigated into a profile", /#\/p\//.test(page.url()), page.url());

  // Match the exact control. A loose /race|play/ regex matches the
  // "← Players" back-link too, and clicking that returns to the picker —
  // which looks exactly like a routing bug in the app.
  await page.getByRole("button", { name: /set up a race/i }).click();
  await page.waitForTimeout(1200);

  const startBtn = page.getByRole("button", { name: /start race/i });
  check("reached race setup", (await startBtn.count()) > 0, page.url());
  await startBtn.click();
  await page.waitForTimeout(2600);

  log("\n4. Answering the deck");
  let answered = 0;
  for (let i = 0; i < 40; i++) {
    if (page.url().includes("results")) break;
    // Bounded: Playwright locators auto-wait 30s by default, so an
    // unbounded read here turns a missing card into a multi-minute stall
    // instead of a fast retry.
    const prompt = await page
      .locator(".card__prompt")
      .first()
      .textContent({ timeout: 1500 })
      .catch(() => null);
    if (!prompt) {
      await page.waitForTimeout(250);
      continue;
    }
    const m = prompt.trim().match(/^(\d+)\s*(\D)\s*(\d+)$/);
    if (!m) {
      await page.waitForTimeout(250);
      continue;
    }
    const [, a, op, b] = m;
    const x = Number(a),
      y = Number(b);
    const answer =
      op.includes("×") || op.includes("x")
        ? x * y
        : op.includes("÷")
          ? x / y
          : op.includes("+")
            ? x + y
            : x - y;
    const choice = page.getByRole("button", {
      name: String(answer),
      exact: true,
    });
    if (await choice.count()) await choice.first().click({ timeout: 3000 });
    else for (const d of String(answer)) await page.keyboard.press(d);
    answered++;
    await page.waitForTimeout(420);
  }
  check("answered cards", answered > 0, `${answered} cards`);
  // Poll the URL rather than waitForURL: a HashRouter transition changes
  // location.hash without a navigation, so waitForURL sits waiting for a
  // "load" event that never comes.
  await page
    .waitForFunction(() => location.hash.includes("results"), null, {
      timeout: 25000,
    })
    .catch(() => {});
  check(
    "reached the results screen",
    page.url().includes("results"),
    page.url(),
  );

  log("\n5. The run survives a reload (the whole point of the storage swap)");
  const savedRuns = await page.evaluate(async () => {
    const db = await new Promise((res) => {
      const r = indexedDB.open("schoolskills");
      r.onsuccess = () => res(r.result);
    });
    return new Promise((res) => {
      const tx = db
        .transaction("sessions", "readonly")
        .objectStore("sessions")
        .getAll();
      tx.onsuccess = () => res(tx.result.length);
    });
  });
  check(
    "session written to IndexedDB",
    savedRuns >= 1,
    `${savedRuns} session(s)`,
  );

  await page.goto(`${BASE}/flash-cards`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  check(
    "profile still listed after reload",
    (await page.getByText("Smoke").count()) > 0,
  );

  log(
    `\nconsole errors: ${errors.length ? errors.slice(0, 5).join(" | ") : "none"}`,
  );
  if (errors.length) failures++;
} catch (err) {
  log(`\n✗ threw: ${err.message}`);
  failures++;
} finally {
  await browser.close();
}

log(failures ? `\nFAILED (${failures})` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
