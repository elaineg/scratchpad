/**
 * E2e tests for the 2026-06-20 restyle pass.
 * Covers new/changed spec items 10, 11, 13, 17, 18 (restyle variants):
 *   - Title from content, SKIPPING dateline, sidebar row shows content not date
 *   - Delete immediate, no confirm dialog
 *   - Active row marked by INK COLOR ONLY (no fill/inversion)
 *   - Sidebar has no border/background chrome
 *   - Dateline is tight: no blank paragraph between dateline and first typed line
 *   - NO copy affordance in DOM or bundle
 *   - Global type: root font-size ~13px, body font-weight ~300
 */
import { test, expect, Page } from '@playwright/test';

const EDITOR = '[data-testid="scratchpad-editor"]';
const NEW_NOTE_BTN = '[data-testid="new-note-btn"]';
const NOTES_SIDEBAR = '[data-testid="notes-sidebar"]';

async function freshLoad(page: Page) {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });
}

async function seedTwoNotes(page: Page, id1: string, text1: string, id2: string, text2: string) {
  await page.goto('/');
  await page.evaluate(({ id1, text1, id2, text2 }) => {
    window.localStorage.clear();
    const rec = (id: string, text: string, ts: number) => ({
      id,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
      updatedAt: ts,
    });
    window.localStorage.setItem(`scratchpad-note-${id1}`, JSON.stringify(rec(id1, text1, 1000)));
    window.localStorage.setItem(`scratchpad-note-${id2}`, JSON.stringify(rec(id2, text2, 2000)));
    window.localStorage.setItem('scratchpad-notes-index', JSON.stringify([id2, id1]));
    window.localStorage.setItem('scratchpad-active-id', id2);
  }, { id1, text1, id2, text2 });
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });
}

// ─── SC17 (spec item 17): Global type — root font-size ≈13px, body weight ≈300 ─

test('SC17-restyle: root font-size is ~13px (not 16px)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  const fontSize = await page.evaluate(() => {
    return window.getComputedStyle(document.documentElement).fontSize;
  });
  // Should be 13px, not the default 16px
  expect(fontSize).toBe('13px');
});

test('SC17-restyle: body font-weight is lighter (≤350, not 400)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  const fontWeight = await page.evaluate(() => {
    return window.getComputedStyle(document.body).fontWeight;
  });
  // Should be 300 (or at most 350); must NOT be 400 or heavier
  const weight = parseInt(fontWeight, 10);
  expect(weight).toBeLessThanOrEqual(350);
  expect(weight).toBeGreaterThanOrEqual(200);
});

// ─── SC11 (spec item 11): Sidebar bare text — no background fill, no border ──

test('SC11-restyle: notes-sidebar container has no border and transparent/paper background', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  const styles = await page.locator(NOTES_SIDEBAR).evaluate((el) => {
    const cs = window.getComputedStyle(el);
    return {
      borderRightWidth: cs.borderRightWidth,
      borderRightStyle: cs.borderRightStyle,
      backgroundColor: cs.backgroundColor,
    };
  });

  // No border-right (the sidebar must not have a visible divider line)
  const hasBorder = styles.borderRightWidth !== '0px' && styles.borderRightStyle !== 'none';
  expect(hasBorder).toBe(false);

  // Background must be transparent or the paper color (#FBFAF8) — NOT a dark/filled color
  // transparent = rgba(0,0,0,0); paper = rgb(251,250,248)
  const bg = styles.backgroundColor;
  const isTransparentOrPaper =
    bg === 'rgba(0, 0, 0, 0)' ||
    bg === 'transparent' ||
    bg === 'rgb(251, 250, 248)';
  expect(isTransparentOrPaper).toBe(true);
});

// ─── SC10 (spec item 10): Title from content, SKIPPING dateline ───────────────

test('SC10-restyle: sidebar title skips auto-dateline, shows "meeting notes" not the date', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  // Type on the fresh blank note — dateline auto-inserts on first keystroke
  await page.locator(EDITOR).click();
  await page.keyboard.type('meeting notes');

  // Wait for dateline insertion and autosave debounce
  await page.waitForFunction(() => {
    const editor = document.querySelector('[data-testid="scratchpad-editor"]');
    return editor ? editor.querySelectorAll('p').length >= 2 : false;
  }, undefined, { timeout: 5000 });

  // Wait for autosave (debounce 800ms) + list refresh (900ms)
  await page.waitForTimeout(2000);

  // The sidebar title should be "meeting notes", NOT a date string
  const sidebarText = await page.locator(NOTES_SIDEBAR).innerText();
  expect(sidebarText).toContain('meeting notes');

  // The sidebar title must NOT show the date as the title
  // Check via the note-title span — it should contain "meeting notes" not a date pattern
  const titleSpan = page.locator('.note-title').first();
  const titleText = await titleSpan.innerText();
  expect(titleText).toContain('meeting notes');
  expect(titleText).not.toMatch(/^\w+,\s+\w+\s+\d+/); // not starting with date
});

