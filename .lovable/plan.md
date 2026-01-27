

# Amélioration des onglets sur la page Classement

## Problème actuel

Les onglets "Managers", "Top Coureurs", "Chrono" et "Comparaison" utilisent le composant `ChipGroup` avec des `Badge` qui ressemblent à des boutons/pills plutôt qu'à de véritables onglets de navigation.

```text
Actuel (Badges arrondis style "pills") :
┌──────────┐ ┌─────────────┐ ┌────────┐ ┌─────────────┐
│ Managers │ │Top Coureurs │ │ Chrono │ │ Comparaison │
└──────────┘ └─────────────┘ └────────┘ └─────────────┘
```

---

## Solution proposée

Créer un nouveau composant `TabGroup` dédié aux onglets avec un style plus clair :
- Fond commun (barre d'onglets) pour regrouper visuellement
- Style plus "plat" sans bordures arrondies prononcées
- Indicateur visuel clair pour l'onglet actif (fond contrasté + bordure inférieure)

```text
Nouveau (Style onglets classique) :
┌─────────────────────────────────────────────────────┐
│ ▼Managers │ Top Coureurs │  Chrono  │ Comparaison  │
│ ═══════════                                         │
└─────────────────────────────────────────────────────┘
```

---

## Modifications

### 1. Créer un composant `TabGroup`

**Fichier** : `src/components/mobile/TabGroup.tsx`

Nouveau composant dédié aux onglets avec :
- Container avec fond `bg-muted` et coins arrondis
- Onglets avec coins moins arrondis (`rounded-md` au lieu de `rounded-full`)
- Onglet actif avec fond `bg-background`, ombre légère et bordure inférieure jaune
- Padding interne pour l'effet "barre d'onglets"

```tsx
interface TabGroupProps {
  items: Array<{
    label: string;
    value: string;
  }>;
  selected?: string;
  onSelect?: (value: string) => void;
  className?: string;
}

export const TabGroup = ({ items, selected, onSelect, className }: TabGroupProps) => {
  return (
    <div className={cn(
      "flex gap-1 p-1 bg-muted rounded-lg overflow-x-auto scrollbar-hide",
      className
    )}>
      {items.map((item) => {
        const isSelected = selected === item.value;
        
        return (
          <button
            key={item.value}
            className={cn(
              "flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "bg-background text-foreground shadow-sm border-b-2 border-[#FFD500]"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
            onClick={() => onSelect?.(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
```

### 2. Mettre à jour Rankings.mobile.tsx

**Fichier** : `src/pages/Rankings.mobile.tsx`

Remplacer `ChipGroup` par `TabGroup` pour les onglets principaux :

```tsx
// Import
import { TabGroup } from "@/components/mobile/TabGroup";

// Usage (lignes 317-321)
<TabGroup
  items={tabChips}
  selected={activeTab}
  onSelect={(value) => setActiveTab(value as TabView)}
/>
```

Supprimer les dégradés gauche/droite qui ne sont plus nécessaires avec le nouveau style.

---

## Comparaison visuelle

| Aspect | Avant (ChipGroup) | Après (TabGroup) |
|--------|-------------------|------------------|
| Forme | Badges arrondis (pills) | Rectangles avec coins doux |
| Container | Aucun fond commun | Fond `muted` qui regroupe |
| Actif | Fond jaune | Fond blanc + bordure inférieure jaune |
| Inactif | Bordure noire | Texte grisé, pas de bordure |
| Espacement | Gaps entre badges | Padding interne dans la barre |

---

## Fichiers impactés

| Fichier | Modification |
|---------|--------------|
| `src/components/mobile/TabGroup.tsx` | Nouveau composant |
| `src/pages/Rankings.mobile.tsx` | Remplacer ChipGroup par TabGroup |

