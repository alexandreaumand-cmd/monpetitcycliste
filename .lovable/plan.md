

# Simplification de l'affichage mobile des classements

## Objectif

Améliorer l'affichage étendu des classements managers sur mobile :
- Remplacer le badge "NEW" par un tiret discret
- Remplacer "Position" par "Évolution" dans la grille 2x2

---

## Aperçu visuel

### Avant

```text
Évolution: [NEW]              ← Ligne séparée
Position      % du total
3e            17.0%
Scoreurs      Victoires
8             2
```

### Après

```text
Évolution     % du total      ← Intégré à la grille
—             17.0%
Scoreurs      Victoires
8             2
```

---

## Modifications techniques

### Fichier : `src/pages/Rankings.mobile.tsx`

#### 1. Remplacer le badge NEW par un tiret (lignes 354-374)

Changer le `evolutionBadge` pour afficher un tiret discret au lieu du badge NEW :

```tsx
const evolutionBadge = !selectedPhase && previousGlobalStandings ? (
  isNew ? (
    <span className="text-muted-foreground">—</span>
  ) : evolution !== null && evolution !== 0 ? (
    <div className={`flex items-center gap-1 text-xs font-semibold ${
      evolution > 0 ? "text-green-600" : "text-red-600"
    }`}>
      {evolution > 0 ? (
        <>
          <TrendingUp className="h-3.5 w-3.5" />
          <span>+{evolution}</span>
        </>
      ) : (
        <>
          <TrendingUp className="h-3.5 w-3.5 rotate-180" />
          <span>{Math.abs(evolution)}</span>
        </>
      )}
    </div>
  ) : (
    <span className="text-muted-foreground">—</span>
  )
) : null;
```

#### 2. Supprimer la ligne "Évolution" séparée (lignes 406-412)

Supprimer ce bloc :

```tsx
{/* Evolution badge */}
{evolutionBadge && (
  <div className="flex items-center gap-2">
    <span className="text-muted-foreground text-xs">{t('mobile.evolution')}:</span>
    {evolutionBadge}
  </div>
)}
```

#### 3. Remplacer "Position" par "Évolution" dans la grille (lignes 415-432)

Remplacer :

```tsx
<div className="grid grid-cols-2 gap-3 text-xs">
  <div className="flex flex-col gap-1">
    <span className="text-muted-foreground">{t('mobile.position')}</span>
    <span className="font-semibold">{getRankLabel(rank)}</span>
  </div>
  ...
</div>
```

Par :

```tsx
<div className="grid grid-cols-2 gap-3 text-xs">
  <div className="flex flex-col gap-1">
    <span className="text-muted-foreground">{t('mobile.evolution')}</span>
    <span className="font-semibold">{evolutionBadge || <span className="text-muted-foreground">—</span>}</span>
  </div>
  <div className="flex flex-col gap-1">
    <span className="text-muted-foreground">{t('mobile.totalPercent')}</span>
    <span className="font-semibold">{percentage}%</span>
  </div>
  <div className="flex flex-col gap-1">
    <span className="text-muted-foreground">{t('mobile.scorers')}</span>
    <span className="font-semibold">{standing.nb_scoreurs ?? 0}</span>
  </div>
  <div className="flex flex-col gap-1">
    <span className="text-muted-foreground">{t('mobile.victories')}</span>
    <span className="font-semibold">{standing.nb_victoires ?? 0}</span>
  </div>
</div>
```

---

## Résumé des changements

| Élément | Avant | Après |
|---------|-------|-------|
| Badge NEW | Badge jaune avec bordure noire | Tiret discret `—` |
| Position | Affiché dans la grille (redondant) | Supprimé |
| Évolution | Ligne séparée au-dessus de la grille | Intégré dans la grille 2x2 |
| Grille | 2 colonnes, 4 éléments (Position, %, Scoreurs, Victoires) | 2 colonnes, 4 éléments (Évolution, %, Scoreurs, Victoires) |

