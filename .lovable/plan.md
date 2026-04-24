## Objectif

Ajouter un nouveau filtre « Courses » au panneau de filtres des enchères (mobile et desktop), permettant de :
- rechercher textuellement une ou plusieurs courses,
- filtrer la liste de coureurs en ne montrant que ceux présents sur la startlist d'au moins une course sélectionnée.

## UX

**Desktop (`AuctionSearchFilters.tsx`)** : nouveau bouton/Popover « Courses » placé à côté de « Équipes », identique en comportement (multi-select avec champ de recherche, badges « Tout / Aucun »). Affiche dans le bouton le nombre de courses sélectionnées ou les noms si ≤ 2.

**Mobile (`FiltersDrawer.tsx`)** : nouvelle section « Courses » dans le drawer, juste sous « Équipes », avec champ de recherche + liste cochable scrollable. Compteur dans le badge global du bouton flottant.

**Liste des courses proposées** : courses de la saison de la phase d'enchères en cours, qui ont au moins une startlist importée. Si la ligue a un `selected_course_ids` (cf. `useLeagueFilteredRaces`), on restreint la liste à ce périmètre.

**Comportement de filtrage** : un coureur passe le filtre si son `coureur_id` apparaît dans `startlist_entries` d'au moins une `startlist_imports` rattachée à une des courses cochées (union, pas intersection — cohérent avec les autres filtres existants).

## Implémentation technique

### 1. Backend — Edge Function `auction-search-riders`

Ajouter un paramètre `course_ids: string[] | null` :
- Si fourni et non vide :
  1. Charger `startlist_imports.id` où `race_id IN (course_ids)` AND `saison_id = phase.saison_id`.
  2. Charger `startlist_entries.coureur_id DISTINCT` où `startlist_id IN (...)` AND `coureur_id NOT NULL`.
  3. Si l'ensemble est vide → retourner `items: []`.
  4. Sinon, ajouter `query.in('coureur_id', startlistRiderIds)` à la query principale.
- Logger nb de courses, nb de startlists, nb de coureurs.

### 2. Nouveau hook `useAuctionAvailableCourses(phaseId, leagueId)`

Fichier : `src/hooks/useAuctionAvailableCourses.ts`.
- Récupère `phase.saison_id`.
- Récupère `league_scopes.selected_course_ids` (si `leagueId`).
- Query `startlist_imports` filtrée par `saison_id` + (optionnel) `race_id IN selected_course_ids` → `DISTINCT race_id`.
- Joint `courses` (`id, nom, date_debut`) → retourne `[{ id, nom, date_debut }]` triés par date.
- `staleTime: 5 min`, query key `["auction-available-courses", phaseId, leagueId]`.

### 3. UI — états partagés

Dans `AuctionPageMobile.tsx` et `AuctionPageDesktop.tsx` :
- Nouveau state `selectedCourses: string[]`.
- Ajouter dans la `queryKey` de `auction-search-riders-infinite` et passer `course_ids: selectedCourses.length > 0 ? selectedCourses : null` au body.
- Passer `selectedCourses` / `setSelectedCourses` + `availableCourses` (du hook) aux composants de filtres.

### 4. UI — composants de filtres

**`AuctionSearchFilters.tsx` (desktop)** :
- Nouvelles props `selectedCourses`, `onCoursesChange`, `availableCourses`.
- Nouveau `<Popover>` « Courses » miroir du Popover « Équipes » (Input de recherche, liste cochable, Tout/Aucun, libellé `nom` + petite date à droite).

**`FiltersDrawer.tsx` (mobile)** :
- Mêmes nouvelles props.
- Nouvelle section « Courses » avec Input de recherche + liste de Checkbox scrollable.
- Inclure `selectedCourses.length > 0` dans `hasActiveFilters` et `activeFiltersCount`.
- `clearAllFilters` réinitialise aussi `selectedCourses`.

### 5. Pass-through dans `AuctionTabs.tsx`

Ajouter les nouvelles props et les transmettre à `AuctionSearchFilters`.

### 6. i18n

Ajouter les clés dans `src/i18n/locales/{fr,en}/auction.json` :
- `search.courses` : « Courses » / « Races »
- `search.searchCourse` : « Rechercher une course… » / « Search a race…  »
- `search.coursesCount` : « {{count}} courses » / « {{count}} races »
- `search.noCourseFound` : « Aucune course trouvée » / « No race found »

### 7. Tests manuels

- Cocher 1 course → seuls les coureurs de la startlist apparaissent.
- Cocher 2 courses → union des deux startlists.
- Combiner avec filtres « Équipes », « Côtes », « Catégories » → intersection respectée.
- Vérifier desktop + mobile.
- Ligue avec `selected_course_ids` : seules les courses du scope sont proposées.
- Course sans startlist importée : n'apparaît pas dans la liste.

## Fichiers touchés

- `supabase/functions/auction-search-riders/index.ts`
- `src/hooks/useAuctionAvailableCourses.ts` (nouveau)
- `src/components/auction/v2/AuctionPageMobile.tsx`
- `src/components/auction/v2/AuctionPageDesktop.tsx`
- `src/components/auction/v2/AuctionTabs.tsx`
- `src/components/auction/v2/AuctionSearchFilters.tsx`
- `src/components/auction/v2/FiltersDrawer.tsx`
- `src/i18n/locales/fr/auction.json`
- `src/i18n/locales/en/auction.json`
