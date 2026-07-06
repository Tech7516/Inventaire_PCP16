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

// ---------- API Calls ----------

export async function getActiveSession(lotId: string): Promise<SessionData | null> {
  try {
    const res = await client.apiCall.invoke({
      url: `/api/v1/inventory/active-session/${lotId}`,
      method: "GET",
    });
    return res.data || null;
  } catch {
    return null;
  }
}

export async function createSession(
  lotId: string,
  dpsName: string,
  variantId?: string | null
): Promise<SessionData> {
  const res = await client.apiCall.invoke({
    url: "/api/v1/inventory/create-session",
    method: "POST",
    data: {
      lot_id: lotId,
      dps_name: dpsName,
      variant_id: variantId || null,
    },
  });
  return res.data;
}

export async function abandonSession(sessionId: number): Promise<void> {
  await client.apiCall.invoke({
    url: `/api/v1/inventory/abandon-session/${sessionId}`,
    method: "POST",
  });
}

export async function completeSession(sessionId: number): Promise<SessionData> {
  const res = await client.apiCall.invoke({
    url: "/api/v1/inventory/complete-session",
    method: "POST",
    data: { session_id: sessionId },
  });
  return res.data;
}

export async function getSubEntityChecks(
  sessionId: number
): Promise<SubEntityCheckData[]> {
  try {
    const res = await client.apiCall.invoke({
      url: `/api/v1/inventory/sub-entity-checks/${sessionId}`,
      method: "GET",
    });
    return res.data || [];
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
  const res = await client.apiCall.invoke({
    url: "/api/v1/inventory/mark-sub-entity",
    method: "POST",
    data: {
      session_id: sessionId,
      sub_entity_id: subEntityId,
      variant_id: variantId || null,
      sac_type: sacType || null,
      checker_name: checkerName,
    },
  });
  return res.data;
}

export async function saveInventoryItems(
  sessionId: number,
  subEntityId: string,
  items: { item_id: string; validated: boolean; custom_quantity: string | null }[],
  checkerName?: string,
  variantId?: string | null,
  sacType?: string | null
): Promise<InventoryItemData[]> {
  const res = await client.apiCall.invoke({
    url: "/api/v1/inventory/save-items",
    method: "POST",
    data: {
      session_id: sessionId,
      sub_entity_id: subEntityId,
      variant_id: variantId || null,
      sac_type: sacType || null,
      checker_name: checkerName || null,
      items,
    },
  });
  return res.data;
}

export async function getInventoryItems(
  sessionId: number,
  subEntityId?: string,
  variantId?: string,
  sacType?: string
): Promise<InventoryItemData[]> {
  try {
    let url = `/api/v1/inventory/items/${sessionId}`;
    const params: string[] = [];
    if (subEntityId) params.push(`sub_entity_id=${subEntityId}`);
    if (variantId) params.push(`variant_id=${variantId}`);
    if (sacType) params.push(`sac_type=${sacType}`);
    if (params.length) url += "?" + params.join("&");

    const res = await client.apiCall.invoke({
      url,
      method: "GET",
    });
    return res.data || [];
  } catch {
    return [];
  }
}

export async function getSession(sessionId: number): Promise<SessionData> {
  const res = await client.apiCall.invoke({
    url: `/api/v1/inventory/session/${sessionId}`,
    method: "GET",
  });
  return res.data;
}