

## Problème

Le `NavLink` applique `bg-white/15 text-white` quand la route est active, mais ces styles sont sur le `<a>` intérieur et sont écrasés par les styles du `SidebarMenuButton` parent. La surbrillance n'est donc pas visible.

## Solution

Utiliser `useLocation` pour détecter manuellement la route active et appliquer des styles de surbrillance directement sur le `SidebarMenuButton`, avec un contraste plus fort.

### Changements dans `src/components/layout/AppSidebar.tsx`

1. Importer `useLocation` depuis `react-router-dom`
2. Récupérer `location.pathname` pour comparer avec chaque `item.href`
3. Appliquer conditionnellement sur le `SidebarMenuButton` un style plus visible quand l'item est actif :
   - Actif : `bg-white/20 text-white font-semibold border-l-2 border-white`
   - Inactif : `text-white/80 hover:bg-white/10 hover:text-white` (inchangé)
4. Même logique pour le lien Super Admin

