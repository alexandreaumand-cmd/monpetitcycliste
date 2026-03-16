

## Plan : Sidebar desktop verte avec coin logo crème

### Concept

La sidebar devient **fond vert forêt** (`bg-secondary`) avec texte/icônes blancs. Le **header** (coin haut gauche avec le logo) reste sur fond **crème** (`bg-background`) pour conserver la lisibilité du logo vert "La Bordure".

### Changements dans `src/components/layout/AppSidebar.tsx`

1. **Header (logo)** : garder le fond crème actuel, supprimer `border-b`, ajouter une légère séparation via un filet or ou un simple espacement.

2. **SidebarContent** : ajouter `className="bg-secondary"` pour le fond vert.

3. **Sidebar root** : passer `className="bg-secondary border-r-0"` sur `<Sidebar>` pour colorer toute la sidebar en vert (le header override avec crème).

4. **Texte & icônes** : passer en blanc (`text-white`) pour les labels de navigation et les icônes. Le `SidebarGroupLabel` "Navigation" aussi en `text-white/60`.

5. **État actif** : remplacer `bg-accent text-accent-foreground` par `bg-white/15 text-white` pour un effet de surbrillance subtil sur fond vert.

6. **État hover** : `hover:bg-white/10 hover:text-white` via les classes du `SidebarMenuButton`.

7. **Logo header** : utiliser `logo-bordure.png` (vert sur crème) quand expanded, `logo-carre-sans-marque.png` quand collapsed — déjà en place.

### Fichier modifié

| Fichier | Changement |
|---|---|
| `src/components/layout/AppSidebar.tsx` | Classes CSS : fond vert, texte blanc, états actif/hover adaptés |

Aucune modification du composant `sidebar.tsx` ni d'autre fichier nécessaire — tout se fait via les classes Tailwind dans `AppSidebar`.

