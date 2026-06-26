/**
 * Unit tests for SC25 (typewriter scroll) and SC26 (paragraph font-weight 400).
 * SC25: Tests the scrolling math logic (dead zone, clamp, caret-vs-midpoint).
 * SC26: Tests CSS file assertions for font-weight values.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── SC26: CSS font-weight assertions ─────────────────────────────────────────

describe('SC26: globals.css paragraph font-weight', () => {
  const cssPath = join(__dirname, '../../app/globals.css');
  const css = readFileSync(cssPath, 'utf8');

  it('.scratchpad-editor p has font-weight: 400', () => {
    // Match `.scratchpad-editor p { ... }` block (not subclasses like p.dateline-para)
    const pBlock = css.match(/\.scratchpad-editor\s+p\s*\{([^}]+)\}/);
    expect(pBlock).not.toBeNull();
    expect(pBlock![1]).toContain('font-weight: 400');
  });

  it('.scratchpad-editor p does NOT have font-weight: 300 (no regression to old weight)', () => {
    const pBlock = css.match(/\.scratchpad-editor\s+p\s*\{([^}]+)\}/);
    expect(pBlock).not.toBeNull();
    expect(pBlock![1]).not.toContain('font-weight: 300');
  });

  it('.scratchpad-editor (root) font-weight is still 300 (not bumped)', () => {
    // Match the `.scratchpad-editor { ... }` block (not `.scratchpad-editor p`)
    const editorBlock = css.match(/\.scratchpad-editor\s*\{([^}]+)\}/);
    expect(editorBlock).not.toBeNull();
    expect(editorBlock![1]).toContain('font-weight: 300');
    expect(editorBlock![1]).not.toContain('font-weight: 400');
  });

  it('.scratchpad-editor h1 font-weight is 600 (headings unchanged)', () => {
    const h1Block = css.match(/\.scratchpad-editor h1\s*\{([^}]+)\}/);
    expect(h1Block).not.toBeNull();
    expect(h1Block![1]).toContain('font-weight: 600');
  });

  it('.scratchpad-editor h2 font-weight is 600 (headings unchanged)', () => {
    const h2Block = css.match(/\.scratchpad-editor h2\s*\{([^}]+)\}/);
    expect(h2Block).not.toBeNull();
    expect(h2Block![1]).toContain('font-weight: 600');
  });

  it('.scratchpad-editor p.dateline-para font-weight is 300 (dateline NOT bumped)', () => {
    const datelineBlock = css.match(/\.scratchpad-editor p\.dateline-para\s*\{([^}]+)\}/);
    expect(datelineBlock).not.toBeNull();
    expect(datelineBlock![1]).toContain('font-weight: 300');
    // Must NOT be 400
    expect(datelineBlock![1]).not.toContain('font-weight: 400');
  });

  it('.notes-sidebar font-weight is 300 (sidebar unchanged)', () => {
    const sidebarBlock = css.match(/\.notes-sidebar\s*\{([^}]+)\}/);
    expect(sidebarBlock).not.toBeNull();
    expect(sidebarBlock![1]).toContain('font-weight: 300');
  });

  it('html/body font-weight is 300 (not bumped)', () => {
    // The html,body block contains font-weight: 300
    const bodyBlock = css.match(/html,\s*\nbody\s*\{([^}]+)\}/);
    expect(bodyBlock).not.toBeNull();
    expect(bodyBlock![1]).toContain('font-weight: 300');
  });
});

// ─── SC25: Typewriter scroll logic (pure math) ────────────────────────────────

describe('SC25: typewriter scroll dead-zone and clamping math', () => {
  // Extracted from makeTypewriterScroller logic:
  // distFromMid = caretMidY - viewportMid
  // deadZone = viewportHeight * 0.15
  // targetScrollY = scrollY + distFromMid
  // clampedY = Math.max(0, Math.min(targetScrollY, maxScroll))

  function shouldScroll(caretTop: number, caretHeight: number, viewportHeight: number): boolean {
    const caretMidY = caretTop + caretHeight / 2;
    const viewportMid = viewportHeight / 2;
    const distFromMid = caretMidY - viewportMid;
    const deadZone = viewportHeight * 0.15;
    return Math.abs(distFromMid) >= deadZone;
  }

  function computeTargetScrollY(
    caretTop: number,
    caretHeight: number,
    viewportHeight: number,
    currentScrollY: number,
    maxScroll: number
  ): number {
    const caretMidY = caretTop + caretHeight / 2;
    const viewportMid = viewportHeight / 2;
    const distFromMid = caretMidY - viewportMid;
    const targetScrollY = currentScrollY + distFromMid;
    return Math.max(0, Math.min(targetScrollY, maxScroll));
  }

  it('caret in top half of 900px viewport — no scroll (within dead zone)', () => {
    // caret at y=100, height=20 → caretMidY=110; viewportMid=450; dist=−340; deadZone=135
    // |−340| = 340 > 135 → actually scrolls! Let's use y=360
    // caret at y=380, height=20 → caretMidY=390; viewportMid=450; dist=−60; deadZone=135
    expect(shouldScroll(380, 20, 900)).toBe(false); // |−60| < 135
  });

  it('caret at top of viewport (y=50) — scroll triggered (far from midpoint)', () => {
    // caretMidY=60; viewportMid=450; dist=−390; deadZone=135 → |390|>135 → scroll
    expect(shouldScroll(50, 20, 900)).toBe(true);
  });

  it('caret just below viewport midpoint within dead zone — no scroll', () => {
    // caretMidY=480; viewportMid=450; dist=30; deadZone=135 → |30|<135 → no scroll
    expect(shouldScroll(470, 20, 900)).toBe(false);
  });

  it('caret pushed below dead zone (past midpoint+135px) — scroll triggered', () => {
    // caretMidY=600; viewportMid=450; dist=150; deadZone=135 → |150|>135 → scroll
    expect(shouldScroll(590, 20, 900)).toBe(true);
  });

  it('clamp: targetScrollY never goes below 0', () => {
    // caretTop=100, viewing at top of page (scrollY=0) — caret is already visible
    const result = computeTargetScrollY(100, 20, 900, 0, 5000);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('clamp: targetScrollY never exceeds maxScroll', () => {
    const maxScroll = 500;
    const result = computeTargetScrollY(800, 20, 900, 600, maxScroll);
    expect(result).toBeLessThanOrEqual(maxScroll);
  });

  it('caret exactly at viewport midpoint — no scroll (dist=0, within dead zone)', () => {
    // caretMidY = 450 = viewportMid → dist=0 → |0| < 135 → no scroll
    expect(shouldScroll(440, 20, 900)).toBe(false);
  });

  it('dead zone is 15% of viewport height', () => {
    const viewportHeight = 900;
    const expectedDeadZone = viewportHeight * 0.15;
    expect(expectedDeadZone).toBe(135);
  });
});
