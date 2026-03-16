

## Redesign des vignettes "Fun Awards" (RankingsKPIs)

### Probleme
Les cartes utilisent des gradients jaune/bleu/vert génériques (Tailwind par defaut) qui ne correspondent pas a la charte La Bordure (Green, Gold, Rose, Cream).

### Proposition de design

Approche unifiee et elegante : toutes les cartes partagent le meme style La Bordure, differenciees uniquement par leur emoji.

```text
┌─────────────────────────────────┐
│  bg-bordure-cream / border-l-4 bordure-gold
│                                 
│  😂  LE PLUS DROLE              ← Montserrat uppercase, text-bordure-green
│                                 
│  ┌─ Avatar ─ Team Majer ──────┐ ← fond blanc, border bordure-gold/30
│  └─────────────────────────────┘
│                                 
└─────────────────────────────────┘
```

### Modifications dans `RankingsKPIs.tsx`

1. **Supprimer les gradients/couleurs par carte** : retirer `gradient`, `borderColor`, `shadowColor` des configs kpi
2. **Style unifie** pour chaque Card :
   - `bg-bordure-cream/50 dark:bg-bordure-green/10`
   - `border-l-4 border-bordure-gold`
   - Pas de `border-2` multicolore
3. **Label** : `font-semibold uppercase tracking-wider text-sm text-bordure-green` (style Montserrat)
4. **Emoji** : taille reduite a `text-3xl` pour plus de finesse
5. **Zone manager** : `bg-white dark:bg-card border border-bordure-gold/30 rounded-lg` — plus subtil que le `border-2 border-bordure-gold shadow-md` actuel
6. **Hover** : `hover:shadow-md hover:border-bordure-gold` au lieu des shadow colorees

### Fichier modifie
- `src/components/rankings/RankingsKPIs.tsx` — refonte visuelle uniquement, logique inchangee

