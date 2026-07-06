import { createClient } from "@metagptx/web-sdk";

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