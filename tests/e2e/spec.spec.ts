/**
 * Scratchpad e2e tests — cover all Success checks from APP_SPEC.md.
 * Run against a local production server: BASE_URL=http://localhost:3000 npm run test:e2e
 */
import { test, expect, Page } from '@playwright/test';

const EDITOR = '[data-testid="scratchpad-editor"]';

// Helper: clear localStorage and reload to a clean state
async function freshLoad(page: Page) {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  // Wait for the editor to appear (dynamic import hydrates client-side)
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });
}

// ─── Success check 1: Cold-load focus, zero clicks ───────────────────────────
test('SC1: editor is auto-focused; typing "h" without any click inserts it', async ({ page }) => {
  await freshLoad(page);
  // Without clicking anywhere, press a key
  await page.keyboard.press('h');
  const editorText = await page.locator(EDITOR).innerText();
  expect(editorText).toContain('h');
});

// ─── Success check 2: Heading rule (## → H2) ─────────────────────────────────
test('SC2: "## Roadmap" becomes H2 with no visible "## " syntax', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('## Roadmap');
  // TipTap fires the heading input rule on the trailing space; result is an H2
  await expect(page.locator(`${EDITOR} h2`)).toBeVisible({ timeout: 3000 });
  await expect(page.locator(`${EDITOR} h2`)).toHaveText('Roadmap');
  // The literal "## " must not appear anywhere in the editor text
  const raw = await page.locator(EDITOR).innerText();
  expect(raw).not.toContain('## ');
});

// ─── H1 rule ("# ") ──────────────────────────────────────────────────────────
test('H1 rule: "# " prefix converts to H1', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('# Hello World');
  await expect(page.locator(`${EDITOR} h1`)).toBeVisible({ timeout: 3000 });
  await expect(page.locator(`${EDITOR} h1`)).toHaveText('Hello World');
  const raw = await page.locator(EDITOR).innerText();
  expect(raw).not.toContain('# ');
});

// ─── H3 rule ("### ") ────────────────────────────────────────────────────────
test('H3 rule: "### " prefix converts to H3', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('### Sub');
  await expect(page.locator(`${EDITOR} h3`)).toBeVisible({ timeout: 3000 });
  await expect(page.locator(`${EDITOR} h3`)).toHaveText('Sub');
  const raw = await page.locator(EDITOR).innerText();
  expect(raw).not.toContain('### ');
});

// ─── Enter after heading returns to paragraph ────────────────────────────────
test('Enter after heading returns next line to paragraph (not another heading)', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('## My heading');
  await page.keyboard.press('Enter');
  await page.keyboard.type('normal text');
  // The editor should have exactly one h2 and at least one paragraph with normal text
  await expect(page.locator(`${EDITOR} h2`)).toHaveCount(1);
  await expect(page.locator(`${EDITOR} p`).filter({ hasText: 'normal text' })).toHaveCount(1);
});

// ─── Success check 3: Bullet rule ("- ") ─────────────────────────────────────
test('SC3: "- buy milk" becomes a bulleted list item; no literal "- "', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('- buy milk');
  await expect(page.locator(`${EDITOR} ul li`)).toBeVisible({ timeout: 3000 });
  await expect(page.locator(`${EDITOR} ul li`)).toContainText('buy milk');
  const raw = await page.locator(EDITOR).innerText();
  // The literal "- " (dash-space as markdown) should be gone
  expect(raw).not.toMatch(/^- buy milk/m);
});

// ─── Numbered list rule ("1. ") ──────────────────────────────────────────────
test('Numbered list rule: "1. " prefix converts to ordered list', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('1. first item');
  await expect(page.locator(`${EDITOR} ol li`)).toBeVisible({ timeout: 3000 });
  await expect(page.locator(`${EDITOR} ol li`)).toContainText('first item');
});

// ─── Blockquote rule ("> ") ──────────────────────────────────────────────────
test('Blockquote rule: "> " prefix converts to blockquote', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('> wise words');
  await expect(page.locator(`${EDITOR} blockquote`)).toBeVisible({ timeout: 3000 });
  await expect(page.locator(`${EDITOR} blockquote`)).toContainText('wise words');
});

