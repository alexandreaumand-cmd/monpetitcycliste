

## Afficher l'info "équipe confirmée" dans les mouvements startlist

### Problème
Quand un coureur est ajouté à une startlist et que son équipe est officiellement confirmée sur PCS (tick vert), cette info n'apparaît pas dans la vue des mouvements.

### Solution
Pour les mouvements de type "added", le champ `startlist_entry_id` pointe vers l'entrée dans `startlist_entries` qui contient `team_confirmed`. On peut joindre cette table pour récupérer l'info et afficher une icône CheckCircle2 verte (comme dans les autres vues startlist).

### Modifications

**1. `src/components/startlist/StartlistTrackerMovements.tsx`**
- Modifier la requête (ligne 72) pour inclure le join : `startlist_entries!startlist_tracker_changes_startlist_entry_id_fkey(team_confirmed)`
- Afficher une icône `CheckCircle2` verte à côté du nom du coureur quand `team_confirmed === true`
- Desktop : dans la cellule "Coureur" (TableCell)
- Mobile : à côté du nom dans le card

**2. `src/pages/TeamStartlistMovements.tsx`**
- Même logique : joindre `startlist_entries` via `startlist_entry_id` pour récupérer `team_confirmed`
- Afficher l'icône CheckCircle2 à côté du rider_name

### Rendu visuel
- Icône `CheckCircle2` h-3 w-3 text-green-600, placée juste avant le nom du coureur (cohérent avec les startlists existantes)
- Uniquement visible pour les ajouts dont l'équipe est confirmée

