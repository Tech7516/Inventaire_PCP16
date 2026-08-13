import { useState, useEffect, useCallback } from "react";
import {
  getCache,
  subscribe,
  ensureLoaded,
  setCachedPref,
  removeCachedPref,
  reloadPreferences,
} from "@/lib/preferenceCache";

/**
 * Hook to manage cloud-backed preferences via singleton cache.
 * All components share the same cache — only ONE GET /preferences call
 * is made regardless of how many components mount this hook.
 * Writes are debounced (500ms) to avoid rapid POST /preferences bursts.
 */
export function useCloudPreferences() {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Trigger load on first mount (deduped — safe for multiple consumers)
    ensureLoaded();

    // Subscribe to cache changes for re-renders
    const unsub = subscribe(() => {
      setTick((t) => t + 1);
    });

    return unsub;
  }, []);

  const cache = getCache();

  const getPref = useCallback(
    (key: string): string | null => {
      return cache.prefs[key] ?? null;
    },
    [cache.prefs]
  );

  const setPref = useCallback(
    (key: string, value: string) => {
      setCachedPref(key, value);
    },
    []
  );

  const removePref = useCallback(
    (key: string) => {
      removeCachedPref(key);
    },
    []
  );

  return {
    prefs: cache.prefs,
    getPref,
    setPref,
    removePref,
    loading: cache.loading,
    error: cache.error,
    reload: reloadPreferences,
  };
}