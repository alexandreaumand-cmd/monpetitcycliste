

## Plan : Réduire la hauteur du header desktop Dashboard

Le logo `h-16` (64px) et le padding `py-3` rendent le header trop imposant sur desktop (visible sur la capture).

### Changements dans `DashboardHomeHeader.tsx` (section desktop, ligne 77-84)

1. **Logo** : `h-16` → `h-10` (40px, aligné avec le screenshot de référence)
2. **Padding** : `py-3` → `py-2` pour resserrer verticalement

| Fichier | Changement |
|---|---|
| `src/components/dashboard/DashboardHomeHeader.tsx` | Logo `h-10`, padding `py-2` sur le header desktop |

