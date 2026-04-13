

# Plan : Refonte mobile de l'écran Super-Admin Ligues

## Objectif
Remplacer le tableau avec scroll latéral par des **cartes empilées sur mobile** affichant toutes les infos demandées, tout en gardant le tableau sur desktop. Ajouter le tri par date de création, la liste des membres, et les courses sélectionnées.

## Modifications

### 1. Edge function `admin-leagues-list/index.ts`
- Enrichir la requête pour inclure `league_scopes(selected_course_ids)` et `league_members(user_id)` (pas juste le count)
- Après la requête, résoudre les `selected_course_ids` en noms via une requête batch sur `courses`
- Résoudre les `user_id` des membres en noms via une requête batch sur `managers`
- Ajouter un paramètre `sort_order` (asc/desc) pour le tri par `created_at`
- Retourner pour chaque ligue : `member_names: string[]`, `course_names: string[]` en plus des données existantes

### 2. `SuperAdminLeaguesTable.tsx` — Refonte complète
- Ajouter un state `sortOrder` (asc/desc) pour le tri par date de création
- Ajouter un bouton de tri dans les filtres

**Desktop (sm+)** : garder le tableau existant, ajouter les colonnes manquantes (mode, visibilité, date sont déjà là mais hidden) — les rendre toutes visibles

**Mobile (<sm)** : remplacer le tableau par des **cartes** (`div` avec les classes Card) :
- Nom de la ligue + badge statut
- Propriétaire (nom + email)
- Badges : mode de jeu, visibilité (publique/privée)
- Date de création (formatée)
- Barre de progression membres (X/Y)
- Section dépliable "Membres" avec la liste des noms
- Section dépliable "Courses" (si mode per_course) avec les noms des courses en badges
- Bouton actions (menu existant)

### 3. Rendu attendu sur mobile (393px)
Chaque ligue = une carte verticale avec toutes les infos visibles sans scroll horizontal. Les sections membres et courses sont dans des `Collapsible` pour ne pas surcharger l'écran.

## Fichiers modifiés
1. `supabase/functions/admin-leagues-list/index.ts` — enrichir les données
2. `src/components/admin/leagues/SuperAdminLeaguesTable.tsx` — layout responsive cards/table