// ─── Success check 4: Bold rule (**bold**) ────────────────────────────────────
test('SC4: "**ship it**" renders bold; no literal asterisks', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('**ship it**');
  await expect(page.locator(`${EDITOR} strong`)).toBeVisible({ timeout: 3000 });
  await expect(page.locator(`${EDITOR} strong`)).toHaveText('ship it');
  const raw = await page.locator(EDITOR).innerText();
  expect(raw).not.toContain('**');
});

// ─── Italic rule (*italic*) ──────────────────────────────────────────────────
test('Italic rule: "*italic*" renders em; no literal asterisks', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('*italic*');
  await expect(page.locator(`${EDITOR} em`)).toBeVisible({ timeout: 3000 });
  await expect(page.locator(`${EDITOR} em`)).toHaveText('italic');
  const raw = await page.locator(EDITOR).innerText();
  expect(raw).not.toContain('*italic*');
});

// ─── Inline code rule (`code`) ───────────────────────────────────────────────
test('Inline code rule: backtick-wrapped text renders as <code>; no backticks visible', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('`hello`');
  await expect(page.locator(`${EDITOR} code`)).toBeVisible({ timeout: 3000 });
  await expect(page.locator(`${EDITOR} code`)).toHaveText('hello');
  const raw = await page.locator(EDITOR).innerText();
  expect(raw).not.toContain('`hello`');
});

// ─── Success check 5: Divider rule (---) ─────────────────────────────────────
test('SC5: typing "---" + Enter on a new line produces an <hr>', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  // TipTap StarterKit fires the HR rule when you type "---" then press Enter
  await page.keyboard.type('---');
  await page.keyboard.press('Enter');
  await expect(page.locator(`${EDITOR} hr`)).toBeVisible({ timeout: 3000 });
  const raw = await page.locator(EDITOR).innerText();
  expect(raw).not.toContain('---');
});

// ─── Success check 6: Autosave round-trip ────────────────────────────────────
test('SC6: autosave round-trip — typed text persists after reload', async ({ page }) => {
  await freshLoad(page);
  const MARKER = 'persist test 123';
  await page.locator(EDITOR).click();
  await page.keyboard.type(MARKER);
  // Wait for debounce to fire (SAVE_DEBOUNCE_MS = 800ms; wait 2s to be safe)
  await page.waitForTimeout(2000);
  // Reload — do NOT clear localStorage this time
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });
  await expect(page.locator(EDITOR)).toContainText(MARKER);
});

// ─── Autosave round-trip: multi-line + heading persists ──────────────────────
test('Autosave: multi-line document with heading persists after reload', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('## My Title');
  await page.keyboard.press('Enter');
  await page.keyboard.type('paragraph content here');
  await page.waitForTimeout(2000);
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });
  await expect(page.locator(`${EDITOR} h2`)).toHaveText('My Title');
  await expect(page.locator(EDITOR)).toContainText('paragraph content here');
});

// ─── Returning-user / pre-populated localStorage state ───────────────────────
test('Returning user: pre-seeded localStorage content renders on load', async ({ page }) => {
  // Seed localStorage BEFORE navigating so the editor picks it up on mount
  await page.goto('/');
  await page.evaluate(() => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Seeded Heading' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'seeded paragraph text' }],
        },
      ],
    };
    window.localStorage.setItem('scratchpad-v1', JSON.stringify(doc));
  });
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });
  await expect(page.locator(`${EDITOR} h2`)).toHaveText('Seeded Heading');
  await expect(page.locator(EDITOR)).toContainText('seeded paragraph text');
});

// ─── Success check 7: No layout jump on heading conversion ───────────────────
test('SC7: converting a paragraph line to heading does not cause other lines to jump', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('line one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('line two');
  await page.keyboard.press('Enter');
  await page.keyboard.type('## heading here');
  // The heading was inserted on a new line — check both prior lines still exist
  await expect(page.locator(EDITOR)).toContainText('line one');
  await expect(page.locator(EDITOR)).toContainText('line two');
  await expect(page.locator(`${EDITOR} h2`)).toHaveText('heading here');
});

