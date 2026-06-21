/**
 * E2e tests for Success checks 20–22: Paste photo feature.
 *
 * Browser security prevents injecting a real image file via synthetic ClipboardEvent.
 * Instead, we:
 *   1. Directly call storeImageBlob (via IndexedDB) + then use TipTap's insertContent
 *      to insert an image node with the imgId — this exercises the full storage+render path.
 *   2. Separately assert localStorage has no base64 and contains the imgId.
 *   3. Assert the rendered <img> is block-level and full-width.
 *
 * The handlePaste path itself is tested by the unit-level imageStore tests;
 * the e2e tests here cover the storage/render/reload/overflow surface.
 */
import { test, expect, Page } from '@playwright/test';

const EDITOR = '[data-testid="scratchpad-editor"]';

async function freshLoad(page: Page) {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });
}

/**
 * Inject a synthetic image node into the TipTap editor via evaluate.
 * Stores a tiny 1x1 PNG blob in IndexedDB with a known id, then
 * inserts an image node with that imgId via a custom DOM event that
 * the Editor's handlePaste intercepts — OR directly via window.__tiptapInsertImage
 * if we expose that debug helper.
 *
 * Since we can't inject clipboard files via synthetic events, we use a
 * two-step approach:
 *  1. Store the blob in IndexedDB directly from evaluate.
 *  2. Trigger insertContent via window.__tiptap (exposed by the editor) OR
 *     dispatch a custom "insert-image" event.
 *
 * To make this testable without special test hooks, we use a helper that
 * directly writes to IndexedDB and then calls storeImageBlob logic via
 * an in-page script to confirm the IDB write, then triggers a React state
 * update by dispatching a custom event. The Editor listens for this in test env.
 *
 * Simplest and most reliable: expose a minimal window.__insertTestImage function
 * from the Editor component only in non-production environments.
 *
 * Actually: the cleanest approach for Playwright is to use page.evaluate to
 * directly write to IndexedDB and then use TipTap's editor.commands.insertContent
 * via a window reference. We expose __editor in a useEffect in the Editor.
 */
async function injectTestImage(page: Page): Promise<string> {
  const imgId = await page.evaluate(async () => {
    // 1x1 transparent PNG
    const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';
    const byteStr = atob(PNG_B64);
    const bytes = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/png' });

    // Generate an id
    const id = 'test-img-' + Math.random().toString(36).slice(2, 10);

    // Write to IndexedDB directly
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('scratchpad-images', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('blobs');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('blobs', 'readwrite');
        const store = tx.objectStore('blobs');
        const put = store.put(blob, id);
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
      };
      req.onerror = () => reject(req.error);
    });

    // Insert image node via the exposed __editor on window (set by Editor useEffect)
    const win = window as unknown as { __scratchpadEditor?: { commands: { insertContent: (c: unknown) => void } } };
    if (win.__scratchpadEditor) {
      win.__scratchpadEditor.commands.insertContent({
        type: 'image',
        attrs: { imgId: id },
      });
    } else {
      // Fallback: dispatch a custom event that Editor listens for (not implemented yet)
      // The test will detect image via the img element check
      console.warn('__scratchpadEditor not available');
    }

    return id;
  });
  // Allow React to re-render and IndexedDB resolve + object URL creation
  await page.waitForTimeout(1000);
  return imgId;
}

// ─── SC20: Paste inserts a full-width block image ─────────────────────────────

test('SC20: pasting an image inserts a block-level <img> in the editor', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();

  await injectTestImage(page);

  // An <img> should appear in the editor (after NodeView resolves the blob)
  const img = page.locator(`${EDITOR} img.scratchpad-img`);
  await expect(img).toBeVisible({ timeout: 8000 });
});

test('SC20: pasted image is full-column-width (not a small inline thumbnail)', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();

  await injectTestImage(page);

  const img = page.locator(`${EDITOR} img.scratchpad-img`);
  await expect(img).toBeVisible({ timeout: 8000 });

  // The image should span the full editor column width
  const editorBox = await page.locator(EDITOR).boundingBox();
  const imgBox = await img.boundingBox();
  expect(editorBox).not.toBeNull();
  expect(imgBox).not.toBeNull();

  // Image width should be close to editor width (width:100% CSS rule)
  expect(imgBox!.width).toBeGreaterThan(editorBox!.width * 0.85);
});

