import { createClient } from "@metagptx/web-sdk";
import { lotSubEntities } from "@/data/lots";

const client = createClient();

// ---------- Types ----------

export interface SessionData {
  id: number;
  lot_id: string;
  variant_id: string | null;
  dps_name: string;
  status: string | null;
  completed_at: string | null;
  created_at: string | null;
}

export interface SubEntityCheckData {
  id: number;
  session_id: number;
  sub_entity_id: string;
  variant_id: string | null;
  sac_type: string | null;
  checker_name: string;
  created_at: string | null;
}

export interface InventoryItemData {
  id: number;
  session_id: number;
  sub_entity_id: string;
  variant_id: string | null;
  sac_type: string | null;
  item_id: string;
  validated: boolean | null;
  custom_quantity: string | null;
  checker_name: string | null;
}

// ---------- Helper: strip null/undefined values from payload ----------
// The entity API rejects null for string fields (422), so we omit them.

function stripNulls<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// ---------- API Calls (using client.entities.* — auto-deployed CRUD) ----------

export async function getActiveSession(lotId: string): Promise<SessionData | null> {
  try {
    const res = await client.entities.inventory_sessions.query({
      query: { lot_id: lotId, status: "active" },
      sort: "-created_at",
      limit: 1,
    });
    const items = res.data?.items || [];
    return items.length > 0 ? (items[0] as SessionData) : null;
  } catch {
    return null;
  }
}

export async function getAllActiveSessions(): Promise<SessionData[]> {
  try {
    const res = await client.entities.inventory_sessions.query({
      query: { status: "active" },
      sort: "-created_at",
      limit: 100,
    });
    return (res.data?.items || []) as SessionData[];
  } catch {
    return [];
  }
}

export async function createSession(
  lotId: string,
  dpsName: string,
  variantId?: string | null
): Promise<SessionData> {
  // Client-side guard: check for existing active session first
  const existing = await getActiveSession(lotId);
  if (existing) {
    throw new Error("An active session already exists for this lot");
  }

  const data = stripNulls({
    lot_id: lotId,
    dps_name: dpsName,
    variant_id: variantId || undefined,
    status: "active",
  });

  const res = await client.entities.inventory_sessions.create({ data });
  return res.data as SessionData;
}

export async function abandonSession(sessionId: number): Promise<void> {
  await client.entities.inventory_sessions.update({
    id: String(sessionId),
    data: {
      status: "abandoned",
    },
  });
}

export async function completeSession(sessionId: number): Promise<SessionData> {
  const res = await client.entities.inventory_sessions.update({
    id: String(sessionId),
    data: {
      status: "completed",
      completed_at: new Date().toISOString(),
    },
  });
  return res.data as SessionData;
}

export async function getSubEntityChecks(
  sessionId: number
): Promise<SubEntityCheckData[]> {
  try {
    const res = await client.entities.sub_entity_checks.query({
      query: { session_id: String(sessionId) },
      limit: 100,
    });
    return (res.data?.items || []) as SubEntityCheckData[];
  } catch {
    return [];
  }
}

export async function markSubEntity(
  sessionId: number,
  subEntityId: string,
  checkerName: string,
  variantId?: string | null,
  sacType?: string | null
): Promise<SubEntityCheckData> {
  // Idempotent: query existing checks for this session + sub_entity, then filter client-side
  try {
    const res = await client.entities.sub_entity_checks.query({
      query: { session_id: String(sessionId), sub_entity_id: subEntityId },
      limit: 100,
    });
    const items = (res.data?.items || []) as SubEntityCheckData[];

    // Find exact match including variant_id and sac_type
    const existing = items.find((c) => {
      if (c.sub_entity_id !== subEntityId) return false;
      if (variantId && c.variant_id !== variantId) return false;
      if (!variantId && c.variant_id) return false;
      if (sacType && c.sac_type !== sacType) return false;
      if (!sacType && c.sac_type) return false;
      return true;
    });

    if (existing) {
      const updateRes = await client.entities.sub_entity_checks.update({
        id: String(existing.id),
        data: { checker_name: checkerName },
      });
      return updateRes.data as SubEntityCheckData;
    }
  } catch {
    /* proceed to create */
  }

  // Create new check — omit null optional fields
  const data = stripNulls({
    session_id: sessionId,
    sub_entity_id: subEntityId,
    variant_id: variantId || undefined,
    sac_type: sacType || undefined,
    checker_name: checkerName,
  });

  const res = await client.entities.sub_entity_checks.create({ data });
  return res.data as SubEntityCheckData;
}

