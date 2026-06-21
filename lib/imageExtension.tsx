"use client";

/**
 * Custom TipTap Image extension — block-level, full-width, IndexedDB-backed.
 *
 * The node stores ONLY an `imgId` attribute (never base64/object-URLs in the doc).
 * Rendering is done via a NodeViewRenderer that resolves imgId → object URL lazily.
 */

import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import { getImageBlob } from "./imageStore";

// ─── React NodeView component — MUST use NodeViewWrapper (TipTap v3 requirement) ─

function ImageNodeView({ node }: NodeViewProps) {
  const [src, setSrc] = useState<string | null>(null);
  const imgId = node.attrs.imgId as string | null;

  useEffect(() => {
    if (!imgId) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    getImageBlob(imgId).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }).catch(() => {
      // blob not found — leave src null (image just won't render)
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imgId]);

  return (
    <NodeViewWrapper as="div" className="scratchpad-img-block">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={(node.attrs.alt as string) ?? ""}
          className="scratchpad-img"
          data-img-id={imgId ?? ""}
          draggable={false}
        />
      ) : (
        // Quiet monochrome placeholder while loading
        <div
          className="scratchpad-img-placeholder"
          aria-hidden="true"
        />
      )}
    </NodeViewWrapper>
  );
}

// ─── Extension ────────────────────────────────────────────────────────────────

export const PasteImage = Image.extend({
  // Block image (not inline)
  inline: false,
  group: "block",
  draggable: false,

  addAttributes() {
    return {
      // We add `imgId` and keep `alt`.
      // `src` is kept for parseHTML compatibility but always null in the stored JSON.
      imgId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-img-id") || null,
        renderHTML: (attrs) =>
          attrs.imgId ? { "data-img-id": attrs.imgId } : {},
      },
      alt: {
        default: null,
        parseHTML: (el) => el.getAttribute("alt") || null,
        renderHTML: (attrs) =>
          attrs.alt ? { alt: attrs.alt } : {},
      },
      // Keep src in schema for HTML parseHTML compat; never written to JSON
      src: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'img[data-img-id]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        class: "scratchpad-img",
        draggable: "false",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
