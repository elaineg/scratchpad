"use client";

import { useCallback, useState } from "react";
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
  // Track which note has confirm-delete shown
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteClick = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  }, []);

  const handleConfirmDelete = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setConfirmDeleteId(null);
      onDeleteNote(id);
    },
    [onDeleteNote]
  );

  const handleCancelDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  }, []);

  const handleSelectNote = useCallback(
    (id: string) => {
      setConfirmDeleteId(null);
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
      {/* + NEW NOTE action */}
      <div className="sidebar-new-note">
        <button
          className="new-note-btn"
          data-testid="new-note-btn"
          aria-label="Create new note"
          onClick={onNewNote}
        >
          + NEW NOTE
        </button>
      </div>

      {/* Notes list */}
      <ul className="notes-list" role="list" aria-label="Saved notes">
        {notes.map((note) => {
          const isActive = note.id === activeId;
          const isConfirming = confirmDeleteId === note.id;
          const title = deriveTitle(note.content);

          return (
            <li
              key={note.id}
              className={`note-row${isActive ? " active" : ""}`}
              data-testid={`note-row-${note.id}`}
              aria-current={isActive ? "true" : undefined}
            >
              {isConfirming ? (
                /* Inline delete confirm */
                <div className="note-delete-confirm" role="alert">
                  <span className="delete-confirm-label">DELETE THIS NOTE?</span>
                  <div className="delete-confirm-actions">
                    <button
                      className="delete-confirm-btn confirm"
                      data-testid={`confirm-delete-${note.id}`}
                      onClick={(e) => handleConfirmDelete(note.id, e)}
                      aria-label="Confirm delete note"
                    >
                      CONFIRM
                    </button>
                    <button
                      className="delete-confirm-btn cancel"
                      data-testid={`cancel-delete-${note.id}`}
                      onClick={handleCancelDelete}
                      aria-label="Cancel delete note"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="note-row-btn"
                  data-testid={`note-select-${note.id}`}
                  onClick={() => handleSelectNote(note.id)}
                  aria-label={`Open note: ${title}`}
                >
                  <span className="note-title">{title}</span>
                  {/* Delete affordance — shows on hover via CSS */}
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
              )}
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