test('SC10-restyle: empty new note shows "Untitled" in sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  // On cold load a blank note exists — sidebar should show "Untitled"
  const sidebarText = await page.locator(NOTES_SIDEBAR).innerText();
  // Either "Untitled" is shown, or no note rows visible yet (possible on fresh load)
  // After debounce, the blank note's title is "Untitled"
  await page.waitForTimeout(300);
  const titleSpans = await page.locator('.note-title').count();
  if (titleSpans > 0) {
    const firstTitle = await page.locator('.note-title').first().innerText();
    // A blank new note should show "Untitled"
    expect(firstTitle.trim()).toBe('Untitled');
  }
  // Also confirm sidebar does not show any date string as a title on empty note
  expect(sidebarText).not.toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
});

// ─── SC13 (spec item 13): Delete IMMEDIATE, no confirm dialog ─────────────────

test('SC13-restyle: delete × is immediate, no confirm dialog appears', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedTwoNotes(page, 'keep-1', 'keep this note', 'del-2', 'delete this note');

  // Hover to reveal delete glyph on the active note (del-2)
  await page.locator('[data-testid="note-select-del-2"]').hover();
  // Click delete
  await page.locator('[data-testid="delete-note-del-2"]').click({ force: true });

  // Assert: NO confirm dialog appeared (no dialog, no confirm-delete element)
  const dialogCount = await page.locator('[role="dialog"]').count();
  expect(dialogCount).toBe(0);
  const confirmCount = await page.locator('[data-testid*="confirm-delete"]').count();
  expect(confirmCount).toBe(0);
  const alertCount = await page.locator('[role="alertdialog"]').count();
  expect(alertCount).toBe(0);

  // Row is gone immediately
  await page.waitForTimeout(100);
  expect(await page.locator('.note-row').count()).toBe(1);
  await expect(page.locator(NOTES_SIDEBAR)).not.toContainText('delete this note');
  await expect(page.locator(NOTES_SIDEBAR)).toContainText('keep this note');
});

// ─── SC11 (spec item 11): Active row marked by INK only — no fill/inversion ───

test('SC11-restyle: active note row background is NOT a fill color (transparent or paper)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedTwoNotes(page, 'inactive-1', 'inactive note', 'active-2', 'active note');

  // active-2 is the active note (loaded last with highest updatedAt=2000)
  const activeBtn = page.locator('[data-testid="note-select-active-2"]');
  await expect(activeBtn).toBeVisible({ timeout: 3000 });

  const activeBg = await activeBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  // Must NOT be a dark fill (ink = rgb(43,43,41)); must be transparent or paper
  expect(activeBg).not.toMatch(/rgb\(43,\s*43,\s*41\)/);
  const isTransparentOrPaper =
    activeBg === 'rgba(0, 0, 0, 0)' ||
    activeBg === 'transparent' ||
    activeBg === 'rgb(251, 250, 248)' ||
    activeBg === 'rgb(255, 255, 255)';
  expect(isTransparentOrPaper).toBe(true);

  // Active row text color IS ink (the ONLY distinguisher)
  const activeColor = await activeBtn.evaluate((el) => window.getComputedStyle(el).color);
  expect(activeColor).toMatch(/rgb\(43,\s*43,\s*41\)/);

  // Inactive row text color is faint grey (NOT ink)
  const inactiveColor = await page.locator('[data-testid="note-select-inactive-1"]').evaluate(
    (el) => window.getComputedStyle(el).color
  );
  expect(inactiveColor).not.toMatch(/rgb\(43,\s*43,\s*41\)/);
});

// ─── SC15 (spec item 15): Dateline tight — no blank paragraph gap below ───────

