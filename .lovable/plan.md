

# Optimiser CalendarPage pour mobile + ajouter équipes confirmées

## Problème

`CalendarPage.tsx` utilise un tableau HTML (`<Table>`) sur toutes les tailles d'écran. Sur mobile (393px), les colonnes sont compressées et illisibles (screenshot). De plus, aucune information sur les équipes confirmées n'est affichée.

## Solution

### 1. Layout responsive — remplacer le tableau par des cards sur mobile

Dans `CalendarPage.tsx`, détecter `isMobile` et afficher :
- **Mobile** : liste de cards compactes (nom, catégorie badge, countdown badge, points, nb équipes confirmées)
- **Desktop** : garder le tableau existant, ajouter une colonne "Équipes ✓"

Les filtres sur mobile seront simplifiés : search + chips horizontaux pour catégorie/phase + toggle "masquer passées", au lieu des selects empilés verticalement.

### 2. Récupérer le nombre d'équipes confirmées par course

Dans la query `queryFn` existante (lignes 111-190), après avoir récupéré les `startlist_imports`, faire une requête groupée sur `startlist_entries` pour compter les équipes confirmées par course :

```sql
-- Pour chaque course ayant un startlist_import, compter les équipes distinctes
-- et les équipes distinctes avec team_confirmed = true
```

Stocker dans `CourseWithPoints` deux nouveaux champs : `confirmed_teams` et `total_teams`.

### 3. Affichage des équipes confirmées

- **Mobile card** : petit badge vert "X/Y ✓" si des données existent
- **Desktop table** : nouvelle colonne avec badge "X/Y" équipes confirmées
- Si aucune startlist → pas de badge affiché

### 4. Traductions

Ajouter dans `fr/calendar.json` et `en/calendar.json` :
- `table.confirmedTeams`: "Équipes ✓" / "Teams ✓"

### Fichiers modifiés

- `src/pages/CalendarPage.tsx` — layout responsive + fetch confirmed teams + affichage
- `src/i18n/locales/fr/calendar.json` — nouvelles clés
- `src/i18n/locales/en/calendar.json` — nouvelles clés