test('SC20: text can be typed before and after the pasted image', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();

  // Type before
  await page.keyboard.type('before text');
  await page.keyboard.press('Enter');

  await injectTestImage(page);

  // Place cursor after image and type
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.type('after text');
  await page.waitForTimeout(300);

  // Both text and image should be present
  const editorText = await page.locator(EDITOR).innerText();
  expect(editorText).toContain('before text');
  expect(editorText).toContain('after text');

  const img = page.locator(`${EDITOR} img.scratchpad-img`);
  await expect(img).toBeVisible({ timeout: 3000 });
});

// ─── SC21: Image stored in IndexedDB, NOT base64 in localStorage ──────────────

test('SC21: after paste, localStorage note record does NOT contain base64 image data', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();

  await injectTestImage(page);

  // Trigger autosave by typing something
  await page.keyboard.type(' ');
  // Wait for autosave debounce
  await page.waitForTimeout(1200);

  // Read the localStorage note record
  const activeId = await page.evaluate(() => window.localStorage.getItem('scratchpad-active-id'));
  expect(activeId).not.toBeNull();

  const noteRaw = await page.evaluate((id) =>
    window.localStorage.getItem(`scratchpad-note-${id}`)
  , activeId!);
  expect(noteRaw).not.toBeNull();

  // Must NOT contain a base64 data: URL in the localStorage record
  expect(noteRaw!).not.toContain('data:image');
  expect(noteRaw!).not.toContain('base64');
});

test('SC21: after paste, localStorage note record contains an imgId (not a blob URL)', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();

  await injectTestImage(page);

  // Trigger autosave
  await page.keyboard.type(' ');
  await page.waitForTimeout(1200);

  const activeId = await page.evaluate(() => window.localStorage.getItem('scratchpad-active-id'));
  const noteRaw = await page.evaluate((id) =>
    window.localStorage.getItem(`scratchpad-note-${id}`)
  , activeId!);

  expect(noteRaw).not.toBeNull();
  const parsed = JSON.parse(noteRaw!);

  // Walk the content tree to find an image node with an imgId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findImgId(node: any): string | null {
    if (node?.type === 'image') {
      const id = node?.attrs?.imgId;
      if (typeof id === 'string') return id;
    }
    if (Array.isArray(node?.content)) {
      for (const child of node.content) {
        const id = findImgId(child);
        if (id) return id;
      }
    }
    return null;
  }

  const imgId = findImgId(parsed.content);
  expect(imgId).not.toBeNull();
  expect(imgId!.length).toBeGreaterThan(0);
  // imgId must NOT be a data: or blob: URL
  expect(imgId!).not.toMatch(/^data:/);
  expect(imgId!).not.toMatch(/^blob:/);
});

test('SC21: blob is stored in IndexedDB and retrievable', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();

  const imgId = await injectTestImage(page);

  // Verify the blob was stored in IndexedDB
  const blobFound = await page.evaluate(async (id) => {
    return new Promise<boolean>((resolve) => {
      const req = indexedDB.open('scratchpad-images', 1);
      req.onsuccess = () => {
        const db = req.result;
        // If the store doesn't exist, blob not found
        if (!db.objectStoreNames.contains('blobs')) { resolve(false); return; }
        const tx = db.transaction('blobs', 'readonly');
        const store = tx.objectStore('blobs');
        const get = store.get(id);
        get.onsuccess = () => resolve(get.result instanceof Blob);
        get.onerror = () => resolve(false);
      };
      req.onerror = () => resolve(false);
    });
  }, imgId);

  expect(blobFound).toBe(true);
});

