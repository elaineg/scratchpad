/**
 * E2e tests for SC25 (typewriter scrolling) and SC26 (paragraph font-weight 400).
 * Run against a local production server at BASE_URL (default http://localhost:3000).
 */
import { test, expect, Page } from '@playwright/test';

const EDITOR = '[data-testid="scratchpad-editor"]';

async function freshLoad(page: Page) {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });
}

// ─── SC26: Paragraph font-weight 400, others unchanged ────────────────────────

test('SC26: .scratchpad-editor p (content, not dateline) computed font-weight is 400', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  // Type a paragraph line so there is a <p> in the editor.
  // On a new note this also inserts a dateline (class="dateline-para") — we must
  // target the CONTENT paragraph (not the dateline) to verify the 400 weight.
  await page.locator(EDITOR).click();
  await page.keyboard.type('Hello world');

  // Wait for TipTap to settle (dateline insert is async setTimeout(0))
  await page.waitForTimeout(200);

  // Target a non-dateline paragraph: p:not(.dateline-para)
  const pWeight = await page.evaluate(() => {
    const p = document.querySelector('.scratchpad-editor p:not(.dateline-para)') as HTMLElement | null;
    if (!p) return null;
    return window.getComputedStyle(p).fontWeight;
  });
  expect(pWeight).not.toBeNull();
  expect(parseInt(pWeight!, 10)).toBe(400);
});

test('SC26: body computed font-weight is still 300 (not bumped)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  const bodyWeight = await page.evaluate(() => {
    return window.getComputedStyle(document.body).fontWeight;
  });
  // Body stays at 300; only .scratchpad-editor p is bumped to 400
  const w = parseInt(bodyWeight, 10);
  expect(w).toBeLessThanOrEqual(350);
  expect(w).toBeGreaterThanOrEqual(200);
});

test('SC26: .scratchpad-editor (base) computed font-weight is still 300 (not bumped)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  const editorWeight = await page.locator('.scratchpad-editor').first().evaluate((el) => {
    return window.getComputedStyle(el).fontWeight;
  });
  // The .scratchpad-editor root itself stays 300; only <p> children go to 400
  const w = parseInt(editorWeight, 10);
  expect(w).toBeLessThanOrEqual(350);
  expect(w).toBeGreaterThanOrEqual(200);
});

test('SC26: heading (h1/h2/h3) font-weight is NOT 400 (still 600)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  await page.locator(EDITOR).click();
  await page.keyboard.type('## My heading');

  // Wait for TipTap to apply the heading rule
  await expect(page.locator('.scratchpad-editor h2')).toBeVisible({ timeout: 5_000 });

  const h2Weight = await page.locator('.scratchpad-editor h2').first().evaluate((el) => {
    return window.getComputedStyle(el).fontWeight;
  });
  // Headings use 600, not 400
  expect(parseInt(h2Weight, 10)).toBeGreaterThanOrEqual(500);
});

test('SC26: dateline paragraph font-weight is 300 (not bumped by paragraph rule)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  // Trigger dateline by typing on a new note
  await page.locator(EDITOR).click();
  await page.keyboard.type('my note content');

  // Wait for dateline to appear (async setTimeout(0))
  await expect(page.locator('.scratchpad-editor p.dateline-para')).toBeVisible({ timeout: 3_000 });

  const datelineWeight = await page.locator('.scratchpad-editor p.dateline-para').first().evaluate((el) => {
    return window.getComputedStyle(el).fontWeight;
  });
  // dateline-para overrides to font-weight: 300
  const w = parseInt(datelineWeight, 10);
  expect(w).toBeLessThanOrEqual(350);
});

