# Données & Maintenance : correction de l'onglet Saisons + épuration

## 1. Le bug de l'onglet « Saisons » (confirmé)

Vérifié dans l'aperçu : l'écran affiche « Aucune saison terminée », « Aucune saison active » et « Aucune phase créée pour cette saison », alors que la base contient bien des phases pour 2024, 2025 et 2026 (visibles dans la requête réseau `phases?select=id,index_dans_saison,saisons(annee)` qui répond correctement).

Cause : collision de cache React Query. Trois composants affichés sur la même page utilisent la même clé `['saisons']` avec des requêtes différentes :

- `SeasonManager` demande `saisons` **avec** les phases imbriquées ;
- `SeasonDeleteManager` (rendu à l'intérieur de `SeasonManager`) demande seulement `id, annee` ;
- `CoursesResetManager` demande `saisons` sans phases.

Le premier résultat arrivé écrase l'autre : les saisons se retrouvent sans tableau `phases`, donc tous les compteurs et listes de phases sont vides.

Correction : donner des clés de cache distinctes et explicites (`['saisons', 'with-phases']` pour `SeasonManager`, `['saisons', 'list']` pour `SeasonDeleteManager`), et invalider les deux clés après création de saison/phase ou suppression. Aucun changement de schéma ni de logique métier.

## 2. Rapport : ce qu'on peut supprimer pour épurer

Éléments obsolètes ou redondants repérés dans « Données & Maintenance » :

| Élément | Constat | Proposition |
| --- | --- | --- |
| Maintenance > Configuration > « Mise à jour des phases des courses » | Appelle `update-race-phases`, qui réassigne les courses via un mapping de noms de courses figé en dur dans le code (saison d'origine). Inutilisable et risqué sur 2026. | Supprimer la section (et la fonction associée dans un second temps) |
| Maintenance > Danger Zone > « Nettoyer Courses et Phases » | Supprime toutes les courses et phases de toutes les saisions, rend rosters/enchères orphelins. La « Zone dangereuse » de l'onglet Saisons fait déjà une suppression propre, saison par saison. | Supprimer |
| `AuctionResetManager` | Importé dans `MaintenanceTabs` mais jamais affiché. | Supprimer l'import et le fichier |
| `CoursesResetManager` | Composant orphelin, plus référencé nulle part. | Supprimer le fichier |
| Import > sections Courses / Coureurs / Équipes / Barèmes | Doublons des écrans dédiés (Courses, Coureurs, Équipes, Barèmes) qui gèrent déjà la création et l'édition. | À conserver pour l'instant (utile pour les gros imports de début de saison), à revoir si jamais utilisés |
| Import > Rosters / Résultats | Les rosters viennent des enchères et les résultats de la saisie/scraping ; un import CSV brut contourne les triggers de points. | Supprimer (à confirmer) |
| Export complet de la base | La liste des tables exportées est figée à 43 tables et ne contient plus les tables récentes (arène, pronostics, tweets, e-mails, blessures, planning live…) : la sauvegarde est incomplète. | Rendre la liste dynamique (lecture du catalogue) plutôt que codée en dur |

## 3. Ce que je propose de faire maintenant

1. Corriger les clés de cache pour que l'onglet Saisons affiche à nouveau les phases (saisons passées / en cours / à venir + liste des phases par saison).
2. Retirer les éléments morts et dangereux listés ci-dessus : section « Mise à jour des phases des courses », section « Nettoyer Courses et Phases », `AuctionResetManager`, `CoursesResetManager`.
3. Rendre l'export complet de la base exhaustif (toutes les tables publiques, sans liste figée).

Les points marqués « à confirmer » (suppression des imports Rosters/Résultats) attendent ta validation avant suppression.

## Détails techniques

- `src/components/admin/SeasonManager.tsx` : clé `['saisons','with-phases']`, invalidations mises à jour.
- `src/components/admin/SeasonDeleteManager.tsx` : clé `['saisons','list']` + invalidation des deux clés.
- `src/components/admin/MaintenanceTabs.tsx` : suppression de l'onglet Configuration réduit à la bannière d'annonce, retrait de `PhaseUpdateSection`, `CleanupSection`, import `AuctionResetManager`.
- Fichiers supprimés : `maintenance/PhaseUpdateSection.tsx`, `maintenance/CleanupSection.tsx`, `AuctionResetManager.tsx`, `CoursesResetManager.tsx`.
- `supabase/functions/export-all-tables/index.ts` : remplacement du tableau `TABLES` par une découverte dynamique des tables du schéma public (via une fonction SQL de listage en `security definer` réservée aux superadmins), fallback sur la liste actuelle en cas d'échec.
