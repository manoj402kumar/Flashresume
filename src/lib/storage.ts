import type { TemplateV1 } from "./api";

/**
 * 20 minutes TTL (Time-To-Live) in milliseconds.
 * 20 min * 60 sec * 1000 ms = 1,200,000 ms
 */
export const DEFAULT_TTL_MS = 20 * 60 * 1000;

export interface StorageEnvelope<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version?: number;
}

// In-memory fallback map for environments where localStorage is disabled, full, or throws (e.g. Safari Private Mode)
const memoryStore = new Map<string, string>();

/**
 * Safe check to verify if window and localStorage are fully accessible and writable.
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Low-level safe setItem that catches QuotaExceededError and SecurityError,
 * cleans up expired items if needed, and seamlessly falls back to in-memory storage.
 */
export function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") {
    memoryStore.set(key, value);
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch (err: any) {
    // Check if quota exceeded, attempt to clear expired entries and retry once
    if (
      err?.name === "QuotaExceededError" ||
      err?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err?.code === 22 ||
      err?.code === 1014
    ) {
      try {
        cleanupExpiredStorage();
        window.localStorage.setItem(key, value);
        return;
      } catch {
        // Still failing, fall through to memoryStore
      }
    }
    // Fallback to in-memory store so the app never throws an uncaught exception
    memoryStore.set(key, value);
  }
}

/**
 * Low-level safe getItem that falls back to memoryStore if localStorage is unavailable.
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") {
    return memoryStore.get(key) ?? null;
  }

  try {
    const item = window.localStorage.getItem(key);
    if (item !== null) return item;
  } catch {
    // Ignore and fallback
  }

  return memoryStore.get(key) ?? null;
}

/**
 * Low-level safe removeItem.
 */
export function safeRemoveItem(key: string): void {
  memoryStore.delete(key);
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

/**
 * Stores data wrapped in an envelope containing a 20-minute expiration timestamp (TTL).
 *
 * @param key The localStorage key
 * @param data The data object/primitive to store
 * @param ttlMs Time-to-live in milliseconds (defaults to 20 minutes)
 */
export function setStorageWithTTL<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const now = Date.now();
  const envelope: StorageEnvelope<T> = {
    data,
    timestamp: now,
    expiresAt: now + ttlMs,
    version: 1,
  };

  try {
    const serialized = JSON.stringify(envelope);
    safeSetItem(key, serialized);
  } catch (e) {
    console.warn(`[Flashresume Storage] Failed to serialize data for key: ${key}`, e);
  }
}

/**
 * Retrieves data stored with a TTL.
 * If the item has expired (exceeded TTL), it is automatically removed and null is returned.
 * If the item is valid and `renewTTL` is true, the expiration timestamp is extended (sliding window).
 *
 * @param key The localStorage key
 * @param options Optional flags for renewing TTL or custom TTL duration
 */
export function getStorageWithTTL<T>(
  key: string,
  options?: { renewTTL?: boolean; ttlMs?: number }
): T | null {
  const raw = safeGetItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    // Check if the item is wrapped in our StorageEnvelope
    if (parsed && typeof parsed === "object" && typeof parsed.expiresAt === "number" && "data" in parsed) {
      const envelope = parsed as StorageEnvelope<T>;
      const now = Date.now();

      // Check for expiration
      if (now > envelope.expiresAt) {
        // Expired! Clean up and return null
        safeRemoveItem(key);
        return null;
      }

      // Valid! If renewTTL is requested (active user editing), extend the TTL window
      if (options?.renewTTL) {
        const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
        envelope.expiresAt = now + ttlMs;
        safeSetItem(key, JSON.stringify(envelope));
      }

      return envelope.data;
    }

    // Legacy un-enveloped data fallback: wrap it in a fresh TTL envelope and return
    const now = Date.now();
    const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    const migratedEnvelope: StorageEnvelope<T> = {
      data: parsed as T,
      timestamp: now,
      expiresAt: now + ttlMs,
      version: 1,
    };
    safeSetItem(key, JSON.stringify(migratedEnvelope));
    return parsed as T;
  } catch (e) {
    // Corrupted JSON - safely remove
    safeRemoveItem(key);
    return null;
  }
}

/**
 * Scans known Flashresume storage keys and cleans up any expired entries.
 */
export function cleanupExpiredStorage(): void {
  if (typeof window === "undefined") return;

  const knownKeys = [
    "generated_resume",
    "scratch_resume_draft",
    "resume_text",
    "job_description",
    "analysis",
    "approved_project",
    "extracted_links",
    "resume_history",
    "resume_history_index",
    "resume_history_session_id",
  ];

  const now = Date.now();

  for (const key of knownKeys) {
    try {
      const raw = safeGetItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && typeof parsed.expiresAt === "number") {
        if (now > parsed.expiresAt) {
          safeRemoveItem(key);
        }
      }
    } catch {
      // If corrupt, clean it
      safeRemoveItem(key);
    }
  }
}

