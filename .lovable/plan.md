## Problème

La table `public._debug_standings_audit` est exposée via PostgREST sans RLS. N'importe qui (même anonyme) peut lire/écrire/supprimer ses lignes (manager_id, league_id, total_race_pts, saison_id).

C'est une table de debug interne — elle ne devrait pas être accessible publiquement.

## Solution proposée

Migration SQL en deux temps de sécurité :

1. **Activer RLS** sur `_debug_standings_audit`
2. **Créer une policy unique réservée aux superadmins** (lecture + écriture) via `is_superadmin()`
3. **Révoquer les droits** `anon` et `authenticated` au niveau GRANT pour que la table disparaisse de l'API PostgREST publique

```sql
ALTER TABLE public._debug_standings_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public._debug_standings_audit FROM anon, authenticated;

CREATE POLICY "superadmins_only_audit"
  ON public._debug_standings_audit
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
```

## Impact

- Aucun changement frontend nécessaire (table debug, pas utilisée par l'app cliente).
- Les éventuels jobs SQL/scripts internes qui peuplent cette table doivent tourner via `service_role` (qui bypass RLS) — ce qui est déjà le cas pour les edge functions admin.
- Élimine les findings `SUPA_rls_disabled_in_public` et `debug_audit_no_rls`.

## Alternative

Si la table n'est plus utilisée du tout, je peux aussi simplement la **DROP** (plus propre). Dis-moi si tu préfères cette option — sinon je pars sur "RLS + superadmin only".
