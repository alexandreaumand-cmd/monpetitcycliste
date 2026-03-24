

# Tri du classement managers par points, victoires ou scoreurs

## Problème
Le classement managers est toujours trié par points. L'utilisateur veut pouvoir trier par points, nombre de victoires ou nombre de scoreurs.

## Solution

### 1. Desktop — `src/components/rankings/ManagerStandings.tsx`

- Ajouter un état `sortBy: 'points' | 'victories' | 'scorers'` (défaut: `points`)
- Ajouter un `Select` compact dans le header de la Card (à côté du titre ou dans le header du tableau)
- Trier les standings avec `useMemo` selon le critère choisi :
  - `points` → `total_points` (actuel)
  - `victories` → `nb_victoires`
  - `scorers` → `nb_scoreurs`
- Le rang affiché reflète le tri sélectionné

### 2. Mobile — `src/pages/Rankings.mobile.tsx`

- Ajouter le même état `standingsSortBy`
- Ajouter un petit `Select` au-dessus de la liste des managers (dans le tab `standings`)
- Trier les standings de la même façon avant le `.map()`

### 3. Traductions — `fr/rankings.json` et `en/rankings.json`

Ajouter :
```json
"standings": {
  "sortBy": "Trier par",
  "sortByPoints": "Points",
  "sortByVictories": "Victoires",
  "sortByScorers": "Scoreurs"
}
```

### Fichiers modifiés
- `src/components/rankings/ManagerStandings.tsx`
- `src/pages/Rankings.mobile.tsx`
- `src/i18n/locales/fr/rankings.json`
- `src/i18n/locales/en/rankings.json`

