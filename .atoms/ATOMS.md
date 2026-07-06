---
last_updated: 2026-07-05T12:01:32Z
status: active
---

# Project Context

## Project Overview
Application web d'inventaire de lots (PCP16) pour la gestion collaborative d'inventaires. Page d'accueil avec sélection de lot, page sous-ensembles, formulaire d'inventaire, rapport d'écart et journal d'intervention. Données stockées en BDD (Atoms Cloud) pour visibilité partagée entre utilisateurs.

## Key Decisions
| Date | Decision | By | Rationale |
|------|----------|-----|-----------|
| 2026-07-05 | React + TypeScript + Vite + shadcn/ui | Alex | Template frontend standard |
| 2026-07-05 | Atoms Cloud backend (DB, Auth) | Alex | Persistance partagée, pas de localStorage |
| 2026-07-06 | 1 rapport d'écart par lot+variante en BDD | Alex | Éviter duplication, alléger BDD |
| 2026-07-06 | Regroupement journal personnalisé | Alex | VPS Auteuil, VPS Neuilly, Lot A, Lot C Alpha/Bravo, Lot B, Lot V |

## Constraints
- Pas d'authentification utilisateur (nom DPS saisi manuellement)
- Lots B toujours regroupés dans section Lot B du journal
- Cellule avant/arrière va dans VPS Auteuil ou Neuilly selon variante sélectionnée


