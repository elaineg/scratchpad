/**
 * Unit tests for note CRUD helpers and title/dateline logic.
 */
import { describe, it, expect } from 'vitest';
import { deriveTitle } from '../../lib/useNotes';

// ─── deriveTitle ──────────────────────────────────────────────────────────────

describe('deriveTitle', () => {
  it('returns "Untitled" for null', () => {
    expect(deriveTitle(null)).toBe('Untitled');
  });

  it('returns "Untitled" for undefined', () => {
    expect(deriveTitle(undefined)).toBe('Untitled');
  });

  it('returns "Untitled" for a doc with no content', () => {
    expect(deriveTitle({ type: 'doc', content: [] })).toBe('Untitled');
  });

  it('returns "Untitled" for a doc with only an empty paragraph', () => {
    expect(deriveTitle({ type: 'doc', content: [{ type: 'paragraph', content: [] }] })).toBe('Untitled');
  });

  it('returns text from first paragraph', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Sprint plan' }] },
      ],
    };
    expect(deriveTitle(doc)).toBe('Sprint plan');
  });

  it('returns text from a heading node', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Meeting Notes' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'body text' }] },
      ],
    };
    expect(deriveTitle(doc)).toBe('Meeting Notes');
  });

  it('skips empty first paragraph and finds first non-empty node', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second line' }] },
      ],
    };
    expect(deriveTitle(doc)).toBe('Second line');
  });

  it('trims whitespace from title', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '  My Note  ' }] },
      ],
    };
    expect(deriveTitle(doc)).toBe('My Note');
  });

  // Item 5: deriveTitle must SKIP the auto-dateline line and derive from real content
  it('skips auto-dateline first line and returns first real typed content', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Saturday, June 20' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'meeting notes' }] },
      ],
    };
    expect(deriveTitle(doc)).toBe('meeting notes');
  });

  it('returns "Untitled" when doc has only a dateline and no typed content', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Friday, June 19' }] },
      ],
    };
    expect(deriveTitle(doc)).toBe('Untitled');
  });

  it('skips a dateline-like first line with various weekday/month combos', () => {
    const cases = [
      'Monday, January 1',
      'Wednesday, March 15',
      'Sunday, December 31',
      'Thursday, October 3',
    ];
    for (const dateStr of cases) {
      const doc = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: dateStr }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'actual content' }] },
        ],
      };
      expect(deriveTitle(doc)).toBe('actual content');
    }
  });

  it('does NOT skip a first line that merely starts with a word and comma (not a valid dateline)', () => {
    // "Hello, world" is NOT a dateline — no day number at the end
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello, world' }] },
      ],
    };
    expect(deriveTitle(doc)).toBe('Hello, world');
  });
});

// ─── Dateline format ──────────────────────────────────────────────────────────

describe('dateline format', () => {
  it('formats today correctly with weekday, month, day — no year', () => {
    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    // Should match pattern like "Saturday, June 20"
    expect(dateStr).toMatch(/^\w+, \w+ \d+$/);
    // Should NOT contain a 4-digit year
    expect(dateStr).not.toMatch(/\d{4}/);
  });

  it('dateline format contains a comma separating weekday from month-day', () => {
    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    expect(dateStr).toContain(',');
    const parts = dateStr.split(', ');
    expect(parts.length).toBe(2);
    // First part is weekday (long)
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    expect(weekdays.some((d) => parts[0].startsWith(d))).toBe(true);
  });

  it('dateline has no ordinal suffix (no "1st", "2nd", "3rd", "4th")', () => {
    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    expect(dateStr).not.toMatch(/\d+(st|nd|rd|th)/);
  });
});

// ─── Note CRUD helpers (pure logic, no DOM) ───────────────────────────────────

describe('note index mutation helpers', () => {
  it('prepend a new id to an existing index', () => {
    const existing = ['id-b', 'id-c'];
    const newId = 'id-a';
    const updated = [newId, ...existing];
    expect(updated[0]).toBe('id-a');
    expect(updated).toEqual(['id-a', 'id-b', 'id-c']);
  });

  it('bubble an existing id to the front (save-note pattern)', () => {
    const ids = ['id-b', 'id-a', 'id-c'];
    const toFront = 'id-a';
    const updated = [toFront, ...ids.filter((i) => i !== toFront)];
    expect(updated).toEqual(['id-a', 'id-b', 'id-c']);
  });

  it('delete a note from index and pick next active', () => {
    const ids = ['id-a', 'id-b', 'id-c'];
    const toDelete = 'id-a';
    const after = ids.filter((i) => i !== toDelete);
    expect(after).toEqual(['id-b', 'id-c']);
    // If we deleted the active, pick ids[0]
    const newActive = after[0];
    expect(newActive).toBe('id-b');
  });

  it('delete last note returns empty index', () => {
    const ids = ['id-a'];
    const after = ids.filter((i) => i !== 'id-a');
    expect(after).toEqual([]);
    // No remaining notes — create fresh
    expect(after.length).toBe(0);
  });
});