test('SC15-restyle: dateline paragraph is directly followed by content, no empty paragraph gap', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  await page.locator(EDITOR).click();
  await page.keyboard.type('tight check');

  // Wait for dateline to be inserted
  await page.waitForFunction(() => {
    const editor = document.querySelector('[data-testid="scratchpad-editor"]');
    return editor ? editor.querySelectorAll('p').length >= 2 : false;
  }, undefined, { timeout: 5000 });

  // Inspect the ProseMirror document: paragraphs should be [dateline, content]
  // No empty paragraph between them
  const paragraphs = await page.evaluate(() => {
    const editor = document.querySelector('[data-testid="scratchpad-editor"]');
    if (!editor) return [];
    return Array.from(editor.querySelectorAll('p')).map(p => ({
      text: p.textContent ?? '',
      classes: p.className,
    }));
  });

  // Verify at least 2 paragraphs
  expect(paragraphs.length).toBeGreaterThanOrEqual(2);

  // First paragraph is the dateline (faint, date-like)
  const dateline = paragraphs[0];
  expect(dateline.text).toMatch(/\w+, \w+ \d+/);

  // Second paragraph is the content — NOT empty
  const content = paragraphs[1];
  expect(content.text.trim()).toBe('tight check');

  // There is NO empty paragraph between dateline and content
  // (dateline is [0], content is [1] — no blank in between)
  if (paragraphs.length > 2) {
    // If more paragraphs exist, the one at index 1 must have content
    expect(content.text.trim()).not.toBe('');
  }
});

// ─── SC18 (spec item 18): NO copy affordance anywhere ─────────────────────────

test('SC18-restyle: no copy icon, copy button, or copy confirmation on non-empty note', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshLoad(page);

  // Type something to make the note non-empty
  await page.locator(EDITOR).click();
  await page.keyboard.type('some content for copy test');
  await page.waitForTimeout(500);

  // No copy-related elements
  expect(await page.locator('[data-testid="copy-icon-btn"]').count()).toBe(0);
  expect(await page.locator('[data-testid="copy-icon-confirm"]').count()).toBe(0);
  expect(await page.locator('[data-testid="copy-icon-blocked"]').count()).toBe(0);
  expect(await page.locator('.copy-actions').count()).toBe(0);
  expect(await page.locator('[data-testid*="copy"]').count()).toBe(0);

  // No "Copied!" or "Copy blocked" text in the page
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('Copied!');
  expect(bodyText).not.toContain('Copy blocked');
  expect(bodyText).not.toContain('Copy as Rich Text');
  expect(bodyText).not.toContain('Copy as Markdown');
});

test('SC18-restyle: bundle JS chunks contain no ClipboardItem runtime call', async ({ page }) => {
  // The docSerializer.ts has ClipboardItem in a COMMENT, but the bundle should not
  // contain any actual ClipboardItem reference (the copy feature was removed).
  // Intercept the JS chunk responses and scan their content.
  const jsChunks: string[] = [];
  page.on('response', async (response) => {
    if (response.url().includes('/_next/static/chunks/') && response.url().endsWith('.js')) {
      try {
        const text = await response.text();
        jsChunks.push(text);
      } catch {
        // ignore
      }
    }
  });

  await page.goto('/');
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });

  // Check each captured chunk for ClipboardItem
  let foundClipboardItem = false;
  for (const chunk of jsChunks) {
    if (chunk.includes('ClipboardItem')) {
      foundClipboardItem = true;
      break;
    }
  }
  expect(foundClipboardItem).toBe(false);
});

// ─── Returning-user + dateline-skip: pre-populated state ──────────────────────

test('SC10-restyle returning-user: pre-seeded note with dateline → sidebar shows content title', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Seed a note that already has a dateline as first paragraph and content as second
  const noteId = 'restyle-returning-1';
  await page.goto('/');
  await page.evaluate(({ id }) => {
    window.localStorage.clear();
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { class: 'dateline-para' }, content: [{ type: 'text', text: 'Friday, June 20' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'stand-up agenda' }] },
      ],
    };
    const record = { id, content: doc, updatedAt: Date.now() };
    window.localStorage.setItem(`scratchpad-note-${id}`, JSON.stringify(record));
    window.localStorage.setItem('scratchpad-notes-index', JSON.stringify([id]));
    window.localStorage.setItem('scratchpad-active-id', id);
  }, { id: noteId });
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(300);

  // Sidebar title should show "stand-up agenda", NOT "Friday, June 20"
  const titleSpan = page.locator('.note-title').first();
  const titleText = await titleSpan.innerText();
  expect(titleText.trim()).toContain('stand-up agenda');
  expect(titleText.trim()).not.toMatch(/Friday/);
  expect(titleText.trim()).not.toMatch(/June 20/);
});
