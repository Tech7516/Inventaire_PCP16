import { createClient } from "@metagptx/web-sdk";
import { lotSubEntities } from "@/data/lots";

const client = createClient();

// ---------- Types ----------

export interface SessionData {
  id: number;
  lot_id: string;
  variant_id: string | null;
  dps_name: string;
  intervention_type: string | null;
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

// ---------- API helpers (bypass RLS via custom backend routes) ----------

async function inventoryApi<T = any>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  data?: Record<string, unknown>
): Promise<T> {
  const res = await client.apiCall.invoke({
    url: `/api/v1/inventory${path}`,
    method,
    data: data || {},
  });
  return res.data as T;
}

async function sharedApi<T = any>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  data?: Record<string, unknown>
): Promise<T> {
  const res = await client.apiCall.invoke({
    url: `/api/v1/shared${path}`,
    method,
    data: data || {},
  });
  return res.data as T;
}

// ---------- Sessions (collaborative API — bypasses RLS) ----------

export async function getActiveSession(lotId: string): Promise<SessionData | null> {
  try {
    return await inventoryApi<SessionData | null>(
      "GET",
      `/active-session/${encodeURIComponent(lotId)}`
    );
  } catch {
    return null;
  }
}

export async function getAllActiveSessions(): Promise<SessionData[]> {
  try {
    return await inventoryApi<SessionData[]>("GET", "/active-sessions");
  } catch {
    return [];
  }
}

export async function createSession(
  lotId: string,
  dpsName: string,
  variantId?: string | null,
  interventionType?: string | null
): Promise<SessionData> {
  try {
    return await inventoryApi<SessionData>("POST", "/create-session", {
      lot_id: lotId,
      dps_name: dpsName,
      variant_id: variantId || null,
      intervention_type: interventionType || null,
    });
  } catch (e: any) {
    // Re-throw with meaningful message
    const detail = e?.data?.detail || e?.response?.data?.detail || e?.message || "Failed to create session";
    throw new Error(detail);
  }
}

export async function abandonSession(sessionId: number): Promise<void> {
  await inventoryApi("POST", `/abandon-session/${sessionId}`);
}

export async function completeSession(sessionId: number): Promise<SessionData> {
  return await inventoryApi<SessionData>("POST", "/complete-session", {
    session_id: sessionId,
  });
}

export async function getSession(sessionId: number): Promise<SessionData> {
  return await inventoryApi<SessionData>("GET", `/session/${sessionId}`);
}

// ---------- Sub-entity checks (collaborative API — bypasses RLS) ----------

export async function getSubEntityChecks(
  sessionId: number
): Promise<SubEntityCheckData[]> {
  try {
    return await inventoryApi<SubEntityCheckData[]>(
      "GET",
      `/sub-entity-checks/${sessionId}`
    );
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
  return await inventoryApi<SubEntityCheckData>("POST", "/mark-sub-entity", {
    session_id: sessionId,
    sub_entity_id: subEntityId,
    variant_id: variantId || null,
    sac_type: sacType || null,
    checker_name: checkerName,
  });
}

// ---------- Inventory items (collaborative API — bypasses RLS) ----------

export async function saveInventoryItems(
  sessionId: number,
  subEntityId: string,
  items: { item_id: string; validated: boolean; custom_quantity: string | null }[],
  checkerName?: string,
  variantId?: string | null,
  sacType?: string | null
): Promise<InventoryItemData[]> {
  return await inventoryApi<InventoryItemData[]>("POST", "/save-items", {
    session_id: sessionId,
    sub_entity_id: subEntityId,
    variant_id: variantId || null,
    sac_type: sacType || null,
    checker_name: checkerName || null,
    items: items.map((item) => ({
      item_id: item.item_id,
      validated: item.validated,
      custom_quantity: item.custom_quantity || null,
    })),
  });
}

export async function getInventoryItems(
  sessionId: number,
  subEntityId?: string,
  variantId?: string,
  sacType?: string
): Promise<InventoryItemData[]> {
  try {
    const params = new URLSearchParams();
    if (subEntityId) params.set("sub_entity_id", subEntityId);
    if (variantId) params.set("variant_id", variantId);
    if (sacType) params.set("sac_type", sacType);
    const qs = params.toString();
    const path = `/items/${sessionId}${qs ? `?${qs}` : ""}`;
    return await inventoryApi<InventoryItemData[]>("GET", path);
  } catch {
    return [];
  }
}

// ---------- Inventory Logs (SHARED API — bypasses RLS) ----------

export interface InventoryLogData {
  id: number;
  lot_id: string;
  lot_name: string;
  sub_entity_name: string;
  variant_name: string | null;
  lot_variant_name: string | null;
  sac_type: string | null;
  dps_name: string;
  intervention_type: string | null;
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
  intervention_type?: string | null;
  completed_key: string;
}): Promise<InventoryLogData> {
  return await sharedApi<InventoryLogData>("POST", "/logs", {
    lot_id: entry.lot_id,
    lot_name: entry.lot_name,
    sub_entity_name: entry.sub_entity_name,
    variant_name: entry.variant_name || null,
    lot_variant_name: entry.lot_variant_name || null,
    sac_type: entry.sac_type || null,
    dps_name: entry.dps_name,
    intervention_type: entry.intervention_type || null,
    completed_key: entry.completed_key,
  });
}

