---
last_updated: 2026-07-05T12:01:32Z
---

# Architecture Design

## System Overview
Application web d'inventaire de lots. 3 pages : accueil (sélection de lot) → sous-ensembles (POM, Lot B, Caisses, Matériel complémentaire) → formulaire d'inventaire.

## Tech Stack
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- React Router pour la navigation

## Module Design
| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| Pages | Vues principales | src/pages/Index.tsx, src/pages/SubEntities.tsx, src/pages/Inventory.tsx |
| Routing | Navigation | src/App.tsx |
| Data | Données des lots | src/data/lots.ts |

## Tech Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| State management | Local state (useState) | App simple, pas besoin de store global |
| Routing | React Router | Déjà inclus dans le template |
| Design | Product register, clean industrial | App utilitaire, focus sur l'efficacité |

## File Tree Plan
```
src/
├── App.tsx (routing)
├── pages/
│   ├── Index.tsx (page accueil - sélection lot)
│   ├── SubEntities.tsx (sous-ensembles du lot)
│   └── Inventory.tsx (formulaire inventaire)
├── data/
│   └── lots.ts (données des lots)
└── index.css (design tokens)
```

## Implementation Guide
1. Configurer les couleurs et typographie dans index.css
2. Créer les données de lots dans src/data/lots.ts
3. Implémenter la page d'accueil avec cartes cliquables
4. Implémenter le formulaire d'inventaire
5. Configurer le routing dans App.tsx