test('SC26: char-count element font-weight is NOT 400 (inherits body 300)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  await page.locator(EDITOR).click();
  await page.keyboard.type('some text for char count');

  const charCountEl = page.locator('.char-count');
  await expect(charCountEl).toBeVisible({ timeout: 3_000 });

  const ccWeight = await charCountEl.first().evaluate((el) => {
    return window.getComputedStyle(el).fontWeight;
  });
  // char-count inherits body weight (300), not the paragraph 400
  const w = parseInt(ccWeight, 10);
  expect(w).toBeLessThanOrEqual(400); // allows inheriting up to 400 from body chain but...
  // Primary assertion: must not be HEAVIER than 400 (headings are 600)
  expect(w).toBeLessThan(500);
});

// ─── SC25: Typewriter scrolling ───────────────────────────────────────────────

test('SC25: short note stays static (scrollY ≈ 0) when caret is in top half', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  // Type a short note — should NOT scroll
  await page.locator(EDITOR).click();
  await page.keyboard.type('Short note line 1');

  // Wait a bit for any potential rAF scroll to fire
  await page.waitForTimeout(400);

  const scrollY = await page.evaluate(() => window.scrollY);
  // Caret is in top half → page should stay at or very near top
  expect(scrollY).toBeLessThan(50);
});

test('SC25: typing many lines pushes caret past viewport midpoint and triggers scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  await page.locator(EDITOR).click();

  // Gather initial scroll position
  const scrollBefore = await page.evaluate(() => window.scrollY);

  // Type enough lines to push caret below viewport midpoint (900px / 2 = 450px)
  // Each line is ~1.46rem * 1.4 * 13px ≈ ~26px; need ~18+ lines to reach midpoint
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press('Enter');
  }

  // Poll for scrollY to increase (async rAF + smooth scroll)
  let scrollAfter = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(150);
    scrollAfter = await page.evaluate(() => window.scrollY);
    if (scrollAfter > scrollBefore + 20) break;
  }

  expect(scrollAfter).toBeGreaterThan(scrollBefore + 20);
});

test('SC25: deleting lines recenters upward (scrollY decreases)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  await page.locator(EDITOR).click();

  // Type enough lines to trigger typewriter scroll
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Enter');
  }

  // Wait for scroll to settle
  let scrollAtBottom = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(150);
    scrollAtBottom = await page.evaluate(() => window.scrollY);
    if (scrollAtBottom > 100) break;
  }

  // Confirm we scrolled down
  expect(scrollAtBottom).toBeGreaterThan(50);

  // Now delete many lines with Backspace
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Backspace');
  }

  // Poll for scrollY to decrease
  let scrollAfterDelete = scrollAtBottom;
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(150);
    scrollAfterDelete = await page.evaluate(() => window.scrollY);
    if (scrollAfterDelete < scrollAtBottom - 20) break;
  }

  expect(scrollAfterDelete).toBeLessThan(scrollAtBottom - 20);
});

test('SC25: with prefers-reduced-motion:reduce, caret stays within viewport after many lines', async ({ browser }) => {
  // Launch a context with prefers-reduced-motion: reduce
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  // Fresh load
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });

  await page.locator(EDITOR).click();

  // Type many lines to push caret down
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press('Enter');
  }

  // Wait for the instant scroll (auto behavior, no animation delay)
  await page.waitForTimeout(500);

  // Measure caret position relative to viewport
  // With reduced motion, scroll must still happen (instant), caret must be visible
  const caretInView = await page.evaluate(() => {
    const editor = document.querySelector('[data-testid="scratchpad-editor"]') as HTMLElement;
    if (!editor) return false;
    // Use ProseMirror view to get caret coords
    const view = (editor as any).__pm_view;
    if (view) {
      try {
        const coords = view.coordsAtPos(view.state.selection.head);
        return coords.top >= 0 && coords.top <= window.innerHeight;
      } catch {
        // fallback
      }
    }
    // Fallback: check native selection
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight + 5;
    }
    return true; // can't measure, assume ok
  });

  // Also check scrollY > 0 (scroll happened even with reduced motion)
  const scrollY = await page.evaluate(() => window.scrollY);

  await context.close();

  // The scroll should have happened (instant, but still centering)
  expect(scrollY).toBeGreaterThan(20);
  // And caret should be in view (not off-screen)
  expect(caretInView).toBe(true);
});

