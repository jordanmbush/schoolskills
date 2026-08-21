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

/*
 * `SMOKE_CPU=4` runs the whole walk on a quarter of this machine's processor.
 *
 * Every timing-sensitive thing below is timing-sensitive *because a CI runner
 * is slower than a laptop*, and a check that only ever runs at full speed is a
 * check whose margins nobody has measured. This is the knob that measures
 * them: a hailstorm flake that took a run of CI to see reproduces here in
 * thirty seconds at `SMOKE_CPU=10`, and a fix for one is not demonstrated
 * until it has been run under it.
 *
 * Off by default, because the point of the ordinary run is to be fast.
 */
const CPU = Number(process.env.SMOKE_CPU ?? 1);
if (CPU > 1) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  log(`(processor throttled ${CPU}×)`);
}

/*
 * `SMOKE_LAG=300` puts 300ms between deciding on a key and pressing it.
 *
 * The other half of a slow runner, and the half `SMOKE_CPU` cannot show. CPU
 * throttling slows the *page*, and the hailstorm's clock slows with it
 * (`MAX_STEP_MS` caps how much wave time one frame may be worth), so the game
 * politely waits for a throttled driver. What a loaded CI box actually does is
 * the opposite: the browser keeps its frames while the node process driving it
 * is starved, so the wave falls at full speed into a hand that has gone slow.
 *
 * That gap is where a shot at "the lowest letter" turns into a shot at the
 * letter that used to be lowest, and it is the whole of the flake this knob
 * exists to reproduce. Anything below that reads the field and then acts on it
 * must survive `SMOKE_LAG=500`.
 */
const LAG = Number(process.env.SMOKE_LAG ?? 0);
if (LAG) log(`(${LAG}ms of driver lag before every keypress)`);

/** A keystroke, taken as slowly as `SMOKE_LAG` says a starved driver takes it. */
const press = async (key) => {
  if (LAG) await page.waitForTimeout(LAG);
  await page.keyboard.press(key);
};

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

/**
 * Everything in one of the app's object stores, read from the page.
 *
 * Three sections below check that something reached IndexedDB, and the same
 * dozen lines of open-transaction-getAll were written out once per store —
 * three places for the database name to be wrong, and three chances for one of
 * them to forget that a failed open should fail the run rather than hang it.
 */
