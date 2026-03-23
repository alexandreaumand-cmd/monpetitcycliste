

# Fix: Suppression bulk de startlist_entries échoue (foreign key)

## Explication de l'erreur

L'erreur `update or delete on table "startlist_entries" violates foreign key constraint "startlist_tracker_changes_startlist_entry_id_fkey"` signifie que quand vous supprimez des entrées de startlist, il existe des enregistrements liés dans la table `startlist_tracker_changes` qui référencent ces entrées. La suppression est bloquée car la contrainte de clé étrangère empêche de supprimer un parent tant que des enfants existent.

Le code dans `StartlistRidersManagement.tsx` (suppression individuelle) gère déjà ce cas en supprimant d'abord les `startlist_tracker_changes` liés. Mais le code de suppression bulk dans `StartlistEntriesTable.tsx` (ligne 123-126) ne le fait pas — il tente directement un `DELETE` sur `startlist_entries` sans nettoyer les dépendances.

## Solution

Modifier `handleBulkDelete` dans `StartlistEntriesTable.tsx` pour supprimer d'abord les `startlist_tracker_changes` liés avant de supprimer les `startlist_entries` :

```typescript
// 1. Supprimer les tracker changes liés
await supabase
  .from('startlist_tracker_changes')
  .delete()
  .in('startlist_entry_id', Array.from(selectedIds));

// 2. Puis supprimer les entries
await supabase
  .from('startlist_entries')
  .delete()
  .in('id', Array.from(selectedIds));
```

### Fichier modifié
- `src/components/admin/startlist-data/StartlistEntriesTable.tsx` — ajouter la suppression des tracker changes avant la suppression des entries dans `handleBulkDelete`

