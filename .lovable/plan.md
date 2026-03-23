
Constat (cause probable de l’erreur en LIVE)

- Le code actuel de `StartlistEntriesTable.tsx` supprime bien d’abord `startlist_tracker_changes`, puis `startlist_entries` (donc le correctif est présent dans la base de code).
- En LIVE, la contrainte FK est toujours `ON DELETE NO ACTION` sur `startlist_tracker_changes.startlist_entry_id` → si la suppression enfant n’est pas effectivement exécutée (bundle ancien, cache PWA, ou course condition), la suppression parent échoue immédiatement avec l’erreur que vous voyez.
- Le symptôme (“même message FK”) indique que le runtime LIVE n’applique pas un delete enfant effectif au moment de l’action.

Plan de correction (robuste)

1) Vérifier la version réellement exécutée en LIVE
- Contrôler que la version publiée contient bien la logique actuelle de `handleBulkDelete`.
- Valider côté mobile/PWA (cache applicatif) avec un refresh forcé / rechargement propre pour éviter un ancien bundle.

2) Rendre la suppression infaillible côté base
- Migration SQL: passer la FK `startlist_tracker_changes_startlist_entry_id_fkey` en `ON DELETE CASCADE`.
- Résultat: même si un client appelle seulement la suppression de `startlist_entries`, les lignes liées dans `startlist_tracker_changes` seront supprimées automatiquement.

3) Simplifier et sécuriser le front
- Dans `StartlistEntriesTable.tsx`, conserver le delete explicite enfant (optionnel) mais considérer la cascade comme filet de sécurité.
- Améliorer le message d’erreur pour distinguer:
  - échec de permissions,
  - échec FK,
  - suppression partielle (0 ligne supprimée).

4) Validation LIVE
- Refaire le test exact (ex: Mercan’Tour, 5 entrées sélectionnées).
- Vérifier: plus d’erreur FK, compteur et liste se rafraîchissent, comportement identique desktop/mobile.

Détails techniques

- Fichiers ciblés:
  - `src/components/admin/startlist-data/StartlistEntriesTable.tsx` (UX erreurs + robustesse appel)
  - migration SQL (FK `startlist_tracker_changes_startlist_entry_id_fkey` en cascade)
- Aucun changement d’UI métier nécessaire, uniquement robustesse de suppression.
