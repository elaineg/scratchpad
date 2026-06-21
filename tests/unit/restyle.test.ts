/**
 * Unit tests for restyle features (20260620 restyle pass).
 * Covers: title-from-content skipping dateline, truncation (CSS-side but logic check),
 * dateline detection edge cases, and line-height values (20260621 spacing pass).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { deriveTitle } from '../../lib/useNotes';

// ─── Line-height CSS assertions (SC24: tighter line spacing) ──────────────────
// Parse globals.css and assert the exact line-height values shipped in the 20260621 pass.

describe('SC24-spacing: globals.css line-height values', () => {
  const cssPath = join(__dirname, '../../app/globals.css');
  const css = readFileSync(cssPath, 'utf8');

  it('.scratchpad-editor body line-height is 1.4 (not 1.75)', () => {
    // Find the .scratchpad-editor block and assert line-height: 1.4
    const editorBlock = css.match(/\.scratchpad-editor\s*\{([^}]+)\}/);
    expect(editorBlock).not.toBeNull();
    expect(editorBlock![1]).toContain('line-height: 1.4');
    expect(editorBlock![1]).not.toContain('line-height: 1.75');
  });

  it('.scratchpad-editor h1 line-height is 1.0', () => {
    const h1Block = css.match(/\.scratchpad-editor h1\s*\{([^}]+)\}/);
    expect(h1Block).not.toBeNull();
    expect(h1Block![1]).toContain('line-height: 1.0');
  });

  it('.scratchpad-editor h2 line-height is 1.05', () => {
    const h2Block = css.match(/\.scratchpad-editor h2\s*\{([^}]+)\}/);
    expect(h2Block).not.toBeNull();
    expect(h2Block![1]).toContain('line-height: 1.05');
  });

  it('.scratchpad-editor h3 line-height is 1.1', () => {
    const h3Block = css.match(/\.scratchpad-editor h3\s*\{([^}]+)\}/);
    expect(h3Block).not.toBeNull();
    expect(h3Block![1]).toContain('line-height: 1.1');
  });

  it('.scratchpad-editor p.dateline-para retains line-height 1.4 (unchanged)', () => {
    const datelineBlock = css.match(/\.scratchpad-editor p\.dateline-para\s*\{([^}]+)\}/);
    expect(datelineBlock).not.toBeNull();
    expect(datelineBlock![1]).toContain('line-height: 1.4');
  });

  it('dateline-para has NO letter-spacing override', () => {
    const datelineBlock = css.match(/\.scratchpad-editor p\.dateline-para\s*\{([^}]+)\}/);
    expect(datelineBlock).not.toBeNull();
    expect(datelineBlock![1]).not.toMatch(/letter-spacing/);
  });

  it('.scratchpad-editor body has no letter-spacing override', () => {
    const editorBlock = css.match(/\.scratchpad-editor\s*\{([^}]+)\}/);
    expect(editorBlock).not.toBeNull();
    expect(editorBlock![1]).not.toMatch(/letter-spacing/);
  });
});

// ─── Title-from-content skipping dateline ─────────────────────────────────────

describe('restyle: deriveTitle skips dateline, returns content', () => {
  it('note with [dateline, "meeting notes"] → sidebar title is "meeting notes"', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Saturday, June 20' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'meeting notes' }] },
      ],
    };
    expect(deriveTitle(doc)).toBe('meeting notes');
  });

  it('empty note (only blank paragraph) → "Untitled"', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [] },
      ],
    };
    expect(deriveTitle(doc)).toBe('Untitled');
  });

  it('note with only a dateline and no typed content → "Untitled"', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Friday, June 20' }] },
      ],
    };
    expect(deriveTitle(doc)).toBe('Untitled');
  });

  it('long first content line returns full text (CSS truncates visually; no JS slice)', () => {
    // deriveTitle itself does not truncate — visual truncation is CSS text-overflow:ellipsis.
    // This test confirms the fn returns the full string (the sidebar CSS clips it).
    const longText = 'this is a very long note title that exceeds twenty characters by far';
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: longText }] },
      ],
    };
    expect(deriveTitle(doc)).toBe(longText);
  });

  it('[dateline, long text] → returns long text (dateline skipped, no truncation by fn)', () => {
    const longText = 'quarterly roadmap planning and prioritization session';
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Wednesday, June 18' }] },
        { type: 'paragraph', content: [{ type: 'text', text: longText }] },
      ],
    };
    expect(deriveTitle(doc)).toBe(longText);
  });

  it('"Hello, world" is NOT a dateline — kept as title', () => {
    // No trailing day number → not a dateline
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello, world' }] },
      ],
    };
    expect(deriveTitle(doc)).toBe('Hello, world');
  });

  it('"Mon June 23" (no comma) is NOT a dateline — kept as title', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Mon June 23' }] },
      ],
    };
    expect(deriveTitle(doc)).toBe('Mon June 23');
  });

  it('[dateline, heading node] → returns heading text (not the dateline)', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Thursday, June 19' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sprint Planning' }] },
      ],
    };
    expect(deriveTitle(doc)).toBe('Sprint Planning');
  });
});
