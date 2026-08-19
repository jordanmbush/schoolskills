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

  await page.goto(`${BASE}/printables/lined-paper`, {
    waitUntil: "networkidle",
  });
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
  // Nothing links to the storm until the ladder grows its tiles, so the URL is
  // the only way in — which is what the route is for at this stage.
  const storm = async () => {
    // Out to the ladder first, so this is a fresh mount every time it is
    // called: a hash set to the one it already holds fires no navigation, and
    // the run below it would be whatever the last one finished as. Leaving is
    // also the only way out of the storm there is, so this is the same exit a
    // child takes between two goes at it.
    await page.evaluate((id) => (location.hash = `#/p/${id}`), player);
    await page.evaluate((id) => (location.hash = `#/p/${id}/storm`), player);
    await page.waitForSelector(".storm__letter", { timeout: 8000 });
  };

  await storm();
  /*
   * Thirty-six readings across 900ms, rather than two readings 300ms apart —
   * and the difference is the entire value of the check.
   *
   * The stand-in wave spawns a letter every 300ms and every spawn is a redraw,
   * so React rewrites each stone's inline `--drop` from `state.timeMs` at
   * least once inside any 300ms window. Two readings that far apart therefore
   * move whether or not the rAF loop writes anything at all: delete the loop's
   * only side effect and the pair still differs, because the re-render alone
   * carried the stone. What the re-render cannot fake is the SHAPE of the
   * motion — without the loop the stone climbs a 300ms staircase, three or
   * four distinct positions across this window, where the loop gives one per
   * frame. So the assertion is on the count of distinct positions, which is
   * the one number a staircase and a fall cannot both satisfy.
   *
   * The element is held rather than re-queried between readings: React keys
   * the sky by wave index, so this node survives every re-render for as long
   * as its letter is airborne — and the wave's first letter falls for four
   * seconds, comfortably longer than this samples for.
   */
  const fall = await page.evaluate(async () => {
    // The first stone in DOM order, which is wave-index (spawn) order because
    // the sky renders `wave.letters` in place — NOT lane order, and the lanes
    // in DOM order are not sorted. All this relies on is that the wave never
    // reorders, so it is the same element on every reading below.
    const stone = document.querySelector(".storm__letter");
    const tops = [];
    for (let i = 0; i < 36; i++) {
      tops.push(stone.getBoundingClientRect().top);
      await new Promise((done) => window.setTimeout(done, 25));
    }
    return {
      // Rounded to whole pixels so sub-pixel noise cannot be counted as
      // movement. A frame of this wave is several pixels, so nothing real is
      // rounded away, and a 300ms step is roughly fifty.
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
  });
  check(
    "a stone moves on every frame, not once per spawn",
    fall.distinct >= 12 && fall.forwards && fall.attached,
    `${fall.distinct} distinct positions in ${fall.samples} readings over 900ms, ` +
      `${fall.travelled}px travelled (a per-spawn staircase gives 3)`,
  );
  check(
    "the loop has exactly one frame in flight while it runs",
    fall.pending === 1,
    `${fall.pending} pending`,
  );

  /*
   * The shield, measured against the board it is defending.
   *
   * "Segments align with the finger zones of the keyboard beneath them" is an
   * acceptance criterion with a number behind it, and this is the only place
   * that number exists. `StormField.test.tsx` runs game.css's arithmetic in
   * key units, which is the right altitude for the claim but resolves no
   * `--key` and lays out no boxes; only a browser turns both into pixels at a
   * viewport and can be asked whether one is actually over the other.
   *
   * Each segment is compared with the HOME-ROW keycaps of its own finger,
   * because the home row is where the zones are cut (docs/typing.md §8.5,
   * decision 41) — `a` and Caps under the left pinky's segment, `f` and `g`
   * under the left index's. Half a pixel of tolerance, which is a rounding
   * error and not room for a segment to have drifted a key.
   */
  const shield = await page.evaluate(() => {
    const home = document.querySelector(".keyboard__row:nth-child(3)");
    return [...document.querySelectorAll(".storm__zone")].map((zone) => {
      const box = zone.getBoundingClientRect();
      const caps = [
        ...home.querySelectorAll(
          `.keyboard__key[data-finger="${zone.dataset.finger}"]`,
        ),
      ].map((cap) => cap.getBoundingClientRect());
      return {
        finger: zone.dataset.finger,
        left: box.left,
        right: box.right,
        capLeft: Math.min(...caps.map((cap) => cap.left)),
        capRight: Math.max(...caps.map((cap) => cap.right)),
        keys: caps.length,
      };
    });
  });
  check(
    "each segment covers the home keys of its own finger, edge to edge",
    shield.length === 8 &&
      shield.every(
        (zone, i) =>
          zone.keys > 0 &&
          zone.left <= zone.capLeft + 0.5 &&
          zone.right >= zone.capRight - 0.5 &&
          (i === 0 || Math.abs(zone.left - shield[i - 1].right) < 0.5),
      ),
    shield
      .map((z) => `${z.finger} ${z.left.toFixed(1)}→${z.right.toFixed(1)}`)
      .join(" "),
  );

  // Leaving is what quitting is on this screen (there is no quit control), and
  // it has to take the loop with it — and, since the gun landed, the keydown
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

  // And a run that reaches its end stops itself. The stand-in wave is twelve
  // letters over 7.3s, and nothing is pressed at it, so this waits out a whole
  // storm and every letter of it lands.
  await storm();
  await page
    .waitForFunction(() => window.__pendingFrames() === 0, null, {
      timeout: 15000,
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
  // Three zones took three letters each in this wave, and a zone at zero is a
  // hole — drawn as one, off the same number the reducer holds. Twelve
  // landings is what the numbers below are of: shoot one of those letters and
  // its zone keeps the point, which the run after this one does.
  const holes = damage.zones.filter((zone) => zone.hole);
  check(
    "a zone the storm emptied is drawn as a hole",
    holes.length === 3 &&
      holes.every((zone) => zone.hp === 0) &&
      holes.map((zone) => zone.finger).join() === "l-index,r-index,r-middle",
    damage.zones.map((z) => `${z.finger}:${z.hp.toFixed(2)}`).join(" "),
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
   * is the lowest letter and this stand-in falls every letter at one speed —
   * so the lowest is the earliest still on the field, and its own character
   * shoots it. A key that is not that character is a miss whatever else is in
   * the air, which is the other half of §8.4 and the reason the misses below
   * need no timing at all.
   */
  await page.evaluate(() => {
    window.__tints = [];
    // Every cap that goes red, kept rather than caught: `useKeyEcho` releases
    // a key 120ms after the press (§4.3), and a check that read the DOM after
    // a round trip would be racing that timer for its evidence.
    window.__flares = [];
    new window.MutationObserver((records) => {
      for (const record of records)
        if (record.target.classList.contains("is-wrong"))
          window.__flares.push(record.target.textContent);
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  });
  await storm();

  /** The lowest letter on the field — what the gun is aimed at — or null. */
  const aimed = () =>
    page.evaluate(() => {
      const stones = [...document.querySelectorAll(".storm__letter")];
      if (stones.length === 0) return null;
      // Lowest is the earliest spawn here, and `data-stone` is the letter's
      // index in the wave, which is spawn order (§8.3).
      const low = stones.reduce((a, b) =>
        Number(a.dataset.stone) <= Number(b.dataset.stone) ? a : b,
      );
      return { index: Number(low.dataset.stone), ch: low.textContent };
    });

  /** The HUD as a child reads it, plus what the field has left. */
  const hud = () =>
    page.evaluate(() => {
      const combo = document.querySelector(".storm__combo");
      return {
        score: Number(document.querySelector(".storm__score").textContent),
        combo: combo.textContent,
        hot: combo.hasAttribute("data-hot"),
        stones: document.querySelectorAll(".storm__letter").length,
        xp: document.querySelector(".storm__xp")?.textContent ?? null,
        flares: window.__flares,
      };
    });

  // Five clean hits, each fired at the letter nearest the shield as it comes.
  // The loop waits rather than pressing into an empty sky, because a shot at
  // nothing is a miss and this half is about what a run of hits is worth.
  const HITS = 5;
  const shot = [];
  for (let tries = 0; tries < 60 && shot.length < HITS; tries++) {
    const target = await aimed();
    if (target === null) {
      await page.waitForTimeout(20);
      continue;
    }
    await page.keyboard.press(target.ch);
    shot.push(target.index);
  }
  const combo = await hud();
  check(
    "a run of clean hits climbs, and the multiplier climbs with it",
    // 11 + 12 + 13 + 14 + 15: ten points a hit, at the multiplier the hit
    // itself lands on. The fifth is ×1.5 and the HUD says so.
    shot.length === HITS &&
      shot.join() === "0,1,2,3,4" &&
      combo.score === 65 &&
      combo.combo === "×1.5" &&
      combo.hot,
    `shot ${shot.join()} → ${combo.score} at ${combo.combo}`,
  );

  // And a wrong key, against a letter that is really there: the one case that
  // is not a shot at an empty sky, so it takes the target's own neighbours out
  // of the argument. `q` unless the target is a `q`.
  const target = await aimed();
  const wrongKey = target?.ch.toLowerCase() === "q" ? "z" : "q";
  await page.keyboard.press(wrongKey);
  const missed = await hud();
  check(
    "a wrong key costs a hit's worth, breaks the combo, and flares the board",
    missed.score === combo.score - 10 &&
      missed.combo === "×1.0" &&
      !missed.hot &&
      missed.flares.length === 1 &&
      missed.flares[0].toLowerCase() === wrongKey,
    `${combo.score} → ${missed.score} at ${missed.combo}, ` +
      `flared ${JSON.stringify(missed.flares)}`,
  );

  // Seven more, at a rate a child could actually hammer at. The point of them
  // is the score going under: it is the run's own number and it is allowed to.
  //
  // The 200ms is spacing, not patience, and it is what the flash count at the
  // bottom of this section depends on: the HUD's `--flare` is an element keyed
  // by the miss counter, so two misses inside one frame replace it before its
  // animation has started and draw ONE flash between them — the same
  // under-count the shield's tint has for two landings in one tick (§8.10),
  // and the same safe direction. Pressed back to back, eight wrong keys drew
  // seven flashes.
  const MISSES = 8;
  for (let i = 1; i < MISSES; i++) {
    await page.waitForTimeout(200);
    const next = await aimed();
    await page.keyboard.press(next?.ch.toLowerCase() === "q" ? "z" : "q");
  }
  const sunk = await hud();
  check(
    "the score goes negative, and is drawn negative",
    sunk.score === 65 - MISSES * 10,
    `${sunk.score} after ${MISSES} wrong keys`,
  );

  // Then the rest of the wave lands and the run ends itself, exactly as the
  // untouched one did.
  await page
    .waitForFunction(() => window.__pendingFrames() === 0, null, {
      timeout: 15000,
    })
    .catch(() => {});
  await page.waitForTimeout(300);
  const paid = await hud();
  const earned = Number(/\+(\d+) XP/.exec(paid.xp ?? "")?.[1]);
  check(
    "score can fall; XP cannot — a negative run still pays what it hit",
    paid.score < 0 && paid.xp !== null && earned > 0,
    `score ${paid.score}, ${paid.xp}`,
  );

  const played = await page.evaluate(() => window.__tints);
  const hits = played.filter((tint) => tint.name === "storm-hit");
  const flashes = played.filter((tint) => tint.name === "storm-miss");
  check(
    "five letters shot are five that never reached the shield",
    hits.length === 12 - HITS && hits.every((tint) => tint.finger),
    `${hits.length} damage tints for ${12 - HITS} landings`,
  );
  check(
    "one flash of red per wrong key, and never two inside one flash",
    // The HUD's flare is mounted from the miss counter exactly as the shield's
    // tint is from the landing counter (§8.10, decision 42), so the same
    // measurement holds it: one element per event, and no element restarted.
    // 220ms is the flash; the presses above are 200ms apart on purpose, so a
    // pair closer than that would be the animation restarting rather than the
    // hand moving.
    flashes.length === MISSES &&
      flashes.every((tint) => tint.finger === undefined) &&
      rhythm(flashes, () => "hud") >= 150,
    `${flashes.length} flashes for ${MISSES} wrong keys, ` +
      `closest pair ${rhythm(flashes, () => "hud")}ms apart`,
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
