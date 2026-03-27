

## Ajouter le bypass superadmin dans `clore-round`

### Changement

Dans `supabase/functions/clore-round/index.ts`, après la vérification `is_league_admin` (ligne 60), ajouter un check `is_superadmin()` avant de rejeter l'accès. Si l'utilisateur est superadmin, on bypasse le contrôle league admin et on utilise un client service_role pour les opérations (car le superadmin n'est pas forcément membre de la ligue, donc les RLS bloqueraient).

### Modification (lignes 60-77)

```typescript
const { data: isLeagueAdmin } = await supabase.rpc('is_league_admin', { l_id: league_id });

if (!isLeagueAdmin) {
  // Check if user is superadmin
  const { data: isSuperAdmin } = await supabase.rpc('is_superadmin');
  
  if (isSuperAdmin) {
    console.log('🔑 Superadmin bypass: allowing round close for any league');
    // Switch to service role client so RLS doesn't block operations
    supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    );
  } else {
    const { data: membership } = await supabase
      .from('league_members')
      .select('role_in_league')
      .eq('league_id', league_id)
      .eq('user_id', user.id)
      .maybeSingle();

    const role = membership?.role_in_league as string | undefined;
    if (!role || !['owner', 'admin'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Accès refusé: réservé aux administrateurs de la ligue' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
}
```

### Fichier impacté
- `supabase/functions/clore-round/index.ts` — ajout check `is_superadmin` + switch vers service role client