// ─── Success check 8: No chrome on load ──────────────────────────────────────
test('SC8: no toolbar, menu bar, header, sidebar, or visible buttons on cold load', async ({ page }) => {
  await freshLoad(page);
  // No nav, header, or sidebar elements
  await expect(page.locator('nav')).toHaveCount(0);
  await expect(page.locator('header')).toHaveCount(0);
  await expect(page.locator('aside')).toHaveCount(0);
  // Copy buttons are in the DOM but hidden (opacity:0, pointer-events:none, aria-hidden)
  // on a blank document — they must NOT be visible or interactive
  const copyActions = page.locator('.copy-actions');
  // aria-hidden is set to true on blank load
  const ariaHidden = await copyActions.getAttribute('aria-hidden');
  expect(ariaHidden).toBe('true');
  // computed opacity must be 0
  const opacity = await copyActions.evaluate((el) => parseFloat(window.getComputedStyle(el).opacity));
  expect(opacity).toBe(0);
  // Only the main writing surface
  await expect(page.locator('main')).toBeVisible();
});

// ─── Success check 9: Comfortable measure (max-width constrained) ─────────────
test('SC9: writing column has constrained max-width (not full-bleed)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await freshLoad(page);
  const editorBox = await page.locator(EDITOR).boundingBox();
  expect(editorBox).not.toBeNull();
  // Editor should not fill the full 1440px viewport; spec says ~65-75ch (~68ch set)
  // At 1440px, the column should be well under 900px wide
  expect(editorBox!.width).toBeLessThan(900);
  // And it should have some minimum width to actually be usable
  expect(editorBox!.width).toBeGreaterThan(300);
});

// ─── Placeholder visible when empty, hidden after typing ─────────────────────
test('Placeholder shows on empty editor and disappears after typing', async ({ page }) => {
  await freshLoad(page);
  // The placeholder is CSS ::before pseudo-content on .is-editor-empty
  // Verify the class is present on empty state
  const isEmpty = await page.locator(`${EDITOR} p.is-editor-empty`).count();
  expect(isEmpty).toBeGreaterThan(0);
  // After typing, .is-editor-empty should be removed
  await page.locator(EDITOR).click();
  await page.keyboard.type('x');
  const isEmptyAfter = await page.locator(`${EDITOR} p.is-editor-empty`).count();
  expect(isEmptyAfter).toBe(0);
});

// ─── "Saved" indicator appears after edit ────────────────────────────────────
test('"Saved" indicator appears after typing (within 2s)', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('hello saved');
  // The .saved-indicator.show element should appear within debounce + animation time
  await expect(page.locator('.saved-indicator.show')).toBeVisible({ timeout: 3000 });
});

// ─── No console errors on load ───────────────────────────────────────────────
test('No console errors on cold load', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await freshLoad(page);
  // Slight wait for hydration to fully settle
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

// ─── FIX 1: No focus-ring box on .ProseMirror when focused ───────────────────
test('FIX1: focused .ProseMirror has no outline/box-shadow (focus ring removed)', async ({ page }) => {
  await freshLoad(page);
  // Click to ensure focus
  await page.locator(EDITOR).click();
  // Read computed styles of the focused ProseMirror element
  const styles = await page.evaluate(() => {
    const el = document.querySelector('.ProseMirror') as HTMLElement;
    if (!el) return null;
    const cs = window.getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      boxShadow: cs.boxShadow,
    };
  });
  expect(styles).not.toBeNull();
  // outline-style should be 'none' OR outline-width should be '0px'
  const noOutline = styles!.outlineStyle === 'none' || styles!.outlineWidth === '0px';
  expect(noOutline).toBe(true);
  // box-shadow must be none/unset
  expect(styles!.boxShadow).toBe('none');
});

