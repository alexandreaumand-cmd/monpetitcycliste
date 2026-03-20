

## Plan : Uniformiser les valeurs `type_course` dans la base et le code

### État actuel

6 variantes coexistent dans la table `courses` :

```text
type_course       | count
------------------+------
etapes            |    60
one day race      |    50
one_day           |   153
One-day race      |   122
stage_race        |    14
Stages race       |    69
```

Cela vient d'imports successifs (CSV, scraping PCS, formulaire admin) qui utilisaient chacun leur propre convention.

### Solution

**Valeurs canoniques** : `one_day` et `stage_race` (déjà utilisées par le formulaire admin dans `CoursesManager.tsx`).

**1. Migration SQL — normaliser les données existantes**

```sql
UPDATE courses SET type_course = 'stage_race' 
WHERE type_course IN ('etapes', 'Stages race');

UPDATE courses SET type_course = 'one_day' 
WHERE type_course IN ('one day race', 'One-day race');
```

Résultat : toutes les courses auront `one_day` (325) ou `stage_race` (143).

**2. Mettre à jour `courseType.ts`** — adapter `normalizeCourseType` pour reconnaître les valeurs canoniques en priorité et rester rétrocompatible avec d'éventuelles nouvelles entrées mal formatées.

**3. Mettre à jour `RouteImageUploader.tsx`** — utiliser `isStageRace()` (déjà prévu, correction précédente non encore appliquée).

**4. Mettre à jour le template CSV** (`exportTemplates.ts`) — utiliser `stage_race` au lieu de `etapes`.

**5. Mettre à jour les vues SQL** — les vues utilisent déjà `ILIKE '%stage%'` et `ILIKE '%one%'`, donc elles fonctionneront toujours. Pas de modification nécessaire, mais la normalisation rend ces patterns plus simples et fiables.

**6. Vérifier `ManagerComparison.tsx`** — remplacer le hardcoded `c.type_course === "One-day race"` par un check via `isStageRace`.

### Fichiers impactés
- Migration SQL (UPDATE des données)
- `src/lib/courseType.ts` — léger ajustement
- `src/components/startlist/RouteImageUploader.tsx` — utiliser `isStageRace()`
- `src/lib/exportTemplates.ts` — template CSV
- `src/components/rankings/ManagerComparison.tsx` — filtre hardcodé
- `src/components/calendar/CalendarCourseDialog.tsx` — affichage badge `type_course` brut → utiliser `normalizeCourseType().display`

