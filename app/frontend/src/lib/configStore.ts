import { createClient } from "@metagptx/web-sdk";
import {
  lots as staticLots,
  lotSubEntities as staticSubEntities,
  subEntitySections as staticSections,
  type Lot,
  type SubEntity,
  type ConsumableSection,
  type LotVariant,
  type SubEntityVariant,
  type ConsumableItem,
} from "@/data/lots";

const client = createClient();

// ---------- Types ----------

export interface LotConfig {
  lot: Lot;
  subEntities: SubEntity[];
  sections: Record<string, ConsumableSection[]>;
}

export interface LotConfigData {
  id: number;
  lot_id: string;
  lot_name: string;
  location: string | null;
  config_json: string | null;
  is_custom: boolean | null;
}

// ---------- Helpers ----------

/** Convert static lots data into a LotConfig for a given lotId */
function staticToConfig(lotId: string): LotConfig | null {
  const lot = staticLots.find((l) => l.id === lotId);
  if (!lot) return null;
  const subEntities = staticSubEntities[lotId] || [];
  const sections: Record<string, ConsumableSection[]> = {};
  for (const sub of subEntities) {
    const subSections = staticSections[sub.id];
    if (subSections) {
      sections[sub.id] = subSections;
    }
    // Handle lot-b type with soin/o2/dsa variants
    if (sub.inventoryType === "lot-b") {
      const soinKey = `${sub.id}-soin`;
      const o2Key = `${sub.id}-o2`;
      const dsaKey = `${sub.id}-dsa`;
      if (staticSections[soinKey]) sections[soinKey] = staticSections[soinKey];
      if (staticSections[o2Key]) sections[o2Key] = staticSections[o2Key];
      if (staticSections[dsaKey]) sections[dsaKey] = staticSections[dsaKey];
    }
  }
  // Direct inventory lots store sections under the lot id itself
  if (lot.directInventory && staticSections[lotId]) {
    sections[lotId] = staticSections[lotId];
  }
  return { lot, subEntities, sections };
}

// ---------- Public API ----------

/** Load all lot configs from DB, merged with static data */
export async function loadAllLotConfigs(): Promise<LotConfig[]> {
  const dbConfigs: LotConfigData[] = [];
  try {
    const res = await client.apiCall.invoke("GET", "/api/v1/shared/lot-configs");
    if (res && Array.isArray(res)) {
      dbConfigs.push(...(res as LotConfigData[]));
    }
  } catch {
    // DB not available, use static only
  }

  const result: LotConfig[] = [];
  const seenLotIds = new Set<string>();

  // First, add DB configs (these override static ones)
  for (const dbConfig of dbConfigs) {
    try {
      const parsed = JSON.parse(dbConfig.config_json || "{}") as LotConfig;
      if (parsed.lot && parsed.lot.id) {
        result.push(parsed);
        seenLotIds.add(parsed.lot.id);
      }
    } catch {
      // skip invalid JSON
    }
  }

  // Then, add static configs that are not overridden by DB
  for (const staticLot of staticLots) {
    if (!seenLotIds.has(staticLot.id)) {
      const config = staticToConfig(staticLot.id);
      if (config) {
        result.push(config);
      }
    }
  }

  return result;
}

/** Load a single lot config by lotId */
export async function loadLotConfig(lotId: string): Promise<LotConfig | null> {
  // Try DB first (shared API bypasses RLS)
  try {
    const res = await client.apiCall.invoke("GET", `/api/v1/shared/lot-configs/${lotId}`);
    if (res && res.config_json) {
      const parsed = JSON.parse(res.config_json) as LotConfig;
      if (parsed.lot && parsed.lot.id) return parsed;
    }
  } catch {
    // fall through to static
  }

  // Fallback to static
  return staticToConfig(lotId);
}

/** Get merged lots list (for homepage display) */
export async function getMergedLots(): Promise<Lot[]> {
  const configs = await loadAllLotConfigs();
  return configs.map((c) => c.lot);
}

/** Get merged sub-entities for a lot */
export async function getMergedSubEntities(lotId: string): Promise<SubEntity[]> {
  const config = await loadLotConfig(lotId);
  return config?.subEntities || staticSubEntities[lotId] || [];
}

/** Get merged sections for a sub-entity (or lot id for direct inventory) */
export async function getMergedSections(subEntityId: string): Promise<ConsumableSection[]> {
  // Try to find in DB configs (shared API bypasses RLS)
  try {
    const res = await client.apiCall.invoke("GET", "/api/v1/shared/lot-configs");
    if (res && Array.isArray(res)) {
      const items = res as LotConfigData[];
      for (const item of items) {
        if (item.config_json) {
          try {
            const parsed = JSON.parse(item.config_json) as LotConfig;
            if (parsed.sections && parsed.sections[subEntityId]) {
              return parsed.sections[subEntityId];
            }
          } catch {
            // skip
          }
        }
      }
    }
  } catch {
    // fall through
  }

  // Fallback to static
  return staticSections[subEntityId] || [];
}

/** Save a lot config to DB (create or update) via shared API */
export async function saveLotConfig(config: LotConfig): Promise<void> {
  const configJson = JSON.stringify(config);
  const lotId = config.lot.id;

  await client.apiCall.invoke("POST", "/api/v1/shared/lot-configs", {
    lot_id: lotId,
    config_json: configJson,
  });
}

/** Delete a lot config from DB via shared API */
export async function deleteLotConfig(lotId: string): Promise<void> {
  try {
    await client.apiCall.invoke("DELETE", `/api/v1/shared/lot-configs/${lotId}`);
  } catch {
    // ignore
  }
}

/** Generate a unique ID for new entities */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a new empty lot config */
export function createEmptyLotConfig(lotId: string, lotName: string): LotConfig {
  return {
    lot: {
      id: lotId,
      name: lotName,
      location: "",
      lastInventory: null,
      status: "pending",
      directInventory: true,
    },
    subEntities: [],
    sections: {},
  };
}

/** Create a new empty sub-entity */
export function createEmptySubEntity(subId: string, name: string): SubEntity {
  return {
    id: subId,
    name,
    description: "",
  };
}

/** Create a new empty section */
export function createEmptySection(sectionId: string, title: string): ConsumableSection {
  return {
    id: sectionId,
    title,
    items: [],
  };
}

/** Create a new empty item */
export function createEmptyItem(itemId: string, name: string): ConsumableItem {
  return {
    id: itemId,
    name,
    expectedQuantity: 1,
  };
}

/** Create a new empty variant */
export function createEmptyVariant(variantId: string, name: string): LotVariant {
  return { id: variantId, name };
}

/** Create a new empty sub-entity variant */
export function createEmptySubVariant(variantId: string, name: string): SubEntityVariant {
  return { id: variantId, name };
}