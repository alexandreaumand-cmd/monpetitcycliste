

## Surbrillance de l'onglet actif dans la sidebar

### Probleme
L'onglet actif utilise `bg-white/15` (15% d'opacite blanc) ce qui est tres subtil sur le fond vert fonce (`bg-secondary`). La surbrillance est quasi invisible.

### Solution
Renforcer le style actif dans `src/components/layout/AppSidebar.tsx` pour rendre l'onglet selectionne clairement visible :

- Remplacer `bg-white/15 text-white` par un style plus marque : `bg-white/20 text-white font-semibold` avec une bordure gauche doree (`border-l-2 border-bordure-gold`) pour un repere visuel fort
- Appliquer ce changement aux 3 endroits ou `NavLink` est utilise (nav items, admin ligue, super admin)
- Ajouter `rounded-md` pour un rendu propre

### Changement — 1 fichier

**`src/components/layout/AppSidebar.tsx`** — modifier les className des `NavLink` (lignes 101-103, 127-129, 153-155) :

```tsx
// Avant
isActive ? "bg-white/15 text-white" : ""

// Apres  
isActive ? "bg-white/20 text-white font-semibold border-l-2 border-bordure-gold rounded-md" : ""
```