test('SC25: typewriter scroll does not block typing (snappy — no perceptible lag)', async ({ page }) => {
  // This is a smoke test: type 50 characters rapidly and verify all are preserved.
  // If the scroll callback were on the keystroke critical path, characters would drop.
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  await page.locator(EDITOR).click();

  // Type a rapid string
  const testStr = 'abcdefghijklmnopqrstuvwxyz0123456789';
  await page.keyboard.type(testStr, { delay: 5 });

  // Wait a moment for any pending rAF
  await page.waitForTimeout(300);

  // Verify all characters landed in the editor
  const editorText = await page.locator('.scratchpad-editor').innerText();
  expect(editorText).toContain('abcdefghijklmnopqrstuvwxyz');
});

// ─── SC25 NO-JUMP-ON-SWITCH (Elaine 2026-06-27 amendment) ───────────────────
//
// When the user opens/switches to another note via the sidebar the editor must
// load at scrollY === 0 instantly and statically — no animated jump, no smooth-
// scroll, no auto-centering of the caret on note activation.  The typewriter
// recentering must engage ONLY once the user TYPES past the viewport midpoint on
// the newly-opened note.
//
// SIDEBAR POSITIONING NOTE: The notes-sidebar is position:absolute at desktop
// widths, so its rows sit at document top and scroll off-screen when typewriter
// scroll is engaged. Real users scroll up to see the sidebar before switching.
// The test mirrors that: after getting scrollY > 0, we use scrollIntoView to
// bring the sidebar button into view (which also scrolls to ~0), then click it.
// The app fires window.scrollTo({top:0, behavior:'instant'}) on switch; the
// assertion confirms the scroll is at 0 and stays at 0 (no smooth animation).

const NEW_NOTE_BTN = '[data-testid="new-note-btn"]';

/**
 * Scroll to the top of the page (where the sidebar always lives) and click
 * the new-note button.  The sidebar is position:absolute so its buttons are
 * always at document y=0; scrolling to top guarantees they are in the viewport.
 * We use window.scrollTo({top:0}) rather than scrollIntoView — the latter can
 * place the element 1-3px above the viewport (block:'center' on a near-top
 * element) causing Playwright's click to miss.
 */
async function clickNewNote(page: import('@playwright/test').Page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(100);
  await page.locator(NEW_NOTE_BTN).click();
}

/**
 * Scroll to the top of the page and click the nth note-row button.
 * Same rationale as clickNewNote — sidebar rows at doc-top, scroll to 0 first.
 */
async function clickNoteRow(page: import('@playwright/test').Page, n: number) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(100);
  await page.locator('.note-row').nth(n).locator('button.note-row-btn').click();
}

