

## Supprimer le composant AdminMaintenance

Le composant `AdminMaintenance` lance automatiquement une tâche de maintenance (correction des points Porteur + recalcul) toutes les 24h quand un super-admin visite la page Résultats. Il provoque des flashs "Maintenance en cours" et des rechargements de page intempestifs.

La page d'administration dédiée (`MaintenanceStatus`) permet déjà de lancer manuellement cette maintenance quand nécessaire.

### Modifications

1. **Supprimer le fichier** `src/components/admin/AdminMaintenance.tsx`

2. **`src/pages/ResultsPage.mobile.tsx`** — Retirer l'import et l'utilisation de `<AdminMaintenance />`

3. **`src/pages/ResultsPage.desktop.tsx`** — Retirer l'import et l'utilisation de `<AdminMaintenance />`

Aucun autre fichier n'utilise ce composant. La maintenance reste accessible manuellement via la page admin (`MaintenanceStatus`).