// ── FLASHRESUME SPECIFIC DRAFT HELPERS ──────────────────────────────────────

const GENERATED_RESUME_KEY = "generated_resume";
const SCRATCH_RESUME_KEY = "scratch_resume_draft";

/**
 * Save resume draft to browser local storage with a 20-minute TTL.
 * Each change resets the 20-minute countdown (sliding window of activity).
 */
export function saveResumeDraft(resume: TemplateV1, isScratch = false): void {
  const key = isScratch ? SCRATCH_RESUME_KEY : GENERATED_RESUME_KEY;
  setStorageWithTTL(key, resume, DEFAULT_TTL_MS);
  // Also keep generated_resume updated as a fallback reference if scratch
  if (isScratch) {
    setStorageWithTTL(GENERATED_RESUME_KEY, resume, DEFAULT_TTL_MS);
  }
}

/**
 * Load resume draft from browser storage if it was saved within the 20-minute window.
 * Returns null if expired or missing.
 */
export function loadResumeDraft(isScratch = false, sessionId?: string | null): TemplateV1 | null {
  const key = isScratch ? SCRATCH_RESUME_KEY : GENERATED_RESUME_KEY;
  let draft = getStorageWithTTL<TemplateV1>(key, { renewTTL: true });

  // If scratch draft wasn't found, try generated_resume
  if (!draft && isScratch) {
    draft = getStorageWithTTL<TemplateV1>(GENERATED_RESUME_KEY, { renewTTL: true });
  }

  if (draft && sessionId && draft.session_id && draft.session_id !== sessionId) {
    // If a different session is explicitly requested via URL param, disregard mismatched local draft
    return null;
  }

  return draft;
}

/**
 * Clears all resume draft keys from browser storage.
 */
export function clearResumeDraft(isScratch = false): void {
  if (isScratch) {
    safeRemoveItem(SCRATCH_RESUME_KEY);
    safeRemoveItem(HISTORY_KEY_SCRATCH);
  }
  safeRemoveItem(GENERATED_RESUME_KEY);
  safeRemoveItem(HISTORY_KEY_RESULT);
  safeRemoveItem("resume_history");
  safeRemoveItem("resume_history_index");
  safeRemoveItem("resume_history_session_id");
}

/**
 * Clears all workflow-related storage keys (e.g. when starting over).
 * Preserves user authentication tokens.
 */
export function clearAllWorkflowStorage(): void {
  const workflowKeys = [
    "resume_text",
    "job_description",
    "analysis",
    "generated_resume",
    "scratch_resume_draft",
    "no_jd_mode",
    "no_ai_changes",
    "approved_project",
    "preferred_model",
    "extracted_links",
    HISTORY_KEY_RESULT,
    HISTORY_KEY_SCRATCH,
    "resume_history",
    "resume_history_index",
    "resume_history_session_id",
  ];

  workflowKeys.forEach((key) => safeRemoveItem(key));
}

// ── UNDO / REDO HISTORY STACK PERSISTENCE ──────────────────────────────────

export interface HistoryStackState<T> {
  past: T[];
  present: T;
  future: T[];
}

export const HISTORY_KEY_RESULT = "resume_undo_history_result";
export const HISTORY_KEY_SCRATCH = "resume_undo_history_scratch";

/**
 * Save undo/redo history stack (past, present, future) to localStorage with 20-minute TTL timestamp envelope.
 */
export function saveHistoryStack<T>(history: T[], index: number, isScratch = false): void {
  if (!history || history.length === 0 || index < 0 || index >= history.length) return;

  const key = isScratch ? HISTORY_KEY_SCRATCH : HISTORY_KEY_RESULT;
  const payload: HistoryStackState<T> = {
    past: history.slice(0, index),
    present: history[index],
    future: history.slice(index + 1),
  };

  setStorageWithTTL(key, payload, DEFAULT_TTL_MS);
}

/**
 * Load undo/redo history stack from localStorage if saved within 20 minutes (1,200,000 ms).
 * Returns null if expired (> 20 min), corrupted, or missing, and purges expired entry automatically.
 */
export function loadHistoryStack<T>(isScratch = false): HistoryStackState<T> | null {
  const key = isScratch ? HISTORY_KEY_SCRATCH : HISTORY_KEY_RESULT;
  const data = getStorageWithTTL<HistoryStackState<T>>(key, { renewTTL: true });

  if (!data || !Array.isArray(data.past) || !data.present || !Array.isArray(data.future)) {
    safeRemoveItem(key);
    return null;
  }

  return data;
}

/**
 * Clears undo/redo history stack keys from localStorage.
 */
export function clearHistoryStack(isScratch = false): void {
  const key = isScratch ? HISTORY_KEY_SCRATCH : HISTORY_KEY_RESULT;
  safeRemoveItem(key);
  safeRemoveItem(HISTORY_KEY_RESULT);
  safeRemoveItem(HISTORY_KEY_SCRATCH);
}
