

## Améliorer la visibilité de l'onglet actif dans la sidebar

### Problème
L'état actif utilise `bg-white/15 text-white` — un fond blanc à 15% d'opacité sur fond vert foncé, quasi invisible.

### Solution
Remplacer le style actif par un contraste fort : fond doré (`bg-bordure-gold`) avec texte foncé (`text-secondary font-bold`), plus un bord gauche accentué. Cela crée une surbrillance immédiatement identifiable.

### Changement — `src/components/layout/AppSidebar.tsx`

**Ligne 98-102** : Modifier les classes du `SidebarMenuButton` et du `NavLink` :

```tsx
<SidebarMenuButton asChild className="text-white/80 hover:bg-white/10 hover:text-white">
  <NavLink
    to={buildNavUrl(item.href)}
    className={({ isActive }) =>
      isActive 
        ? "bg-bordure-gold text-secondary font-bold rounded-md shadow-sm" 
        : ""
    }
  >
```

Appliquer le même changement aux liens Admin Ligue (ligne ~130) et Super Admin (ligne ~152).

### Résultat
- Onglet inactif : texte blanc semi-transparent sur fond vert (inchangé)
- Onglet actif : fond doré avec texte foncé — contraste fort et immédiat

