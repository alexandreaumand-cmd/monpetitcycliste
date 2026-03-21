

## Nettoyage automatique des notifications

### Constat
- **46 630** notifications en base
- **39 064** déjà lues (84%)
- **44 243** de plus de 90 jours (95%)

### Plan

**1. Migration : créer une fonction SQL de purge**

Créer une fonction `purge_old_notifications()` qui supprime :
- Les notifications **lues** (`is_read = true`) datant de plus de **7 jours**
- **Toutes** les notifications de plus de **90 jours** (lues ou non)

```sql
CREATE OR REPLACE FUNCTION public.purge_old_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted integer;
BEGIN
  DELETE FROM public.notifications
  WHERE (is_read = true AND created_at < now() - interval '7 days')
     OR (created_at < now() - interval '90 days');
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
```

**2. Cron job quotidien via `pg_cron` + `pg_net`**

Planifier un appel quotidien (3h du matin) à une edge function `cleanup-notifications` qui exécute la purge.

Alternativement, appel direct via `pg_cron` :
```sql
SELECT cron.schedule('purge-notifications', '0 3 * * *',
  $$ SELECT public.purge_old_notifications(); $$
);
```

**3. Purge initiale**

Exécuter une purge immédiate pour nettoyer les ~44k lignes existantes.

### Résumé des impacts

| Élément | Action |
|---------|--------|
| Migration SQL | Créer `purge_old_notifications()` |
| pg_cron | Job quotidien à 3h |
| Purge initiale | DELETE des anciennes lignes |
| Code front | Aucun changement |

### Règles de rétention
- Notification lue → supprimée après **7 jours**
- Notification non lue → supprimée après **90 jours**