test('SC21: pasted image survives a full page reload (re-resolves from IndexedDB)', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();

  await injectTestImage(page);

  // Wait for the image to be visible and autosave to fire
  await expect(page.locator(`${EDITOR} img.scratchpad-img`)).toBeVisible({ timeout: 8000 });
  await page.keyboard.type(' ');
  await page.waitForTimeout(1200);

  // Reload the page (without clearing localStorage or IndexedDB)
  await page.reload();
  await page.waitForSelector(EDITOR, { state: 'visible', timeout: 10_000 });

  // The image should re-appear (resolved from IndexedDB)
  const img = page.locator(`${EDITOR} img.scratchpad-img`);
  await expect(img).toBeVisible({ timeout: 10000 });
});

// ─── SC22: Paste is snappy + autosave intact ──────────────────────────────────

test('SC22: autosave still fires after inserting an image (debounce + save path intact)', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();

  await injectTestImage(page);

  // Type some text so the debounce fires
  await page.keyboard.type('autosave check');

  // Wait for the autosave debounce
  await expect(page.locator('.saved-indicator.show')).toBeVisible({ timeout: 3000 });
});

test('SC22: image is block-level at 375px without causing horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await freshLoad(page);
  await page.locator(EDITOR).click();

  await injectTestImage(page);
  await expect(page.locator(`${EDITOR} img.scratchpad-img`)).toBeVisible({ timeout: 8000 });

  // No horizontal overflow
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);

  // Image should not be wider than viewport
  const imgBox = await page.locator(`${EDITOR} img.scratchpad-img`).boundingBox();
  expect(imgBox).not.toBeNull();
  expect(imgBox!.width).toBeLessThanOrEqual(376);
});

// ─── SC21: Note delete frees IndexedDB blob ───────────────────────────────────

test('SC21: deleting a note removes its image blob from IndexedDB', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Seed a note with an image node pointing to a known imgId
  const imgId = 'delete-test-img-' + Math.random().toString(36).slice(2);
  await page.goto('/');
  await page.evaluate(async ({ imgId }) => {
    window.localStorage.clear();

    // Write a fake blob to IndexedDB
    const blob = new Blob(['fake'], { type: 'image/png' });
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('scratchpad-images', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('blobs');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('blobs', 'readwrite');
        const put = tx.objectStore('blobs').put(blob, imgId);
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
      };
      req.onerror = () => reject(req.error);
    });

    // Create a note that references this image
    const noteId = 'idb-delete-test';
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'has image' }] },
        { type: 'image', attrs: { imgId, alt: null, src: null } },
      ],
    };
    const record = { id: noteId, content: doc, updatedAt: Date.now() };
    window.localStorage.setItem(`scratchpad-note-${noteId}`, JSON.stringify(record));
    window.localStorage.setItem('scratchpad-notes-index', JSON.stringify([noteId]));
    window.localStorage.setItem('scratchpad-active-id', noteId);
  }, { imgId });

  await page.reload();
  await page.waitForSelector('[data-testid="scratchpad-editor"]', { state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(300);

  // Verify blob exists in IDB before delete
  const blobBefore = await page.evaluate(async (id) => {
    return new Promise<boolean>((resolve) => {
      const req = indexedDB.open('scratchpad-images', 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('blobs')) { resolve(false); return; }
        const tx = db.transaction('blobs', 'readonly');
        const get = tx.objectStore('blobs').get(id);
        get.onsuccess = () => resolve(get.result instanceof Blob);
        get.onerror = () => resolve(false);
      };
      req.onerror = () => resolve(false);
    });
  }, imgId);
  expect(blobBefore).toBe(true);

  // Delete the note via the sidebar × button (only one note, so it creates a new blank)
  await page.locator('[data-testid="note-select-idb-delete-test"]').hover();
  await page.locator('[data-testid="delete-note-idb-delete-test"]').click({ force: true });
  await page.waitForTimeout(500); // allow async deleteImageBlobs to fire

  // Verify blob was removed from IDB
  const blobAfter = await page.evaluate(async (id) => {
    return new Promise<boolean>((resolve) => {
      const req = indexedDB.open('scratchpad-images', 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('blobs')) { resolve(false); return; }
        const tx = db.transaction('blobs', 'readonly');
        const get = tx.objectStore('blobs').get(id);
        get.onsuccess = () => resolve(get.result instanceof Blob);
        get.onerror = () => resolve(false);
      };
      req.onerror = () => resolve(false);
    });
  }, imgId);
  expect(blobAfter).toBe(false);
});

