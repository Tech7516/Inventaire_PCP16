import {
  getAllPreferencesFromDb,
  setPreferenceInDb,
} from "@/lib/inventory-api";

// ---------- Singleton preference cache with dedup + backoff ----------

type Listener = () => void;

interface CacheState {
  prefs: Record<string, string>;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

const state: CacheState = {
  prefs: {},
  loading: false,
  loaded: false,
  error: null,
};

const listeners = new Set<Listener>();
let loadPromise: Promise<void> | null = null;

// Pending writes queue for debouncing
const pendingWrites = new Map<string, string>();
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const WRITE_DEBOUNCE_MS = 500;

// ---------- Retry with exponential backoff ----------

async function fetchWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      // Only retry on 429 or network errors
      if (attempt < maxRetries && (status === 429 || !status)) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

// ---------- Migration ----------

const MIGRATION_KEYS = ["lot-variants", "dps-name", "selected-variants"];

function migrateFromLocalStorage(cloudPrefs: Record<string, string>): boolean {
  let needsUpdate = false;
  for (const key of MIGRATION_KEYS) {
    const localVal = localStorage.getItem(key);
    if (localVal !== null && !(key in cloudPrefs)) {
      cloudPrefs[key] = localVal;
      needsUpdate = true;
    }
  }
  return needsUpdate;
}

async function pushMigratedValues(prefs: Record<string, string>): Promise<void> {
  for (const key of MIGRATION_KEYS) {
    if (prefs[key] !== undefined) {
      setPreferenceInDb(key, prefs[key]).catch(() => {});
    }
  }
}

// ---------- Load (deduped) ----------

function notifyAll() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

async function loadPreferences(): Promise<void> {
  if (loadPromise) return loadPromise;

  state.loading = true;
  state.error = null;
  notifyAll();

  loadPromise = (async () => {
    try {
      const cloudPrefs = await fetchWithBackoff(() => getAllPreferencesFromDb());
      const needsUpdate = migrateFromLocalStorage(cloudPrefs);
      state.prefs = cloudPrefs;
      state.loaded = true;
      state.error = null;

      if (needsUpdate) {
        pushMigratedValues(cloudPrefs);
      }
    } catch (err: any) {
      state.error = err?.message || "Failed to load preferences";
      // Fallback: try to use localStorage values
      const fallback: Record<string, string> = {};
      for (const key of MIGRATION_KEYS) {
        const val = localStorage.getItem(key);
        if (val !== null) fallback[key] = val;
      }
      state.prefs = fallback;
      state.loaded = true;
    } finally {
      state.loading = false;
      loadPromise = null;
      notifyAll();
    }
  })();

  return loadPromise;
}

// ---------- Debounced writes ----------

function flushWrites() {
  if (pendingWrites.size === 0) return;
  const entries = Array.from(pendingWrites.entries());
  pendingWrites.clear();
  writeTimer = null;

  for (const [key, value] of entries) {
    setPreferenceInDb(key, value).catch(() => {});
  }
}

function scheduleWrite(key: string, value: string) {
  pendingWrites.set(key, value);
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flushWrites, WRITE_DEBOUNCE_MS);
}

// ---------- Public API ----------

export function getCache(): CacheState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Ensure preferences are loaded. Deduped — safe to call from multiple components.
 */
export async function ensureLoaded(): Promise<void> {
  if (state.loaded || state.loading) return;
  await loadPreferences();
}

/**
 * Force reload preferences (e.g., after a 429 cooldown).
 */
export async function reloadPreferences(): Promise<void> {
  state.loaded = false;
  state.loading = false;
  loadPromise = null;
  await loadPreferences();
}

/**
 * Set a preference value (optimistic local update + debounced cloud write).
 */
export function setCachedPref(key: string, value: string): void {
  state.prefs = { ...state.prefs, [key]: value };
  scheduleWrite(key, value);
  notifyAll();
}

/**
 * Remove a preference (optimistic local + debounced cloud write with empty value).
 */
export function removeCachedPref(key: string): void {
  const next = { ...state.prefs };
  delete next[key];
  state.prefs = next;
  scheduleWrite(key, "");
  notifyAll();
}