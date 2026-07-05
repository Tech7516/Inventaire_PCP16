export interface Lot {
  id: string;
  name: string;
  location: string;
  lastInventory: string | null;
  status: "pending" | "in-progress" | "completed";
}

export interface SubEntity {
  id: string;
  name: string;
  description: string;
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

export const lotSubEntities: Record<string, SubEntity[]> = {
  "lot-001": [
    { id: "pom", name: "POM", description: "Poche oxygène médical" },
    { id: "lot-b", name: "Lot B", description: "" },
    { id: "caisse-1", name: "Caisse 1/2", description: "" },
    { id: "caisse-2", name: "Caisse 2/2", description: "" },
    { id: "materiel-comp", name: "Matériel complémentaire", description: "" },
  ],
};

export const subEntitySections: Record<string, ConsumableSection[]> = {
  pom: [
    {
      id: "section-1g",
      title: "1ère ligne — Pochette de gauche",
      items: [
        { id: "item-001", name: "BAVU adulte", expectedQuantity: 1 },
        { id: "item-002", name: "Masque adulte T4 et T5", expectedQuantity: 1 },
      ],
    },
    {
      id: "section-1m",
      title: "1ère ligne — Pochette du milieu",
      items: [
        { id: "item-003", name: "BAVU pédiatrique", expectedQuantity: 1 },
        { id: "item-004", name: "BAVU nourrisson", expectedQuantity: 1 },
        { id: "item-005", name: "Masque T0 T1 T2 T3", expectedQuantity: 1 },
      ],
    },
    {
      id: "section-1d",
      title: "1ère ligne — Pochette de droite",
      items: [
        { id: "item-006", name: "Jeu de canule", expectedQuantity: 1 },
        { id: "item-007", name: "Recharge AMS", expectedQuantity: 1 },
      ],
    },
    {
      id: "section-2g",
      title: "2ème ligne — Pochette de gauche",
      items: [
        { id: "item-008", name: "MHC adulte", expectedQuantity: 4 },
        { id: "item-009", name: "MMC adulte", expectedQuantity: 4 },
        { id: "item-010", name: "Lunettes O2", expectedQuantity: 3 },
      ],
    },
    {
      id: "section-2m",
      title: "2ème ligne — Pochette du milieu",
      items: [
        { id: "item-011", name: "MHC pédiatrique", expectedQuantity: 3 },
        { id: "item-012", name: "MMC pédiatrique", expectedQuantity: 3 },
      ],
    },
    {
      id: "section-2d",
      title: "2ème ligne — Pochette de droite",
      items: [
        { id: "item-013", name: "Pansement absorbant", expectedQuantity: 5 },
        { id: "item-014", name: "CHU", expectedQuantity: 1 },
        { id: "item-015", name: "GISH", expectedQuantity: 1 },
        { id: "item-016", name: "Pansement israélien", expectedQuantity: 2 },
        { id: "item-017", name: "Garrot tourniquet", expectedQuantity: 2 },
      ],
    },
    {
      id: "section-3g",
      title: "3ème ligne — Pochette de gauche",
      items: [
        { id: "item-018", name: "Tensiomètre manuel", expectedQuantity: 1 },
        { id: "item-019", name: "Jeu de 3 brassards", expectedQuantity: 1 },
        { id: "item-020", name: "Stéthoscope", expectedQuantity: 1 },
      ],
    },
    {
      id: "section-3m",
      title: "3ème ligne — Pochette du milieu",
      items: [
        { id: "item-021", name: "Thermomètre tympanique", expectedQuantity: 1 },
        { id: "item-022", name: "Boîte d'embouts tympaniques", expectedQuantity: 2 },
        { id: "item-023", name: "Oxymètre", expectedQuantity: 1 },
        { id: "item-024", name: "Tensiomètre électronique", expectedQuantity: 1 },
      ],
    },
    {
      id: "section-3d",
      title: "3ème ligne — Pochette de droite",
      items: [
        { id: "item-025", name: "Haricot réutilisable", expectedQuantity: 2 },
        { id: "item-026", name: "Jesco", expectedQuantity: 1 },
        { id: "item-027", name: "Pince à écharde", expectedQuantity: 1 },
        { id: "item-028", name: "Tire-tique", expectedQuantity: 1 },
        { id: "item-029", name: "OPTC", expectedQuantity: 1 },
        { id: "item-030", name: "Sparadrap", expectedQuantity: 2 },
        { id: "item-031", name: "Glucomètre", expectedQuantity: 1 },
        { id: "item-032", name: "Réserve de bandeslettes", expectedQuantity: 2 },
        { id: "item-033", name: "Auto-piqueur", expectedQuantity: 30 },
      ],
    },
    {
      id: "section-4g",
      title: "4ème ligne — Pochette de gauche",
      items: [
        { id: "item-034", name: "Écharpe", expectedQuantity: 5 },
        { id: "item-035", name: "Poche de froid", expectedQuantity: 5 },
        { id: "item-036", name: "Détergent de surface en spray", expectedQuantity: 1 },
        { id: "item-037", name: "Paquet de lingettes nettoyantes", expectedQuantity: 1 },
      ],
    },
    {
      id: "section-4m",
      title: "4ème ligne — Pochette du milieu",
      items: [
        { id: "item-038", name: "Sérum physiologique 5ml", expectedQuantity: 30 },
      ],
    },
    {
      id: "section-4d",
      title: "4ème ligne — Pochette de droite",
      items: [
        { id: "item-039", name: "Lot de 2 compresses stériles", expectedQuantity: 25 },
        { id: "item-040", name: "Boîte de compresses non stériles", expectedQuantity: 1 },
        { id: "item-041", name: "Pansement 20x10cm", expectedQuantity: 5 },
        { id: "item-042", name: "Pansement 10x8cm", expectedQuantity: 5 },
        { id: "item-043", name: "Pansement 7,5x5cm", expectedQuantity: 5 },
        { id: "item-044", name: "Boîte de petits pansements", expectedQuantity: 1 },
        { id: "item-045", name: "SHA", expectedQuantity: 1 },
      ],
    },
    {
      id: "section-5g",
      title: "5ème ligne — Pochette de gauche",
      items: [
        { id: "item-046", name: "Bande 10x4cm", expectedQuantity: 5 },
        { id: "item-047", name: "Bande 6x4cm", expectedQuantity: 5 },
        { id: "item-048", name: "Filet tubulaire de différentes tailles", expectedQuantity: 3 },
        { id: "item-049", name: "Bande cohésive", expectedQuantity: 3 },
      ],
    },
    {
      id: "section-5m",
      title: "5ème ligne — Pochette du milieu",
      items: [
        { id: "item-050", name: "Compresse gel d'eau 20x20cm", expectedQuantity: 1 },
        { id: "item-051", name: "Compresse gel d'eau 10x10cm", expectedQuantity: 2 },
        { id: "item-052", name: "Champ stérile 10x10cm", expectedQuantity: 2 },
        { id: "item-053", name: "Couverture de survie", expectedQuantity: 10 },
        { id: "item-054", name: "Gobelet", expectedQuantity: 20 },
        { id: "item-055", name: "Sucre + touillette", expectedQuantity: 20 },
      ],
    },
    {
      id: "section-5d",
      title: "5ème ligne — Pochette de droite",
      items: [
        { id: "item-056", name: "Sac vomitoire", expectedQuantity: 15 },
        { id: "item-057", name: "Paire de lunettes de protection", expectedQuantity: 4 },
      ],
    },
  ],
  "lot-b": [],
  "caisse-1": [],
  "caisse-2": [],
  "materiel-comp": [],
};