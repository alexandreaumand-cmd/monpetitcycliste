## Objectif

Permettre, dans l'onglet **Top Coureurs** du Classement, de filtrer les coureurs par **une ou plusieurs courses** et/ou **une ou plusieurs catégories** (ex. voir uniquement les top coureurs de l'Itzulia Basque Country).

Approche choisie : **filtrage côté serveur dans l'edge function `get-top-riders`**, sans modifier la RPC SQL `get_top_riders_optimized`. Cela évite une migration et garde le chemin RPC ultra-rapide quand aucun filtre additionnel n'est appliqué.

---

## 1. Edge function `supabase/functions/get-top-riders/index.ts`

Ajouter deux paramètres optionnels au body :

- `course_ids?: string[]`
- `categories?: string[]`

Comportement :
- **Aucun des deux fourni** → comportement actuel inchangé (appel RPC `get_top_riders_optimized`).
- **L'un ou l'autre fourni** → bypass de la RPC, agrégation directe :
  1. Récupérer la liste des courses autorisées via `get_league_course_ids(league_id)`.
  2. Intersecter avec `course_ids` si fourni.
  3. Restreindre au scope de phase (phase unique ou toutes les phases de la saison).
  4. Filtrer par `categories` via `courses.categorie` si fourni.
  5. Appliquer le filtre `started_at_effective` de la ligue.
  6. Agréger `points_ledger` (paginé, chunk de 200 course_ids) → `total_points`, `courses_count` par coureur.
  7. Enrichir avec nom du coureur, équipe spécifique à la saison (`coureurs_saisons` + `equipes_saisons`), `prix_initial`.
- La logique en aval (calcul `prix_achat`, `ratio_points_par_prix`, owners depuis rosters) reste identique. Les owners restent ceux du roster de la phase / saison (non re-scopés à la course pour rester cohérent avec le reste de l'écran).

## 2. Front desktop — `src/components/rankings/TopRiders.tsx`

- Ajouter deux états : `selectedCourseIds: string[]`, `selectedCategories: string[]`.
- Nouvelle requête React Query `available-courses` qui charge les courses du périmètre courant :
  - Filtre par `phase_id` (si phase active) ou `phases.saison_id = saisonId`.
  - Restreint à `selected_course_ids` de `league_scopes` si présent (sinon toutes les courses du scope).
  - Renvoie `id`, `nom`, `categorie`, `date_debut`, `phase_id`.
- Deux boutons filtre `Popover` à côté du champ recherche (au-dessus du tableau) :
  - **Courses** : `Command` + `CommandInput` + `Checkbox` par course (groupées par catégorie). Badge avec compteur quand n>0.
  - **Catégories** : liste déduite des courses disponibles avec `Checkbox`. Badge compteur.
- Bouton « Réinitialiser » visible si au moins un filtre actif.
- Passer `course_ids` et `categories` à l'edge function ; ajouter au `queryKey` pour bonne invalidation.
- Quand un filtre est actif :
  - `total_points`, `ratio_points_par_prix`, `courses_count` reflètent automatiquement le périmètre filtré (calculés serveur).
  - Les owners restent ceux des rosters de phase / saison.

## 3. Front mobile — `src/pages/Rankings.mobile.tsx`

- Ajouter les mêmes états `selectedCourseIds` / `selectedCategories`.
- Bouton filtre dans la barre d'actions Top Coureurs ouvrant un `Sheet` (drawer bas) avec la même UI que desktop adaptée tactile (listes scrollables + checkboxes).
- Compteur de filtres actifs dans le bouton.
- Passer les filtres dans le `queryKey` et le body de l'invocation `get-top-riders`.

## 4. i18n — `src/i18n/locales/{fr,en}/rankings.json`

Ajouter sous `topRiders` :

```json
"filterCourses": "Courses",
"filterCategories": "Catégories",
"filterCoursesPlaceholder": "Filtrer par course...",
"filterCategoriesPlaceholder": "Filtrer par catégorie...",
"filterReset": "Réinitialiser",
"filterActiveCount": "{{count}} sélectionné(s)",
"filterNoResults": "Aucune course trouvée"
```

Et l'équivalent anglais (`Courses`, `Categories`, `Filter by race...`, `Filter by category...`, `Reset`, `{{count}} selected`, `No race found`).

## 5. Validation post-implémentation

- Lancer `get-top-riders` via `supabase--curl_edge_functions` avec :
  - aucun filtre (régression),
  - `course_ids: ["<id_itzulia>"]`,
  - `categories: ["WT Cat 1"]`,
  - les deux combinés.
- Vérifier que le front reflète les bons totaux et que la combinaison `Sans manager` + filtres fonctionne.

## Hors scope

- Pas de modification de la RPC SQL `get_top_riders_optimized` (donc pas de migration).
- Pas de filtre sur la pop-up de détail d'un coureur (qui reste sur l'historique complet).
- Pas de filtre sur l'onglet Managers / Hebdo / Chrono / Comparaison.