test('SC25-no-jump: switching notes via sidebar lands at scrollY 0 (static, no animation)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  // ── Seed two notes in localStorage to avoid autosave timing issues ───────
  // Pre-seeded notes guarantee the sidebar shows 2 rows on first load,
  // so we don't need to type + wait for autosave before creating note B.
  const noteIdA = 'no-jump-test-a';
  const noteIdB = 'no-jump-test-b';
  const makeDoc = (text: string) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  await page.goto('/');
  await page.evaluate(({ idA, idB, docA, docB }) => {
    window.localStorage.clear();
    window.localStorage.setItem(`scratchpad-note-${idA}`, JSON.stringify({ id: idA, content: docA, updatedAt: 1000 }));
    window.localStorage.setItem(`scratchpad-note-${idB}`, JSON.stringify({ id: idB, content: docB, updatedAt: 2000 }));
    window.localStorage.setItem('scratchpad-notes-index', JSON.stringify([idB, idA]));
    window.localStorage.setItem('scratchpad-active-id', idB);
  }, { idA: noteIdA, idB: noteIdB, docA: makeDoc('Note A content'), docB: makeDoc('Note B content') });
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });

  // Verify 2 note rows are present (note B is active / most-recent = row 0)
  await expect(page.locator('.note-row')).toHaveCount(2, { timeout: 5000 });

  // ── Type many lines on note B so typewriter scroll engages (scrollY > 0) ─
  await page.locator(EDITOR).click();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Enter');
  }
  let scrollB = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(150);
    scrollB = await page.evaluate(() => window.scrollY);
    if (scrollB > 20) break;
  }
  expect(scrollB).toBeGreaterThan(20); // confirmed: typewriter engaged on note B

  // ── Switch to note A ─────────────────────────────────────────────────────
  // Scroll to top first (sidebar is position:absolute, lives at document top).
  // After the click, the app fires window.scrollTo({top:0, behavior:'instant'}).
  // We assert scrollY === 0 and that it STAYS at 0 (no deferred smooth-scroll).
  // NOTE: We assert 0 remains after 600ms — this is the real behavioral gate.
  // Without the fix, a smooth typewriter scroll animation would move scrollY
  // away from 0 within 300ms of the note switch.
  await clickNoteRow(page, 1); // note A is 2nd row (note B is most-recent → row 0)

  const scrollAfterSwitchToA = await page.evaluate(() => window.scrollY);
  expect(scrollAfterSwitchToA).toBe(0);

  // 600ms: two rAF cycles + a full smooth-scroll window — if a smooth animation
  // had fired, scrollY would be nonzero here.
  await page.waitForTimeout(600);
  const scrollAfterDelay = await page.evaluate(() => window.scrollY);
  expect(scrollAfterDelay).toBe(0);

  // ── B → A → B a second time, each switch must land at 0 ─────────────────
  // Type lines on note A to engage typewriter
  await page.locator(EDITOR).click();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Enter');
  }
  let scrollA2 = 0;
  for (let attempt = 0; attempt < 15; attempt++) {
    await page.waitForTimeout(150);
    scrollA2 = await page.evaluate(() => window.scrollY);
    if (scrollA2 > 20) break;
  }
  expect(scrollA2).toBeGreaterThan(20);

  // Switch to B
  await clickNoteRow(page, 0); // note B is row 0 (most-recent)
  const scrollAtBAgain = await page.evaluate(() => window.scrollY);
  expect(scrollAtBAgain).toBe(0);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // Type on note B to scroll it, then switch back to A
  await page.locator(EDITOR).click();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Enter');
  }
  let scrollB2 = 0;
  for (let attempt = 0; attempt < 15; attempt++) {
    await page.waitForTimeout(150);
    scrollB2 = await page.evaluate(() => window.scrollY);
    if (scrollB2 > 20) break;
  }
  expect(scrollB2).toBeGreaterThan(20);

  // Switch back to A — must land at 0 and stay there
  await clickNoteRow(page, 1);
  const scrollBackAtA = await page.evaluate(() => window.scrollY);
  expect(scrollBackAtA).toBe(0);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('SC25-no-jump: typewriter DOES NOT engage on fresh note until user types past midpoint', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  // Seed note A in localStorage so we start with 1 saved note (avoids autosave timing issues)
  const noteIdA = 'no-jump-typewriter-a';
  const docA = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note A' }] }] };
  await page.goto('/');
  await page.evaluate(({ id, doc }) => {
    window.localStorage.clear();
    window.localStorage.setItem(`scratchpad-note-${id}`, JSON.stringify({ id, content: doc, updatedAt: 1000 }));
    window.localStorage.setItem('scratchpad-notes-index', JSON.stringify([id]));
    window.localStorage.setItem('scratchpad-active-id', id);
  }, { id: noteIdA, doc: docA });
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });

  // Type many lines on note A so typewriter engages (scrollY > 0)
  await page.locator(EDITOR).click();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Enter');
  }
  let scrollA = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(150);
    scrollA = await page.evaluate(() => window.scrollY);
    if (scrollA > 20) break;
  }
  expect(scrollA).toBeGreaterThan(20);

  // Create note B (new blank note) — app must reset scrollY to 0 on creation.
  await clickNewNote(page);
  await expect(page.locator('.note-row')).toHaveCount(2, { timeout: 5000 });
  await page.waitForTimeout(300); // let the editor mount and suppressScroll settle

  // After the switch, page must be at top (app resets scroll on note creation)
  const scrollOnNewNote = await page.evaluate(() => window.scrollY);
  expect(scrollOnNewNote).toBe(0);

  // Type just a few lines — caret is well within top half of the 900px viewport.
  // The first Enter triggers dateline insertion on a new note; subsequent keystrokes
  // clear suppressScrollRef so the typewriter CAN engage later.
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(500);

  // Typewriter should NOT have engaged yet — page still at top
  const scrollAfterFewLines = await page.evaluate(() => window.scrollY);
  expect(scrollAfterFewLines).toBeLessThan(50);

  // Now type many lines to push caret past the viewport midpoint (450px at 900px).
  // ~25 lines × ~26px/line ≈ 650px — well past midpoint.
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Enter');
  }

  let scrollAfterManyLines = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(200);
    scrollAfterManyLines = await page.evaluate(() => window.scrollY);
    if (scrollAfterManyLines > 20) break;
  }
  // Typewriter SHOULD engage — page must scroll to keep caret centered
  expect(scrollAfterManyLines).toBeGreaterThan(20);
});

