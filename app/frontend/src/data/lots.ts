export interface Lot {
  id: string;
  name: string;
  location: string;
  lastInventory: string | null;
  status: "pending" | "in-progress" | "completed";
}

export interface ConsumableItem {
  id: string;
  name: string;
  expectedQuantity: number;
}

export interface ConsumableSection {
  id: string;
  title: string;
  items: ConsumableItem[];
}

export const lots: Lot[] = [
  {
    id: "lot-001",
    name: "Lot A",
    location: "Passy",
    lastInventory: null,
    status: "pending",
  },
];

export const lotSections: Record<string, ConsumableSection[]> = {
  "lot-001": [
    {
      id: "section-1",
      title: "1ère ligne pochette de Gauche",
      items: [
        { id: "item-001", name: "Sérum physiologique", expectedQuantity: 30 },
        { id: "item-002", name: "Compresses stériles", expectedQuantity: 50 },
      ],
    },
    {
      id: "section-2",
      title: "1ère ligne pochette du Milieu",
      items: [
        { id: "item-003", name: "Gants nitrile (boîte)", expectedQuantity: 20 },
        { id: "item-004", name: "Sparadrap", expectedQuantity: 15 },
      ],
    },
    {
      id: "section-3",
      title: "1ère ligne pochette de Droite",
      items: [
        { id: "item-005", name: "Désinfectant", expectedQuantity: 10 },
      ],
    },
  ],
};