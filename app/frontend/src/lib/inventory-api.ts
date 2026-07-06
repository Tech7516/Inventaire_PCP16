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

  const res = await client.entities.inventory_sessions.create({
    data: {
      lot_id: lotId,
      dps_name: dpsName,
      variant_id: variantId || null,
      status: "active",
    },
  });
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

  // Create new check
  const res = await client.entities.sub_entity_checks.create({
    data: {
      session_id: sessionId,
      sub_entity_id: subEntityId,
      variant_id: variantId || null,
      sac_type: sacType || null,
      checker_name: checkerName,
    },
  });
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
        const res = await client.entities.inventory_items.update({
          id: String(existing.id),
          data: {
            validated: itemData.validated,
            custom_quantity: itemData.custom_quantity,
            ...(checkerName ? { checker_name: checkerName } : {}),
          },
        });
        results.push(res.data as InventoryItemData);
      } else {
        const res = await client.entities.inventory_items.create({
          data: {
            session_id: sessionId,
            sub_entity_id: subEntityId,
            variant_id: variantId || null,
            sac_type: sacType || null,
            item_id: itemData.item_id,
            validated: itemData.validated,
            custom_quantity: itemData.custom_quantity,
            checker_name: checkerName || null,
          },
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