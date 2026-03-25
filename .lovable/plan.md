

# Filtrer les courses déjà commencées ou du jour

## Problème
Le filtre actuel exclut uniquement les courses terminées (`date_fin < today`). Les courses en cours ou débutant aujourd'hui restent sélectionnables, ce qui est incohérent puisque les points ont déjà commencé à être comptabilisés.

## Solution

Dans `src/components/leagues/CourseSelector.tsx`, modifier le filtre (ligne 70-72) pour exclure toute course dont `date_debut <= today` :

```typescript
const startDate = c.date_debut;
return startDate ? startDate > today : true;
```

Cela ne garde que les courses dont la date de début est **strictement après aujourd'hui**.

## Fichier modifié
- `src/components/leagues/CourseSelector.tsx` — ligne 70-72