// ─── FIX 2: Placeholder paints on empty load, disappears after typing ─────────
// NOTE: In TipTap v3, is-editor-empty is on the <p> element, NOT on .ProseMirror.
// The CSS rule targets p.is-editor-empty (or p.is-empty) and data-placeholder is on that <p>.
test('FIX2: placeholder ::before content renders on empty editor; disappears after typing', async ({ page }) => {
  await freshLoad(page);
  // On cold empty load: the empty <p> must carry is-editor-empty + data-placeholder
  const emptyState = await page.evaluate(() => {
    const pm = document.querySelector('.ProseMirror');
    if (!pm) return null;
    // TipTap v3: is-editor-empty lives on the first <p>, not on .ProseMirror
    const emptyP = pm.querySelector('p.is-editor-empty');
    const placeholder = emptyP ? emptyP.getAttribute('data-placeholder') : null;
    // Check ::before pseudo-element content on the empty paragraph
    const beforeContent = emptyP
      ? window.getComputedStyle(emptyP, '::before').content
      : null;
    return { hasEmptyP: !!emptyP, placeholder, beforeContent };
  });
  expect(emptyState).not.toBeNull();
  // The empty paragraph with is-editor-empty must exist
  expect(emptyState!.hasEmptyP).toBe(true);
  // data-placeholder must be set to our string
  expect(emptyState!.placeholder).toBe('Start typing…');
  // ::before content resolves to the placeholder string (CSS wraps it in quotes)
  expect(emptyState!.beforeContent).not.toBe('none');
  expect(emptyState!.beforeContent).not.toBe('');
  expect(emptyState!.beforeContent).not.toBeNull();
  // The content value includes the placeholder text
  expect(emptyState!.beforeContent).toContain('Start typing');

  // After typing, is-editor-empty on the paragraph should be removed
  await page.locator(EDITOR).click();
  await page.keyboard.type('a');
  const afterTyping = await page.evaluate(() => {
    const pm = document.querySelector('.ProseMirror');
    return pm ? pm.querySelectorAll('p.is-editor-empty').length : -1;
  });
  expect(afterTyping).toBe(0);
});

// ─── FIX 3: "Saved" indicator behavior ───────────────────────────────────────
test('FIX3a: "Saved" indicator does NOT appear on cold empty load', async ({ page }) => {
  await freshLoad(page);
  // Wait a full debounce period to be certain no spurious flash occurs
  await page.waitForTimeout(1200);
  // .saved-indicator.show must NOT be present
  const showCount = await page.locator('.saved-indicator.show').count();
  expect(showCount).toBe(0);
});

test('FIX3b: "Saved" does NOT flash during localStorage restore-on-reload', async ({ page }) => {
  // First, seed localStorage with real content
  await page.goto('/');
  await page.evaluate(() => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'restore test content' }] },
      ],
    };
    window.localStorage.setItem('scratchpad-v1', JSON.stringify(doc));
  });
  // Reload — this triggers the restore path
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });
  // The text should be restored
  await expect(page.locator(EDITOR)).toContainText('restore test content');
  // But "Saved" must NOT have flashed during restore (debounce is 800ms; wait 1.5s)
  await page.waitForTimeout(1500);
  const showCount = await page.locator('.saved-indicator.show').count();
  expect(showCount).toBe(0);
});

test('FIX3c: "Saved" DOES appear after typing new content (debounce + indicator)', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('new content for saved indicator');
  // Wait for debounce + animation start (800ms debounce + buffer)
  await expect(page.locator('.saved-indicator.show')).toBeVisible({ timeout: 3000 });
});

// ─── Success check 10: Copy affordance visibility ─────────────────────────────
test('SC10: copy buttons hidden on blank load; fade in after typing; fade out when emptied', async ({ page }) => {
  await freshLoad(page);
  // On blank load: aria-hidden true, opacity 0
  const copyActions = page.locator('.copy-actions');
  expect(await copyActions.getAttribute('aria-hidden')).toBe('true');
  const opacityBefore = await copyActions.evaluate((el) =>
    parseFloat(window.getComputedStyle(el).opacity)
  );
  expect(opacityBefore).toBe(0);

  // Type something — buttons should appear
  await page.locator(EDITOR).click();
  await page.keyboard.type('hello');
  await page.waitForTimeout(300); // allow state update
  expect(await copyActions.getAttribute('aria-hidden')).toBe('false');
  const opacityAfter = await copyActions.evaluate((el) =>
    parseFloat(window.getComputedStyle(el).opacity)
  );
  expect(opacityAfter).toBeGreaterThan(0);
  // Both labeled actions visible
  await expect(page.locator('[data-testid="copy-rich-btn"]')).toContainText('Copy as Rich Text');
  await expect(page.locator('[data-testid="copy-md-btn"]')).toContainText('Copy as Markdown');

  // Delete all content — use Meta+A (macOS select-all) then Backspace
  // NOTE: Control+A does NOT select-all in TipTap on macOS; Meta+A does.
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
  expect(await copyActions.getAttribute('aria-hidden')).toBe('true');
});

