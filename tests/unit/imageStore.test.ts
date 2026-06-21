/**
 * Unit tests for lib/imageStore.ts
 * Tests extractImgIds (pure, no DOM) and maybeDownscale is client-only.
 */
import { describe, it, expect } from 'vitest';
import { extractImgIds } from '../../lib/imageStore';

describe('extractImgIds', () => {
  it('returns empty array for null/undefined', () => {
    expect(extractImgIds(null)).toEqual([]);
    expect(extractImgIds(undefined)).toEqual([]);
  });

  it('returns empty array for doc with no image nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'hello' }] },
      ],
    };
    expect(extractImgIds(doc)).toEqual([]);
  });

  it('extracts imgId from a top-level image node', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'before' }] },
        { type: 'image', attrs: { imgId: 'abc-123', alt: null } },
        { type: 'paragraph', content: [{ type: 'text', text: 'after' }] },
      ],
    };
    expect(extractImgIds(doc)).toEqual(['abc-123']);
  });

  it('extracts multiple imgIds from multiple image nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { imgId: 'id-1' } },
        { type: 'paragraph', content: [] },
        { type: 'image', attrs: { imgId: 'id-2' } },
      ],
    };
    const ids = extractImgIds(doc);
    expect(ids).toContain('id-1');
    expect(ids).toContain('id-2');
    expect(ids.length).toBe(2);
  });

  it('skips image nodes with null or missing imgId', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { imgId: null } },
        { type: 'image', attrs: {} },
        { type: 'image', attrs: { imgId: 'valid-id' } },
      ],
    };
    expect(extractImgIds(doc)).toEqual(['valid-id']);
  });

  it('extracts imgIds nested inside blockquote/listItem', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            { type: 'image', attrs: { imgId: 'nested-id' } },
          ],
        },
      ],
    };
    expect(extractImgIds(doc)).toEqual(['nested-id']);
  });

  it('returns empty array when image node has no attrs', () => {
    const doc = {
      type: 'doc',
      content: [
        // No attrs at all
        { type: 'image' },
      ],
    };
    expect(extractImgIds(doc)).toEqual([]);
  });
});
