

## Supprimer le nombre de coureurs du Peloton

### Problème

Le groupe Peloton affiche un chiffre de coureurs (ex: "150") qui est incorrect et absent de PCS.

### Changements dans `src/components/arena/RaceSituationDisplay.tsx`

**1. Badge gauche (ligne 108-110)** : ne pas afficher le count `(N)` sous le badge quand `isPeloton` est true :
```typescript
{!group.isPeloton && (
  <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
    ({group.riderCount || group.riders.length})
  </span>
)}
```

**2. Label "N coureurs" (lignes 122-126)** : supprimer le bloc qui affiche `{group.riderCount} coureurs` pour le peloton. Garder juste le label "PELOTON" via le group name.

### Fichier impacté
- `src/components/arena/RaceSituationDisplay.tsx`

