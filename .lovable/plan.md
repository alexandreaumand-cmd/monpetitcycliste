
# Correction : Permettre aux admins de notifier tous les utilisateurs

## Problème identifié

Le frontend récupère les `user_ids` via RLS, mais la policy `push_subscriptions` limite chaque utilisateur à voir uniquement **sa propre subscription**. Résultat : quand Alex valide une startlist, il n'envoie des notifications qu'à lui-même.

**Logs prouvant le problème :**
```
Processing for 1 user(s), type: startlist_validated
Found 1 subscription(s)
Success for user 84e72276-2ec0-4ae1-8bd2-25026aa2fa97  <-- Seulement Alex
```

## Solution recommandée

Modifier le frontend pour ne plus envoyer de `user_ids` spécifiques, et laisser l'Edge Function (qui a accès au `service_role`) récupérer **toutes les subscriptions**.

### Fichier 1 : `src/components/admin/StartlistDetailView.tsx`

**Changement :** Ne plus fetch les subscriptions côté frontend. Passer un flag `broadcast: true` à l'Edge Function pour indiquer qu'elle doit notifier tous les utilisateurs.

```typescript
// AVANT (ne fonctionne pas à cause de RLS)
const { data: subscriptions } = await supabase
  .from('push_subscriptions')
  .select('user_id');

if (subscriptions && subscriptions.length > 0) {
  const userIds = [...new Set(subscriptions.map(s => s.user_id))];
  await supabase.functions.invoke('send-push-notification', {
    body: { user_ids: userIds, ... }
  });
}

// APRÈS (simple et fonctionne)
await supabase.functions.invoke('send-push-notification', {
  body: {
    broadcast: true,  // Nouveau flag
    title: '📋 Startlist validée',
    message: `La startlist de ${raceName} a été validée`,
    type: 'startlist_validated',
    metadata: { ... }
  }
});
```

### Fichier 2 : `supabase/functions/send-push-notification/index.ts`

**Changement :** Ajouter le support du mode `broadcast` qui récupère TOUTES les subscriptions.

```typescript
interface PushPayload {
  user_ids?: string[];  // Optionnel maintenant
  broadcast?: boolean;  // Nouveau
  title: string;
  message: string;
  type: string;
  metadata?: Record<string, unknown>;
}

// Dans le handler POST...
const { user_ids, broadcast, title, message, type, metadata } = payload;

// Validation modifiée
if (!broadcast && (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0)) {
  return error('Missing user_ids or broadcast flag');
}

// Fetch subscriptions
let query = supabase.from('push_subscriptions').select('...');

if (!broadcast) {
  query = query.in('user_id', user_ids);
}
// Si broadcast=true, on récupère TOUTES les subscriptions
```

## Comportement attendu après correction

1. Admin valide une startlist
2. Frontend appelle Edge Function avec `broadcast: true`
3. Edge Function (avec `service_role`) récupère TOUTES les subscriptions
4. Filtre par préférences (`startlists: true`)
5. Envoie la notification à Alex ET Ludo

## Impact

- Aucune modification de RLS nécessaire
- Sécurisé : le flag `broadcast` est traité côté serveur avec `service_role`
- Simplifie le code frontend (plus besoin de fetch les subscriptions)