export async function saveInventoryItems(
  sessionId: number,
  subEntityId: string,
  items: { item_id: string; validated: boolean; custom_quantity: string | null }[],
  checkerName?: string,
  variantId?: string | null,
  sacType?: string | null
): Promise<InventoryItemData[]> {
  // Fetch all existing items for this session + sub_entity once (avoid N+1 queries)
  let existingItems: InventoryItemData[] = [];
  try {
    const res = await client.entities.inventory_items.query({
      query: { session_id: String(sessionId), sub_entity_id: subEntityId },
      limit: 500,
    });
    existingItems = (res.data?.items || []) as InventoryItemData[];
  } catch {
    /* proceed without existing data */
  }

  const results: InventoryItemData[] = [];

  for (const itemData of items) {
    try {
      // Find existing item by matching item_id, variant_id, sac_type
      const existing = existingItems.find((ei) => {
        if (ei.item_id !== itemData.item_id) return false;
        if (variantId && ei.variant_id !== variantId) return false;
        if (!variantId && ei.variant_id) return false;
        if (sacType && ei.sac_type !== sacType) return false;
        if (!sacType && ei.sac_type) return false;
        return true;
      });

      if (existing) {
        const updateData = stripNulls({
          validated: itemData.validated,
          custom_quantity: itemData.custom_quantity || undefined,
          checker_name: checkerName || undefined,
        });
        const res = await client.entities.inventory_items.update({
          id: String(existing.id),
          data: updateData,
        });
        results.push(res.data as InventoryItemData);
      } else {
        const createData = stripNulls({
          session_id: sessionId,
          sub_entity_id: subEntityId,
          variant_id: variantId || undefined,
          sac_type: sacType || undefined,
          item_id: itemData.item_id,
          validated: itemData.validated,
          custom_quantity: itemData.custom_quantity || undefined,
          checker_name: checkerName || undefined,
        });
        const res = await client.entities.inventory_items.create({
          data: createData,
        });
        results.push(res.data as InventoryItemData);
      }
    } catch {
      // Skip failed items
    }
  }

  return results;
}

export async function getInventoryItems(
  sessionId: number,
  subEntityId?: string,
  variantId?: string,
  sacType?: string
): Promise<InventoryItemData[]> {
  try {
    const query: Record<string, string> = {
      session_id: String(sessionId),
    };
    if (subEntityId) query.sub_entity_id = subEntityId;
    if (variantId) query.variant_id = variantId;
    if (sacType) query.sac_type = sacType;

    const res = await client.entities.inventory_items.query({
      query,
      limit: 500,
    });
    return (res.data?.items || []) as InventoryItemData[];
  } catch {
    return [];
  }
}

export async function getSession(sessionId: number): Promise<SessionData> {
  const res = await client.entities.inventory_sessions.get({
    id: String(sessionId),
  });
  return res.data as SessionData;
}

// ---------- Inventory Logs (DB-backed, shared across users) ----------

export interface InventoryLogData {
  id: number;
  lot_id: string;
  lot_name: string;
  sub_entity_name: string;
  variant_name: string | null;
  lot_variant_name: string | null;
  sac_type: string | null;
  dps_name: string;
  completed_key: string;
  created_at: string | null;
}

export async function addLogEntryToDb(entry: {
  lot_id: string;
  lot_name: string;
  sub_entity_name: string;
  variant_name?: string | null;
  lot_variant_name?: string | null;
  sac_type?: string | null;
  dps_name: string;
  completed_key: string;
}): Promise<InventoryLogData> {
  // Idempotent: check for existing entry with same completed_key
  try {
    const existing = await client.entities.inventory_logs.query({
      query: { completed_key: entry.completed_key },
      limit: 1,
    });
    const items = (existing.data?.items || []) as InventoryLogData[];
    if (items.length > 0) {
      // Update existing entry
      const updateData = stripNulls({
        lot_name: entry.lot_name,
        sub_entity_name: entry.sub_entity_name,
        variant_name: entry.variant_name || undefined,
        lot_variant_name: entry.lot_variant_name || undefined,
        sac_type: entry.sac_type || undefined,
        dps_name: entry.dps_name,
      });
      const res = await client.entities.inventory_logs.update({
        id: String(items[0].id),
        data: updateData,
      });
      return res.data as InventoryLogData;
    }
  } catch { /* proceed to create */ }

  const data = stripNulls({
    lot_id: entry.lot_id,
    lot_name: entry.lot_name,
    sub_entity_name: entry.sub_entity_name,
    variant_name: entry.variant_name || undefined,
    lot_variant_name: entry.lot_variant_name || undefined,
    sac_type: entry.sac_type || undefined,
    dps_name: entry.dps_name,
    completed_key: entry.completed_key,
  });

  const res = await client.entities.inventory_logs.create({ data });
  return res.data as InventoryLogData;
}

