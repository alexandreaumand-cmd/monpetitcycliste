

## Ajouter un indicateur bonus activé/désactivé sur les cartes de ligue

### Problème
Aucune indication visuelle ne permet de savoir si les bonus sont activés ou non dans une ligue depuis la page d'accueil.

### Solution
Ajouter un `Badge` conditionnel dans la ligne 2 du `CardHeader` (à côté des badges game mode et saison), qui affiche :
- **Bonus activés** : icône `Star` + texte "Bonus" (style doré/accent)
- **Bonus désactivés** : icône `StarOff` + texte "Sans bonus" (style muted)

### Fichier impacté
- `src/components/dashboard/LeagueCard.tsx` — ajouter un badge après le badge saison (~ligne 118)

### Détail
```tsx
import { Star, StarOff } from "lucide-react";

// Après le badge saison (ligne ~118), ajouter :
<Badge 
  variant="outline" 
  className={`gap-1 text-xs shrink-0 font-inter ${
    league.bonuses_enabled 
      ? "text-amber-600 border-amber-300" 
      : "text-muted-foreground border-muted-foreground/30"
  }`}
>
  {league.bonuses_enabled ? <Star className="h-3 w-3" /> : <StarOff className="h-3 w-3" />}
  {league.bonuses_enabled ? "Bonus" : "Sans bonus"}
</Badge>
```

### Résultat attendu
- "Ligue Publique WT sans bonus" → badge gris "Sans bonus" avec icône `StarOff`
- Toutes les autres ligues → badge doré "Bonus" avec icône `Star`

