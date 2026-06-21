/**
 * imageStore — IndexedDB storage for pasted image blobs.
 *
 * Each image is stored as a Blob keyed by a short id (crypto.randomUUID()).
 * The TipTap doc only holds the id; bytes never go into localStorage.
 *
 * All APIs are async and guarded for SSR (no window/indexedDB on server).
 */

const DB_NAME = "scratchpad-images";
const DB_VERSION = 1;
const STORE_NAME = "blobs";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

/** Store a Blob and return the id under which it was saved. */
export async function storeImageBlob(blob: Blob, id: string): Promise<string> {
  if (typeof indexedDB === "undefined") throw new Error("No IndexedDB (SSR)");
  const db = await openDB();
  return new Promise<string>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(blob, id);
    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
  });
}

/** Retrieve a Blob by id. Returns null if not found. */
export async function getImageBlob(id: string): Promise<Blob | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDB();
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Delete a Blob by id. No-op if not found. */
export async function deleteImageBlob(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Delete multiple Blobs by id array. Silently ignores missing ids. */
export async function deleteImageBlobs(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  for (const id of ids) {
    await deleteImageBlob(id);
  }
}

/**
 * Downscale a Blob to a max dimension (longest side) if it exceeds the limit.
 * Re-encodes as JPEG at quality 0.85 for large images; keeps PNG for small.
 * Returns a new Blob (or the original if no downscale needed).
 */
export async function maybeDownscale(
  blob: Blob,
  maxDim = 2000,
): Promise<Blob> {
  return new Promise<Blob>((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w <= maxDim && h <= maxDim) {
        // Small enough — keep original
        resolve(blob);
        return;
      }
      const scale = maxDim / Math.max(w, h);
      const dw = Math.round(w * scale);
      const dh = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, dw, dh);
      canvas.toBlob(
        (result) => resolve(result ?? blob),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.src = url;
  });
}

/**
 * Extract all imgId values from a TipTap JSON doc.
 * Used when deleting a note to free its image blobs.
 */
export function extractImgIds(doc: object | null | undefined): string[] {
  if (!doc) return [];
  const ids: string[] = [];

  function walk(node: Record<string, unknown>) {
    if (node.type === "image") {
      const imgId = (node.attrs as Record<string, unknown>)?.imgId;
      if (typeof imgId === "string" && imgId) ids.push(imgId);
    }
    const content = node.content as Record<string, unknown>[] | undefined;
    if (Array.isArray(content)) {
      for (const child of content) walk(child);
    }
  }

  walk(doc as Record<string, unknown>);
  return ids;
}