const readStore = (store) =>
  page.evaluate(
    (name) =>
      new Promise((res, rej) => {
        const open = indexedDB.open("schoolskills");
        open.onerror = () => rej(open.error);
        open.onsuccess = () => {
          const all = open.result
            .transaction(name, "readonly")
            .objectStore(name)
            .getAll();
          all.onsuccess = () => res(all.result);
        };
      }),
    store,
  );

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
  await page.waitForSelector(".modal__panel", { timeout: 8000 });
  // The name field carries no explicit type, and age is a −/+ stepper
  // rather than a number input — so target the panel, not input types.
  await page.locator(".modal__panel input").first().fill("Smoke");
  await page.getByRole("button", { name: /^add player$/i }).click();
  await page.waitForSelector(".modal__panel", {
    state: "detached",
    timeout: 8000,
  });
  await page.waitForTimeout(600);

  const stored = (await readStore("profiles")).map((p) => p.name);
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
  const savedRuns = (await readStore("sessions")).length;
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

  /*
   * The second island, and the second thing that writes to that database.
   *
   * Worth walking for the same reason the race is: the builder is a config in
   * the address bar, a sheet built from it in the browser, and a record in the
   * `sheets` store — three things that type-check perfectly and fail on first
   * click. The reload at the end is the one that matters, because it proves the
   * URL is genuinely the save file rather than something that only looks right
   * while the state is still in memory.
   */
  log("\n6. The bench builds a sheet, and the URL is the save file");
  await page.goto(`${BASE}/printables/make`, { waitUntil: "networkidle" });
  await page.waitForSelector(".bench", { timeout: 15000 });
  await page.waitForTimeout(900);
  check(
    "a sheet is on the bench",
    (await page.locator(".preview .sheet__problem").count()) > 0,
  );
  check("the config is in the fragment", /#s=/.test(page.url()), page.url());

  await page.locator(".saved input").fill("Smoke sheet");
  await page.getByRole("button", { name: /save to my sheets/i }).click();
  await page.waitForTimeout(800);
  const savedSheets = (await readStore("sheets")).map((s) => s.name);
  check(
    "sheet saved to IndexedDB",
    savedSheets.includes("Smoke sheet"),
    JSON.stringify(savedSheets),
  );

  const shared = page.url();
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".bench", { timeout: 15000 });
  await page.waitForTimeout(900);
  check("the shared link reopens the same sheet", page.url() === shared);

  /*
   * The headline of the whole section, walked end to end (§14).
   *
   * It is the one feature that crosses every layer in the app — the record
   * book computes it, a service reads it out of the same IndexedDB the race
   * just wrote to, the engine turns it into a sheet, and the bench prints it —
   * so it is exactly the kind of thing that type-checks and fails on first
   * click. The smoke player answers correctly and quickly, so what this
   * usually exercises is the *other* path: a child with nothing standing out
   * still gets a sheet worth printing rather than an empty page.
   */
  log("\n6b. The bench starts from what the record book knows");
  const steps = await page.locator(".bootstrap__step").count();
  // Two at least — the missed facts and a paste. The saved-list step only
  // appears for a household that has typed one in, which this one has not.
  check("the bootstraps are offered", steps >= 2, `${steps} steps`);

  const beforeBootstrap = page.url();
  await page
    .locator(".bootstrap__step")
    .first()
    .getByRole("button")
    .first()
    .click();
  await page.waitForTimeout(900);
  check(
    "pressing one puts a printable sheet on the bench",
    page.url() !== beforeBootstrap &&
      (await page.locator(".preview .sheet__problem").count()) > 0,
    page.url().slice(0, 60),
  );

  /*
   * Where the paper actually lands on the paper.
   *
   * Print is the whole output path here (§10) — there is no PDF render to
   * notice a problem in first — and the failure mode is invisible on screen by
   * construction: the preview is a separate, scaled copy, so a bench that
   * indents or offsets the *print* copy looks perfect right up until the
   * printer runs. It cost 18px off the right edge of Letter and a second sheet
   * of paper once already.
   *
   * The assertion is the whole contract in two numbers. `print.css` zeroes the
   * `@page` margin because the sheet owns its own geometry, so a correctly
   * printed sheet starts at 0,0 — the same box a catalog page gives it, which
   * is measured here too rather than assumed. Anything between the sheet and
   * the page box shows up as a non-zero offset and nothing else does.
   */
  log("\n7. The printed sheet is the paper, not a sheet inside a layout");
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(400);
  const benchBox = await page
    .locator(".print-only .sheet")
    .first()
    .boundingBox();
  check(
    "the builder's printed sheet starts at the corner of the page",
    benchBox !== null &&
      Math.round(benchBox.x) === 0 &&
      Math.round(benchBox.y) === 0,
    JSON.stringify(benchBox),
  );
  // 8.5in at 96dpi. A sheet that measures anything else has had a transform or
  // a scale leak onto it, which is a ⅝ rule that prints as something else.
  check(
    "and is 8.5in wide, unscaled",
    benchBox !== null && Math.round(benchBox.width) === 816,
    JSON.stringify(benchBox),
  );

  /*
   * Print media, said again — and it has to be said again after every one of
   * these navigations.
   *
   * The emulation does not reliably survive a cross-document load: the page
   * comes back with `matchMedia("print")` false, the masthead laid out and the
   * sheet where the *screen* puts it, which measures as a sheet indented 232px
   * into a page it should start at the corner of. That is not a settling race
   * — it does not resolve at 1.4s, throttled or not — so waiting cannot fix
   * it; it can only decide the checks below are measuring the screen and
   * saying "print".
   *
   * It stayed hidden because a laptop happened to keep the emulation across
   * this hop and a throttled run did not. Restating it costs one call and
   * makes the media the measurement's own, rather than something inherited
   * from whatever ran before it.
   */
  await page.goto(`${BASE}/printables/lined-paper`, {
    waitUntil: "networkidle",
  });
  await page.emulateMedia({ media: "print" });
  const catalogBox = await page.locator(".sheet").first().boundingBox();
  check(
    "a catalog page puts the same sheet in the same place",
    catalogBox !== null &&
      Math.round(catalogBox.x) === 0 &&
      Math.round(catalogBox.y) === 0,
    JSON.stringify(catalogBox),
  );

  /*
   * And where the scissors go.
   *
   * The card shelf makes the one claim on this site that a reader settles with
   * a ruler: a blank flashcard is three and three quarter inches by two and a
   * quarter, and the cut lines are the edges of it. Neither half of that can be
   * checked without a browser — the engine's numbers are in mil, and what
   * reaches paper is whatever the box model and the grid did with them.
   *
   * The third measurement is the one that would go wrong silently. The block is
   * exactly as wide as its cards, so what the page did not use sits outside it,
   * and `margin-inline: auto` is the only thing making the left of that equal
   * the right. A block flushed to one side prints a stack of cut sheets that are
   * not square with each other, and looks identical in every preview.
   */
  log("\n8. A card measures what the page says it measures");
  await page.goto(`${BASE}/printables/templates/blank-flashcards`, {
    waitUntil: "networkidle",
  });
  // Again, for the reason above. Every measurement in this section says "on the
  // paper", and only this line makes that true of the page it just loaded.
  await page.emulateMedia({ media: "print" });
  const face = await page.locator(".sheet__cut-card").first().boundingBox();
  check(
    "a blank flashcard is 3.75in by 2.25in on the paper",
    face !== null &&
      Math.round(face.width) === Math.round(3.75 * 96) &&
      Math.round(face.height) === Math.round(2.25 * 96),
    JSON.stringify(face),
  );

  const cutBlock = await page.locator(".sheet__cut").boundingBox();
  const cardPage = await page.locator(".sheet").first().boundingBox();
  const left = cutBlock.x - cardPage.x;
  const right = cardPage.x + cardPage.width - (cutBlock.x + cutBlock.width);
  check(
    "and what is left over is split evenly either side of it",
    Math.round(left) === Math.round(right),
    `left ${left}, right ${right}`,
  );

  // The vertical guides, in order. Two columns is three of them, and the middle
  // one has to land on the boundary the two cards share — a guide near the cut
  // rather than on it is the sliver down one side of every other card.
  const guides = await page
    .locator(".sheet__cut-guides line")
    .evaluateAll((lines) =>
      lines
        .map((line) => line.getBoundingClientRect())
        .filter((box) => box.width < 1)
        .map((box) => Math.round(box.x)),
    );
  check(
    "the cut lines are the card boundaries, trim edge included",
    guides.length === 3 &&
      Math.abs(guides[1] - (Math.round(cutBlock.x) + Math.round(3.75 * 96))) <=
        1,
    JSON.stringify(guides),
  );
  await page.emulateMedia({ media: null });

  /*
   * The one thing in this app that runs sixty times a second.
   *
   * Hailstorm moves its letters by writing a custom property straight onto
   * them from a `requestAnimationFrame` loop (docs/typing.md §8.9), and both
   * halves of that are invisible to every other kind of test. A unit test has
   * no rAF and no layout, so it can neither see a stone move nor see a frame
   * outlive the screen that asked for it — and an orphaned rAF is the classic
   * way an animation loop passes every gate and then burns a phone battery
   * behind a screen the child has already left.
   *
   * So the browser is asked directly, in two ways. The write half is measured
   * by how MANY distinct positions a single stone occupies across a window
   * several spawns long — a number a re-render cannot reach and only a frame
   * loop can. The lifetime half is a ledger of every frame handle requested
   * and not yet delivered or cancelled, which two numbers settle: one frame in
   * flight while the storm is running, and none at all once the run is over or
   * the screen is gone.
   */
  log("\n9. The hailstorm falls, and its loop dies with the screen");
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    const caf = window.cancelAnimationFrame.bind(window);
    const live = new Set();
    window.__pendingFrames = () => live.size;
    window.requestAnimationFrame = (cb) => {
      let id = 0;
      id = raf((t) => {
        live.delete(id);
        cb(t);
      });
      live.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      live.delete(id);
      caf(id);
    };
  });

  await page.goto(`${BASE}/typing`, { waitUntil: "networkidle" });
  await page.getByText("Smoke", { exact: false }).first().click();
  await page.waitForTimeout(700);
  const player = (await page.evaluate(() => location.hash)).replace("#/p/", "");
  /**
   * Open lesson 4's storm — "First ice", the first of the twenty (§5.6).
   *
   * By URL rather than by pressing its tile, which section 13 does: what these
   * sections are about is the game, and a tile press would put the ladder's
   * unlock rule in front of every one of them. The rung is in the path because
   * a storm is a level (`#/p/:id/storm/:lessonId`).
   *
   * Lesson 4 is the one the numbers below are of: twelve letters, one at a
   * time — `gap` clears `fall`, so this level never puts two on screen — over
   * about twenty seconds, from the seed the table gives it. Being able to sit
   * through a whole wave is why the FIRST storm is the one measured.
   */
  const STORM_LESSON = "L04";

  /*
   * `QUEUE_MS` from `engine/typing/storm.ts` — how long a letter hangs at the
   * top of the sky, perfectly still, before it starts to fall (§8.3, decision
   * 67). Restated rather than imported because this file is plain Node driving
   * a built page and cannot reach the engine's TypeScript; if the two ever
   * part company the fall check below fails on a resting stone, which is the
   * right way for that to be found.
   *
   * Three things here have to wait it out: the two that measure a stone moving
   * (a resting one gives one position and no travel, which reads exactly like
   * a broken loop) and the card times a landed letter saves, which are its
   * whole life on screen and therefore include the beat.
   */
  const STORM_QUEUE_MS = 1000;
  const storm = async () => {
    // Out to the ladder first, so this is a fresh mount every time it is
    // called: a hash set to the one it already holds fires no navigation, and
    // the run below it would be whatever the last one finished as. A hash
    // navigation is the exit THIS helper uses; it is not the only one a child
    // has — the HUD's Quit button and `Escape` both open the sheet (§8.11),
    // and section 12 leaves that way on purpose.
    await page.evaluate((id) => (location.hash = `#/p/${id}`), player);
    await page.evaluate(
      ([id, lesson]) => (location.hash = `#/p/${id}/storm/${lesson}`),
      [player, STORM_LESSON],
    );

    /*
     * A storm does not begin on mount: it hangs at time zero with an empty sky
     * and "press any key to start" in it, until a child says they are ready
     * (§8.13, decision 71). So the entry every section below shares is two
     * steps, and the wait on the panel is the first half of the proof that the
     * gate is really there — the second half is that no `.storm__letter`
     * exists until after the press, which section 13 asserts on a device that
     * cannot make one.
     *
     * The key is spent starting the wave and is never fired at it, so what
     * follows begins with a clean streak and nothing off the score. `Space` is
     * a key the board carries and is not one of the two the gate ignores
     * (`Tab`, and anything off the layout).
     */
    await page.waitForSelector(".storm__ready", { timeout: 8000 });
    await page.keyboard.press("Space");
    await page.waitForSelector(".storm__letter", { timeout: 8000 });
  };

  await storm();
  /*
   * Twenty-eight readings across 700ms, rather than two readings apart — and
   * the difference is the entire value of the check.
   *
   * Every spawn is a redraw, so React rewrites each stone's inline `--drop`
   * from `state.timeMs` whenever the picture changes. Two readings far enough
   * apart therefore move whether or not the rAF loop writes anything at all:
   * delete the loop's only side effect and the pair still differs, because the
   * re-render alone carried the stone. What the re-render cannot fake is the
   * SHAPE of the motion — without the loop this level's stone would sit still
   * until the next spawn a second and a half later, one position across this
   * whole window, where the loop gives one per frame. So the assertion is on
   * the count of distinct positions, which is the one number a staircase and a
   * fall cannot both satisfy.
   *
   * The element is held rather than re-queried between readings: React keys
   * the sky by wave index, so this node survives every re-render for as long
   * as its letter is airborne — and this level's first letter falls for 900ms,
   * which is why the window below is 700 and not a second.
   */
  const fall = await page.evaluate(async (queueMs) => {
    // The first stone in DOM order, which is wave-index (spawn) order because
    // the sky renders `wave.letters` in place — NOT lane order, and the lanes
    // in DOM order are not sorted. All this relies on is that the wave never
    // reorders, so it is the same element on every reading below.
    const stone = document.querySelector(".storm__letter");
    // Let the beat pass first. A queued stone is doing exactly what it should
    // by not moving, and sampling across it would report a working loop as a
    // dead one. A little over, so the first reading is already falling.
    await new Promise((done) => window.setTimeout(done, queueMs + 60));
    const tops = [];
    for (let i = 0; i < 28; i++) {
      tops.push(stone.getBoundingClientRect().top);
      await new Promise((done) => window.setTimeout(done, 25));
    }
    return {
      // Rounded to whole pixels so sub-pixel noise cannot be counted as
      // movement. A frame of this wave is several pixels, so nothing real is
      // rounded away, and a whole spawn gap is the height of the sky.
      distinct: new Set(tops.map((top) => Math.round(top))).size,
      samples: tops.length,
      // The loop and the render must never disagree about `--drop`, so the
      // stone may not rewind on any frame — including the ones React commits.
      forwards: tops.every((top, i) => i === 0 || top >= tops[i - 1]),
      travelled: Math.round(tops[tops.length - 1] - tops[0]),
      // A detached node reads all-zero rects, which would be 1 distinct
      // position and a false failure rather than a false pass — but say so.
      attached: stone.isConnected,
      pending: window.__pendingFrames(),
    };
  }, STORM_QUEUE_MS);
  check(
    "a stone moves on every frame, not once per spawn",
    fall.distinct >= 12 && fall.forwards && fall.attached,
    `${fall.distinct} distinct positions in ${fall.samples} readings over 700ms, ` +
      `${fall.travelled}px travelled (a per-spawn staircase gives 1)`,
  );
  check(
    "the loop has exactly one frame in flight while it runs",
    fall.pending === 1,
    `${fall.pending} pending`,
  );

  /*
   * The shield, measured against the sky it closes off.
   *
   * "Segments align with the finger zones of the keyboard" is an acceptance
   * criterion with a number behind it, and a browser is the only place both
   * sides of it become pixels at a real viewport.
   *
   * It used to be checked against the drawn keycaps under the shield. There
   * are none now (docs/typing.md §8.2, decision 64), and what is left is the
   * stronger half of the claim anyway: the eight segments must TILE the field
   * — no gap for a letter to fall through unjudged, no overlap for two fingers
   * to be blamed for one landing — and together they must be the full fifteen
   * key units the lanes are laid out in. Which segment belongs to which finger
   * is `StormField.test.tsx`'s, in key units off the same stylesheet, along
   * with "every letter lands within a quarter unit of its own segment"; what
   * only a browser can answer is whether the boxes actually meet.
   *
   * Half a pixel of tolerance, which is a rounding error and not room for a
   * segment to have drifted a key. The whole strip sits half a `--key-gap`
   * left of the sky, which is the correction a lane takes too (decision 36),
   * so the span is compared and the origin is not.
   */
  const shield = await page.evaluate(() => {
    const sky = document.querySelector(".storm__sky").getBoundingClientRect();
    return {
      skyWidth: sky.width,
      zones: [...document.querySelectorAll(".storm__zone")].map((zone) => {
        const box = zone.getBoundingClientRect();
        return {
          finger: zone.dataset.finger,
          left: box.left,
          right: box.right,
        };
      }),
    };
  });
  check(
    "the eight segments tile the field edge to edge, with nothing between them",
    shield.zones.length === 8 &&
      shield.zones.every(
        (zone, i) =>
          i === 0 || Math.abs(zone.left - shield.zones[i - 1].right) < 0.5,
      ) &&
      Math.abs(shield.zones[7].right - shield.zones[0].left - shield.skyWidth) <
        0.5,
    shield.zones
      .map((z) => `${z.finger} ${z.left.toFixed(1)}→${z.right.toFixed(1)}`)
      .join(" "),
  );

  // Leaving the route is one of the three ways a run ends — route-left,
  // run-ended, paused (§8.11) — and no longer the only one, now that the HUD
  // carries a Quit and `Escape` opens the same sheet (section 12 uses both).
  // The point being made here is still the one only a navigation can make: it
  // has to take the loop with it, and — since the gun landed — the keydown
  // listener beside it.
  await page.evaluate((id) => (location.hash = `#/p/${id}`), player);
  await page.waitForTimeout(500);
  check(
    "leaving mid-run cancels it",
    (await page.evaluate(() => window.__pendingFrames())) === 0,
  );

  /*
   * Damage is ONE tint, and the count is the proof.
   *
   * "No strobe, in any mode" (§8.10) is a safety constraint — a hail of red
   * flashes at 60fps is a photosensitivity risk and the youngest player here
   * is five — so it is measured rather than asserted about the stylesheet. The
   * animation being 150ms says nothing on its own: what would strobe is an
   * animation RESTARTED every frame, which reads identically in the CSS and
   * would fire `animationstart` sixty times a second. So the events are
   * counted over a whole run, and against the only number they may equal —
   * one per letter that lands, twelve for this wave, because **this run is
   * played with nothing pressed** and each tint is drawn by a counter that
   * only moves when a letter reaches that zone.
   *
   * Nothing pressed is now a choice rather than a fact about the game: keys
   * fire (§8.6), and the run below this one plays the same wave with a child's
   * hands on it. Twelve landings is the densest this wave gets, so it is the
   * right run to measure a strobe in — and it is measured here at every storm
   * animation there is, not only the shield's, which is what makes "no miss
   * flashed" a claim of this run rather than an absence nobody looked for.
   */
  await page.evaluate(() => {
    window.__tints = [];
    // What this counts, and what it does not. One listener on `document` sees
    // a tint's `animationstart` only if the element is still in the document
    // when the event dispatches, so a tint mounted and detached inside the
    // same frame is never counted — 60 real mounts under a wave landing a
    // letter every 15ms came back as 1. That direction is the safe one for the
    // check below, which breaks as loudly on too few as on too many, but it
    // makes this a floor on the tints that were drawn rather than a census of
    // them. Do not reach for it as a general-purpose animation counter.
    document.addEventListener(
      "animationstart",
      (event) => {
        if (!event.animationName.startsWith("storm-")) return;
        window.__tints.push({
          name: event.animationName,
          finger: event.target.closest(".storm__zone")?.dataset.finger,
          at: Math.round(window.performance.now()),
        });
      },
      true,
    );
  });

  // And a run that reaches its end stops itself. Lesson 4's wave is twelve
  // letters over twenty seconds, and nothing is pressed at it, so this waits
  // out a whole storm and every letter of it lands.
  await storm();
  await page
    .waitForFunction(() => window.__pendingFrames() === 0, null, {
      timeout: 30000,
    })
    .catch(() => {});
  const ended = await page.evaluate(() => ({
    pending: window.__pendingFrames(),
    stones: document.querySelectorAll(".storm__letter").length,
    onScreen: document.querySelectorAll(".storm").length,
  }));
  check(
    "a finished wave stops its own loop, on screen and still mounted",
    ended.pending === 0 && ended.stones === 0 && ended.onScreen === 1,
    JSON.stringify(ended),
  );

  // The last letter lands on the frame the loop stops, so its tint is still a
  // style change the browser has not run yet when `__pendingFrames` hits zero.
  // A tint is 150ms; this waits out two of them before counting.
  await page.waitForTimeout(300);
  const damage = await page.evaluate(() => ({
    tints: window.__tints,
    zones: [...document.querySelectorAll(".storm__zone")].map((zone) => ({
      finger: zone.dataset.finger,
      hp: Number(window.getComputedStyle(zone).getPropertyValue("--hp")),
      hole: zone.hasAttribute("data-hole"),
    })),
  }));
  /**
   * The closest two of these animations that belong to the same thing, in ms —
   * `Infinity` where nothing lit twice. `keyOf` says what "the same thing" is:
   * a shield segment for damage, the HUD for a miss.
   *
   * This is the whole no-strobe measurement. A flash sequence is two events
   * inside the ~150ms one pass is on screen for, so the number below the
   * duration is the failure and the number above it is the hand or the wave
   * moving. Written once because both halves of §8.10 are measured with it.
   */
  const rhythm = (tints, keyOf) =>
    Math.min(
      ...tints.map((tint, i, all) => {
        const previous = all
          .slice(0, i)
          .findLast((t) => keyOf(t) === keyOf(tint));
        return previous ? tint.at - previous.at : Infinity;
      }),
    );
  const shieldTints = damage.tints.filter((tint) => tint.name === "storm-hit");
  const closest = rhythm(shieldTints, (tint) => tint.finger);
  check(
    "damage tints once per landing, and never twice inside one tint",
    damage.tints.length === 12 &&
      shieldTints.length === 12 &&
      shieldTints.every((tint) => tint.finger) &&
      closest >= 150,
    `${damage.tints.length} storm animations, all shield damage, ` +
      `closest pair on one zone ${closest}ms apart`,
  );
  // Twelve is the whole census and not only the shield's share of it: no key
  // was pressed at this wave, so the HUD's `--flare` (one per wrong key) and
  // the shield's `--lime` mend (this spec repairs at nothing) each drew none.
  // Counting them here is what stops a run of the game flashing something a
  // check aimed only at zones would never have looked at.
  check(
    "and nothing else on the screen animated at all",
    damage.tints.filter((tint) => tint.name !== "storm-hit").length === 0,
    [...new Set(damage.tints.map((tint) => tint.name))].join() || "none",
  );
  // Lesson 4's wave drops four of its twelve letters on the right index and
  // three on the right ring, against a shield of four (§5.6) — so exactly one
  // zone is emptied and drawn as a hole, off the same number the reducer
  // holds, and no fifth letter ever lands on it. That is the level's own
  // promise: the first storm a child meets cannot end before its letters do
  // (`storms.test.ts`), so twelve landings is what the census above is of.
  const holes = damage.zones.filter((zone) => zone.hole);
  check(
    "a zone the storm emptied is drawn as a hole",
    holes.length === 1 &&
      holes.every((zone) => zone.hp === 0) &&
      holes.map((zone) => zone.finger).join() === "r-index" &&
      // And the zone that took three of four is drawn short but whole, which
      // is what makes the hole above a hole rather than a colour.
      damage.zones.some((zone) => !zone.hole && zone.hp === 0.25),
    damage.zones.map((z) => `${z.finger}:${z.hp.toFixed(2)}`).join(" "),
  );

  /*
   * And the screen the run stops on (docs/typing.md §8.5, decision 47).
   *
   * A browser is the only place two halves of it can be checked at once. The
   * panel stands in the BOARD's grid track rather than over the sky, which is
   * what leaves the shield — with the hole still in it — on screen beside the
   * sentence about it; the unit suite renders the panel alone and cannot see
   * either the board it replaced or the eight segments it left behind. This
   * run is the cleared ending, because nothing was pressed at it and every
   * letter therefore resolved; the breach ending is not reachable on this
   * level at all (§5.6: no zone takes more letters than its four-deep shield
   * can hold), and its wording is `StormOver.test.tsx`'s.
   */
  const over = await page.evaluate(() => {
    const panel = document.querySelector(".storm__over");
    return {
      text: panel?.textContent.replace(/\s+/g, " ").trim() ?? null,
      buttons: [...document.querySelectorAll(".storm__over .btn")].map((b) =>
        b.textContent.trim(),
      ),
      // No board on this screen, live or ended (decision 64). Counted rather
      // than assumed, because the component that draws one is still imported
      // two files away and a storm that quietly grew a keyboard back would
      // change nothing else this walk can see.
      keys: document.querySelectorAll(".keyboard__key").length,
      zones: document.querySelectorAll(".storm__zone").length,
      // The panel is inside the field, in the track below the sky, so the sky
      // is still the sky: same element, same shield, nothing overlapping.
      belowSky:
        panel &&
        panel.getBoundingClientRect().top >=
          document.querySelector(".storm__sky").getBoundingClientRect().bottom,
    };
  });
  check(
    "a run that ends says what the storm did, under the sky it froze",
    over.text?.includes("Wave cleared") &&
      over.text.includes("Shield left") &&
      // Twelve landed, and lesson 4's shield is eight zones of four deep.
      over.text.includes("20/32") &&
      over.buttons.join("|") === "Try this wave again|Back to the ladder" &&
      over.keys === 0 &&
      over.zones === 8 &&
      over.belowSky === true,
    `${JSON.stringify(over.buttons)} over ${over.zones} zones, ` +
      `${over.keys} keycaps anywhere: ${over.text}`,
  );

  /*
   * The same wave again, with a child's hands on it: the gun, the combo and
   * what a wrong key costs (docs/typing.md §8.6).
   *
   * A real browser is the only place this can be asked. The rules are pure and
   * `storm.test.ts` proves every one of them in a millisecond — a hit is ten
   * points times the streak it lands on, a wrong key is ten off and the streak
   * gone — but "the key a child presses reaches those rules, and the number
   * they are looking at is the one that came back" is a claim about a window
   * listener, a rAF loop and a React tree, and none of the three exist in the
   * unit suite. What is measured here is the join: press a key, read the HUD.
   *
   * Every press is deterministic without knowing the wave, because the target
   * is a thing the field says out loud: the lowest letter is the greatest
   * `--drop` (§8.4, decision 32), which the loop writes onto every stone, and
   * its own character shoots it. Read that way rather than as "the earliest
   * still on the field", which is a different ordering the moment two letters
   * fall at different speeds — and every one of the twenty levels draws its
   * falls from a range (§8.3).
   *
   * ── Nothing here may read the field and then act on the reading ───────────
   * The reducer marks a key against the target it holds **when the key
   * arrives**, and the target moves on its own: the letter that was lowest
   * lands, and the one behind it inherits the gun. So a shot chosen from a
   * reading is a shot at where the wave *was*, and every millisecond between
   * the two is a millisecond that reading has to stay true for. On this
   * machine that gap is a few ms and nothing ever moved inside it; on a runner
   * with a starved driver it is long enough for a letter to land, and the run
   * that found this connected four times out of five and then failed three
   * assertions that all presupposed the fifth (`SMOKE_LAG` reproduces it).
   *
   * Two rules keep the presses below true whatever the gap is, and they are
   * the reason there is no timing anywhere in this section:
   *
   *   - **Aim only where a keypress can still land.** `armed()` refuses a
   *     letter in the last of its fall, so the shot has a second of wave time
   *     in hand — and wave time never runs faster than the clock, so that
   *     second is a second on any hardware.
   *   - **Miss with a key nothing in the sky is wearing.** Whichever letter
   *     inherits the gun, it is one that was already airborne when the sky was
   *     read (a spawn arrives at the top and cannot be the lowest), so a key
   *     that matched none of them cannot turn into a hit in flight.
   *
   * And what cannot be guaranteed is checked rather than assumed: every press
   * below is confirmed against the HUD before the next one is taken, so a shot
   * that did not connect is named where it happened instead of surfacing as
   * arithmetic three checks later.
   */
  await page.evaluate(() => {
    window.__tints = [];
    // Every `--flare` wash over the score, kept rather than caught: the wash
    // is a 220ms animation on a node React mounts and drops (`StormHud`), and
    // a check that read the DOM after a round trip would be racing it.
    //
    // This is where a wrong key SHOWS now. It used to be the keycap going red
    // under the child's finger, which was the better signal and is gone with
    // the board (decision 64) — so the one that is left is worth watching
    // exactly as closely.
    window.__flares = [];
    document.addEventListener(
      "animationstart",
      (event) => {
        if (event.animationName === "storm-miss")
          window.__flares.push(Math.round(window.performance.now()));
      },
      true,
    );
  });

  /**
   * What is in the sky, and which of it the gun is on: every character up
   * there, plus the lowest stone and how far down it is. Read as one snapshot
   * because the two are only usable together — a key is chosen against the
   * whole sky and aimed at the lowest of it.
   */
  const read = () =>
    page.evaluate(() => {
      const stones = [...document.querySelectorAll(".storm__letter")];
      // Lowest is the greatest `--drop`, with the earlier spawn taking an
      // exact tie — `targetIndex`, read off the field (§8.4, decision 33).
      const dropOf = (stone) =>
        Number(window.getComputedStyle(stone).getPropertyValue("--drop"));
      let low = null;
      for (const stone of stones)
        if (
          low === null ||
          dropOf(stone) > dropOf(low) ||
          (dropOf(stone) === dropOf(low) &&
            Number(stone.dataset.stone) < Number(low.dataset.stone))
        )
          low = stone;
      return {
        chars: stones.map((stone) => stone.textContent.toLowerCase()),
        index: low && Number(low.dataset.stone),
        ch: low && low.textContent,
        drop: low && dropOf(low),
      };
    });

  /**
   * The same reading, but only once the lowest letter is one a keypress can
   * still reach. `null` if the field offered no such letter inside `budgetMs`.
   *
   * The wait runs **in the page**, on the same frames the game is drawn on,
   * which is what makes this a fix rather than a wider margin: a driver-side
   * poll pays a round trip for every look and then another to press, so its
   * reading is at best one round trip stale. This pays one, and the answer is
   * a frame old.
   *
   * `0.35` is the last drop it will aim at. `--drop` is the 0→1 the renderer
   * writes on each stone (STM03), lesson 4's falls are 900–1200ms of wave
   * time, and wave time only ever runs slower than the clock — so leaving the
   * last two thirds of a fall unshot leaves at least 580ms of real time for
   * the press to arrive in. Waiting is the ordinary case and not a slow
   * machine: this level puts one letter on screen at a time and spawns the
   * next 1.5–1.9s later, so the sky between a shot and the next spawn is
   * genuinely empty.
   *
   * **The budget is generous enough for one spawn gap and no more.** There are
   * only two reasons to wait — the next spawn, and at the very start a first
   * letter that was already too low when the driver arrived. Past that the
   * wave has outrun the hand: the lowest letter is always deep in its fall, so
   * there is no letter left that a press can be promised to reach and no
   * amount of further waiting will produce one. A fresh wave is the only way
   * back, which is what `cleanRun` does with this `null`.
   */
  const armed = async (budgetMs = 3000) => {
    const handle = await page
      .waitForFunction(
        (room) => {
          const stones = [...document.querySelectorAll(".storm__letter")];
          if (stones.length === 0) return null;
          const dropOf = (stone) =>
            Number(window.getComputedStyle(stone).getPropertyValue("--drop"));
          let low = stones[0];
          for (const stone of stones)
            if (
              dropOf(stone) > dropOf(low) ||
              (dropOf(stone) === dropOf(low) &&
                Number(stone.dataset.stone) < Number(low.dataset.stone))
            )
              low = stone;
          const drop = dropOf(low);
          if (!(drop <= room)) return null;
          return {
            chars: stones.map((stone) => stone.textContent.toLowerCase()),
            index: Number(low.dataset.stone),
            ch: low.textContent,
            drop,
          };
        },
        0.35,
        { timeout: budgetMs },
      )
      .catch(() => null);
    return handle && (await handle.jsonValue());
  };

  /**
   * A key that would miss whatever happens next: one no letter in `chars` is
   * wearing. See the header — the gun can only ever pass to a letter that was
   * already in that reading, so a key none of them answers to stays a miss
   * however long the press takes to arrive.
   *
   * The order is the rarest keys first, which is only so the flare in the
   * check below reads as a wrong key rather than as a near miss.
   */
  const missKey = (chars) =>
    [..."qzxjvkbpygwmcfhdlrsnoaietu"].find((ch) => !chars.includes(ch));

  /** The HUD as a child reads it, plus what the field has left. */
  const hud = () =>
    page.evaluate(() => {
      const combo = document.querySelector(".storm__combo");
      return {
        score: Number(document.querySelector(".storm__score").textContent),
        combo: combo.textContent,
        hot: combo.hasAttribute("data-hot"),
        stones: document.querySelectorAll(".storm__letter").length,
        // The payout is on the ending panel, which stands in the track under
        // the sky once the gun is dead (§8.5) — so it is null for the whole of
        // a run and a number the instant one is over.
        xp:
          document.querySelector(".storm__over .stat--xp .stat__value")
            ?.textContent ?? null,
        flares: window.__flares,
      };
    });

  /**
   * The score the HUD settles on after a press, or `null` if it never moved.
   *
   * Waiting on the *change* rather than on a value is what makes this usable
   * as a verdict: every stroke the reducer accepts moves the score — up by the
   * hit's worth, down by `MISS_POINTS` — and nothing else moves it at all,
   * because a letter reaching the shield costs a shield point and no points
   * (§8.4). So the sign of the move says which of the two happened, and no
   * move inside the budget says the stroke reached nothing — a run that had
   * already ended, or a screen that has stopped listening.
   */
  const scored = async (before, budgetMs = 8000) => {
    const handle = await page
      .waitForFunction(
        (was) => {
          const now = Number(
            document.querySelector(".storm__score")?.textContent,
          );
          return Number.isFinite(now) && now !== was ? { now } : null;
        },
        before,
        { timeout: budgetMs },
      )
      .catch(() => null);
    return handle ? (await handle.jsonValue()).now : null;
  };

  /**
   * One go at a clean run: a fresh wave, then `HITS` shots that each connect —
   * or the first one that did not, said out loud.
   *
   * A fresh wave per go rather than a recovery, because there is no recovering
   * a streak: the thing being measured is five hits *in a row*, and a shot
   * that missed has already reset the multiplier every later hit would be paid
   * at. Restarting is also free and honest here — `storm()` is the same exit
   * and re-entry a child takes between two goes, the wave is replayed from its
   * seed, and the counters below are of whatever the last go left behind.
   */
  const HITS = 5;
  const cleanRun = async () => {
    await page.evaluate(() => {
      window.__tints = [];
      window.__flares = [];
    });
    await storm();

    const shot = [];
    let score = 0;
    while (shot.length < HITS) {
      const target = await armed();
      if (!target) return { shot, missed: "the sky never offered a target" };
      await press(target.ch);
      const after = await scored(score);
      if (after === null)
        return {
          shot,
          missed: `"${target.ch}" (letter ${target.index}) drew no answer at all`,
        };
      if (after < score)
        return {
          shot,
          missed:
            `"${target.ch}" was aimed at letter ${target.index} ` +
            `${target.drop.toFixed(2)} of the way down and missed ` +
            `(${score} → ${after})`,
        };
      shot.push(target.index);
      score = after;
    }
    return { shot, missed: null };
  };

  // Five clean hits, each fired at the letter nearest the shield as it comes.
  let run = await cleanRun();
  const restarts = [];
  for (let go = 1; go < 3 && run.missed !== null; go++) {
    restarts.push(run.missed);
    run = await cleanRun();
  }
  const shot = run.shot;
  check(
    // Named apart from the arithmetic below it on purpose. "The gun connected
    // five times" and "five hits are worth 65" are two different claims, and a
    // wave that outran the driver is a fact about this harness where a 65 that
    // came back 50 is a fact about the reducer. Reported as one, a short count
    // reads as a scoring bug — which is exactly how this cost an afternoon.
    "the gun connected five times running",
    run.missed === null && shot.length === HITS,
    run.missed
      ? `${shot.length} of ${HITS} — ${run.missed}`
      : `shot ${shot.join()}` +
          (restarts.length
            ? ` (after ${restarts.length}: ${restarts[0]})`
            : ""),
  );
  const combo = await hud();
  check(
    "a run of clean hits climbs, and the multiplier climbs with it",
    // 11 + 12 + 13 + 14 + 15: ten points a hit, at the multiplier the hit
    // itself lands on. The fifth is ×1.5 and the HUD says so.
    //
    // The indices are asked to ascend rather than to be `0,1,2,3,4`: the gun
    // takes the lowest letter, so a run that started a letter or two into the
    // wave — the driver was slow to arrive, and `armed()` let the first letter
    // land rather than shoot at one it could not reach — walked down the wave
    // exactly as correctly. What ascending forbids is the thing that would be
    // a bug: a letter shot twice, or the gun going back up the field.
    shot.length === HITS &&
      shot.every((index, i) => i === 0 || index > shot[i - 1]) &&
      combo.score === 65 &&
      combo.combo === "×1.5" &&
      combo.hot,
    `shot ${shot.join()} → ${combo.score} at ${combo.combo}`,
  );

  // And a wrong key, against a letter that is really there: the one case that
  // is not a shot at an empty sky, so it takes the target's own neighbours out
  // of the argument.
  //
  // Which has to be *waited* for and then *checked*, neither of which it used
  // to be — five hits land inside one spawn gap, so at full speed the sky
  // directly after them is empty and this was quietly the empty-sky case it
  // says it is not. A letter, not a shootable letter: what the stroke needs is
  // something up there to be refused by, and waiting for one the gun could
  // have hit would spend wave time the misses below still need.
  await page
    .waitForSelector(".storm__letter", { timeout: 2000 })
    .catch(() => {});
  const aimedAt = await read();
  const wrongKey = missKey(aimedAt.chars);
  await press(wrongKey);
  await scored(combo.score);

  /*
   * And then wait for the wash, which the score settling does NOT imply.
   *
   * `scored` returns on the re-render that moved the number; the `--flare`
   * element mounts in that same render but its `animationstart` does not
   * dispatch until the frame after it is painted. Reading `__flares` on the
   * round trip straight after `scored` is therefore a coin flip, and it landed
   * tails: 0 washes for a miss that had plainly happened.
   *
   * Waited for rather than slept on, and swallowed rather than thrown, so that
   * the check below is what reports a wash that never came — with the score
   * and the combo beside it, which is what says whether the miss was scored at
   * all or only drawn quietly.
   */
  await page
    .waitForFunction(() => window.__flares.length > 0, { timeout: 2000 })
    .catch(() => {});
  const missed = await hud();
  check(
    "a wrong key costs a hit's worth, breaks the combo, and washes the score",
    aimedAt.chars.length > 0 &&
      missed.score === combo.score - 10 &&
      missed.combo === "×1.0" &&
      !missed.hot &&
      missed.flares.length === 1,
    `"${wrongKey}" into a sky of ${aimedAt.chars.join("")}: ` +
      `${combo.score} → ${missed.score} at ${missed.combo}, ` +
      `${missed.flares.length} score wash(es)`,
  );

  // Seven more, at a rate a child could actually hammer at. The point of them
  // is the score going under: it is the run's own number and it is allowed to.
  //
  // The 200ms is spacing, not patience, and it is what the flash count at the
  // bottom of this section is about. Eight wrong keys 200ms apart is five a
  // second, which is two and a half times faster than the `--flare` wash is
  // allowed to light (`MIN_TINT_GAP_MS`, decision 57) — so this is the strobe
  // case, played at a rate a seven-year-old really can hammer at, and the
  // check below is that every one of the eight is CHARGED while fewer than
  // eight light.
  const MISSES = 8;
  // Presses the HUD never answered. Each one would be a miss the flash count
  // at the bottom is short by, and the reason is worth carrying to the check
  // rather than leaving as a number that is ten out.
  const unanswered = [];
  let running = missed.score;
  for (let i = 1; i < MISSES; i++) {
    await page.waitForTimeout(200);
    // The plain reading, not `armed()`: a miss needs a key nothing in the sky
    // is wearing, which every reading gives, and waiting for a *shootable*
    // letter here would spend wave time this run does not have to spare.
    await press(missKey((await read()).chars));
    const after = await scored(running);
    if (after === null) unanswered.push(i);
    else running = after;
  }
  const sunk = await hud();
  check(
    "the score goes negative, and is drawn negative",
    // Off `combo.score` and not off 65. The claim is that eight wrong keys
    // cost eight hits' worth and take the run under, which is a statement
    // about the run that was actually played — and a run that scored something
    // else has a scoring bug to report on its own line above, not an
    // arithmetic mismatch on this one.
    sunk.score === combo.score - MISSES * 10 && sunk.score < 0,
    `${combo.score} → ${sunk.score} after ${MISSES} wrong keys` +
      (unanswered.length ? `, ${unanswered.length} unanswered` : ""),
  );

  // Then the rest of the wave lands and the run ends itself, exactly as the
  // untouched one did.
  await page
    .waitForFunction(() => window.__pendingFrames() === 0, null, {
      timeout: 30000,
    })
    .catch(() => {});
  await page.waitForTimeout(300);
  const paid = await hud();
  const earned = Number(/\+(\d+)/.exec(paid.xp ?? "")?.[1]);
  check(
    "score can fall; XP cannot — a negative run still pays what it hit",
    paid.score < 0 && paid.xp !== null && earned > 0,
    `score ${paid.score}, ${paid.xp}`,
  );

  /*
   * The gun dies with the run, and the proof of it is a `Tab`.
   *
   * `fire` refuses an ended state, so a stray letter costs nothing whether or
   * not the listener is still armed — which is worth checking and is not what
   * this is for. What a listener left armed would still do is swallow the
   * DEFAULT: every key the board carries is `preventDefault`ed while the gun
   * is live, and `Tab`, `Space` and `Enter` are three of them. Those are the
   * keys a child reaches the ending's buttons with, and nothing in the unit
   * suite has a focus ring to lose. So this presses `Tab` and asks where the
   * focus went: into the panel is the pass, and stuck on `<body>` is the
   * regression. Five at most, because whatever else is focusable on this page
   * comes before it and the count is not the claim.
   */
  await press("j");
  const inert = await scored(paid.score, 1000);
  let landed = null;
  for (let i = 0; i < 5 && !landed?.inPanel; i++) {
    await press("Tab");
    landed = await page.evaluate(() => ({
      inPanel:
        document
          .querySelector(".storm__over")
          ?.contains(document.activeElement) ?? false,
      on: document.activeElement?.textContent?.trim().slice(0, 30) ?? null,
    }));
  }
  const stillThere = await page.evaluate(() => ({
    panel: document.querySelectorAll(".storm__over").length,
    score: Number(document.querySelector(".storm__score").textContent),
  }));
  check(
    "the gun is dead: a key costs nothing, and Tab reaches the ending",
    inert === null &&
      stillThere.panel === 1 &&
      stillThere.score === paid.score &&
      landed.inPanel,
    `${paid.score} → ${stillThere.score}, focus on "${landed.on}"`,
  );

  const played = await page.evaluate(() => window.__tints);
  const hits = played.filter((tint) => tint.name === "storm-hit");
  const flashes = played.filter((tint) => tint.name === "storm-miss");
  check(
    // Twelve is the wave and `shot.length` is what the gun took out of it, so
    // this is "every letter is accounted for exactly once" — a shot letter or
    // a damaged zone, never both and never neither. Counted off the shots that
    // actually connected rather than off `HITS`, because a short run is a
    // failure the check above has already named: repeating it here as a tint
    // census would say "the shield is drawing the wrong number of hits", which
    // is a different and much more alarming bug than the one that happened.
    "letters shot are letters that never reached the shield",
    hits.length === 12 - shot.length && hits.every((tint) => tint.finger),
    `${hits.length} damage tints for ${12 - shot.length} landings ` +
      `after ${shot.length} shot`,
  );
  check(
    "a hand cannot strobe the score, however fast it hammers",
    // **The half of §8.10 no `WaveSpec` can keep** (decision 57). A zone's
    // tint rate is a property of the schedule and each of the twenty levels
    // ships at two starts a second (`storms.test.ts`); a miss is a child
    // pressing a wrong key, and the only place that can be bounded is the
    // reducer. So the wash is mounted from `missTintAt`, a wave-time stamp
    // that moves at most once every 500ms — two flashes a second, the same
    // headroom the zone tints have under WCAG 2.3.1's line of more than three
    // — and eight presses at five a second must therefore light FEWER than
    // eight times while costing all eight.
    //
    // The floor is the measurement that says it did not merely mount fewer
    // elements: 150ms is the tint's own life, so a pair closer than that would
    // be an animation restarting rather than a hand moving, and 500 is the
    // rule itself. Both are asserted; the second implies the first, and the
    // first is the one that has been true since the shield's tint was built.
    // Wall-clock against a wave-time rule is the safe direction: wave time is
    // clamped per frame and can only run behind the wall, never ahead of it.
    flashes.length > 0 &&
      flashes.length < MISSES &&
      flashes.every((tint) => tint.finger === undefined) &&
      rhythm(flashes, () => "hud") >= 150 &&
      rhythm(flashes, () => "hud") >= 500,
    `${flashes.length} flashes for ${MISSES} wrong keys 200ms apart, ` +
      `closest pair ${rhythm(flashes, () => "hud")}ms apart`,
  );

  /*
   * A storm is a `Session`, and a retry is a second one (docs/typing.md §8.7).
   *
   * The mapping is pure and `stormSession.test.ts` proves every field of it
   * without a browser. What only a browser can answer is whether the write
   * happens at all, exactly once, and again for the next attempt: the save is
   * an effect fired on the frame `ending` appears, the guard against a second
   * one is a component instance, and a retry is a remount — none of which
   * exist in the unit suite. So this counts what actually reached IndexedDB.
   *
   * Two runs have FINISHED by now and they are deliberately different shapes:
   * the census run above was played with nothing pressed, so all twelve
   * letters got through it, and the one after it was played with a child's
   * hands on it. The first is the honest-numbers case (§8.7's "correct,
   * incorrect and durationMs are all honest") and the second is the one that
   * pays XP. Every other storm this file entered was left mid-fall, and a run
   * with no ending writes nothing — which is why "two" is the number here even
   * though `storm()` has been called four or five times.
   */
  log("\n10. A storm is a session, and a retry is a second one");
  const stormRuns = async () =>
    (await readStore("sessions")).filter(
      (s) => s.mode === `typing:${STORM_LESSON}`,
    );

  /**
   * Waits — in the page, against the same database the app writes to — until
   * exactly `want` storm runs are stored. `false` if it never got there, which
   * says "too few, or the count went past it and stayed".
   */
  const storedRuns = (target) =>
    page
      .waitForFunction(
        ([lesson, want]) =>
          new Promise((res) => {
            const open = indexedDB.open("schoolskills");
            open.onerror = () => res(false);
            open.onsuccess = () => {
              const all = open.result
                .transaction("sessions", "readonly")
                .objectStore("sessions")
                .getAll();
              all.onsuccess = () =>
                res(
                  all.result.filter((s) => s.mode === `typing:${lesson}`)
                    .length === want,
                );
            };
          }),
        [STORM_LESSON, target],
        { timeout: 8000 },
      )
      .then(() => true)
      .catch(() => false);

  const twoRuns = await storedRuns(2);
  const saved = await stormRuns();
  const untouched = saved.find((s) => s.correct === 0);
  const handsOn = saved.find((s) => s.correct > 0);
  check(
    "both finished storms are in the record book, filed under their lesson",
    twoRuns &&
      saved.length === 2 &&
      saved.every(
        (s) =>
          s.configKey === `typing|${STORM_LESSON}|12` &&
          s.config.lessonId === STORM_LESSON &&
          s.config.storm === true &&
          // The level's own seed, off `STORM_WAVES` — a storm is the same
          // weather every time it is opened (decision 58), so two runs a
          // minute apart are two runs of one storm and not two storms.
          s.seed === 6 &&
          s.cards.length === 12,
      ),
    `${saved.length} run(s): ${saved.map((s) => `${s.mode} ${s.configKey} ${s.correct}/${s.cards.length}`).join(", ")}`,
  );
  check(
    "a wave nobody pressed at saves twelve letters that all got through",
    untouched?.correct === 0 &&
      untouched?.incorrect === 12 &&
      // `ms` is the letter's own time on screen and the total is the sum of
      // them, not a wall clock — which is the whole of §8.7's `durationMs` for
      // a wave whose letters can overlap. Derived rather than a number written
      // here, because every level draws its falls from a range (§8.3): what is
      // asserted is that each is one of lesson 4's, and that the total is
      // exactly what they add up to.
      //
      // On screen, not falling: a letter nobody pressed at was there for the
      // beat it hung as well as the fall it took, and `ms` is `atMs -
      // spawnMs` — time from a child first SEEING it, which is what it has
      // always been (§8.7). A letter that is shot during the beat still saves
      // the small number it took.
      untouched?.durationMs ===
        untouched?.cards.reduce((sum, c) => sum + c.ms, 0) &&
      untouched?.cards.every(
        (c) =>
          c.prompt === c.answer &&
          c.factId === c.answer &&
          c.given === null &&
          c.ok === false &&
          c.timedOut === true &&
          c.ms >= STORM_QUEUE_MS + 900 &&
          c.ms <= STORM_QUEUE_MS + 1200,
      ),
    `${untouched?.correct}/${untouched?.incorrect} in ${untouched?.durationMs}ms`,
  );
  check(
    "the run that was played saves what was shot, and pays for it",
    handsOn?.correct === shot.length &&
      handsOn?.incorrect === 12 - shot.length &&
      handsOn?.xpEarned > 0 &&
      handsOn?.bestStreak === shot.length &&
      handsOn?.cards.filter((c) => c.ok).every((c) => c.given === c.answer) &&
      // A shot letter was caught before it landed, so its time in the air is
      // less than the fastest fall this level can draw — which is what makes
      // it worth XP (§8.6).
      handsOn?.cards.filter((c) => c.ok).every((c) => c.ms < 900),
    `${handsOn?.correct} shot, ${handsOn?.incorrect} through, ` +
      `${handsOn?.xpEarned} XP, best combo ${handsOn?.bestStreak}`,
  );

  // And the same wave again. "Try this wave again" is a new run rather than
  // the old one rewound (decision 51), so it owes the record book exactly one
  // more session — where a screen that kept its finish guard across the retry
  // would write none, and one that re-fired the old one would write two.
  await page.getByRole("button", { name: /try this wave again/i }).click();
  // A retry is a remount, so it gets the beat before it falls again (§8.13) —
  // which is the point of the flag starting false: just after a loss is when a
  // child is likeliest to have taken a hand off the keys.
  await page.waitForSelector(".storm__ready", { timeout: 8000 });
  await page.keyboard.press("Space");
  await page.waitForSelector(".storm__letter", { timeout: 8000 });
  await page
    .waitForFunction(() => document.querySelector(".storm__over") !== null, {
      timeout: 30000,
    })
    .catch(() => {});
  const threeRuns = await storedRuns(3);
  const retried = await stormRuns();
  check(
    "a retry writes one more run, and only one",
    threeRuns && retried.length === 3,
    `${retried.length} run(s) after the retry: ` +
      retried.map((s) => `${s.correct}/${s.cards.length}`).join(", "),
  );

  /*
   * The setting a falling-letter game cannot honour by removing the falling
   * (docs/typing.md §8.10, #155).
   *
   * Two claims, and neither can be read off the stylesheet. **The fall stays**
   * — it is a custom property written from a rAF loop rather than an
   * animation, so base.css's blanket clamp has nothing of it to reach, and the
   * only proof of that is a stone moving on a page that asked for less motion.
   * **The flashing comes off** — the three tints are switched to
   * `animation: none` rather than left to the clamp's 0.001ms pass, and the
   * difference between those two is exactly one `animationstart` per event: a
   * clamped animation still starts. So the census below is of a whole run, and
   * the number it may equal is zero.
   *
   * Screen shake, parallax and particles are the rest of §8.10's list, and the
   * honest answer is that this screen has never had any of them. That is not a
   * claim a count can carry, so it is checked as what it looks like: nothing
   * on this screen is transformed but the stones.
   */
  log("\n11. Under reduced motion the fall stays and the flashing goes");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => (window.__tints = []));
  await storm();

  const calm = await page.evaluate(async (queueMs) => {
    // The same measurement as the fall at the top of section 9, on a page that
    // has asked for less motion: distinct positions are what a re-render alone
    // cannot fake, because without the loop a stone would not move at all
    // between two spawns a second and a half apart. The beat is waited out
    // here for the same reason it is there.
    const stone = document.querySelector(".storm__letter");
    await new Promise((done) => window.setTimeout(done, queueMs + 60));
    const tops = [];
    for (let i = 0; i < 20; i++) {
      tops.push(stone.getBoundingClientRect().top);
      await new Promise((done) => window.setTimeout(done, 25));
    }
    return {
      distinct: new Set(tops.map((top) => Math.round(top))).size,
      forwards: tops.every((top, i) => i === 0 || top >= tops[i - 1]),
      travelled: Math.round(tops[tops.length - 1] - tops[0]),
      // Nothing but the stones moves — and that is asked of the whole screen
      // rather than of a list of selectors somebody has to remember to grow.
      // A shake would be a transform on the field, the sky or the shield; a
      // parallax layer would be a transform on something none of those three
      // names. Enumerating every descendant catches all of them, including
      // the one nobody thought of, which is the only kind worth checking for.
      // `.storm__combo` reports `scale: 1` rather than a transform, so it is
      // `none` here like everything else that is not a falling stone. The
      // field itself is in the list as well as its descendants, because a
      // shake would most naturally be put on the thing that holds them.
      // Read as an attribute rather than `className`, which is an
      // `SVGAnimatedString` and not a string on an SVG node — and an icon
      // somebody transforms is exactly the kind of thing this is here to
      // find, so the one case it must not choke on is the new one.
      moved: [...document.querySelectorAll("main.storm, main.storm *")]
        .filter((el) => window.getComputedStyle(el).transform !== "none")
        .map((el) => el.getAttribute("class") ?? el.tagName),
      stone: window.getComputedStyle(document.querySelector(".storm__letter"))
        .transform,
      particles: document.querySelectorAll(".confetti, .confetti__bit").length,
    };
  }, STORM_QUEUE_MS);
  check(
    "a stone still falls, frame by frame, for a child who asked for less motion",
    calm.distinct >= 12 && calm.forwards && calm.travelled > 0,
    `${calm.distinct} distinct positions in 20 readings over 500ms, ` +
      `${calm.travelled}px travelled`,
  );
  check(
    "and nothing but the stones is moved at all",
    calm.moved.every((name) => name.split(" ").includes("storm__letter")) &&
      calm.stone.startsWith("matrix") &&
      calm.particles === 0,
    `${calm.moved.length} transformed element(s) in the storm, all stones: ` +
      `${[...new Set(calm.moved)].join() || "none"}; stone ${calm.stone}, ` +
      `${calm.particles} particles`,
  );

  // The whole wave, untouched, exactly as the census run in section 9 was —
  // so the number below is over twelve landings and not over a quiet moment.
  await page
    .waitForFunction(() => window.__pendingFrames() === 0, null, {
      timeout: 30000,
    })
    .catch(() => {});
  await page.waitForTimeout(300);
  const quiet = await page.evaluate(() => ({
    tints: window.__tints,
    zones: document.querySelectorAll(".storm__zone[data-hole]").length,
  }));
  check(
    "twelve letters land and not one animation runs",
    quiet.tints.length === 0 && quiet.zones === 1,
    `${quiet.tints.length} storm animations over a whole wave, ` +
      `${quiet.zones} zone emptied (the damage still happened)`,
  );
  await page.emulateMedia({ reducedMotion: null });

  /*
   * The keys the gun swallows, the key that leaves, and what quitting costs
   * the record book (§8.8, #155).
   *
   * `preventDefault` is invisible to every other kind of test: the storm is
   * exactly one viewport tall with `overflow: hidden`, so a `Space` that
   * scrolled would move nothing HERE and everything on a shorter screen or
   * behind a taller ad. What can be asked is whether the default was taken,
   * which a listener on the way back up can see — so the checks below read
   * `defaultPrevented` rather than a scroll position, and read the scroll
   * position too because it costs nothing.
   *
   * The pair matters as much as the members: `Space`, `/` and `Tab` are keys
   * the board carries and are swallowed; `ArrowDown` and `Escape` are not on
   * it and are left alone, which is what keeps a browser's own keys working on
   * a screen a child has to be able to get out of.
   */
  log("\n12. The keys a storm swallows, and the one that leaves it");
  const runsBeforeQuit = (await stormRuns()).length;
  await storm();
  await page.evaluate(() => {
    window.__keys = [];
    // Bubble phase, so this runs after the gun's capture listener and sees
    // whatever it decided.
    window.addEventListener("keydown", (event) =>
      window.__keys.push({
        code: event.code,
        prevented: event.defaultPrevented,
      }),
    );
  });
  for (const key of ["Space", "/", "Tab", "ArrowDown"]) {
    await press(key);
    await page.waitForTimeout(120);
  }
  const swallowed = await page.evaluate(() => ({
    keys: window.__keys,
    scrollY: window.scrollY,
  }));
  const took = (code) => swallowed.keys.find((k) => k.code === code)?.prevented;
  check(
    "the gun reads event.code, and swallows the keys that would scroll",
    swallowed.keys.length === 4 &&
      took("Space") === true &&
      took("Slash") === true &&
      took("Tab") === true &&
      took("ArrowDown") === false &&
      swallowed.scrollY === 0,
    swallowed.keys.map((k) => `${k.code}:${k.prevented}`).join(" "),
  );

  // And the way out. `Escape` is not a key the board carries, so it is neither
  // swallowed nor fired at the lowest letter — a way out that cost ten points
  // and a streak would be a trap.
  //
  // A letter has to be in the sky for the freeze below to be measurable, and
  // on this level the sky is empty between letters — one at a time is what
  // makes lesson 4 a reaction level (§5.6). So the same `armed()` the shots
  // used waits for a stone with most of its fall left, and `Escape` follows it
  // immediately: what is then frozen has hundreds of milliseconds of wave time
  // still to run, and standing still for 900 of them is the pause.
  const paused = await armed(3000);
  const scoreAtQuit = await page.evaluate(() =>
    Number(document.querySelector(".storm__score").textContent),
  );
  await press("Escape");
  await page.waitForSelector('[aria-label="Quit the storm"]', {
    timeout: 4000,
  });
  const asked = await page.evaluate(async () => {
    // The stone the sheet froze, whichever it is: with the run paused nothing
    // spawns and nothing lands, so the deepest `--drop` in the sky is the same
    // element at both readings.
    const lowest = () => {
      const drops = [...document.querySelectorAll(".storm__letter")].map(
        (stone) =>
          Number(window.getComputedStyle(stone).getPropertyValue("--drop")),
      );
      return drops.length ? Math.max(...drops) : null;
    };
    const before = lowest();
    await new Promise((done) => window.setTimeout(done, 900));
    return {
      before,
      after: lowest(),
      // No frame is requested while the sheet is up, which is what makes the
      // pause cost the wave nothing rather than merely look like it.
      pending: window.__pendingFrames(),
      escaped: window.__keys.at(-1),
      score: Number(document.querySelector(".storm__score").textContent),
    };
  });
  check(
    "Escape asks rather than fires, and the storm stops where it stood",
    paused !== null &&
      asked.escaped.code === "Escape" &&
      asked.escaped.prevented === false &&
      asked.score === scoreAtQuit &&
      asked.before !== null &&
      asked.after === asked.before &&
      asked.pending === 0,
    `--drop ${asked.before} → ${asked.after} over 900ms, ` +
      `${asked.pending} frames pending, score ${scoreAtQuit} → ${asked.score}`,
  );

  // Then confirm it. A quit mid-wave is a run with no ending, and the save is
  // an effect on the ending — so the record book must not move. Counted in
  // IndexedDB rather than watched on screen: a partial run written and then
  // hidden would look identical from here.
  await page.locator(".modal__actions button", { hasText: /^quit$/i }).click();
  await page.waitForFunction(
    () => document.querySelector(".ladder__tile") !== null,
    null,
    { timeout: 8000 },
  );
  const runsAfterQuit = await stormRuns();
  check(
    "quitting mid-wave saves nothing at all",
    runsAfterQuit.length === runsBeforeQuit &&
      (await page.evaluate(
        () => document.querySelectorAll(".storm").length,
      )) === 0,
    `${runsBeforeQuit} run(s) before, ${runsAfterQuit.length} after`,
  );

  /*
   * The tablet (§4.5, §8.8, #155).
   *
   * A second context, because `hasTouch` is fixed when one is created — and it
   * is what makes `(any-pointer: coarse) and (any-hover: none)` match, which
   * is the guess `useKeyboardPresence` makes. Only a browser can be asked
   * whether that query really matches on a device with no mouse; the unit
   * suite can only be told.
   *
   * Both halves of the story are here, and the second is the one that matters:
   * the guess is a guess, so a child in a keyboard folio has to be able to
   * overturn it — with one keystroke, live, on the same page.
   */
  log("\n13. A device with no keyboard is told so, and is not locked out");
  const tabletCtx = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
  });
  const tablet = await tabletCtx.newPage();
  tablet.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await tablet.goto(`${BASE}/typing`, { waitUntil: "networkidle" });
  await tablet
    .getByRole("button", { name: /add a player/i })
    .first()
    .click();
  await tablet.waitForSelector(".modal__panel", { timeout: 8000 });
  await tablet.locator(".modal__panel input").first().fill("Tablet");
  await tablet.getByRole("button", { name: /^add player$/i }).click();
  await tablet.waitForSelector(".modal__panel", {
    state: "detached",
    timeout: 8000,
  });
  await tablet.getByText("Tablet", { exact: false }).first().click();
  await tablet.waitForSelector(".ladder__tile", { timeout: 8000 });

  /** The ladder as this device draws it: the storms, and the legend's line. */
  const ladder = () =>
    tablet.evaluate(() => {
      const rung = (extra) => [
        ...document.querySelectorAll(`.ladder__row .ladder__tile${extra}`),
      ];
      const storms = rung(".is-storm");
      return {
        storms: storms.length,
        shut: storms.filter((t) => t.getAttribute("aria-disabled") === "true")
          .length,
        said: storms.filter((t) =>
          t.textContent.includes("Hailstorm needs a keyboard"),
        ).length,
        // The rest of the ladder is untouched: a passage is typed on the
        // software keyboard like anything else (§4.5), so a child on an iPad
        // still has the whole course. Counted exactly, because "some are
        // open" would pass with seventy-nine of the eighty wrongly shut —
        // which is the failure this is here to catch, and the one a floor of
        // zero cannot see.
        lessonsOpen: rung(":not(.is-storm):not([aria-disabled])").length,
        legend: [...document.querySelectorAll(".ladder__keyitem")]
          .map((li) => li.textContent.trim())
          .find((text) => text.startsWith("Hailstorm")),
        touchOnly: window.matchMedia(
          "(any-pointer: coarse) and (any-hover: none)",
        ).matches,
      };
    });

  const guessed = await ladder();
  check(
    "every storm tile is shut, with the reason on it",
    guessed.touchOnly === true &&
      guessed.storms === 20 &&
      guessed.shut === 20 &&
      guessed.said === 20 &&
      // Eleven of the eighty non-storm rungs, which is what FRESH progress
      // opens on any device: lesson 1, and the ten checkpoints a placement
      // test may be taken at from a standing start (§6.6). A desktop draws
      // the same eleven — the keyboard guess reaches storm tiles and nothing
      // else — so a drift either way is the bug this names.
      guessed.lessonsOpen === 11 &&
      guessed.legend.includes("Press any key if you have one"),
    `${guessed.said}/${guessed.storms} storms say why, ` +
      `${guessed.lessonsOpen} lessons still open: "${guessed.legend}"`,
  );

  // And the route itself is not gated by any of it. A wrong guess must cost a
  // child a tile, never the game — so a URL still opens a playable storm, with
  // the way out drawn on it.
  await tablet.evaluate(
    (lesson) => (location.hash = `${location.hash}/storm/${lesson}`),
    STORM_LESSON,
  );
  await tablet.waitForSelector(".storm__ready", { timeout: 8000 });
  const reachable = await tablet.evaluate(() => ({
    // What a storm opens on now: the beat before it falls, and no hail at all
    // until a key starts it (§8.13, decision 71). On this device that is also
    // the honest ending — a tablet cannot press the key, and the panel it is
    // left looking at carries the way out rather than twelve letters it has
    // no way to shoot.
    ready: document.querySelectorAll(".storm__ready").length,
    stones: document.querySelectorAll(".storm__letter").length,
    quit: document.querySelectorAll(".storm__quit").length,
  }));
  await tablet.goBack();
  await tablet.waitForSelector(".ladder__tile", { timeout: 8000 });

  // One keystroke, and the guess is over. Nothing is reloaded and the pointer
  // still says tablet — which is the point: proof beats a proxy.
  await tablet.keyboard.press("k");
  await tablet.waitForTimeout(250);
  const proved = await ladder();
  check(
    "and one keystroke lets a keyboard in, with nothing reloaded",
    reachable.ready === 1 &&
      reachable.stones === 0 &&
      reachable.quit === 1 &&
      proved.touchOnly === true &&
      proved.said === 0 &&
      // What the legend says on a device that can play them, which is the one
      // fact a child needs before pressing a diamond (§8.8).
      proved.legend.includes("Nothing on the ladder waits on one"),
    `the route opened the ready panel and ${reachable.stones} stone(s); ` +
      `after one key ${proved.said}/${proved.storms} still name a keyboard`,
  );
  await tabletCtx.close();

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
