"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { docToHtml, docToMarkdown, docIsEmpty, TipTapNode } from "../lib/docSerializer";

const STORAGE_KEY = "scratchpad-v1";
const SAVE_DEBOUNCE_MS = 800;

type CopyState = "idle" | "copied" | "blocked";

export default function Editor() {
  // Track mount to avoid SSR hydration mismatch
  const [mounted, setMounted] = useState(false);

  // Saved indicator — use a counter key to force re-animation
  const [savedKey, setSavedKey] = useState(0);
  const [showSaved, setShowSaved] = useState(false);
  const showSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guard: don't flash "Saved" during the initial content restore
  const isRestoringRef = useRef(false);

  // Copy affordance state
  const [isEmpty, setIsEmpty] = useState(true);
  const [richState, setRichState] = useState<CopyState>("idle");
  const [mdState, setMdState] = useState<CopyState>("idle");
  const richTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        StarterKit,
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
        // Cheap isEmpty check — no serialization on the keystroke path
        const empty = editor.isEmpty;
        setIsEmpty((prev) => (prev === empty ? prev : empty));

        // Reset debounce timer; full-doc serialization happens inside the timer only
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          try {
            const json = editor.getJSON() as TipTapNode;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
            // Don't flash "Saved" during the initial restore-from-localStorage
            if (!isRestoringRef.current) {
              triggerSaved();
            }
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

  // After mount: restore from localStorage (suppress "Saved" flash during restore)
  useEffect(() => {
    if (!mounted || !editor) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const json = JSON.parse(raw) as TipTapNode;
        isRestoringRef.current = true;
        editor.commands.setContent(json);
        // Update empty state based on restored content
        setIsEmpty(docIsEmpty(json));
        // Reset the flag after the debounce window so any pending onUpdate fires suppressed
        setTimeout(() => {
          isRestoringRef.current = false;
        }, SAVE_DEBOUNCE_MS + 100);
      }
    } catch {
      // Corrupt data or blocked storage — start fresh
    }
    editor.commands.focus("end");
  }, [mounted, editor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (showSavedTimerRef.current) clearTimeout(showSavedTimerRef.current);
      if (richTimerRef.current) clearTimeout(richTimerRef.current);
      if (mdTimerRef.current) clearTimeout(mdTimerRef.current);
    };
  }, []);

  const handleCopyRich = useCallback(async () => {
    if (!editor) return;
    const doc = editor.getJSON() as TipTapNode;
    const html = docToHtml(doc);
    const md = docToMarkdown(doc);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([md], { type: "text/plain" }),
        }),
      ]);
      setRichState("copied");
      if (richTimerRef.current) clearTimeout(richTimerRef.current);
      richTimerRef.current = setTimeout(() => setRichState("idle"), 1800);
    } catch {
      setRichState("blocked");
      if (richTimerRef.current) clearTimeout(richTimerRef.current);
      richTimerRef.current = setTimeout(() => setRichState("idle"), 3000);
    }
    // Restore focus to editor without shifting layout
    editor.commands.focus();
  }, [editor]);

  const handleCopyMarkdown = useCallback(async () => {
    if (!editor) return;
    const doc = editor.getJSON() as TipTapNode;
    const md = docToMarkdown(doc);
    try {
      await navigator.clipboard.writeText(md);
      setMdState("copied");
      if (mdTimerRef.current) clearTimeout(mdTimerRef.current);
      mdTimerRef.current = setTimeout(() => setMdState("idle"), 1800);
    } catch {
      setMdState("blocked");
      if (mdTimerRef.current) clearTimeout(mdTimerRef.current);
      mdTimerRef.current = setTimeout(() => setMdState("idle"), 3000);
    }
    // Restore focus to editor without shifting layout
    editor.commands.focus();
  }, [editor]);

  // SSR / pre-hydration: render nothing (dynamic ssr:false prevents this rendering server-side)
  if (!mounted) {
    return null;
  }

  const showCopy = !isEmpty;

  return (
    <>
      <EditorContent editor={editor} />
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

      {/* Copy affordance — fixed top-right, outside the writing column */}
      <div
        className="copy-actions"
        style={{ opacity: showCopy ? 1 : 0, pointerEvents: showCopy ? "auto" : "none" }}
        aria-hidden={!showCopy}
      >
        <button
          className={`copy-btn${richState === "copied" ? " confirm" : richState === "blocked" ? " warn" : ""}`}
          data-testid="copy-rich-btn"
          aria-label="Copy as Rich Text"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleCopyRich}
          tabIndex={showCopy ? 0 : -1}
        >
          {richState === "copied"
            ? "Copied rich text ✓"
            : richState === "blocked"
            ? "Copy blocked — select all & ⌘C"
            : "Copy as Rich Text"}
        </button>
        <button
          className={`copy-btn${mdState === "copied" ? " confirm" : mdState === "blocked" ? " warn" : ""}`}
          data-testid="copy-md-btn"
          aria-label="Copy as Markdown"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleCopyMarkdown}
          tabIndex={showCopy ? 0 : -1}
        >
          {mdState === "copied"
            ? "Copied markdown ✓"
            : mdState === "blocked"
            ? "Copy blocked — select all & ⌘C"
            : "Copy as Markdown"}
        </button>
      </div>
    </>
  );
}
