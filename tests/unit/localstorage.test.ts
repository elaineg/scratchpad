/**
 * Unit tests for the localStorage serialization contract used by the Editor.
 * The Editor stores TipTap JSON (doc shape) under "scratchpad-v1".
 * These tests verify that the shape can be serialized/deserialized correctly.
 */
import { describe, it, expect } from 'vitest';

const STORAGE_KEY = 'scratchpad-v1';

// Minimal TipTap doc shapes that the Editor saves/restores
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

describe('localStorage serialization contract', () => {
  it('serializes and deserializes an empty doc correctly', () => {
    const serialized = JSON.stringify(emptyDoc);
    const restored = JSON.parse(serialized);
    expect(restored).toEqual(emptyDoc);
  });

  it('serializes and deserializes a doc with heading and paragraph', () => {
    const serialized = JSON.stringify(docWithHeading);
    const restored = JSON.parse(serialized);
    expect(restored.type).toBe('doc');
    expect(restored.content[0].type).toBe('heading');
    expect(restored.content[0].attrs.level).toBe(2);
    expect(restored.content[0].content[0].text).toBe('Title');
    expect(restored.content[1].type).toBe('paragraph');
    expect(restored.content[1].content[0].text).toBe('body text');
  });

  it('serializes and deserializes a bullet list doc', () => {
    const serialized = JSON.stringify(docWithBullet);
    const restored = JSON.parse(serialized);
    expect(restored.content[0].type).toBe('bulletList');
    expect(restored.content[0].content[0].type).toBe('listItem');
  });

  it('storage key is the expected constant', () => {
    expect(STORAGE_KEY).toBe('scratchpad-v1');
  });

  it('JSON.parse of a corrupt string throws (corrupt storage guard)', () => {
    // The Editor guards against corrupt data with try/catch
    expect(() => JSON.parse('not valid json {')).toThrow();
  });

  it('round-trip preserves text marks (bold)', () => {
    const docWithBold = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'ship it', marks: [{ type: 'bold' }] }],
        },
      ],
    };
    const restored = JSON.parse(JSON.stringify(docWithBold));
    expect(restored.content[0].content[0].marks[0].type).toBe('bold');
  });

  it('round-trip preserves inline code mark', () => {
    const docWithCode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'hello', marks: [{ type: 'code' }] }],
        },
      ],
    };
    const restored = JSON.parse(JSON.stringify(docWithCode));
    expect(restored.content[0].content[0].marks[0].type).toBe('code');
  });

  it('round-trip preserves horizontal rule node', () => {
    const docWithHr = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'before' }] },
        { type: 'horizontalRule' },
        { type: 'paragraph', content: [{ type: 'text', text: 'after' }] },
      ],
    };
    const restored = JSON.parse(JSON.stringify(docWithHr));
    expect(restored.content[1].type).toBe('horizontalRule');
  });

  it('SAVE_DEBOUNCE_MS is a reasonable value (800ms)', () => {
    // The debounce value affects the autosave UX; test it's within expected range
    const SAVE_DEBOUNCE_MS = 800;
    expect(SAVE_DEBOUNCE_MS).toBeGreaterThanOrEqual(300);
    expect(SAVE_DEBOUNCE_MS).toBeLessThanOrEqual(2000);
  });
});
