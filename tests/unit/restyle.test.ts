/**
 * Unit tests for restyle features (20260620 restyle pass).
 * Covers: title-from-content skipping dateline, truncation (CSS-side but logic check),
 * dateline detection edge cases.
 */
import { describe, it, expect } from 'vitest';
import { deriveTitle } from '../../lib/useNotes';

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
