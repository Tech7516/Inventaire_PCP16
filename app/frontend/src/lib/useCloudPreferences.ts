import { useState, useEffect, useCallback } from "react";
import {
  getAllPreferencesFromDb,
  setPreferenceInDb,
} from "@/lib/inventory-api";

/**
 * Hook to manage cloud-backed preferences (replaces localStorage).
 * On mount, loads all preferences from DB. Also migrates any localStorage
 * values that haven't been synced yet.
 *
 * Returns:
 * - prefs: current preference map (key → value)
 * - getPref: synchronous getter (from cached state)
 * - setPref: async setter (writes to DB + updates local state)
 * - loading: true while loading from DB
 */
export function useCloudPreferences() {
  const [prefs, setPrefs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const cloudPrefs = await getAllPreferencesFromDb();

        // One-time migration: if a localStorage key exists but not in cloud, push it
        const MIGRATION_KEYS = [
          "lot-variants",
          "dps-name",
          "selected-variants",
        ];
        let needsUpdate = false;
        for (const key of MIGRATION_KEYS) {
          const localVal = localStorage.getItem(key);
          if (localVal !== null && !(key in cloudPrefs)) {
            cloudPrefs[key] = localVal;
            needsUpdate = true;
          }
        }

        setPrefs(cloudPrefs);

        // Push migrated values to cloud in background
        if (needsUpdate) {
          for (const key of MIGRATION_KEYS) {
            if (cloudPrefs[key] !== undefined) {
              setPreferenceInDb(key, cloudPrefs[key]).catch(() => {});
            }
          }
        }
      } catch {
        // Fallback: read from localStorage
        const fallback: Record<string, string> = {};
        const KEYS = ["lot-variants", "dps-name", "selected-variants"];
        for (const key of KEYS) {
          const val = localStorage.getItem(key);
          if (val !== null) fallback[key] = val;
        }
        setPrefs(fallback);
      }
      setLoading(false);
    };
    load();
  }, []);

  const getPref = useCallback(
    (key: string): string | null => {
      return prefs[key] ?? null;
    },
    [prefs]
  );

  const setPref = useCallback(
    async (key: string, value: string) => {
      // Optimistic local update
      setPrefs((prev) => ({ ...prev, [key]: value }));
      // Also keep localStorage in sync as fallback
      localStorage.setItem(key, value);
      // Write to cloud
      try {
        await setPreferenceInDb(key, value);
      } catch {
        /* ignore — localStorage fallback already updated */
      }
    },
    []
  );

  const removePref = useCallback(
    async (key: string) => {
      setPrefs((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      localStorage.removeItem(key);
      // Note: we don't delete from DB, just set empty — or we could leave it
      // For simplicity, set to empty string to mark "removed"
      try {
        await setPreferenceInDb(key, "");
      } catch {
        /* ignore */
      }
    },
    []
  );

  return { prefs, getPref, setPref, removePref, loading };
}