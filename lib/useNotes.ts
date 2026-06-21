"use client";

/**
 * useNotes — multi-note localStorage persistence.
 *
 * Storage shape:
 *   "scratchpad-notes-index" → JSON array of note ids (string[]), ordered newest-first
 *   "scratchpad-note-<id>"   → JSON: { id, content, updatedAt }
 *   "scratchpad-active-id"   → string (last-open note id)
 *
 * The old single-note key "scratchpad-v1" is migrated on first load.
 */

export interface NoteRecord {
  id: string;
  content: object; // TipTap JSON doc
  updatedAt: number; // ms timestamp
}

const INDEX_KEY = "scratchpad-notes-index";
const ACTIVE_KEY = "scratchpad-active-id";
const NOTE_PREFIX = "scratchpad-note-";
const LEGACY_KEY = "scratchpad-v1";

function noteKey(id: string) {
  return `${NOTE_PREFIX}${id}`;
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Pure helpers (used in hook + tests) ─────────────────────────────────────

export function readIndex(): string[] {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function writeIndex(ids: string[]) {
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

export function readNote(id: string): NoteRecord | null {
  try {
    const raw = window.localStorage.getItem(noteKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as NoteRecord;
  } catch {
    return null;
  }
}

export function writeNote(record: NoteRecord) {
  window.localStorage.setItem(noteKey(record.id), JSON.stringify(record));
}

export function deleteNoteRecord(id: string) {
  window.localStorage.removeItem(noteKey(id));
}

export function readActiveId(): string | null {
  return window.localStorage.getItem(ACTIVE_KEY);
}

export function writeActiveId(id: string) {
  window.localStorage.setItem(ACTIVE_KEY, id);
}

/**
 * Migrate the old single-note "scratchpad-v1" format into the new multi-note schema.
 * Returns the migrated note id, or null if no migration was needed.
 */
export function migrateLegacy(): string | null {
  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (!legacy) return null;
    const existingIndex = readIndex();
    if (existingIndex.length > 0) {
      // Already migrated or new-format notes exist — just clean up the old key
      window.localStorage.removeItem(LEGACY_KEY);
      return null;
    }
    const content = JSON.parse(legacy);
    const id = genId();
    writeNote({ id, content, updatedAt: Date.now() });
    writeIndex([id]);
    window.localStorage.removeItem(LEGACY_KEY);
    return id;
  } catch {
    return null;
  }
}

/** Derive a display title from TipTap JSON doc content. */
export function deriveTitle(content: object | null | undefined): string {
  if (!content) return "Untitled";
  const doc = content as { content?: Array<{ type: string; content?: Array<{ text?: string }> }> };
  const nodes = doc.content ?? [];
  for (const node of nodes) {
    if (!node.content) continue;
    for (const child of node.content) {
      if (child.text && child.text.trim()) {
        return child.text.trim();
      }
    }
  }
  return "Untitled";
}

/**
 * Create a fresh blank note in localStorage and return its id.
 * Prepends it to the index (newest first).
 */
export function createNote(): string {
  const id = genId();
  const emptyContent = { type: "doc", content: [{ type: "paragraph", content: [] }] };
  writeNote({ id, content: emptyContent, updatedAt: Date.now() });
  const ids = readIndex();
  writeIndex([id, ...ids]);
  writeActiveId(id);
  return id;
}

/**
 * Save a note's content and bump updatedAt.
 * Re-sorts the index so this note moves to the front (most recent).
 */
export function saveNote(id: string, content: object) {
  const record = readNote(id);
  if (!record) return;
  const updated: NoteRecord = { ...record, content, updatedAt: Date.now() };
  writeNote(updated);
  // Bubble this note to the top of the index
  const ids = readIndex().filter((i) => i !== id);
  writeIndex([id, ...ids]);
}

/**
 * Delete a note and remove it from the index.
 * Returns the new active id (next note or null if empty).
 */
export function deleteNote(id: string, currentActiveId: string): string | null {
  deleteNoteRecord(id);
  const ids = readIndex().filter((i) => i !== id);
  writeIndex(ids);
  if (ids.length === 0) return null;
  // If we deleted the active note, pick the first remaining
  if (currentActiveId === id) {
    writeActiveId(ids[0]);
    return ids[0];
  }
  return currentActiveId;
}

/**
 * Load all notes from localStorage, sorted by updatedAt descending.
 * Returns { notes: NoteRecord[], activeId: string | null }
 */
export function loadAllNotes(): { notes: NoteRecord[]; activeId: string | null } {
  const ids = readIndex();
  const notes: NoteRecord[] = [];
  for (const id of ids) {
    const n = readNote(id);
    if (n) notes.push(n);
  }
  // Sort newest first by updatedAt
  notes.sort((a, b) => b.updatedAt - a.updatedAt);
  const activeId = readActiveId();
  return { notes, activeId };
}
