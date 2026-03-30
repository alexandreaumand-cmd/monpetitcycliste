

## Sidebar: onglet actif en surbrillance dorée

### Probleme
L'onglet actif utilise `bg-white/15 text-white` — un fond blanc semi-transparent peu visible. Conformement au memory "desktop-sidebar-design", l'actif doit utiliser un fond doré avec texte sombre.

### Changement — `src/components/layout/AppSidebar.tsx`

Remplacer le style actif sur les 3 `NavLink` (nav items, admin ligue, super admin) :

**Avant :** `isActive ? "bg-white/15 text-white" : ""`

**Après :** `isActive ? "!bg-bordure-gold !text-secondary font-bold" : ""`

Le `!` (important) est nécessaire pour surcharger les classes de `SidebarMenuButton`. Cela donne un fond doré (#C8963A) avec texte vert foncé, cohérent avec l'identité La Bordure.

### Résultat
- Onglet actif : fond doré, texte vert foncé, gras
- Onglets inactifs : inchangés (texte blanc/80, hover blanc/10)

