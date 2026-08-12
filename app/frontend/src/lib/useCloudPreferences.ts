import { useState, useEffect, useCallback } from "react";
import {
  getAllPreferencesFromDb,
  setPreferenceInDb,
} from "@/lib/inventory-api";

/**
 * Hook to manage cloud-backed preferences via shared API (bypasses RLS).
 * All devices see the same preferences since the shared API has no user filtering.
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
        setPrefs({});
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
      // Write to cloud via shared API
      try {
        await setPreferenceInDb(key, value);
      } catch {
        /* ignore — optimistic update already applied locally */
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
      // Set to empty string to mark "removed" in cloud
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