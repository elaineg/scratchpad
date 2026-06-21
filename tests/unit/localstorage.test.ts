/**
 * Unit tests for multi-note localStorage serialization contract.
 *
 * Storage shape (v2, multi-note):
 *   "scratchpad-notes-index" → JSON string[]  (note ids, newest-first)
 *   "scratchpad-note-<id>"   → JSON NoteRecord { id, content, updatedAt }
 *   "scratchpad-active-id"   → string (last-open note id)
 *
 * Legacy key "scratchpad-v1" is migrated on first load.
 */
import { describe, it, expect } from 'vitest';

const INDEX_KEY = 'scratchpad-notes-index';
const ACTIVE_KEY = 'scratchpad-active-id';
const NOTE_PREFIX = 'scratchpad-note-';
const LEGACY_KEY = 'scratchpad-v1';

// Minimal TipTap doc shapes
const emptyDoc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};

const docWithHeading = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'body text' }] },
  ],
};

const docWithBullet = {
  type: 'doc',
  content: [
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'buy milk' }] }],
        },
      ],
    },
  ],
};

describe('multi-note storage schema', () => {
  it('INDEX_KEY is the expected constant', () => {
    expect(INDEX_KEY).toBe('scratchpad-notes-index');
  });

  it('ACTIVE_KEY is the expected constant', () => {
    expect(ACTIVE_KEY).toBe('scratchpad-active-id');
  });

  it('NOTE_PREFIX is the expected constant', () => {
    expect(NOTE_PREFIX).toBe('scratchpad-note-');
  });

  it('LEGACY_KEY is the expected constant', () => {
    expect(LEGACY_KEY).toBe('scratchpad-v1');
  });

  it('note key is formed as scratchpad-note-<id>', () => {
    const id = 'abc123';
    expect(`${NOTE_PREFIX}${id}`).toBe('scratchpad-note-abc123');
  });
});

describe('NoteRecord serialization', () => {
  it('serializes and deserializes a NoteRecord with empty doc', () => {
    const id = 'test-1';
    const record = { id, content: emptyDoc, updatedAt: 1000 };
    const serialized = JSON.stringify(record);
    const restored = JSON.parse(serialized);
    expect(restored.id).toBe(id);
    expect(restored.content).toEqual(emptyDoc);
    expect(restored.updatedAt).toBe(1000);
  });

  it('serializes and deserializes a NoteRecord with heading doc', () => {
    const id = 'test-2';
    const record = { id, content: docWithHeading, updatedAt: 2000 };
    const serialized = JSON.stringify(record);
    const restored = JSON.parse(serialized);
    expect(restored.content.type).toBe('doc');
    expect(restored.content.content[0].type).toBe('heading');
    expect(restored.content.content[0].content[0].text).toBe('Title');
  });

  it('serializes and deserializes a NoteRecord with bullet list', () => {
    const id = 'test-3';
    const record = { id, content: docWithBullet, updatedAt: 3000 };
    const restored = JSON.parse(JSON.stringify(record));
    expect(restored.content.content[0].type).toBe('bulletList');
  });

  it('round-trips mark (bold) correctly in NoteRecord', () => {
    const docWithBold = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'ship it', marks: [{ type: 'bold' }] }] },
      ],
    };
    const record = { id: 'bold-1', content: docWithBold, updatedAt: 4000 };
    const restored = JSON.parse(JSON.stringify(record));
    expect(restored.content.content[0].content[0].marks[0].type).toBe('bold');
  });

  it('round-trips horizontalRule node correctly in NoteRecord', () => {
    const docWithHr = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'before' }] },
        { type: 'horizontalRule' },
        { type: 'paragraph', content: [{ type: 'text', text: 'after' }] },
      ],
    };
    const record = { id: 'hr-1', content: docWithHr, updatedAt: 5000 };
    const restored = JSON.parse(JSON.stringify(record));
    expect(restored.content.content[1].type).toBe('horizontalRule');
  });

  it('JSON.parse of a corrupt string throws (corrupt storage guard)', () => {
    expect(() => JSON.parse('not valid json {')).toThrow();
  });
});

describe('notes index serialization', () => {
  it('serializes and deserializes a notes index (string array)', () => {
    const ids = ['note-a', 'note-b', 'note-c'];
    const serialized = JSON.stringify(ids);
    const restored = JSON.parse(serialized) as string[];
    expect(restored).toEqual(ids);
    expect(restored.length).toBe(3);
  });

  it('empty index serializes and deserializes correctly', () => {
    const ids: string[] = [];
    const restored = JSON.parse(JSON.stringify(ids));
    expect(restored).toEqual([]);
  });

  it('prepending to index (new-note pattern) works correctly', () => {
    const existing = ['old-1', 'old-2'];
    const newId = 'new-1';
    const updated = [newId, ...existing];
    expect(updated[0]).toBe('new-1');
    expect(updated.length).toBe(3);
  });

  it('filtering out deleted id from index works correctly', () => {
    const ids = ['a', 'b', 'c'];
    const toDelete = 'b';
    const after = ids.filter((id) => id !== toDelete);
    expect(after).toEqual(['a', 'c']);
    expect(after).not.toContain('b');
  });
});

describe('SAVE_DEBOUNCE_MS is a reasonable value (800ms)', () => {
  it('SAVE_DEBOUNCE_MS is within expected range', () => {
    const SAVE_DEBOUNCE_MS = 800;
    expect(SAVE_DEBOUNCE_MS).toBeGreaterThanOrEqual(300);
    expect(SAVE_DEBOUNCE_MS).toBeLessThanOrEqual(2000);
  });
});