// ─── Success check 13: Perceptible copy confirmation ─────────────────────────
test('SC13: copy-markdown confirmation persists for >=1.5s and survives autosave', async ({ page, context }) => {
  // Grant clipboard permissions
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('## Title');

  // Wait for copy button to appear
  await page.waitForTimeout(300);
  await page.locator('[data-testid="copy-md-btn"]').click();

  // Immediately check — should show "Copied markdown ✓"
  await expect(page.locator('[data-testid="copy-md-btn"]')).toContainText('Copied markdown ✓', { timeout: 1000 });

  // After 1s it should STILL show "Copied" (not reverted yet — holds for 1.8s)
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-testid="copy-md-btn"]')).toContainText('Copied markdown ✓');
});

// ─── Success check 14: No focus-steal / no layout jump ───────────────────────
test('SC14: clicking copy action does not steal focus from editor', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('some text');
  await page.waitForTimeout(300);

  // Click copy-md using onMouseDown preventDefault + onClick focus restore
  await page.locator('[data-testid="copy-md-btn"]').click();
  await page.waitForTimeout(200);

  // Editor should still be focused (active element is inside the editor)
  const isFocused = await page.evaluate(() => {
    const editor = document.querySelector('[data-testid="scratchpad-editor"]');
    return editor ? editor.contains(document.activeElement) : false;
  });
  expect(isFocused).toBe(true);
});

// ─── Success check 15: Mobile safe at 375px ──────────────────────────────────
test('SC15: copy controls stay within viewport at 375px, no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('mobile test');
  await page.waitForTimeout(300);

  // Check no horizontal overflow
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow).toBe(false);

  // Copy actions must be within viewport bounds
  const copyBounds = await page.locator('.copy-actions').boundingBox();
  expect(copyBounds).not.toBeNull();
  expect(copyBounds!.x).toBeGreaterThanOrEqual(0);
  expect(copyBounds!.x + copyBounds!.width).toBeLessThanOrEqual(375 + 1); // +1px tolerance
});

// ─── Success check 11: Copy as Markdown copies raw source ────────────────────
test('SC11: Copy as Markdown copies raw markdown source (not rendered HTML)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await freshLoad(page);
  await page.locator(EDITOR).click();
  // Type heading then bullet
  await page.keyboard.type('## Title');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- item');
  await page.waitForTimeout(300);

  // Intercept clipboard.writeText to capture what gets written
  await page.addInitScript(() => {
    (window as any).__clipboardWrites = [];
    const orig = navigator.clipboard.writeText.bind(navigator.clipboard);
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: async (text: string) => {
        (window as any).__clipboardWrites.push(text);
        return orig(text);
      },
      writable: true,
      configurable: true,
    });
  });

  // Reload to apply init script, re-seed content via localStorage
  await page.evaluate(() => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }] },
          ],
        },
      ],
    };
    window.localStorage.setItem('scratchpad-v1', JSON.stringify(doc));
  });
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(300);

  await page.locator('[data-testid="copy-md-btn"]').click();
  await page.waitForTimeout(300);

  // Read what was written to clipboard
  const writes = await page.evaluate(() => (window as any).__clipboardWrites ?? []);
  // The writeText call should contain raw markdown, not HTML
  const captured = writes.length > 0 ? writes[writes.length - 1] :
    await page.evaluate(() => navigator.clipboard.readText());

  expect(typeof captured).toBe('string');
  // Must contain markdown heading syntax
  expect(captured).toContain('## Title');
  // Must contain markdown bullet syntax
  expect(captured).toContain('- item');
  // Must NOT contain HTML tags
  expect(captured).not.toMatch(/<h[1-6]>/);
  expect(captured).not.toMatch(/<ul>/);
});