export async function getLogEntriesFromDb(lotId?: string): Promise<InventoryLogData[]> {
  try {
    const path = lotId ? `/logs?lot_id=${encodeURIComponent(lotId)}` : "/logs";
    return await sharedApi<InventoryLogData[]>("GET", path);
  } catch {
    return [];
  }
}

export async function clearLogEntriesFromDb(): Promise<void> {
  try {
    await sharedApi("DELETE", "/logs");
  } catch {
    /* ignore */
  }
}

// ---------- Discrepancy Reports (SHARED API — bypasses RLS) ----------

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
 * Save a discrepancy report via shared API (bypasses RLS).
 * 1 report per lot+variant (report_key). Merges sub-entity data client-side.
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

  // Fetch existing report via shared API to merge sub-entity data
  let existingReport: DiscrepancyReportData | null = null;
  try {
    existingReport = await sharedApi<DiscrepancyReportData | null>(
      "GET",
      `/reports/${encodeURIComponent(reportKey)}`
    );
  } catch {
    /* proceed without existing */
  }

  let mergedInventory = report.fullInventory;

  if (existingReport?.full_inventory_json) {
    try {
      const existingInventory: SavedInventory[] = JSON.parse(existingReport.full_inventory_json);
      const newKeys = new Set(
        report.fullInventory.map(
          (inv) => `${inv.subId}::${inv.variantId || ""}::${inv.sacType || ""}`
        )
      );
      const kept = existingInventory.filter(
        (inv) => !newKeys.has(`${inv.subId}::${inv.variantId || ""}::${inv.sacType || ""}`)
      );
      mergedInventory = [...kept, ...report.fullInventory];
    } catch {
      /* use new data if parse fails */
    }
  }

  // Recalculate all discrepancies from merged inventory
  const allDiscrepancies: DiscrepancyItem[] = [];
  mergedInventory.forEach((data) => {
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

  // Save via shared API (upsert by report_key)
  return await sharedApi<DiscrepancyReportData>("POST", "/reports", {
    lot_id: report.lotId,
    variant_id: report.variantId || null,
    report_key: reportKey,
    lot_name: report.lotName,
    variant_name: report.variantName || null,
    dps_name: report.dpsName,
    discrepancies_json: JSON.stringify(allDiscrepancies),
    full_inventory_json: JSON.stringify(mergedInventory),
    has_discrepancies: allDiscrepancies.length > 0,
  });
}

/**
 * Get all discrepancy reports for a given lot (shared API).
 */
export async function getDiscrepancyReportsForLot(
  lotId: string
): Promise<DiscrepancyReportData[]> {
  try {
    const all = await sharedApi<DiscrepancyReportData[]>("GET", "/reports");
    return all.filter((r) => r.lot_id === lotId);
  } catch {
    return [];
  }
}

/**
 * Get a single discrepancy report by its report_key (shared API).
 */
export async function getDiscrepancyReportByKey(
  key: string
): Promise<DiscrepancyReportData | null> {
  try {
    return await sharedApi<DiscrepancyReportData | null>(
      "GET",
      `/reports/${encodeURIComponent(key)}`
    );
  } catch {
    return null;
  }
}

/**
 * Get all discrepancy reports (shared API).
 */
export async function getAllDiscrepancyReports(): Promise<DiscrepancyReportData[]> {
  try {
    return await sharedApi<DiscrepancyReportData[]>("GET", "/reports");
  } catch {
    return [];
  }
}

export async function clearAllDiscrepancyReports(): Promise<void> {
  try {
    await sharedApi("DELETE", "/reports");
  } catch {
    /* ignore */
  }
}

// ---------- Cloud Preferences (SHARED API — bypasses RLS) ----------

export interface PreferenceData {
  id: number;
  pref_key: string;
  pref_value: string;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Get all cloud preferences as a key-value map (shared API).
 */
export async function getAllPreferencesFromDb(): Promise<Record<string, string>> {
  try {
    const items = await sharedApi<PreferenceData[]>("GET", "/preferences");
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
 * Get a single cloud preference by key (shared API).
 */
export async function getPreferenceFromDb(key: string): Promise<string | null> {
  try {
    const res = await sharedApi<{ pref_key: string; pref_value: string | null }>(
      "GET",
      `/preferences/${encodeURIComponent(key)}`
    );
    return res.pref_value;
  } catch {
    return null;
  }
}

/**
 * Set a cloud preference (upsert, shared API).
 */
export async function setPreferenceInDb(key: string, value: string): Promise<void> {
  try {
    await sharedApi("POST", "/preferences", {
      pref_key: key,
      pref_value: value,
    });
  } catch {
    /* ignore */
  }
}