

# Plan : Diagnostiquer et corriger la non-réception des notifications push

## Problème identifié

Les logs serveur montrent que la notification est **acceptée par FCM** (`sent: 1, Success`) mais elle n'arrive jamais sur ton appareil (mobile ou desktop).

## Causes probables (par ordre de probabilité)

### 1. Désynchronisation de la clé VAPID publique (cause la plus probable)

La clé VAPID publique doit être **identique** à 3 endroits :
- Dans le code frontend (`usePushNotifications.ts` ligne 6)
- Dans le secret Edge `VAPID_PUBLIC_KEY`
- Utilisée lors de la création de la subscription dans le navigateur

Si ces clés diffèrent, FCM accepte le message (status 201) mais ne peut pas le router vers le bon service worker → la notification est perdue silencieusement.

### 2. Subscription créée depuis une origin différente

Si tu t'es abonné depuis l'URL preview (`id-preview--...`) mais que tu testes depuis l'URL publiée (`monpetitcycliste.lovable.app`), la subscription ne sera pas valide pour l'autre origin.

### 3. Service Worker push non chargé

Le fichier `sw-push.js` est importé via `importScripts` dans le service worker Workbox. Si le SW n'est pas actif ou si l'événement `push` n'est jamais déclenché, rien ne s'affiche.

## Solution proposée

### Étape 1 : Forcer la re-synchronisation de l'abonnement

Modifier `usePushNotifications.ts` pour ajouter une fonction de "réinitialisation" qui :
1. Supprime l'ancienne subscription côté navigateur
2. Supprime l'entrée dans la base de données
3. Recrée une nouvelle subscription avec la clé VAPID actuelle

### Étape 2 : Ajouter un diagnostic visible dans l'UI

Dans `NotificationSettings.tsx`, afficher un petit bloc de debug (quand isSubscribed est true) montrant :
- L'endpoint tronqué de la subscription actuelle
- La permission actuelle (`Notification.permission`)
- L'état du service worker

Cela permet de vérifier que la subscription est bien active.

### Étape 3 : Améliorer le logging dans le service worker

Dans `sw-push.js`, ajouter des logs plus détaillés et un fallback si `event.data.json()` échoue (essayer `event.data.text()`).

### Étape 4 : Vérifier la cohérence des clés VAPID

Demander confirmation que la clé VAPID_PUBLIC_KEY dans les secrets Edge correspond exactement à celle dans le code frontend :
```
BCfsjfWS47JE_QBAn1vRb72fPsfHbg6DeGYx7M0zZLb8FDj9zG3Ezk24TP6kb_OhJ5EMLzClH1NbayZ2ehMsp7U
```

## Fichiers à modifier

1. **`src/hooks/usePushNotifications.ts`**
   - Ajouter une fonction `resetSubscription()` pour forcer une ré-inscription complète
   - Exposer des infos de debug (endpoint, état SW)

2. **`src/components/settings/NotificationSettings.tsx`**
   - Ajouter un bouton "Réinitialiser l'abonnement" qui appelle `resetSubscription()`
   - Afficher un bloc de debug avec l'endpoint tronqué et l'état du SW

3. **`public/sw-push.js`**
   - Améliorer le parsing du payload avec un fallback `text()`
   - Ajouter un log visible même en cas d'erreur

## Détails techniques

### Nouvelle fonction `resetSubscription()` dans usePushNotifications.ts

```typescript
const resetSubscription = useCallback(async (): Promise<boolean> => {
  setIsLoading(true);
  try {
    // 1. Unsubscribe from browser push
    const registration = await navigator.serviceWorker.ready;
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      await existingSub.unsubscribe();
    }

    // 2. Delete from database
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', session.user.id);
    }

    // 3. Re-subscribe with current VAPID key
    setIsSubscribed(false);
    return await subscribe();
  } catch (error) {
    console.error('Error resetting subscription:', error);
    return false;
  } finally {
    setIsLoading(false);
  }
}, [subscribe]);
```

### Bloc de debug dans NotificationSettings.tsx

```tsx
{isSubscribed && (
  <div className="text-xs text-muted-foreground bg-muted p-2 rounded mt-2">
    <p>Debug: Permission = {permission}</p>
    <p>Endpoint: {subscriptionEndpoint?.substring(0, 50)}...</p>
    <Button variant="ghost" size="sm" onClick={handleResetSubscription}>
      Réinitialiser l'abonnement
    </Button>
  </div>
)}
```

## Validation

Après implémentation :
1. Aller dans /dashboard/compte → Notifications
2. Cliquer sur "Réinitialiser l'abonnement"
3. Vérifier que le nouvel endpoint s'affiche
4. Cliquer sur "Envoyer une notification test"
5. La notification devrait apparaître sur ton appareil

## Risques

- La réinitialisation de l'abonnement est sans danger, elle recrée simplement la subscription avec les bonnes clés
- Le bloc de debug peut être masqué plus tard (derrière un toggle "Mode expert" par exemple)

