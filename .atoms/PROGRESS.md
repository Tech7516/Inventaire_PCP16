---
last_updated: 2026-07-05T12:01:32Z
---

# Requirements & Progress

## Requirements Overview
Application d'inventaire de lots. Page d'accueil avec sélection de lot, page formulaire pour saisir l'inventaire.

## User Stories
- En tant qu'utilisateur, je veux voir la liste des lots disponibles à inventorier
- En tant qu'utilisateur, je veux pouvoir sélectionner un lot et accéder au formulaire d'inventaire
- En tant qu'utilisateur, je veux saisir des articles (nom, quantité, état) dans le formulaire d'inventaire

## Task Breakdown
- [x] Configurer le design system (couleurs, typographie) dans index.css
- [x] Créer la page d'accueil avec les cartes de lots
- [x] Créer la page formulaire d'inventaire
- [x] Configurer le routing entre les pages
- [x] Vérifier lint et build
- [x] Créer les tables DB (inventory_sessions, sub_entity_checks, inventory_items)
- [x] Créer l'API backend custom pour la gestion collaborative des sessions
- [x] Modifier Index.tsx — vérifier session active, rediriger vers DPS en cours
- [x] Modifier SubEntities.tsx — charger état depuis DB, polling, bouton Abandonner
- [x] Modifier Inventory.tsx — sauvegarder items en DB au lieu de localStorage
- [x] Lint + build + vérification
- [x] Supprimer mention "Vérifié par" (pas d'authentification = pas pertinent)
- [x] Optimiser lenteur : remplacer N appels API séquentiels par 1 appel batch /active-sessions
- [x] Optimiser fluidité : ne stocker que les écarts (non-conformes) au lieu de tous les articles consommés
- [x] Ajouter champ "Nom du DPS" sur la page inventaire direct (Lot CAI, Lot V)
- [x] Corriger titre sous-titre inventaire direct (afficher variante au lieu de "Lot V — Passy")
- [x] Optimiser SubEntities : affichage instantané via cache localStorage, vérification en arrière-plan
- [x] Corriger 404 /api/v1/inventory/active-sessions : remplacer client.apiCall.invoke par client.entities.* (CRUD auto-déployé)
- [x] Corriger 422 entity API : stripNulls() pour omettre les champs null (variant_id, sac_type, etc.) des payloads create/update
- [x] Corriger 500 integer=varchar : ajouter _coerce_query_value() dans les 3 services backend pour caster les query params selon le type de colonne
- [x] Décocher consommable → quantité réelle par défaut à "0"
- [x] Rapport d'écart : distinguer surplus (bleu, "Excédent : +N") vs manque (ambre, "Manque : N")
- [x] Journal : ajouter bouton "Rapport" pour revoir les rapports d'écart précédents

## Progress Log
- 2026-07-06: Supprimé mention "Vérifié par : [nom]" sur SubEntities.tsx (pas d'authentification, le nom du DPS n'est pas le nom du vérificateur)
- 2026-07-06: Optimisé lenteur homepage : remplacé N appels API séquentiels (1 par lot) par 1 seul appel batch GET /active-sessions ; handleStartInventory utilise les données déjà chargées au lieu d'un appel API supplémentaire
- 2026-07-06: Implemented collaborative inventory — DB tables (inventory_sessions, sub_entity_checks, inventory_items), custom backend API, frontend pages updated: Index.tsx checks active sessions, SubEntities.tsx requires DPS validation + shows abandon button + polls checks, Inventory.tsx saves items to DB
- 2026-07-05: Journal n'enregistre que lors du clic Sauvegarder/Envoyer (SubEntities) ou enregistrement direct (Lot V); nom DPS inclus; icone utilisateur supprimee; consommables pre-coches conformes par defaut
- 2026-07-05: Added discrepancy report page (/report/:lotId) — lists consumables with differing quantities and their locations; redirects from Sauvegarder/Envoyer (SubEntities) and Enregistrer (Lot V direct inventory); inventory data saved to localStorage for report generation
- 2026-07-05: Added "Télécharger" button on report page to download full inventory summary as .txt file; reset green check marks and DPS name after Sauvegarder/Envoyer
- 2026-07-06: Homepage now shows "Dernière vérification : [date]" from log instead of "Aucun inventaire effectué" ; added Lot CAI with direct inventory (3 sections : Accueil, Consommables, Administratif, 13 articles)
- 2026-07-06: Sub-entities page title: "Lot A — Passy" kept, other lots show just name or variant name (e.g. "VPS Auteuil") without "— Passy" ; VPS Lot B dropdown pre-selected based on homepage VPS variant choice
- 2026-07-06: Added Lot C variants (Alpha/Bravo) on homepage dropdown ; Lot C Lot B now only shows Alpha/Bravo (removed Auteuil/Neuilly) ; POM/Lot B/Caisse dropdowns pre-selected based on Lot C variant choice from homepage
- 2026-07-06: Fixed pre-selection bug — homepage variant now ALWAYS overrides localStorage sub-variant selections (not just when empty) ; added Lot A Lot B pre-selection from homepage ; pre-selected values persisted to localStorage
- 2026-07-05: Projet initialisé avec template frontend React + shadcn/ui
- 2026-07-05: Implémentation terminée - page accueil + formulaire inventaire + routing + design system
- 2026-07-05: Modifications appliquées - localisation "Passy", suppression infos superflues, formulaire inventaire avec validation stock conforme/quantité différente
- 2026-07-05: Titre lot simplifié "Lot A", description supprimée, sections par emplacement ajoutées (pochette gauche/milieu/droite)
- 2026-07-05: Liste consommables mise à jour avec données exactes (BAVU, masques, canule, recharge AMS)
- 2026-07-05: Liste complète 5 lignes x 3 pochettes ajoutée (57 articles) avec corrections orthographiques
- 2026-07-05: Page intermédiaire sous-ensembles ajoutée (POM, Lot B, Caisse 1/2, Caisse 2/2, Matériel complémentaire) — routing 3 niveaux : accueil → sous-ensembles → inventaire
- 2026-07-05: Lot B avec menu déroulant pour variantes (Alpha, Bravo, Auteuil, Neuilly) — toutes partagent les mêmes consommables
- 2026-07-05: Lot B renommé "Choix du lot B", 2 boutons : "Vérifier le sac de soin" + "Vérifier l'inventaire du sac d'O2"
- 2026-07-05: Inventaire Lot B implémenté depuis PDF — sac de soin (51 articles, 9 sections) + sac d'O2 (19 articles, 7 sections), boutons même couleur
- 2026-07-05: Page Lot A : champ "Nom du DPS", coche verte sur sections complétées, bouton "Sauvegarder/Envoyer", sélection Lot B persistée, boutons uniformisés "Vérifier l'inventaire"
- 2026-07-05: Inventaires complétés depuis PDF Lot A — Caisse 1/2 (13 articles, 2 sections), Caisse 2/2 (8 articles, 1 section), Matériel complémentaire (56 articles, 7 sections : bureau, optionnel, local, administratif, réserve, traumatologie, vrac)
- 2026-07-05: Supprimé sections "Dans le bureau", "Local en bas", "Administratif" de Matériel complémentaire ; déplacé "Caisse Réserve", "Caisse Traumatologie", "En vrac" vers Caisse 1/2
- 2026-07-05: Fusionné sections "Pansements et compresses" + "Caisse Réserve" en une seule section "Caisse Réserve" dans Caisse 1/2
- 2026-07-05: Ajouté Lot C avec page intermédiaire — POM (Alpha/Bravo), Lot B (Alpha/Bravo/Auteuil/Neuilly, sac de soin + sac d'O2), Caisse (Alpha/Bravo) ; menus déroulants adaptés par type de sous-ensemble
- 2026-07-05: Corrigé Lot B du Lot A — ajouté inventoryType "lot-b" pour afficher les boutons sac de soin / sac d'O2
- 2026-07-05: POM Lot C différencié du POM Lot A — L1G (BAVU Adulte, Masque T4, Masque T5) et L1M (BAVU Pédiatrique, BAVU Nourrisson, Masque T0, T1, T2)
- 2026-07-05: POM Lot C remplacé par la nouvelle liste complète — 10 sections (L1G à L4D), 32 articles : L1G (protections auditives, sucres, gobelets, vomix), L1M (DASRI, DAOM, SHA, Jesco, Haricot), L1D (CHU, lunettes), L2G (compresses stériles, compresses non stériles, petits pansements), L2M (sérum phy, écharpes, survie), L2D (tensiomètre, thermomètre, glucomètre, autopiqueurs, bandelettes), L3G (bandes 10x6, 6x4, cohésives, sparadraps), L3D (poches de froid), L4G (lingettes, détergent, champs stériles), L4D (gants non stériles)
- 2026-07-05: Ajouté lot VPS sur page principale avec menu déroulant (VPS Auteuil / VPS Neuilly) ; 3 sous-ensembles : Cellule avant, Cellule arrière, Lot B (sac de soin + sac d'O2)
- 2026-07-05: VPS Cellule avant — 2 sections : Admin (7 articles) + Cellule Avant (18 articles : GHV, piles, SHA, projecteur, lunettes, carte essence, couteau, anti-lacrymo, tricoises, crique, gants, gilets pare-balles, cales, triangle, carnet CH, outils, extincteur)
- 2026-07-05: VPS Cellule arrière — 16 sections : Matériel apparent (7), Réserve 1 (7), Réserve 2 (15), Latérale G (14), Latérale D (4), Trauma 1 (6), Trauma 2 (2), Placard 1 (1), Placard 2 (5), Placard 3 (3), Tiroir 1 (14), Tiroir 2 (9), Tiroir 3 (6), Tiroir 4 (5), Caisse Réserve (5)
- 2026-07-05: Ajouté Lot V avec menu déroulant (VL Poussin / VTP Passy) — inventaire direct sans page intermédiaire, 5 sections : Sécurité Hygiène (12), Réanimation (3), Hémorragies (4), Soins Protection (8), Divers (7) = 34 articles
- 2026-07-05: Supprimé localisation "Passy" de tous les lots sauf Lot A ; supprimé badge "À faire" de toutes les cartes
- 2026-07-05: Créé page Journal (/log) — historique des inventaires complétés avec nom du DPS, variante vérifiée, date/heure ; bouton "Journal" dans le header ; bouton "Effacer le journal" ; entrées groupées par lot

