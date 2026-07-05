export interface Lot {
  id: string;
  name: string;
  description: string;
  location: string;
  lastInventory: string | null;
  status: "pending" | "in-progress" | "completed";
}

export interface ConsumableItem {
  id: string;
  name: string;
  expectedQuantity: number;
}

export const lots: Lot[] = [
  {
    id: "lot-001",
    name: "Lot A - Passy",
    description: "Consommables médicaux",
    location: "Passy",
    lastInventory: null,
    status: "pending",
  },
];

export const lotConsumables: Record<string, ConsumableItem[]> = {
  "lot-001": [
    { id: "item-001", name: "Sérum physiologique", expectedQuantity: 30 },
    { id: "item-002", name: "Compresses stériles", expectedQuantity: 50 },
    { id: "item-003", name: "Gants nitrile (boîte)", expectedQuantity: 20 },
    { id: "item-004", name: "Sparadrap", expectedQuantity: 15 },
    { id: "item-005", name: "Désinfectant", expectedQuantity: 10 },
  ],
};