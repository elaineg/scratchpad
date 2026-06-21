"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import NotesSidebar from "./NotesSidebar";
import type { NoteRecord } from "../lib/useNotes";
import {
  loadAllNotes,
  createNote,
  deleteNote,
  migrateLegacy,
  readNote,
  writeActiveId,
} from "../lib/useNotes";
// Load Editor client-side only (TipTap is not SSR-safe)
const Editor = dynamic(() => import("./Editor"), { ssr: false });

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph", content: [] }] };

export default function EditorPage() {
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeContent, setActiveContent] = useState<object>(EMPTY_DOC);
  // Track if the current note is "new" (just created, dateline eligible)
  const [isNewNote, setIsNewNote] = useState(false);
  // Mobile sidebar open state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ─── Bootstrap: migrate legacy, load all notes ─────────────────────────────
  useEffect(() => {
    setMounted(true);
    // Migrate old single-note format if present
    migrateLegacy();

    const { notes: loadedNotes, activeId: savedActiveId } = loadAllNotes();

    if (loadedNotes.length === 0) {
      // First-ever load: create a blank note and drop into it
      const id = createNote();
      const record = readNote(id)!;
      setNotes([record]);
      setActiveId(id);
      setActiveContent(EMPTY_DOC);
      setIsNewNote(true);
    } else {
      // Returning user: open last-active note (or most recent)
      let targetId = savedActiveId && loadedNotes.find((n) => n.id === savedActiveId)
        ? savedActiveId
        : loadedNotes[0].id;
      const targetNote = loadedNotes.find((n) => n.id === targetId)!;
      setNotes(loadedNotes);
      setActiveId(targetId);
      setActiveContent(targetNote.content);
      setIsNewNote(false);
    }
  }, []);

  // ─── Save the current note before switching ────────────────────────────────
  // We expose a ref-style callback so the Editor can call it synchronously
  // before we change activeId. Actually, the Editor's own debounce handles
  // autosave; here we do an immediate flush when switching via button.
  // The Editor component saves on debounce independently; we just need to
  // reload notes state from localStorage after any save.

  const refreshNotesList = useCallback(() => {
    const { notes: refreshed } = loadAllNotes();
    setNotes(refreshed);
  }, []);

  // ─── New note ──────────────────────────────────────────────────────────────
  const handleNewNote = useCallback(() => {
    // Guard: if the current active note is already a fresh blank note (isNewNote + no content
    // saved), do not create another. This prevents a rapid double-click from spawning two
    // empty notes. We check isNewNote flag AND that the stored note is still empty.
    if (isNewNote && activeId) {
      const existing = readNote(activeId);
      const isBlank = !existing || (
        Array.isArray((existing.content as { content?: unknown[] })?.content) &&
        (existing.content as { content: { content?: unknown[] }[] }).content.length <= 1 &&
        ((existing.content as { content: { content?: unknown[] }[] }).content[0]?.content?.length ?? 0) === 0
      );
      if (isBlank) {
        // Already on a fresh blank note — stay on it
        setSidebarOpen(false);
        return;
      }
    }

    const id = createNote();
    const record = readNote(id)!;
    setSidebarOpen(false);
    setNotes((prev) => [record, ...prev]);
    setActiveId(id);
    setActiveContent(EMPTY_DOC);
    setIsNewNote(true);
  }, [isNewNote, activeId]);

  // ─── Select note ──────────────────────────────────────────────────────────
  const handleSelectNote = useCallback((id: string) => {
    if (id === activeId) {
      setSidebarOpen(false);
      return;
    }
    const note = readNote(id);
    if (!note) return;
    writeActiveId(id);
    setSidebarOpen(false);
    setActiveId(id);
    setActiveContent(note.content);
    setIsNewNote(false);
    // Refresh the list (order may have changed)
    refreshNotesList();
  }, [activeId, refreshNotesList]);

  // ─── Delete note ──────────────────────────────────────────────────────────
  const handleDeleteNote = useCallback((id: string) => {
    const newActiveId = deleteNote(id, activeId ?? "");
    if (newActiveId === null) {
      // No notes left — create a fresh blank one
      const freshId = createNote();
      const record = readNote(freshId)!;
      setNotes([record]);
      setActiveId(freshId);
      setActiveContent(EMPTY_DOC);
      setIsNewNote(true);
    } else {
      const note = readNote(newActiveId);
      setActiveId(newActiveId);
      setActiveContent(note ? note.content : EMPTY_DOC);
      setIsNewNote(false);
      refreshNotesList();
    }
  }, [activeId, refreshNotesList]);

  // ─── When content changes (from Editor), refresh notes list for title update
  const handleContentChange = useCallback((_isEmpty: boolean) => {
    // Debounced: the Editor will have already written via saveNote()
    // We schedule a list refresh after the debounce window
    setTimeout(() => {
      refreshNotesList();
    }, 900);
  }, [refreshNotesList]);

  if (!mounted) {
    return (
      <div
        style={{ background: "#FBFAF8", minHeight: "100vh" }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="app-layout" data-testid="app-layout">
      {/* Mobile hamburger toggle */}
      <button
        className="hamburger-btn"
        data-testid="hamburger-btn"
        aria-label="Toggle notes sidebar"
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((v) => !v)}
      >
        {/* Three-line hamburger, 1px stroke */}
        <svg
          width="18"
          height="14"
          viewBox="0 0 18 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          aria-hidden="true"
        >
          <line x1="0" y1="1" x2="18" y2="1" />
          <line x1="0" y1="7" x2="18" y2="7" />
          <line x1="0" y1="13" x2="18" y2="13" />
        </svg>
      </button>

      {/* Left sidebar */}
      <NotesSidebar
        notes={notes}
        activeId={activeId}
        onNewNote={handleNewNote}
        onSelectNote={handleSelectNote}
        onDeleteNote={handleDeleteNote}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main writing surface */}
      <main className="writing-surface" data-testid="writing-surface">
        <div className="writing-column">
          {activeId && (
            <Editor
              key={activeId}
              noteId={activeId}
              initialContent={activeContent}
              isNewNote={isNewNote}
              onContentChange={handleContentChange}
            />
          )}
        </div>
      </main>
    </div>
  );
}
