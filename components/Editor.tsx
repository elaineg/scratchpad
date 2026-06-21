"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Paragraph from "@tiptap/extension-paragraph";
import { saveNote } from "../lib/useNotes";
import type { TipTapNode } from "../lib/docSerializer";

// Extend the default Paragraph to allow a "class" HTML attribute so we can
// mark the auto-dateline paragraph for faint styling (item 7).
const ParagraphWithClass = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute("class") || null,
        renderHTML: (attrs) => {
          if (!attrs.class) return {};
          return { class: attrs.class };
        },
      },
    };
  },
});

const SAVE_DEBOUNCE_MS = 800;

interface EditorProps {
  noteId: string;
  initialContent: object;
  isNewNote: boolean; // true = this note was just created (dateline eligible)
  onContentChange?: (isEmpty: boolean) => void;
}

export default function Editor({ noteId, initialContent, isNewNote, onContentChange }: EditorProps) {
  // Track mount to avoid SSR hydration mismatch
  const [mounted, setMounted] = useState(false);

  // Saved indicator
  const [savedKey, setSavedKey] = useState(0);
  const [showSaved, setShowSaved] = useState(false);
  const showSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guard: don't flash "Saved" during the initial content restore
  const isRestoringRef = useRef(false);

  // Character count (cheap — updated on editor transaction)
  const [charCount, setCharCount] = useState(0);

  // Dateline tracking: armed synchronously on new-note activation, cleared after first insert.
  // pendingDatelineRef bypasses the restoring guard so a fast typist still gets the dateline.
  const pendingDatelineRef = useRef(isNewNote);
  // Guard against re-entry in onUpdate when we dispatch the dateline insertion
  const isInsertingDatelineRef = useRef(false);

  // Track the current noteId so we can save to the right note
  const noteIdRef = useRef(noteId);

  const triggerSaved = useCallback(() => {
    setSavedKey((k) => k + 1);
    setShowSaved(true);
    if (showSavedTimerRef.current) clearTimeout(showSavedTimerRef.current);
    showSavedTimerRef.current = setTimeout(() => setShowSaved(false), 2100);
  }, []);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        // Exclude the built-in paragraph so we can use our class-aware version
        StarterKit.configure({ paragraph: false }),
        ParagraphWithClass,
        Placeholder.configure({
          placeholder: "Start typing…",
        }),
      ],
      content: "",
      autofocus: true,
      editorProps: {
        attributes: {
          class: "scratchpad-editor",
          "data-testid": "scratchpad-editor",
          "aria-label": "Scratchpad editor",
          "aria-multiline": "true",
          role: "textbox",
        },
      },
      onUpdate({ editor }) {
        // Skip processing during dateline insertion (prevents re-entry)
        if (isInsertingDatelineRef.current) return;

        // Cheap isEmpty check — no serialization on the keystroke path
        const empty = editor.isEmpty;

        // Cheap char count — getText() is lighter than getJSON() for counting
        const text = editor.getText();
        setCharCount(text.length);
        onContentChange?.(empty);

        // Auto-dateline: on first keystroke of a NEW blank note.
        // pendingDatelineRef is armed synchronously on note activation, so we do NOT
        // gate on isRestoringRef — that guard would block fast typists (~0ms after click).
        if (pendingDatelineRef.current && !empty) {
          pendingDatelineRef.current = false;

          const dateStr = new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          });

          // Defer insertion to next tick to avoid dispatching inside onUpdate
          setTimeout(() => {
            if (!editor || editor.isDestroyed) return;
            isInsertingDatelineRef.current = true;

            // Insert date paragraph at the very beginning of the doc.
            // The paragraph carries a data-dateline attribute so CSS can style it
            // as very faint and small (item 7).
            editor.chain()
              .insertContentAt(0, {
                type: "paragraph",
                attrs: { class: "dateline-para" },
                content: [{ type: "text", text: dateStr }],
              })
              // Move caret to end of the document (which is now the line after the dateline)
              .focus("end")
              .run();

            isInsertingDatelineRef.current = false;

            // Update char count after dateline insertion
            setCharCount(editor.getText().length);
          }, 0);
        }

        // Reset debounce timer; full-doc serialization happens inside the timer only
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          try {
            if (isRestoringRef.current) return;
            const json = editor.getJSON() as TipTapNode;
            saveNote(noteIdRef.current, json);
            triggerSaved();
          } catch {
            // localStorage may be blocked in some contexts
          }
        }, SAVE_DEBOUNCE_MS);
      },
    },
    []
  );

  // Mark mounted (client-only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // When noteId or initialContent changes (user switched notes): restore new content
  useEffect(() => {
    if (!mounted || !editor) return;

    // Reset dateline refs for the new note.
    // pendingDatelineRef is armed synchronously here so the VERY FIRST keystroke
    // on the new note inserts the dateline regardless of how fast the user types.
    noteIdRef.current = noteId;
    pendingDatelineRef.current = isNewNote;
    isInsertingDatelineRef.current = false;

    // Cancel any pending save for the previous note
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    isRestoringRef.current = true;
    editor.commands.setContent(initialContent as TipTapNode);

    // Update empty state and char count based on restored content
    const empty = editor.isEmpty;
    setCharCount(editor.getText().length);
    onContentChange?.(empty);

    setTimeout(() => {
      isRestoringRef.current = false;
    }, SAVE_DEBOUNCE_MS + 100);

    // Focus the editor
    editor.commands.focus("end");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, mounted, editor]);

  // Flush-on-unload: synchronously write the current editor content on tab-close/hide.
  // This prevents data loss when the user reloads within the debounce window (~800ms).
  // We read the editor via a ref to avoid stale closure issues.
  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    const flush = () => {
      try {
        const ed = editorRef.current;
        if (!ed || ed.isDestroyed || isRestoringRef.current) return;
        const json = ed.getJSON() as TipTapNode;
        saveNote(noteIdRef.current, json);
      } catch {
        // localStorage may be blocked
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (showSavedTimerRef.current) clearTimeout(showSavedTimerRef.current);
    };
  }, []);

  // SSR / pre-hydration: render nothing
  if (!mounted) {
    return null;
  }

  return (
    <>
      <EditorContent editor={editor} />

      {/* Saved indicator */}
      <div
        key={savedKey}
        className={`saved-indicator${showSaved ? " show" : ""}`}
        role="status"
        aria-live="polite"
        aria-label="Document saved"
        aria-atomic="true"
      >
        Saved
      </div>

      {/* Character count — lower-right of writing surface */}
      <div
        className="char-count"
        aria-label="Character count"
        aria-live="polite"
        aria-atomic="true"
      >
        {charCount.toLocaleString()}
      </div>
    </>
  );
}
