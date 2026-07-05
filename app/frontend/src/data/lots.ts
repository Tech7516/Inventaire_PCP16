export interface Lot {
  id: string;
  name: string;
  location: string;
  lastInventory: string | null;
  status: "pending" | "in-progress" | "completed";
}

export interface SubEntityVariant {
  id: string;
  name: string;
}

export interface SubEntity {
  id: string;
  name: string;
  description: string;
  variants?: SubEntityVariant[];
  inventoryType?: "standard" | "lot-b";
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
  {
    id: "lot-003",
    name: "Lot C",
    location: "Passy",
    lastInventory: null,
    status: "pending",
  },
];

export const lotSubEntities: Record<string, SubEntity[]> = {
  "lot-001": [
    { id: "pom", name: "POM", description: "Poche oxygène médical" },
    {
      id: "lot-b",
      name: "Lot B",
      description: "",
      inventoryType: "lot-b",
      variants: [
        { id: "alpha", name: "Lot B Alpha" },
        { id: "bravo", name: "Lot B Bravo" },
        { id: "auteuil", name: "Lot B Auteuil" },
        { id: "neuilly", name: "Lot B Neuilly" },
      ],
    },
    { id: "caisse-1", name: "Caisse 1/2", description: "" },
    { id: "caisse-2", name: "Caisse 2/2", description: "" },
    { id: "materiel-comp", name: "Matériel complémentaire", description: "" },
  ],
  "lot-003": [
    {
      id: "pom-c",
      name: "POM",
      description: "",
      variants: [
        { id: "alpha", name: "POM Alpha" },
        { id: "bravo", name: "POM Bravo" },
      ],
    },
    {
      id: "lot-b-c",
      name: "Lot B",
      description: "",
      inventoryType: "lot-b",
      variants: [
        { id: "alpha", name: "Lot B Alpha" },
        { id: "bravo", name: "Lot B Bravo" },
        { id: "auteuil", name: "Lot B Auteuil" },
        { id: "neuilly", name: "Lot B Neuilly" },
      ],
    },
    {
      id: "caisse-c",
      name: "Caisse",
      description: "",
      variants: [
        { id: "alpha", name: "Caisse Alpha" },
        { id: "bravo", name: "Caisse Bravo" },
      ],
    },
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
  // Lot B — sac de soin (tous les Lot B contiennent les mêmes articles)
  "lot-b-soin": [
    {
      id: "lb-soin-ext",
      title: "Poche extérieure",
      items: [
        { id: "lb-s-001", name: "Combinaison", expectedQuantity: 1 },
        { id: "lb-s-002", name: "Lampe frontale", expectedQuantity: 1 },
        { id: "lb-s-003", name: "Haricot réutilisable", expectedQuantity: 1 },
        { id: "lb-s-004", name: "Bouteille d'eau 50cl", expectedQuantity: 1 },
        { id: "lb-s-005", name: "Gobelet", expectedQuantity: 5 },
        { id: "lb-s-006", name: "Rouleau de rubalise", expectedQuantity: 1 },
        { id: "lb-s-007", name: "Drap UU", expectedQuantity: 1 },
      ],
    },
    {
      id: "lb-soin-filets",
      title: "Filets latéraux",
      items: [
        { id: "lb-s-008", name: "Ciseaux Jesco", expectedQuantity: 1 },
        { id: "lb-s-009", name: "Sac vomitoire", expectedQuantity: 3 },
        { id: "lb-s-010", name: "Couverture de survie", expectedQuantity: 1 },
        { id: "lb-s-011", name: "Sachet de 4 paires de gants", expectedQuantity: 1 },
        { id: "lb-s-012", name: "Gel hydroalcoolique 100 ml", expectedQuantity: 1 },
        { id: "lb-s-013", name: "Boîte OPTC", expectedQuantity: 1 },
        { id: "lb-s-014", name: "Sachet sucre et touillettes", expectedQuantity: 15 },
      ],
    },
    {
      id: "lb-soin-zip-noir",
      title: "Zip Noir",
      items: [
        { id: "lb-s-015", name: "DASRI", expectedQuantity: 3 },
        { id: "lb-s-016", name: "DAOM", expectedQuantity: 3 },
        { id: "lb-s-017", name: "Bloc de fiche bil", expectedQuantity: 1 },
        { id: "lb-s-018", name: "Paire de gants de maintenance", expectedQuantity: 2 },
      ],
    },
    {
      id: "lb-soin-rabat-rouge",
      title: "Rabat rouge",
      items: [
        { id: "lb-s-019", name: "Thermomètre axillaire", expectedQuantity: 1 },
        { id: "lb-s-020", name: "Saturomètre", expectedQuantity: 1 },
        { id: "lb-s-021", name: "Thermomètre tympanique", expectedQuantity: 1 },
        { id: "lb-s-022", name: "Boîte d'embouts tympaniques", expectedQuantity: 1 },
        { id: "lb-s-023", name: "Glucomètre", expectedQuantity: 1 },
        { id: "lb-s-024", name: "Boîte de bandelettes", expectedQuantity: 1 },
        { id: "lb-s-025", name: "Auto-piqueur", expectedQuantity: 5 },
      ],
    },
    {
      id: "lb-soin-poche-rouge",
      title: "Poche Rouge",
      items: [
        { id: "lb-s-026", name: "Pansement absorbant 20x40", expectedQuantity: 2 },
        { id: "lb-s-027", name: "C.H.U", expectedQuantity: 1 },
        { id: "lb-s-028", name: "Pansement israélien", expectedQuantity: 2 },
        { id: "lb-s-029", name: "Pansement imbibé de substance hémostatique", expectedQuantity: 1 },
        { id: "lb-s-030", name: "Garrot", expectedQuantity: 2 },
      ],
    },
    {
      id: "lb-soin-rabat-bleu",
      title: "Rabat bleu",
      items: [
        { id: "lb-s-031", name: "Manomètre + brassard moyen", expectedQuantity: 1 },
        { id: "lb-s-032", name: "Jeu de 3 brassards", expectedQuantity: 1 },
        { id: "lb-s-033", name: "Stéthoscope", expectedQuantity: 1 },
      ],
    },
    {
      id: "lb-soin-poche-jaune",
      title: "Poche Jaune",
      items: [
        { id: "lb-s-034", name: "Pince à échardes", expectedQuantity: 1 },
        { id: "lb-s-035", name: "Tire-tique", expectedQuantity: 1 },
        { id: "lb-s-036", name: "Rouleau de sparadrap", expectedQuantity: 2 },
        { id: "lb-s-037", name: "Compresse stérile par 2", expectedQuantity: 20 },
        { id: "lb-s-038", name: "Boîte de compresses non stériles", expectedQuantity: 1 },
        { id: "lb-s-039", name: "Sérum physiologique unidose 5ml", expectedQuantity: 10 },
        { id: "lb-s-040", name: "Boîte de pansements", expectedQuantity: 1 },
        { id: "lb-s-041", name: "Coalgan", expectedQuantity: 2 },
      ],
    },
    {
      id: "lb-soin-poche-bleue",
      title: "Poche Bleue",
      items: [
        { id: "lb-s-042", name: "Poche de froid", expectedQuantity: 3 },
        { id: "lb-s-043", name: "Écharpe triangulaire", expectedQuantity: 2 },
        { id: "lb-s-044", name: "Bande cohésive", expectedQuantity: 2 },
        { id: "lb-s-045", name: "Bande 6x4", expectedQuantity: 2 },
        { id: "lb-s-046", name: "Bande 10x4", expectedQuantity: 2 },
      ],
    },
    {
      id: "lb-soin-poche-verte",
      title: "Poche Verte",
      items: [
        { id: "lb-s-047", name: "Masque chirurgical", expectedQuantity: 4 },
        { id: "lb-s-048", name: "Masque FFP2/3", expectedQuantity: 4 },
        { id: "lb-s-049", name: "Pansement 7,2x5", expectedQuantity: 3 },
        { id: "lb-s-050", name: "Pansement 10x8", expectedQuantity: 3 },
        { id: "lb-s-051", name: "Pansement 20x10", expectedQuantity: 3 },
      ],
    },
  ],
  // Lot B — sac d'O2
  "lot-b-o2": [
    {
      id: "lb-o2-ext",
      title: "Poche extérieure",
      items: [
        { id: "lb-o-001", name: "Couverture bactério", expectedQuantity: 1 },
        { id: "lb-o-002", name: "Drap UU", expectedQuantity: 1 },
      ],
    },
    {
      id: "lb-o2-filets",
      title: "Filets",
      items: [
        { id: "lb-o-003", name: "Collier cervical adulte", expectedQuantity: 1 },
        { id: "lb-o-004", name: "Collier cervical pédiatrique", expectedQuantity: 1 },
        { id: "lb-o-005", name: "Couverture de survie", expectedQuantity: 1 },
      ],
    },
    {
      id: "lb-o2-interieur",
      title: "Intérieur",
      items: [
        { id: "lb-o-006", name: "Bouteille d'O2", expectedQuantity: 1 },
        { id: "lb-o-007", name: "Cardio-pompe", expectedQuantity: 1 },
      ],
    },
    {
      id: "lb-o2-poche-verte",
      title: "Poche Verte",
      items: [
        { id: "lb-o-008", name: "MHC adulte", expectedQuantity: 2 },
        { id: "lb-o-009", name: "MMC adulte", expectedQuantity: 2 },
        { id: "lb-o-010", name: "Lunettes d'O2", expectedQuantity: 2 },
      ],
    },
    {
      id: "lb-o2-poche-bleue",
      title: "Poche Bleue",
      items: [
        { id: "lb-o-011", name: "MHC pédiatrique", expectedQuantity: 2 },
        { id: "lb-o-012", name: "MMC pédiatrique", expectedQuantity: 2 },
        { id: "lb-o-013", name: "BAVU pédiatrique + T3", expectedQuantity: 1 },
        { id: "lb-o-014", name: "Masque d'insufflation T2 et T0", expectedQuantity: 2 },
      ],
    },
    {
      id: "lb-o2-grande-poche-bleue",
      title: "Grande poche bleue",
      items: [
        { id: "lb-o-015", name: "Boîte de canules de Guedel", expectedQuantity: 1 },
        { id: "lb-o-016", name: "Paire de lunettes", expectedQuantity: 2 },
        { id: "lb-o-017", name: "BAVU néonat + T1", expectedQuantity: 1 },
      ],
    },
    {
      id: "lb-o2-poche-superieure",
      title: "Poche supérieure",
      items: [
        { id: "lb-o-018", name: "BAVU adulte relié à l'O2", expectedQuantity: 1 },
        { id: "lb-o-019", name: "Masque d'insufflation T5 et T4", expectedQuantity: 2 },
      ],
    },
  ],
  "lot-b": [],
  "caisse-1": [
    {
      id: "c1-kits",
      title: "Les kits",
      items: [
        { id: "c1-001", name: "Kit pharmacie", expectedQuantity: 1 },
        { id: "c1-002", name: "Kit accouchement", expectedQuantity: 1 },
        { id: "c1-003", name: "Kit AERV", expectedQuantity: 1 },
        { id: "c1-004", name: "Kit de risque biologique renforcé", expectedQuantity: 1 },
        { id: "c1-005", name: "Kit SNV", expectedQuantity: 1 },
        { id: "c1-006", name: "Kit membre arraché", expectedQuantity: 1 },
      ],
    },
    {
      id: "c1-reserve",
      title: "Caisse Réserve",
      items: [
        { id: "c1-007", name: "Pansement 20x10", expectedQuantity: 5 },
        { id: "c1-008", name: "Pansement 10x8", expectedQuantity: 5 },
        { id: "c1-009", name: "Pansement 7,5x5", expectedQuantity: 5 },
        { id: "c1-010", name: "Boîte de compresses non stériles", expectedQuantity: 1 },
        { id: "c1-011", name: "Compresses stériles par 2", expectedQuantity: 50 },
        { id: "c1-012", name: "Sac vomitoire", expectedQuantity: 10 },
        { id: "c1-013", name: "Poche de froid", expectedQuantity: 5 },
        { id: "c1-014", name: "Rouleau de sparadrap", expectedQuantity: 2 },
        { id: "c1-015", name: "Protection auditive", expectedQuantity: 20 },
        { id: "c1-016", name: "Bande élastique", expectedQuantity: 3 },
        { id: "c1-017", name: "Bande S", expectedQuantity: 5 },
        { id: "c1-018", name: "Bande L", expectedQuantity: 5 },
        { id: "c1-019", name: "Sérum physiologique", expectedQuantity: 20 },
        { id: "c1-020", name: "Boîte de petits pansements", expectedQuantity: 1 },
      ],
    },
    {
      id: "c1-traumato",
      title: "Caisse Traumatologie",
      items: [
        { id: "c1-021", name: "Poche de froid instantanée", expectedQuantity: 10 },
        { id: "c1-022", name: "Couverture de survie", expectedQuantity: 10 },
        { id: "c1-023", name: "Écharpe", expectedQuantity: 5 },
      ],
    },
    {
      id: "c1-vrac",
      title: "En vrac",
      items: [
        { id: "c1-024", name: "Boîte de masques FFP2", expectedQuantity: 1 },
        { id: "c1-025", name: "Boîte de masques chirurgicaux", expectedQuantity: 1 },
        { id: "c1-026", name: "Drap UU", expectedQuantity: 10 },
        { id: "c1-027", name: "Eau (litres)", expectedQuantity: 6 },
        { id: "c1-028", name: "Boîte de gants non stériles", expectedQuantity: 8 },
        { id: "c1-029", name: "Rouleau DASRI", expectedQuantity: 2 },
        { id: "c1-030", name: "Rouleau DAOM", expectedQuantity: 2 },
        { id: "c1-031", name: "SHA", expectedQuantity: 1 },
        { id: "c1-032", name: "Couverture bactériostatique", expectedQuantity: 2 },
        { id: "c1-033", name: "Paquet de lingettes de nettoyage", expectedQuantity: 1 },
        { id: "c1-034", name: "Détergent surfaces hautes en spray", expectedQuantity: 1 },
        { id: "c1-035", name: "Savon liquide", expectedQuantity: 1 },
        { id: "c1-036", name: "Lot de papier absorbant", expectedQuantity: 1 },
        { id: "c1-037", name: "Paire de gants de déblai", expectedQuantity: 2 },
        { id: "c1-038", name: "Rouleau de rubalise", expectedQuantity: 1 },
        { id: "c1-039", name: "Cardio-pompe", expectedQuantity: 1 },
      ],
    },
  ],
  "caisse-2": [
    {
      id: "c2-attelles",
      title: "Attelles et immobilisation",
      items: [
        { id: "c2-001", name: "Attelle à dépression", expectedQuantity: 3 },
        { id: "c2-002", name: "Attelle Cervico-Thoracique", expectedQuantity: 1 },
        { id: "c2-003", name: "Immobilisateur de tête cuillère", expectedQuantity: 1 },
        { id: "c2-004", name: "PDIT (Plan d'Immobilisation de Tête)", expectedQuantity: 1 },
        { id: "c2-005", name: "Sangle araignée", expectedQuantity: 1 },
        { id: "c2-006", name: "Collier cervical adulte", expectedQuantity: 1 },
        { id: "c2-007", name: "Collier cervical pédiatrique", expectedQuantity: 1 },
        { id: "c2-008", name: "Alaise portoir souple", expectedQuantity: 1 },
      ],
    },
  ],
  "materiel-comp": [
    {
      id: "mc-optionnel",
      title: "Optionnel — demande de l'OPE ou CP",
      items: [
        { id: "mc-001", name: "Tente + murs + poids + flamme + pieds", expectedQuantity: 1 },
        { id: "mc-002", name: "Table (avec tabourets)", expectedQuantity: 1 },
        { id: "mc-003", name: "Multiprise", expectedQuantity: 1 },
        { id: "mc-004", name: "Chauffage", expectedQuantity: 1 },
        { id: "mc-005", name: "Péli", expectedQuantity: 1 },
      ],
    },
  ],
};

// Lot C — POM (liste spécifique au Lot C)
subEntitySections["pom-c"] = [
  {
    id: "pomc-1g",
    title: "1ère ligne — Pochette de gauche",
    items: [
      { id: "pomc-001", name: "Protection auditive", expectedQuantity: 10 },
      { id: "pomc-002", name: "Sucre et touillette", expectedQuantity: 20 },
      { id: "pomc-003", name: "Gobelet", expectedQuantity: 10 },
      { id: "pomc-004", name: "Sac vomitoire", expectedQuantity: 10 },
    ],
  },
  {
    id: "pomc-1m",
    title: "1ère ligne — Pochette du milieu",
    items: [
      { id: "pomc-005", name: "Rouleau DASRI", expectedQuantity: 1 },
      { id: "pomc-006", name: "Rouleau DAOM", expectedQuantity: 1 },
      { id: "pomc-007", name: "SHA", expectedQuantity: 1 },
      { id: "pomc-008", name: "Jesco", expectedQuantity: 1 },
      { id: "pomc-009", name: "Haricot réutilisable", expectedQuantity: 1 },
    ],
  },
  {
    id: "pomc-1d",
    title: "1ère ligne — Pochette de droite",
    items: [
      { id: "pomc-010", name: "CHU", expectedQuantity: 1 },
      { id: "pomc-011", name: "Paire de lunettes de protection", expectedQuantity: 2 },
    ],
  },
  {
    id: "pomc-2g",
    title: "2ème ligne — Pochette de gauche",
    items: [
      { id: "pomc-012", name: "Compresse stérile", expectedQuantity: 25 },
      { id: "pomc-013", name: "Paquet de compresses non stériles", expectedQuantity: 1 },
      { id: "pomc-014", name: "Boîte de petits pansements", expectedQuantity: 1 },
    ],
  },
  {
    id: "pomc-2m",
    title: "2ème ligne — Pochette du milieu",
    items: [
      { id: "pomc-015", name: "Sérum physiologique", expectedQuantity: 30 },
      { id: "pomc-016", name: "Écharpe", expectedQuantity: 3 },
      { id: "pomc-017", name: "Couverture de survie", expectedQuantity: 10 },
    ],
  },
  {
    id: "pomc-2d",
    title: "2ème ligne — Pochette de droite",
    items: [
      { id: "pomc-018", name: "Tensiomètre électronique", expectedQuantity: 1 },
      { id: "pomc-019", name: "Thermomètre tympanique", expectedQuantity: 1 },
      { id: "pomc-020", name: "Boîte d'embouts tympaniques", expectedQuantity: 1 },
      { id: "pomc-021", name: "Glucomètre", expectedQuantity: 1 },
      { id: "pomc-022", name: "Auto-piqueur", expectedQuantity: 10 },
      { id: "pomc-023", name: "Boîte de bandelettes", expectedQuantity: 1 },
    ],
  },
  {
    id: "pomc-3g",
    title: "3ème ligne — Pochette de gauche",
    items: [
      { id: "pomc-024", name: "Bande 10x6", expectedQuantity: 5 },
      { id: "pomc-025", name: "Bande 6x4", expectedQuantity: 5 },
      { id: "pomc-026", name: "Bande cohésive", expectedQuantity: 2 },
      { id: "pomc-027", name: "Rouleau de sparadrap", expectedQuantity: 2 },
    ],
  },
  {
    id: "pomc-3d",
    title: "3ème ligne — Pochette de droite",
    items: [
      { id: "pomc-028", name: "Poche de froid", expectedQuantity: 10 },
    ],
  },
  {
    id: "pomc-4g",
    title: "4ème ligne — Pochette de gauche",
    items: [
      { id: "pomc-029", name: "Paquet de lingettes de nettoyage", expectedQuantity: 1 },
      { id: "pomc-030", name: "Détergent surfaces hautes en spray", expectedQuantity: 1 },
      { id: "pomc-031", name: "Champ stérile 10x10", expectedQuantity: 2 },
    ],
  },
  {
    id: "pomc-4d",
    title: "4ème ligne — Pochette de droite",
    items: [
      { id: "pomc-032", name: "Boîte de gants non stériles", expectedQuantity: 4 },
    ],
  },
];
subEntitySections["lot-b-c-soin"] = subEntitySections["lot-b-soin"];
subEntitySections["lot-b-c-o2"] = subEntitySections["lot-b-o2"];
subEntitySections["caisse-c"] = [];