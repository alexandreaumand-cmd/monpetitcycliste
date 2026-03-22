

# Détection et affichage des équipes confirmées (tick vert PCS)

## Concept

Sur ProCyclingStats, les équipes dont la composition est officiellement confirmée ont un **tick vert** (✓) à côté du nom. Le scraper actuel ignore cette information. L'objectif est de :
1. Scraper cette info depuis PCS
2. La stocker en base
3. L'afficher dans les différents écrans de l'app

## Changements techniques

### 1. Scraper — `supabase/functions/startlist-tracker/index.ts`

Modifier `parseStartlistHtml` pour retourner un champ `team_confirmed: boolean` par coureur. Sur PCS, le tick vert est un élément HTML dans le bloc équipe (class contenant `icon` ou `tick` ou un `✓`). Le parser itèrera sur les blocs équipe, détectera la présence de cet indicateur, et propagera `team_confirmed` à tous les coureurs de l'équipe.

Nouveau type de retour : `{ rider_name: string; team_name: string; team_confirmed: boolean }`

### 2. Base de données — Migration SQL

Ajouter une colonne `team_confirmed` (boolean, default `false`) à la table `startlist_entries`. Cette colonne sera mise à jour à chaque scrape.

### 3. Sync — `syncCourseStartlist`

- Lors de l'insertion de nouveaux riders, stocker `team_confirmed`
- Lors des re-scrapes, **mettre à jour** `team_confirmed` sur les entrées existantes (un team peut passer de non-confirmé à confirmé entre deux scrapes)

### 4. Edge function `startlist-manager-view`

Inclure `team_confirmed` dans le select des entries, et le propager dans les données retournées (starters et managers.starters).

### 5. Affichage UI — Tous les écrans

**Indicateur visuel** : Un petit ✓ vert discret à côté du nom de l'équipe ou du coureur, indiquant que sa composition d'équipe est officiellement confirmée.

**Écrans impactés :**

| Écran | Emplacement | Affichage |
|-------|-------------|-----------|
| **Startlist Mobile** (user view) | Liste des coureurs dans l'accordion manager | Petit badge ✓ vert à côté du nom du coureur si `team_confirmed` |
| **Startlist Desktop** (user view) | Grille des managers, liste coureurs | Idem |
| **StartlistDesktopExport** (image export) | Liste des coureurs par manager | ✓ vert à côté du nom |
| **Admin StartlistDetailView** | Vue SuperAdmin des partants | ✓ vert + compteur "X/Y équipes confirmées" dans les stats |
| **Calendrier Startlist** (cards) | Badge sur la carte de la course | Indicateur "X/Y équipes ✓" si disponible |
| **Sans propriétaire** | Liste des coureurs sans manager | ✓ vert à côté du badge nom |

**Légende** : Un petit texte explicatif "✓ = composition d'équipe confirmée officiellement" sera affiché en bas de la section partants.

### Fichiers modifiés

- `supabase/functions/startlist-tracker/index.ts` — Parser + sync
- `supabase/functions/startlist-manager-view/index.ts` — Inclure `team_confirmed`
- `src/components/startlist/StartlistDesktopExport.tsx` — Affichage ✓
- `src/pages/Startlist.mobile.tsx` — Affichage ✓
- `src/pages/Startlist.desktop.tsx` — Affichage ✓
- `src/components/admin/StartlistDetailView.tsx` — Stats + affichage
- Migration SQL — Nouvelle colonne