export async function getLogEntriesFromDb(lotId?: string): Promise<InventoryLogData[]> {
  try {
    const query: Record<string, string> = {};
    if (lotId) query.lot_id = lotId;

    const res = await client.entities.inventory_logs.query({
      query: Object.keys(query).length > 0 ? query : undefined,
      sort: "-created_at",
      limit: 500,
    });
    return (res.data?.items || []) as InventoryLogData[];
  } catch {
    return [];
  }
}

export async function clearLogEntriesFromDb(): Promise<void> {
  try {
    const res = await client.entities.inventory_logs.query({ limit: 500 });
    const items = (res.data?.items || []) as InventoryLogData[];
    for (const item of items) {
      await client.entities.inventory_logs.delete({ id: String(item.id) });
    }
  } catch { /* ignore */ }
}

// ---------- Discrepancy Reports (DB-backed, 1 per lot+variant) ----------

export interface DiscrepancyReportData {
  id: number;
  lot_id: string;
  variant_id: string | null;
  report_key: string;
  lot_name: string;
  variant_name: string | null;
  dps_name: string;
  discrepancies_json: string | null;
  full_inventory_json: string | null;
  has_discrepancies: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DiscrepancyItem {
  itemName: string;
  expectedQuantity: number;
  actualQuantity: number;
  location: string;
  subEntityKey?: string;
}

export interface SavedInventoryEntry {
  itemId: string;
  validated: boolean;
  customQuantity: string;
  itemName: string;
  expectedQuantity: number;
  sectionTitle: string;
}

export interface SavedInventory {
  lotId: string;
  subId: string;
  variantId: string | null;
  sacType: string | null;
  lotVariantName: string | null;
  dpsName: string | null;
  entries: SavedInventoryEntry[];
  savedAt: string;
}

/**
 * Save a discrepancy report to DB. 1 report per lot+variant (report_key).
 * If a report with the same report_key exists, the new sub-entity data is merged
 * into the existing report (replacing the entry for the same subId+variantId+sacType).
 * This way, the report accumulates data from all sub-entities verified.
 */
export async function saveDiscrepancyReportToDb(report: {
  lotId: string;
  variantId: string | null;
  lotName: string;
  variantName: string | null;
  dpsName: string;
  discrepancies: DiscrepancyItem[];
  fullInventory: SavedInventory[];
  hasDiscrepancies: boolean;
  reportKeyOverride?: string;
}): Promise<DiscrepancyReportData> {
  const reportKey = report.reportKeyOverride || `${report.lotId}::${report.variantId || ""}`;

  // Try to fetch existing report to merge sub-entity data
  let existingReport: DiscrepancyReportData | null = null;
  try {
    const existing = await client.entities.discrepancy_reports.query({
      query: { report_key: reportKey },
      limit: 1,
    });
    const items = (existing.data?.items || []) as DiscrepancyReportData[];
    if (items.length > 0) {
      existingReport = items[0];
    }
  } catch { /* proceed without existing */ }

  let mergedInventory = report.fullInventory;

  if (existingReport?.full_inventory_json) {
    try {
      const existingInventory: SavedInventory[] = JSON.parse(existingReport.full_inventory_json);
      // Merge: for each new inventory entry, replace existing one with same subId+variantId+sacType key
      const newKeys = new Set(
        report.fullInventory.map(
          (inv) => `${inv.subId}::${inv.variantId || ""}::${inv.sacType || ""}`
        )
      );
      // Keep existing entries that are NOT being replaced
      const kept = existingInventory.filter(
        (inv) => !newKeys.has(`${inv.subId}::${inv.variantId || ""}::${inv.sacType || ""}`)
      );
      mergedInventory = [...kept, ...report.fullInventory];
    } catch { /* use new data if parse fails */ }
  }

  // Recalculate all discrepancies from merged inventory using resolved display names
  const allDiscrepancies: DiscrepancyItem[] = [];
  mergedInventory.forEach((data) => {
    // Resolve sub-entity display name
    const subs = lotSubEntities[data.lotId] || [];
    const sub = subs.find((s) => s.id === data.subId);
    let subLabel = data.subId;
    if (sub) {
      if (data.variantId) {
        const v = sub.variants?.find((vv) => vv.id === data.variantId);
        subLabel = v?.name || data.variantId;
      } else {
        subLabel = sub.name;
      }
    }
    // Include lot variant name (e.g. "VPS Auteuil") for lots with variants
    const lotVariantPart = data.lotVariantName || null;
    const sacLabel =
      data.sacType === "soin" ? "Sac de soin" : data.sacType === "o2" ? "Sac d'O2" : null;
    const locationParts: string[] = [];
    if (lotVariantPart) locationParts.push(lotVariantPart);
    if (subLabel) locationParts.push(subLabel);
    if (sacLabel) locationParts.push(sacLabel);

    data.entries.forEach((entry) => {
      if (!entry.validated && entry.customQuantity.trim()) {
        const actual = parseInt(entry.customQuantity, 10);
        if (!isNaN(actual) && actual !== entry.expectedQuantity) {
          allDiscrepancies.push({
            itemName: entry.itemName,
            expectedQuantity: entry.expectedQuantity,
            actualQuantity: actual,
            location: [...locationParts, entry.sectionTitle].join(" / "),
            subEntityKey: `${data.subId}::${data.variantId || ""}::${data.sacType || ""}`,
          });
        }
      }
    });
  });

  const payload = stripNulls({
    lot_id: report.lotId,
    variant_id: report.variantId || undefined,
    report_key: reportKey,
    lot_name: report.lotName,
    variant_name: report.variantName || undefined,
    dps_name: report.dpsName,
    discrepancies_json: JSON.stringify(allDiscrepancies),
    full_inventory_json: JSON.stringify(mergedInventory),
    has_discrepancies: allDiscrepancies.length > 0,
  });

  if (existingReport) {
    // Update existing report with merged data
    const res = await client.entities.discrepancy_reports.update({
      id: String(existingReport.id),
      data: payload,
    });
    return res.data as DiscrepancyReportData;
  }

  // Create new report
  const res = await client.entities.discrepancy_reports.create({ data: payload });
  return res.data as DiscrepancyReportData;
}

/**
 * Get all discrepancy reports for a given lot.
 */
export async function getDiscrepancyReportsForLot(
  lotId: string
): Promise<DiscrepancyReportData[]> {
  try {
    const res = await client.entities.discrepancy_reports.query({
      query: { lot_id: lotId },
      sort: "-updated_at",
      limit: 100,
    });
    return (res.data?.items || []) as DiscrepancyReportData[];
  } catch {
    return [];
  }
}

/**
 * Get a single discrepancy report by its report_key.
 */
export async function getDiscrepancyReportByKey(
  key: string
): Promise<DiscrepancyReportData | null> {
  try {
    const res = await client.entities.discrepancy_reports.query({
      query: { report_key: key },
      limit: 1,
    });
    const items = (res.data?.items || []) as DiscrepancyReportData[];
    return items.length > 0 ? items[0] : null;
  } catch {
    return null;
  }
}

/**
 * Get all discrepancy reports (for log page to check existence).
 */
export async function getAllDiscrepancyReports(): Promise<DiscrepancyReportData[]> {
  try {
    const res = await client.entities.discrepancy_reports.query({
      sort: "-updated_at",
      limit: 500,
    });
    return (res.data?.items || []) as DiscrepancyReportData[];
  } catch {
    return [];
  }
}

export async function clearAllDiscrepancyReports(): Promise<void> {
  try {
    const res = await client.entities.discrepancy_reports.query({ limit: 500 });
    const items = (res.data?.items || []) as DiscrepancyReportData[];
    for (const item of items) {
      await client.entities.discrepancy_reports.delete({ id: String(item.id) });
    }
  } catch { /* ignore */ }
}

// ---------- Cloud Preferences (replaces localStorage) ----------

export interface PreferenceData {
  id: number;
  pref_key: string;
  pref_value: string;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Get all cloud preferences as a key-value map.
 */
export async function getAllPreferencesFromDb(): Promise<Record<string, string>> {
  try {
    const res = await client.entities.app_preferences.query({ limit: 500 });
    const items = (res.data?.items || []) as PreferenceData[];
    const map: Record<string, string> = {};
    for (const item of items) {
      map[item.pref_key] = item.pref_value;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Get a single cloud preference by key. Returns null if not found.
 */
export async function getPreferenceFromDb(key: string): Promise<string | null> {
  try {
    const res = await client.entities.app_preferences.query({
      query: { pref_key: key },
      limit: 1,
    });
    const items = (res.data?.items || []) as PreferenceData[];
    return items.length > 0 ? items[0].pref_value : null;
  } catch {
    return null;
  }
}

/**
 * Set a cloud preference (upsert). Also migrates from localStorage if present.
 */
export async function setPreferenceInDb(key: string, value: string): Promise<void> {
  try {
    // Try to find existing
    const res = await client.entities.app_preferences.query({
      query: { pref_key: key },
      limit: 1,
    });
    const items = (res.data?.items || []) as PreferenceData[];
    if (items.length > 0) {
      await client.entities.app_preferences.update({
        id: String(items[0].id),
        data: { pref_value: value },
      });
    } else {
      await client.entities.app_preferences.create({
        data: { pref_key: key, pref_value: value },
      });
    }
  } catch { /* ignore */ }
}