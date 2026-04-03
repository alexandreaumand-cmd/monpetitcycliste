

# Fix : Sélecteur de phase de départ

## Problème
Le filtre actuel (`statut !== 'completed'`) se base sur le champ `statut` des phases, qui est incorrect dans l'environnement de test (P3-P5 de 2026 marquées `completed` alors que leurs dates sont futures). En production aussi, seul le statut `active` de P2 est correct — les phases futures n'ont pas de statut fiable.

## Solution
Remplacer le filtre par statut par un **filtre par date** : afficher toutes les phases dont `date_fin >= aujourd'hui`. C'est plus robuste car indépendant du cron qui met à jour les statuts.

## Changement

**Fichier** : `src/components/leagues/CreateLeagueDialog.tsx` (lignes 80-101)

- Remplacer le filtre `(data || []).filter(p => p.statut !== 'completed')` par `(data || []).filter(p => new Date(p.date_fin) >= new Date(new Date().toDateString()))`
- Ajouter `date_fin` dans le SELECT (déjà présent via `date_debut`, ajouter `date_fin`)
- Pour le label "(en cours)", garder la vérification `statut === 'active'` ou calculer : `date_debut <= today && date_fin >= today`
- Filtrer aussi par `saison_id` correspondant à la saison 2026 (déjà fait via `seasonId`)

Résultat : les phases 2, 3, 4, 5 seront affichées, avec Phase 2 marquée "(en cours)".