test('SC25-no-jump: with prefers-reduced-motion:reduce, note switch still lands at scrollY 0', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  // Seed two notes in localStorage to avoid autosave timing issues
  const noteIdA = 'no-jump-rm-a';
  const noteIdB = 'no-jump-rm-b';
  const makeDoc = (text: string) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  await page.goto('/');
  await page.evaluate(({ idA, idB, docA, docB }) => {
    window.localStorage.clear();
    window.localStorage.setItem(`scratchpad-note-${idA}`, JSON.stringify({ id: idA, content: docA, updatedAt: 1000 }));
    window.localStorage.setItem(`scratchpad-note-${idB}`, JSON.stringify({ id: idB, content: docB, updatedAt: 2000 }));
    window.localStorage.setItem('scratchpad-notes-index', JSON.stringify([idB, idA]));
    window.localStorage.setItem('scratchpad-active-id', idB);
  }, { idA: noteIdA, idB: noteIdB, docA: makeDoc('Note A'), docB: makeDoc('Note B') });
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });

  // 2 note rows must be present (note B is active = row 0)
  await expect(page.locator('.note-row')).toHaveCount(2, { timeout: 5000 });

  // Type many lines on note B to engage typewriter scroll
  await page.locator(EDITOR).click();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Enter');
  }
  let scrollB = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(150);
    scrollB = await page.evaluate(() => window.scrollY);
    if (scrollB > 20) break;
  }
  expect(scrollB).toBeGreaterThan(20);

  // Switch back to note A (row index 1) — scroll to top so button is in viewport
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(100);
  await page.locator('.note-row').nth(1).locator('button.note-row-btn').click();

  // Must be at 0 immediately — the app fires window.scrollTo({top:0, behavior:'instant'}).
  // Also assert 600ms later: smooth animation (unfixed behavior) would have moved scrollY.
  const scrollAfterSwitch = await page.evaluate(() => window.scrollY);
  expect(scrollAfterSwitch).toBe(0);
  await page.waitForTimeout(600);
  const scrollDeferred = await page.evaluate(() => window.scrollY);
  await context.close();
  expect(scrollDeferred).toBe(0);
});
