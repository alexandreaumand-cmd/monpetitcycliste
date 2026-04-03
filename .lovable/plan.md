

# Fix : Affichage des numéros de phases

## Problème
Les `index_dans_saison` en base sont **1-based** (1, 2, 3, 4, 5). Le code d'affichage fait `index_dans_saison + 1`, ce qui décale tout d'un cran :
- Phase index 2 → affiche "Phase 3 (en cours)" au lieu de "Phase 2 (en cours)"
- Phase index 5 → affiche "Phase 6" (n'existe pas)

## Correction

**Fichier** : `src/components/leagues/CreateLeagueDialog.tsx` (ligne 355-357)

Remplacer :
```tsx
{phase.index_dans_saison === 0
  ? t('settings.startingPhaseDefault')
  : t('settings.startingPhaseOption', { num: phase.index_dans_saison + 1 })}
```

Par :
```tsx
{t('settings.startingPhaseOption', { num: phase.index_dans_saison })}
```

Le check `=== 0` est inutile car les indices commencent à 1. Le `+ 1` est le bug.

**Résultat attendu** : Phase 2 (en cours), Phase 3, Phase 4, Phase 5.

