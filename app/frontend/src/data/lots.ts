export interface Lot {
  id: string;
  name: string;
  description: string;
  location: string;
  itemCount: number;
  lastInventory: string | null;
  status: "pending" | "in-progress" | "completed";
}

export const lots: Lot[] = [
  {
    id: "lot-001",
    name: "Lot A - Entrepôt Principal",
    description: "Matériel informatique et bureautique",
    location: "Bâtiment A, Zone 1",
    itemCount: 45,
    lastInventory: null,
    status: "pending",
  },
];