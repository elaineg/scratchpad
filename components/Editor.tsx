"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

const STORAGE_KEY = "scratchpad-v1";
const SAVE_DEBOUNCE_MS = 800;

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
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          try {
            const json = editor.getJSON();
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
        const json = JSON.parse(raw);
        isRestoringRef.current = true;
        editor.commands.setContent(json);
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
    };
  }, []);

  // SSR / pre-hydration: render nothing (dynamic ssr:false prevents this rendering server-side)
  if (!mounted) {
    return null;
  }

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
    </>
  );
}
