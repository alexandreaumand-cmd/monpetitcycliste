# Ligue Legacy : données parasites sur la saison 2026

## Ce que disent les données

La déclaration officielle de la ligue est bien 2025 : dans `league_scopes`, la Ligue Legacy est rattachée à la saison **2025**.

Mais ses effectifs, eux, ne sont pas tous en 2025 :

```text
saison | phase | nb d'effectifs (Ligue Legacy)
2025   | P1    | 300
2025   | P2    | 300
2025   | P3    | 300
2025   | P4    | 300
2025   | P5    | 300
2026   | P1    | 115   <-- anomalie
```

Ces 115 lignes concernent 4 managers (Alex 30, Ludo 30, Max 28, Matt B 27) et sont rattachées à la **phase P1 de la saison 2026**, plus une enchère clôturée sur cette même phase 2026, **sans aucune offre associée** (0 enchère posée).

C'est uniquement de là que venait l'affichage « P1 2026 · Ligue Legacy » dans la fiche manager : la stat « meilleur ratio all-time » lit les effectifs du manager, tombe sur ces lignes Legacy rattachées à une phase 2026, et récupère les points 2026 du coureur (d'où le 1461 pts de Pellizzari, qui sont en réalité les points de la saison 2026, pas de Legacy).

Donc : rien ne « dit » que Legacy est une ligue 2026 — c'est bien une ligue 2025, mais elle traîne un reliquat de données rattaché à une phase 2026.

## Correction proposée

Nettoyer le reliquat, sans toucher au calcul des stats (qui reste sur toutes les phases de toutes les ligues comme demandé) :

1. Supprimer les 115 lignes d'effectifs de la Ligue Legacy rattachées à la phase P1 2026.
2. Supprimer l'enchère Legacy rattachée à cette phase 2026 (elle est vide : aucune offre).
3. Vérifier après nettoyage qu'il ne reste plus aucune donnée Legacy hors saison 2025 (effectifs, enchères, offres, points).

Aucun effectif ni enchère de la saison 2025 n'est touché, et aucune autre ligue n'est concernée.

## Détails techniques

- Suppressions ciblées via `run_sql` (opérations sur données, pas de migration) :
  - `DELETE FROM rosters WHERE league_id = <Legacy> AND phase_id = <P1 2026>`
  - `DELETE FROM auctions WHERE league_id = <Legacy> AND phase_id = <P1 2026>`
- `get_manager_extra_stats` reste inchangée (le filtre par saison de ligue ajouté plus tôt a déjà été retiré).
- Contrôles de vérification : recomptage des effectifs Legacy par saison, et relecture de `get_manager_extra_stats` pour un manager Legacy afin de confirmer que le libellé all-time ne mentionne plus « 2026 · Ligue Legacy » à tort.
