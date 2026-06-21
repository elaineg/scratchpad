"use client";

import { useCallback } from "react";
import type { NoteRecord } from "../lib/useNotes";
import { deriveTitle } from "../lib/useNotes";

interface NotesSidebarProps {
  notes: NoteRecord[];
  activeId: string | null;
  onNewNote: () => void;
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  isOpen: boolean; // mobile drawer state
  onClose: () => void;
}

export default function NotesSidebar({
  notes,
  activeId,
  onNewNote,
  onSelectNote,
  onDeleteNote,
  isOpen,
  onClose,
}: NotesSidebarProps) {
  // Item 6: delete immediately, no confirm state needed
  const handleDeleteClick = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteNote(id);
  }, [onDeleteNote]);

  const handleSelectNote = useCallback(
    (id: string) => {
      onSelectNote(id);
      onClose(); // close drawer on mobile after selecting
    },
    [onSelectNote, onClose]
  );

  return (
    <nav
      className={`notes-sidebar${isOpen ? " open" : ""}`}
      aria-label="Notes list"
      data-testid="notes-sidebar"
    >
      {/* + new note action — item 2: lowercase, faint grey, same treatment as rows */}
      <div className="sidebar-new-note">
        <button
          className="new-note-btn"
          data-testid="new-note-btn"
          aria-label="Create new note"
          onClick={onNewNote}
        >
          + new note
        </button>
      </div>

      {/* Notes list */}
      <ul className="notes-list" role="list" aria-label="Saved notes">
        {notes.map((note) => {
          const isActive = note.id === activeId;
          const title = deriveTitle(note.content);

          return (
            <li
              key={note.id}
              className={`note-row${isActive ? " active" : ""}`}
              data-testid={`note-row-${note.id}`}
              aria-current={isActive ? "true" : undefined}
            >
              <button
                className="note-row-btn"
                data-testid={`note-select-${note.id}`}
                onClick={() => handleSelectNote(note.id)}
                aria-label={`Open note: ${title}`}
              >
                <span className="note-title">{title}</span>
                {/* Delete affordance — shows on hover via CSS, item 6: immediate delete */}
                <span
                  className="note-delete-glyph"
                  role="button"
                  tabIndex={0}
                  aria-label={`Delete note: ${title}`}
                  data-testid={`delete-note-${note.id}`}
                  onClick={(e) => handleDeleteClick(note.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleDeleteClick(note.id, e as unknown as React.MouseEvent);
                    }
                  }}
                >
                  ×
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Mobile close overlay */}
      <div
        className="sidebar-overlay"
        aria-hidden="true"
        onClick={onClose}
      />
    </nav>
  );
}