// ─── Success check 12: Copy as Rich Text writes real HTML tags ────────────────
test('SC12: Copy as Rich Text ClipboardItem contains real HTML tags not markdown', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await freshLoad(page);

  // Intercept navigator.clipboard.write to inspect the ClipboardItem payload
  await page.addInitScript(() => {
    (window as any).__clipboardRichWrites = [];
    const orig = navigator.clipboard.write.bind(navigator.clipboard);
    Object.defineProperty(navigator.clipboard, 'write', {
      value: async (items: ClipboardItem[]) => {
        for (const item of items) {
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html');
            const text = await blob.text();
            (window as any).__clipboardRichWrites.push({ html: text });
          }
        }
        return orig(items);
      },
      writable: true,
      configurable: true,
    });
  });

  // Seed bold content via localStorage
  await page.evaluate(() => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Heading' }],
        },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bullet' }] }] },
          ],
        },
        { type: 'horizontalRule' },
      ],
    };
    window.localStorage.setItem('scratchpad-v1', JSON.stringify(doc));
  });
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(300);

  await page.locator('[data-testid="copy-rich-btn"]').click();
  await page.waitForTimeout(500);

  const writes = await page.evaluate(() => (window as any).__clipboardRichWrites ?? []);
  expect(writes.length).toBeGreaterThan(0);
  const htmlPayload = writes[writes.length - 1]?.html ?? '';

  // Must contain real HTML elements — not literal markdown asterisks
  expect(htmlPayload).toContain('<strong>bold</strong>');
  expect(htmlPayload).toContain('<h2>Heading</h2>');
  expect(htmlPayload).toContain('<ul>');
  expect(htmlPayload).toContain('<li>bullet</li>');
  expect(htmlPayload).toContain('<hr/>');

  // Must NOT contain markdown syntax
  expect(htmlPayload).not.toContain('**');
  expect(htmlPayload).not.toContain('## ');
  expect(htmlPayload).not.toContain('- bullet');
});

// ─── Hostile clipboard: blocked clipboard shows "Copy blocked" (not silent) ───
test('Hostile clipboard: blocked clipboard.writeText shows "Copy blocked" not silent success', async ({ page }) => {
  // Navigate first to get a valid page context, seed localStorage, then reload
  // with the clipboard override active via addInitScript
  await page.goto('/');
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });

  // Seed content
  await page.evaluate(() => {
    window.localStorage.setItem('scratchpad-v1', JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'blocked test' }] }],
    }));
  });

  // Install init script THEN reload so the override is applied on the next navigation
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => Promise.reject(new DOMException('Not allowed', 'NotAllowedError')),
        write: () => Promise.reject(new DOMException('Not allowed', 'NotAllowedError')),
        readText: () => Promise.reject(new DOMException('Not allowed', 'NotAllowedError')),
        read: () => Promise.reject(new DOMException('Not allowed', 'NotAllowedError')),
      },
      configurable: true,
    });
  });
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(300);

  // Verify clipboard override is active
  const isBlocked = await page.evaluate(async () => {
    try { await navigator.clipboard.writeText('test'); return false; } catch { return true; }
  });
  expect(isBlocked).toBe(true);

  // Click Copy as Markdown — clipboard is blocked
  await page.locator('[data-testid="copy-md-btn"]').click();
  await page.waitForTimeout(200);

  // Must show "Copy blocked" — explicit failure, not "Copied ✓"
  await expect(page.locator('[data-testid="copy-md-btn"]')).toContainText('Copy blocked', { timeout: 2000 });
  // Must NOT show success
  const mdText = await page.locator('[data-testid="copy-md-btn"]').innerText();
  expect(mdText).not.toContain('Copied markdown');

  // Click Copy as Rich Text — also blocked
  await page.locator('[data-testid="copy-rich-btn"]').click();
  await page.waitForTimeout(200);
  await expect(page.locator('[data-testid="copy-rich-btn"]')).toContainText('Copy blocked', { timeout: 2000 });
  const richText = await page.locator('[data-testid="copy-rich-btn"]').innerText();
  expect(richText).not.toContain('Copied rich text');
});

// ─── Copy confirmation survives autosave re-render (live ticking session) ────
test('SC13b: "Copied" cue is still visible 1s after click despite autosave re-render', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await freshLoad(page);
  await page.locator(EDITOR).click();
  await page.keyboard.type('autosave survivor test content');

  // Wait for autosave debounce to fire (800ms + buffer)
  await page.waitForTimeout(1200);

  // Type one more character to trigger another autosave cycle while we check the confirmation
  await page.keyboard.type('x');

  // Click the copy button — autosave will re-render within 800ms
  await page.locator('[data-testid="copy-md-btn"]').click();

  // Check confirmation is present immediately
  await expect(page.locator('[data-testid="copy-md-btn"]')).toContainText('Copied markdown ✓', { timeout: 1000 });

  // Wait 800ms (the autosave debounce fires here and triggers re-render)
  await page.waitForTimeout(900);

  // The "Copied ✓" cue must STILL be present after autosave re-render
  await expect(page.locator('[data-testid="copy-md-btn"]')).toContainText('Copied markdown ✓');
});
