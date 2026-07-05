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
      title: "1ère ligne — Pochette de gauche",
      items: [
        { id: "item-001", name: "BAVU adulte", expectedQuantity: 1 },
        { id: "item-002", name: "Masque Adulte T4 et T5", expectedQuantity: 1 },
      ],
    },
    {
      id: "section-2",
      title: "1ère ligne — Pochette du milieu",
      items: [
        { id: "item-003", name: "BAVU pédiatrique", expectedQuantity: 1 },
        { id: "item-004", name: "BAVU nourrisson", expectedQuantity: 1 },
        { id: "item-005", name: "Masque T0 T1 T2 T3", expectedQuantity: 1 },
      ],
    },
    {
      id: "section-3",
      title: "1ère ligne — Pochette de droite",
      items: [
        { id: "item-006", name: "Jeu de canule", expectedQuantity: 1 },
        { id: "item-007", name: "Recharge AMS", expectedQuantity: 1 },
      ],
    },
  ],
};