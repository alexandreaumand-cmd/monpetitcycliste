

## Fix : erreur générique lors de la jonction par code d'invitation

### Cause racine

Dans `JoinLeagueDialog.tsx`, ligne 106 : `if (error) throw error;`. Quand l'edge function retourne un code non-2xx (404, 410, etc.), le SDK Supabase met le message serveur dans `data.error` mais `error` contient seulement "Edge Function returned a non-2xx status code". Le `throw` perd donc le vrai message d'erreur, et le catch ne peut pas matcher les strings ("Invalid token", "revoked", etc.).

C'est le même problème documenté dans la mémoire projet : le client Supabase ne lève pas d'exception avec le message du body JSON.

### Solution

Remplacer la gestion d'erreur dans `handleJoinByCode` pour vérifier `data?.error` en priorité (comme c'est déjà fait dans `JoinLeaguePage.tsx`) :

```typescript
const { data, error } = await supabase.functions.invoke('leagues-join-by-token', {
  body: { token: inviteCode.trim() },
});

if (error || data?.error) {
  const serverMsg = data?.error || error?.message || '';
  if (serverMsg.includes('Invalid token')) {
    toast.error(t('errors.invalidCode'));
  } else if (serverMsg.includes('revoked')) {
    toast.error(t('errors.revokedInvite'));
  } else if (serverMsg.includes('expired')) {
    toast.error(t('errors.expiredInvite'));
  } else if (serverMsg.includes('limit reached')) {
    toast.error(t('errors.limitReached'));
  } else if (serverMsg.includes('MANAGER_NOT_FOUND')) {
    toast.error(t('errors.managerNotFound'));
  } else {
    toast.error(serverMsg || t('errors.joinError'));
  }
  return;
}

toast.success(t('join.successWithName', { name: data.league_name }));
```

Supprimer le `throw error` et le bloc `catch` pour les erreurs métier — les traiter directement via `data?.error`.

### Fichier impacté
- `src/components/leagues/JoinLeagueDialog.tsx` — réécriture de la gestion d'erreur dans `handleJoinByCode`

