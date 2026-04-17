

# Fix : Super-admin ne peut pas voir le détail d'une ligue dont il n'est pas membre

## Cause racine

La page `src/pages/admin/LeagueDetailPage.tsx` interroge directement les tables `leagues`, `league_members`, `league_invites`, `league_scopes` via le client Supabase (donc avec RLS appliqué). Or les policies SELECT actuelles n'incluent **aucun bypass super-admin** :

| Table | Policy SELECT actuelle |
|---|---|
| `leagues` | `visibility='public' OR is_league_member(id)` |
| `league_members` | `is_league_member(league_id)` |
| `league_invites` | `is_league_admin(league_id)` |
| `league_scopes` | `is_league_member(league_id)` |

À noter : `league_members` UPDATE/DELETE ont déjà le bypass `is_superadmin() OR ...`. C'est juste le SELECT (et lecture des autres tables) qui a été oublié.

Résultat : la requête `select * from leagues where id = ...` retourne 0 ligne pour un super-admin non membre → `Ligue introuvable`.

## Solution

Ajouter une policy PERMISSIVE supplémentaire `is_superadmin()` sur SELECT pour chacune des 4 tables (logique OR avec les policies existantes — pas de régression pour les membres).

### Migration SQL

```sql
CREATE POLICY "leagues_read_superadmin" ON public.leagues
  FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "league_members_read_superadmin" ON public.league_members
  FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "league_invites_read_superadmin" ON public.league_invites
  FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "league_scopes_read_superadmin" ON public.league_scopes
  FOR SELECT TO authenticated USING (public.is_superadmin());
```

Et étendre les UPDATE manquants (pour que le super-admin puisse aussi modifier nom/visibilité, paramètres et invitations) :

```sql
-- leagues UPDATE actuel = is_league_admin(id) → ajouter superadmin
DROP POLICY "leagues_update" ON public.leagues;
CREATE POLICY "leagues_update" ON public.leagues
  FOR UPDATE TO authenticated USING (public.is_superadmin() OR public.is_league_admin(id));

-- league_invites UPDATE
DROP POLICY "league_invites_update" ON public.league_invites;
CREATE POLICY "league_invites_update" ON public.league_invites
  FOR UPDATE TO authenticated USING (public.is_superadmin() OR public.is_league_admin(league_id));

-- league_invites INSERT/DELETE policies (currently restrictive false / null) — laisser les Edge Functions gérer
```

Le `LeagueAdminGuard` côté client autorise déjà `isSuperAdmin` → pas de changement frontend nécessaire.

## Fichiers modifiés
1. Migration SQL — ajout de 4 policies SELECT super-admin + extension de 2 policies UPDATE existantes

