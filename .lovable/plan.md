

## Sécuriser les enchères : vérification d'appartenance à la ligue

### Problème
L'Edge Function `auction-upsert-bid` ne vérifie pas que le manager est membre de la ligue. Avec le `SERVICE_ROLE_KEY`, les RLS sont bypassées. Résultat : n'importe quel utilisateur authentifié peut enchérir dans n'importe quelle ligue.

### Solution — 2 niveaux de protection

**1. Edge Function `auction-upsert-bid/index.ts`**
Ajouter après la résolution du `manager_id` (ligne ~65) une vérification `league_members` :

```typescript
// Check manager is a member of this league
const { data: membership } = await supabase
  .from('league_members')
  .select('id')
  .eq('league_id', league_id)
  .eq('user_id', user.id)
  .maybeSingle();

if (!membership) {
  return new Response(
    JSON.stringify({ error: 'Vous devez être membre de cette ligue pour enchérir' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**2. RLS policy sur `bids` (INSERT) — défense en profondeur**
Renforcer la policy existante pour vérifier l'appartenance :

```sql
DROP POLICY "Users can create their own bids" ON public.bids;
CREATE POLICY "Users can create their own bids" ON public.bids
FOR INSERT TO public
WITH CHECK (
  manager_id IN (SELECT id FROM managers WHERE user_id = auth.uid())
  AND is_league_member(league_id)
);
```

### Nettoyage des données TEST
Supprimer les bids orphelins d'Alex dans la ligue "test saison entière 3 managers" (déjà identifiés précédemment).

### Fichiers impactés
- `supabase/functions/auction-upsert-bid/index.ts` — ajout check membership
- 1 migration SQL — renforcement RLS sur `bids`