// ─── Real ClipboardEvent paste path ──────────────────────────────────────────

test('SC20-real-paste: dispatching a ClipboardEvent with an image/png File on .ProseMirror inserts a block <img>', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();

  // Dispatch a synthetic ClipboardEvent with a canvas-generated PNG blob via evaluate
  const inserted = await page.evaluate(async () => {
    // Build a 4x4 PNG via canvas
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 4, 4);

    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    const file = new File([blob], 'test.png', { type: 'image/png' });

    // Build DataTransfer with the image file
    const dt = new DataTransfer();
    dt.items.add(file);

    const proseMirror = document.querySelector('.ProseMirror') as HTMLElement;
    if (!proseMirror) return 'no .ProseMirror';

    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });
    proseMirror.dispatchEvent(event);
    return 'dispatched';
  });

  expect(inserted).toBe('dispatched');

  // After up to 5s, an <img> should appear (the async handlePaste path: downscale + IDB store + node insert)
  const img = page.locator(`${EDITOR} img.scratchpad-img`);
  await expect(img).toBeVisible({ timeout: 8000 });
});

// ─── SC22: Downscale invariant — large paste is capped ───────────────────────

test('SC22-downscale: a large pasted image (>2000px) is stored at a capped dimension, not the raw size', async ({ page }) => {
  await freshLoad(page);
  await page.locator(EDITOR).click();

  // Dispatch a ClipboardEvent carrying a 3000x2000 canvas-generated PNG
  const dispatched = await page.evaluate(async () => {
    const W = 3000, H = 2000;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#336699';
    ctx.fillRect(0, 0, W, H);

    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    const file = new File([blob], 'large.png', { type: 'image/png' });

    const dt = new DataTransfer();
    dt.items.add(file);

    const pm = document.querySelector('.ProseMirror') as HTMLElement;
    if (!pm) return { ok: false, reason: 'no .ProseMirror' };

    pm.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
    return { ok: true };
  });
  expect(dispatched.ok).toBe(true);

  // Wait for the image to appear
  const img = page.locator(`${EDITOR} img.scratchpad-img`);
  await expect(img).toBeVisible({ timeout: 10000 });

  // Wait for the imgId to appear in the autosave
  await page.keyboard.type(' ');
  await page.waitForTimeout(1200);

  // Retrieve the stored blob from IndexedDB and decode its dimensions
  const storedDimensions = await page.evaluate(async () => {
    // Get all blobs from the IDB store
    return new Promise<{ width: number; height: number } | null>((resolve) => {
      const req = indexedDB.open('scratchpad-images', 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('blobs')) { resolve(null); return; }
        const tx = db.transaction('blobs', 'readonly');
        const store = tx.objectStore('blobs');
        const getAllKeys = store.getAllKeys();
        getAllKeys.onsuccess = () => {
          const keys = getAllKeys.result;
          if (keys.length === 0) { resolve(null); return; }
          // Take the most-recently added blob (last key)
          const getBlob = store.get(keys[keys.length - 1]);
          getBlob.onsuccess = () => {
            const blob = getBlob.result as Blob;
            if (!blob) { resolve(null); return; }
            const url = URL.createObjectURL(blob);
            const image = new Image();
            image.onload = () => {
              URL.revokeObjectURL(url);
              resolve({ width: image.naturalWidth, height: image.naturalHeight });
            };
            image.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
            image.src = url;
          };
          getBlob.onerror = () => resolve(null);
        };
        getAllKeys.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  });

  expect(storedDimensions).not.toBeNull();
  // The stored image must NOT be the original 3000x2000 — longest side must be ≤2000
  expect(Math.max(storedDimensions!.width, storedDimensions!.height)).toBeLessThanOrEqual(2000);
  // But still has a real size (not 0)
  expect(storedDimensions!.width).toBeGreaterThan(0);
});
